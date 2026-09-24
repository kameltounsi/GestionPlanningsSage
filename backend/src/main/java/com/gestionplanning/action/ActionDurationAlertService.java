package com.gestionplanning.action;

import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.realtime.RealtimeUpdateService;
import com.gestionplanning.user.AccountMailService;
import com.gestionplanning.user.AppUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionalEventListener;
import java.time.LocalDateTime;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Collections;

@Service
public class ActionDurationAlertService {
    private static final Logger LOGGER = LoggerFactory.getLogger(ActionDurationAlertService.class);
    private final ActionDurationAlertRepository repository;
    private final AccessControlService access;
    private final AccountMailService mail;
    private final ApplicationEventPublisher events;
    private final RealtimeUpdateService realtime;

    public ActionDurationAlertService(ActionDurationAlertRepository repository, AccessControlService access,
            AccountMailService mail, ApplicationEventPublisher events, RealtimeUpdateService realtime) {
        this.repository = repository;
        this.access = access;
        this.mail = mail;
        this.events = events;
        this.realtime = realtime;
    }

    @Transactional
    public void durationChanged(EcrAction action, Integer previousDays, AppUser actor) {
        if (action == null || action.getRequest() == null || actor == null
                || days(previousDays) == days(action.getWorkDurationDays()) || !isCritical(action)
                || !(access.isRequestPilot(actor, action.getRequest()) || access.isProjectLeadForRequest(actor, action.getRequest()))) return;
        access.validationRecipientFor(action).filter(user -> !email(user).isEmpty()).ifPresent(recipient -> {
            ActionDurationAlert alert = new ActionDurationAlert();
            alert.setActionId(action.getId());
            alert.setRequestId(action.getRequest().getId());
            alert.setRequestLabel(action.getRequest().getModificationNumber());
            alert.setActionTitle(action.getTitle());
            alert.setRecipientEmail(email(recipient));
            alert.setChangedBy(actor.getFullName() == null ? actor.getEmail() : actor.getFullName());
            alert.setPreviousDays(days(previousDays));
            alert.setNewDays(days(action.getWorkDurationDays()));
            repository.save(alert);
            events.publishEvent(new Created(alert.getId()));
        });
    }

    // Run only after the duration and durable alert have committed successfully.
    @TransactionalEventListener
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void deliverCreated(Created event) {
        realtime.publishPlanningUpdated("/api/action-duration-alerts");
        repository.findLockedById(event.id).ifPresent(this::sendMail);
    }

    @Scheduled(fixedDelay = 60000, initialDelay = 60000)
    @Transactional
    public void retryMail() {
        repository.findTop50ByMailSentAtIsNullAndMailAttemptedAtBeforeOrderByCreatedAtAsc(LocalDateTime.now().minusMinutes(5))
                .forEach(alert -> repository.findLockedById(alert.getId()).ifPresent(this::sendMail));
    }

    private void sendMail(ActionDurationAlert alert) {
        if (alert.getMailSentAt() != null || alert.getMailAttemptedAt().isAfter(LocalDateTime.now().minusMinutes(5))) return;
        alert.setMailAttemptedAt(LocalDateTime.now());
        try {
            mail.sendActionDurationChangedEmail(alert);
            alert.setMailSentAt(LocalDateTime.now());
        } catch (RuntimeException exception) {
            LOGGER.error("Unable to send critical action duration alert {}", alert.getId(), exception);
        }
        repository.save(alert);
    }

    @Transactional(readOnly = true)
    public List<ActionDurationAlert> pending(AppUser user) {
        return email(user).isEmpty() ? Collections.emptyList()
                : repository.findByRecipientEmailAndAcknowledgedAtIsNullOrderByCreatedAtAscIdAsc(email(user));
    }

    @Transactional
    public void acknowledge(AppUser user, List<Long> ids) {
        if (email(user).isEmpty() || ids == null || ids.isEmpty()) return;
        repository.findAllById(ids).stream().filter(alert -> email(user).equals(alert.getRecipientEmail()))
                .filter(alert -> alert.getAcknowledgedAt() == null)
                .forEach(alert -> { alert.setAcknowledgedAt(LocalDateTime.now()); repository.save(alert); });
    }

    private int days(Integer value) { return value == null ? 1 : Math.max(0, value); }
    private String email(AppUser user) { return user == null || user.getEmail() == null ? "" : user.getEmail().trim().toLowerCase(Locale.ROOT); }
    private boolean isCritical(EcrAction action) {
        String value = action.getCriticality() == null ? "" : Normalizer.normalize(action.getCriticality(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "").trim().toLowerCase(Locale.ROOT);
        return value.startsWith("1") || value.equals("critique") || value.equals("critical");
    }

    public static class Created {
        private final Long id;
        public Created(Long id) { this.id = id; }
    }
}
