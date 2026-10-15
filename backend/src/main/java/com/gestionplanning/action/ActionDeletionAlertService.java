package com.gestionplanning.action;

import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.user.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.event.TransactionalEventListener;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ActionDeletionAlertService {
    private static final Logger LOGGER = LoggerFactory.getLogger(ActionDeletionAlertService.class);
    private final ActionDeletionAlertRepository alerts;
    private final AccessControlService access;
    private final AppUserRepository users;
    private final AccountMailService mail;
    private final ApplicationEventPublisher events;

    public ActionDeletionAlertService(ActionDeletionAlertRepository alerts, AccessControlService access,
            AppUserRepository users, AccountMailService mail, ApplicationEventPublisher events) {
        this.alerts = alerts;
        this.access = access;
        this.users = users;
        this.mail = mail;
        this.events = events;
    }

    /** Capture before deletion; the mail is delivered only after the deletion commits. */
    @Transactional
    public void actionDeleted(EcrAction action, AppUser actor) {
        if (action == null || action.getRequest() == null) return;
        String leads = users.findAll().stream().filter(AppUser::isEnabled)
                .filter(user -> access.isProjectLeadForRequest(user, action.getRequest()))
                .map(this::displayName).distinct().collect(Collectors.joining(", "));
        Set<String> recipients = new HashSet<>();
        for (AppUser admin : access.adminsFor()) {
            if (admin.getEmail() == null || admin.getEmail().trim().isEmpty()) continue;
            String email = admin.getEmail().trim().toLowerCase(Locale.ROOT);
            if (!recipients.add(email)) continue;
            ActionDeletionAlert alert = new ActionDeletionAlert();
            alert.setRecipientEmail(email);
            alert.setActionTitle(action.getTitle());
            alert.setRequestLabel(action.getRequest().getModificationNumber());
            alert.setPhaseLabel(action.getStage() == null ? "Non définie" : action.getStage().getLabel(action.getRequest().isNewVersion()));
            alert.setProjectLead(leads.isEmpty() ? "Non renseigné" : leads);
            alert.setChangedBy(displayName(actor));
            alerts.save(alert);
            events.publishEvent(new Created(alert.getId()));
        }
    }

    private String displayName(AppUser user) {
        if (user == null) return "Non renseigné";
        return user.getFullName() == null || user.getFullName().trim().isEmpty() ? user.getEmail() : user.getFullName();
    }

    @TransactionalEventListener
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void deliverCreated(Created event) {
        alerts.findLockedById(event.id).ifPresent(this::send);
    }

    @Scheduled(fixedDelay = 60000, initialDelay = 60000)
    @Transactional
    public void retryMail() {
        alerts.findTop50ByMailSentAtIsNullAndMailAttemptedAtBeforeOrderByCreatedAtAsc(LocalDateTime.now().minusMinutes(5))
                .forEach(alert -> alerts.findLockedById(alert.getId()).ifPresent(this::send));
    }

    private void send(ActionDeletionAlert alert) {
        if (alert.getMailSentAt() != null || alert.getMailAttemptedAt().isAfter(LocalDateTime.now().minusMinutes(5))) return;
        alert.setMailAttemptedAt(LocalDateTime.now());
        try {
            mail.sendActionDeletedEmail(alert);
            alert.setMailSentAt(LocalDateTime.now());
        } catch (RuntimeException exception) {
            LOGGER.error("Unable to send action deletion alert {}", alert.getId(), exception);
        }
        alerts.save(alert);
    }

    public static class Created {
        private final Long id;
        public Created(Long id) { this.id = id; }
    }
}
