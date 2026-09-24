package com.gestionplanning.action;

import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.ecr.EcrRequest;
import com.gestionplanning.realtime.RealtimeUpdateService;
import com.gestionplanning.user.AccountMailService;
import com.gestionplanning.user.AppUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import java.util.Arrays;
import java.util.Collections;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ActionDurationAlertServiceTest {
    private final ActionDurationAlertRepository repository = mock(ActionDurationAlertRepository.class);
    private final AccessControlService access = mock(AccessControlService.class);
    private final AccountMailService mail = mock(AccountMailService.class);
    private final ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    private final RealtimeUpdateService realtime = mock(RealtimeUpdateService.class);
    private final ActionDurationAlertService service = new ActionDurationAlertService(repository, access, mail, events, realtime);
    private final EcrAction action = new EcrAction();
    private final AppUser lead = new AppUser();
    private final AppUser validator = new AppUser();

    @BeforeEach
    void prepare() {
        EcrRequest request = new EcrRequest();
        request.setModificationNumber("MOD-42");
        action.setRequest(request);
        action.setTitle("Essai sécurité");
        action.setCriticality("1 - Critique");
        action.setWorkDurationDays(5);
        lead.setFullName("Chef projet");
        validator.setEmail(" Validateur@example.test ");
        when(access.isRequestPilot(lead, request)).thenReturn(true);
        when(access.validationRecipientFor(action)).thenReturn(Optional.of(validator));
    }

    @Test
    void criticalDurationChangeStoresSnapshotAndDefersDeliveryUntilCommit() {
        service.durationChanged(action, 3, lead);
        ArgumentCaptor<ActionDurationAlert> capture = ArgumentCaptor.forClass(ActionDurationAlert.class);
        verify(repository).save(capture.capture());
        ActionDurationAlert alert = capture.getValue();
        assertEquals("validateur@example.test", alert.getRecipientEmail());
        assertEquals(3, alert.getPreviousDays());
        assertEquals(5, alert.getNewDays());
        assertEquals("Chef projet", alert.getChangedBy());
        assertEquals("MOD-42", alert.getRequestLabel());
        action.setTitle("Changed later");
        assertEquals("Essai sécurité", alert.getActionTitle());
        verify(events).publishEvent(any(ActionDurationAlertService.Created.class));
        verifyNoInteractions(mail, realtime);
    }

    @Test
    void decreaseAlsoNotifies() {
        action.setWorkDurationDays(0);
        service.durationChanged(action, 5, lead);
        verify(repository).save(any(ActionDurationAlert.class));
    }

    @Test
    void unchangedEffectiveDurationDoesNotNotify() {
        service.durationChanged(action, 5, lead);
        action.setWorkDurationDays(1);
        service.durationChanged(action, null, lead);
        verifyNoInteractions(repository, events, mail);
    }

    @Test
    void nonCriticalActionDoesNotNotify() {
        action.setCriticality("2 - Non critique");
        service.durationChanged(action, 3, lead);
        verifyNoInteractions(repository, events, mail);
    }

    @Test
    void unrelatedActorDoesNotNotify() {
        service.durationChanged(action, 3, new AppUser());
        verifyNoInteractions(repository, events, mail);
    }

    @Test
    void projectLeadAndPlainCriticalLabelAreSupported() {
        when(access.isRequestPilot(lead, action.getRequest())).thenReturn(false);
        when(access.isProjectLeadForRequest(lead, action.getRequest())).thenReturn(true);
        action.setCriticality("Critique");
        service.durationChanged(action, 3, lead);
        verify(repository).save(any(ActionDurationAlert.class));
    }

    @Test
    void unresolvedValidatorDoesNotSendToUnrelatedUser() {
        when(access.validationRecipientFor(action)).thenReturn(Optional.empty());
        service.durationChanged(action, 3, lead);
        verifyNoInteractions(repository, events, mail);
    }

    @Test
    void committedAlertTriggersRealtimeAndMailOnlyOnce() {
        ActionDurationAlert alert = new ActionDurationAlert();
        when(repository.findLockedById(7L)).thenReturn(Optional.of(alert));
        service.deliverCreated(new ActionDurationAlertService.Created(7L));
        verify(realtime).publishPlanningUpdated("/api/action-duration-alerts");
        verify(mail).sendActionDurationChangedEmail(alert);
        assertNotNull(alert.getMailSentAt());
        service.deliverCreated(new ActionDurationAlertService.Created(7L));
        verify(mail, times(1)).sendActionDurationChangedEmail(alert);
        assertNull(alert.getAcknowledgedAt());
    }

    @Test
    void mailFailureKeepsNotificationPendingForRetry() {
        ActionDurationAlert alert = new ActionDurationAlert();
        when(repository.findLockedById(7L)).thenReturn(Optional.of(alert));
        doThrow(new IllegalStateException("SMTP offline")).when(mail).sendActionDurationChangedEmail(alert);
        assertDoesNotThrow(() -> service.deliverCreated(new ActionDurationAlertService.Created(7L)));
        assertNull(alert.getMailSentAt());
        assertNull(alert.getAcknowledgedAt());
        assertNotNull(alert.getMailAttemptedAt());
        verify(repository).save(alert);
    }

    @Test
    void onlyRecipientCanCloseAndOnlyRequestedAlertsAreClosed() {
        ActionDurationAlert own = new ActionDurationAlert();
        own.setRecipientEmail("validateur@example.test");
        ActionDurationAlert other = new ActionDurationAlert();
        other.setRecipientEmail("other@example.test");
        when(repository.findAllById(Arrays.asList(1L, 2L))).thenReturn(Arrays.asList(own, other));
        service.acknowledge(validator, Arrays.asList(1L, 2L));
        assertNotNull(own.getAcknowledgedAt());
        assertNull(other.getAcknowledgedAt());
        verify(repository).save(own);
        verify(repository, never()).save(other);
    }

    @Test
    void fetchingAlertsDoesNotAcknowledgeThem() {
        when(repository.findByRecipientEmailAndAcknowledgedAtIsNullOrderByCreatedAtAscIdAsc("validateur@example.test"))
                .thenReturn(Collections.singletonList(new ActionDurationAlert()));
        assertEquals(1, service.pending(validator).size());
        verify(repository, never()).save(any());
    }
}
