package com.gestionplanning.action;

import com.gestionplanning.ecr.EcrRequest;
import com.gestionplanning.ecr.EcrStage;
import com.gestionplanning.user.AccountMailService;
import com.gestionplanning.user.AppUser;
import com.gestionplanning.user.AppUserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.time.LocalDate;
import java.util.Collections;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ActivePhaseDeadlineTest {
    private final EcrActionRepository actions = mock(EcrActionRepository.class);
    private final ActionDeadlineAlertRepository alerts = mock(ActionDeadlineAlertRepository.class);
    private final AppUserRepository users = mock(AppUserRepository.class);
    private final AccountMailService mail = mock(AccountMailService.class);
    private final ActionDeadlineAlertService service = new ActionDeadlineAlertService(actions, alerts, users, mail);
    private final ActionPlanningService planning = new ActionPlanningService(actions, null, null, null);

    private EcrAction overdueAction(EcrStage currentStage) {
        EcrRequest request = new EcrRequest();
        request.setCurrentStage(currentStage);
        EcrAction action = new EcrAction();
        action.setRequest(request);
        action.setStage(EcrStage.PROJECT_MANAGEMENT);
        action.setStatus(ActionStatus.LATE);
        action.setStartDate(LocalDate.now().minusDays(5));
        action.setEndDate(LocalDate.now().minusDays(1));
        action.setDeadline(action.getEndDate());
        return action;
    }

    @ParameterizedTest
    @EnumSource(EcrStage.class)
    void onlyCurrentActivePhaseCanBeLate(EcrStage currentStage) {
        EcrAction action = overdueAction(currentStage);
        boolean active = currentStage == action.getStage();
        assertEquals(active, action.isLate());
        assertEquals(active, EcrActionDto.fromDashboardItem(action).getStatus() == ActionStatus.LATE);
        planning.refreshActionStatus(action);
        assertEquals(active, action.getStatus() == ActionStatus.LATE);
        assertEquals(active, EcrActionDto.fromDashboardItem(action).isLate());
    }

    @Test
    void archivedClosedCancelledAndCompletedActionsAreExcluded() {
        EcrAction action = overdueAction(EcrStage.PROJECT_MANAGEMENT);
        action.getRequest().setArchived(true);
        assertFalse(action.isLate());
        action.getRequest().setArchived(false);
        action.getRequest().setClosureStatus(true);
        assertFalse(action.isLate());
        action.getRequest().setClosureStatus(false);
        action.getRequest().setCancelledStatus(true);
        assertFalse(action.isLate());
        action.getRequest().setCancelledStatus(false);
        action.setChecked(true);
        assertFalse(action.isLate());
        action.setChecked(false);
        action.setStatus(ActionStatus.CANCELLED);
        assertFalse(action.isLate());
        action.setStatus(ActionStatus.DONE_LATE);
        assertFalse(action.isLate());
        planning.refreshActionStatus(action);
        assertTrue(action.isChecked());
    }

    @ParameterizedTest
    @EnumSource(EcrStage.class)
    void escalationMailRequiresCurrentActivePhase(EcrStage currentStage) {
        EcrAction action = overdueAction(currentStage);
        action.setResponsible("pilot@example.test");
        AppUser pilot = new AppUser();
        pilot.setEmail("pilot@example.test");
        pilot.setEnabled(true);
        when(actions.findByRequest_ArchivedFalseAndEndDateBetweenAndStatusNotInOrderByEndDateAscIdAsc(any(), any(), anyList()))
                .thenReturn(Collections.singletonList(action));
        when(users.findAll()).thenReturn(Collections.singletonList(pilot));
        when(alerts.findByAction_IdAndRecipientEmailAndAlertType(isNull(), anyString(), any()))
                .thenReturn(Optional.empty());
        when(alerts.save(any(ActionDeadlineAlert.class))).thenAnswer(invocation -> invocation.getArgument(0));
        service.generateDueAlerts();
        if (currentStage == action.getStage()) {
            verify(mail).sendActionDeadlineEmail(eq(action.getRequest()), eq(action), eq(pilot), anyList(), eq("J+1"), anyString(), eq(true));
        } else {
            verifyNoInteractions(mail, alerts, users);
        }
    }

    @Test
    void dueTodayIsNotLateAndDeadlineIsFallback() {
        EcrAction action = overdueAction(EcrStage.PROJECT_MANAGEMENT);
        action.setEndDate(LocalDate.now());
        assertFalse(action.isLate());
        planning.refreshActionStatus(action);
        assertNotEquals(ActionStatus.LATE, action.getStatus());
        action.setEndDate(null);
        assertTrue(action.isLate());
        planning.refreshActionStatus(action);
        assertEquals(ActionStatus.LATE, action.getStatus());
    }

    @Test
    void closingPhaseDismissesPreviouslyPendingSoundAlert() {
        EcrAction action = overdueAction(EcrStage.PRODUCT_DEVELOPMENT);
        ActionDeadlineAlert alert = new ActionDeadlineAlert();
        alert.setAction(action);
        AppUser pilot = new AppUser();
        pilot.setEmail("pilot@example.test");
        when(alerts.findByRecipientEmailAndSoundAcknowledgedAtIsNullOrderByCreatedAtAscIdAsc(pilot.getEmail()))
                .thenReturn(Collections.singletonList(alert));
        assertTrue(service.pendingSoundAlertsFor(pilot).isEmpty());
        assertNotNull(alert.getSoundAcknowledgedAt());
        verifyNoInteractions(mail);
    }
}
