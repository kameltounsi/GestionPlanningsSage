package com.gestionplanning.action;

import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.ecr.*;
import com.gestionplanning.user.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import java.time.LocalDateTime;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;

class ActionDeletionAlertServiceTest {
    private final ActionDeletionAlertRepository alerts = mock(ActionDeletionAlertRepository.class);
    private final AccessControlService access = mock(AccessControlService.class);
    private final AppUserRepository users = mock(AppUserRepository.class);
    private final AccountMailService mail = mock(AccountMailService.class);
    private final ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    private final ActionDeletionAlertService service = new ActionDeletionAlertService(alerts, access, users, mail, events);

    @Test
    void capturesDeletedActionAndProjectLeadForDistinctAdministrators() {
        EcrRequest request = new EcrRequest(); request.setModificationNumber("MOD-42");
        EcrAction action = new EcrAction(); action.setRequest(request); action.setTitle("Essai sécurité");
        action.setStage(EcrStage.CUSTOMER_VALIDATION);
        AppUser admin = user("Admin", "admin@example.test");
        AppUser duplicate = user("Admin bis", " ADMIN@example.test ");
        AppUser otherAdmin = user("Autre admin", "other@example.test");
        AppUser lead = user("Chef projet", "lead@example.test");
        AppUser pilot = user("Pilote différent", "pilot@example.test");
        when(users.findAll()).thenReturn(Arrays.asList(lead, pilot));
        when(access.isProjectLeadForRequest(lead, request)).thenReturn(true);
        when(access.adminsFor()).thenReturn(Arrays.asList(admin, duplicate, otherAdmin));
        service.actionDeleted(action, admin);
        ArgumentCaptor<ActionDeletionAlert> captor = ArgumentCaptor.forClass(ActionDeletionAlert.class);
        verify(alerts, times(2)).save(captor.capture());
        ActionDeletionAlert alert = captor.getValue();
        assertEquals("MOD-42", alert.getRequestLabel());
        assertEquals("Chef projet", alert.getProjectLead());
        assertEquals(EcrStage.CUSTOMER_VALIDATION.getLabel(false), alert.getPhaseLabel());
        assertEquals("Admin", alert.getChangedBy());
        assertEquals("other@example.test", alert.getRecipientEmail());
        action.setTitle("Changed later");
        assertEquals("Essai sécurité", alert.getActionTitle());
        verify(events, times(2)).publishEvent(any(ActionDeletionAlertService.Created.class));
        verifyNoInteractions(mail);
    }

    @Test
    void retriesFailureWithoutResendingSuccessfulMail() {
        ActionDeletionAlert alert = new ActionDeletionAlert();
        when(alerts.findLockedById(1L)).thenReturn(Optional.of(alert));
        doThrow(new IllegalStateException("SMTP offline")).doNothing().when(mail).sendActionDeletedEmail(alert);
        service.deliverCreated(new ActionDeletionAlertService.Created(1L));
        assertNull(alert.getMailSentAt());
        alert.setMailAttemptedAt(LocalDateTime.now().minusMinutes(6));
        service.deliverCreated(new ActionDeletionAlertService.Created(1L));
        assertNotNull(alert.getMailSentAt());
        service.deliverCreated(new ActionDeletionAlertService.Created(1L));
        verify(mail, times(2)).sendActionDeletedEmail(alert);
    }

    private AppUser user(String name, String email) {
        AppUser user = new AppUser(); user.setFullName(name); user.setEmail(email); user.setEnabled(true); return user;
    }
}
