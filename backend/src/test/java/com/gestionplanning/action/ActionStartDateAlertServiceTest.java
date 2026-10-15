package com.gestionplanning.action;

import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.ecr.EcrRequest;
import com.gestionplanning.user.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;

class ActionStartDateAlertServiceTest {
    private final EcrActionRepository actions = mock(EcrActionRepository.class);
    private final ActionStartDateAlertRepository alerts = mock(ActionStartDateAlertRepository.class);
    private final AccessControlService access = mock(AccessControlService.class);
    private final AccountMailService mail = mock(AccountMailService.class);
    private final ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    private final ActionStartDateAlertService service = new ActionStartDateAlertService(actions, alerts, access, mail, events);

    @Test
    void snapshotsManualAndCascadedChangesForEachValidatorAfterCommit() {
        EcrRequest request = new EcrRequest();
        org.springframework.test.util.ReflectionTestUtils.setField(request, "id", 1L);
        request.setModificationNumber("MOD-1");
        EcrAction direct = action(1L), dependent = action(2L), done = action(3L), unchanged = action(4L);
        done.setStatus(ActionStatus.DONE);
        when(actions.findByRequest_IdOrderByDeadlineAscIdAsc(1L)).thenReturn(Arrays.asList(direct, dependent, done, unchanged));
        AppUser first = new AppUser(); first.setEmail("first@example.test");
        AppUser second = new AppUser(); second.setEmail("second@example.test");
        when(access.validationRecipientFor(direct)).thenReturn(Optional.of(first));
        when(access.validationRecipientFor(dependent)).thenReturn(Optional.of(second));
        Map<Long, LocalDate> before = service.snapshot(request);
        direct.setStartDate(LocalDate.of(2026, 10, 20));
        dependent.setStartDate(LocalDate.of(2026, 10, 23));
        done.setStartDate(LocalDate.of(2026, 10, 24));
        AppUser admin = new AppUser(); admin.setFullName("Administrateur");
        service.notifyChanges(request, before, admin);
        ArgumentCaptor<ActionStartDateAlert> captor = ArgumentCaptor.forClass(ActionStartDateAlert.class);
        verify(alerts, times(2)).save(captor.capture());
        assertEquals("first@example.test", captor.getAllValues().get(0).getRecipientEmail());
        assertEquals("second@example.test", captor.getAllValues().get(1).getRecipientEmail());
        assertEquals(LocalDate.of(2026, 10, 15), captor.getValue().getPreviousDate());
        assertEquals(LocalDate.of(2026, 10, 23), captor.getValue().getNewDate());
        assertEquals("Administrateur", captor.getValue().getChangedBy());
        verify(events, times(2)).publishEvent(any(ActionStartDateAlertService.Created.class));
        verifyNoInteractions(mail);
    }

    @Test
    void unchangedDatesAndMissingValidatorDoNotNotify() {
        EcrRequest request = new EcrRequest(); org.springframework.test.util.ReflectionTestUtils.setField(request, "id", 1L);
        EcrAction action = action(1L);
        when(actions.findByRequest_IdOrderByDeadlineAscIdAsc(1L)).thenReturn(Collections.singletonList(action));
        Map<Long, LocalDate> before = service.snapshot(request);
        service.notifyChanges(request, before, new AppUser());
        action.setStartDate(LocalDate.of(2026, 10, 21));
        when(access.validationRecipientFor(action)).thenReturn(Optional.empty());
        service.notifyChanges(request, before, new AppUser());
        verifyNoInteractions(alerts, events, mail);
    }

    @Test
    void failedMailIsRetriedAndSuccessfulMailIsNotSentTwice() {
        ActionStartDateAlert alert = new ActionStartDateAlert();
        when(alerts.findLockedById(1L)).thenReturn(Optional.of(alert));
        doThrow(new IllegalStateException("SMTP unavailable")).doNothing().when(mail).sendActionStartDateChangedEmail(alert);
        service.deliverCreated(new ActionStartDateAlertService.Created(1L));
        assertNull(alert.getMailSentAt());
        alert.setMailAttemptedAt(LocalDateTime.now().minusMinutes(6));
        service.deliverCreated(new ActionStartDateAlertService.Created(1L));
        assertNotNull(alert.getMailSentAt());
        service.deliverCreated(new ActionStartDateAlertService.Created(1L));
        verify(mail, times(2)).sendActionStartDateChangedEmail(alert);
    }

    private EcrAction action(long id) {
        EcrAction action = new EcrAction(); org.springframework.test.util.ReflectionTestUtils.setField(action, "id", id); action.setTitle("Action " + id);
        action.setStartDate(LocalDate.of(2026, 10, 15)); return action;
    }
}
