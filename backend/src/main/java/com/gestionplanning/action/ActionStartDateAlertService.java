package com.gestionplanning.action;

import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.ecr.EcrRequest;
import com.gestionplanning.user.AccountMailService;
import com.gestionplanning.user.AppUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.event.TransactionalEventListener;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class ActionStartDateAlertService {
    private static final Logger LOGGER = LoggerFactory.getLogger(ActionStartDateAlertService.class);
    private final EcrActionRepository actions;
    private final ActionStartDateAlertRepository alerts;
    private final AccessControlService access;
    private final AccountMailService mail;
    private final ApplicationEventPublisher events;

    public ActionStartDateAlertService(EcrActionRepository actions, ActionStartDateAlertRepository alerts,
            AccessControlService access, AccountMailService mail, ApplicationEventPublisher events) {
        this.actions = actions;
        this.alerts = alerts;
        this.access = access;
        this.mail = mail;
        this.events = events;
    }

    public Map<Long, LocalDate> snapshot(EcrRequest request) {
        Map<Long, LocalDate> dates = new HashMap<>();
        if (request != null) {
            actions.findByRequest_IdOrderByDeadlineAscIdAsc(request.getId()).stream()
                    .filter(this::unfinished).forEach(action -> dates.put(action.getId(), action.getStartDate()));
        }
        return dates;
    }

    @Transactional
    public void notifyChanges(EcrRequest request, Map<Long, LocalDate> previous, AppUser actor) {
        if (request == null || request.isArchived() || previous.isEmpty()) return;
        for (EcrAction action : actions.findByRequest_IdOrderByDeadlineAscIdAsc(request.getId())) {
            if (!unfinished(action) || !previous.containsKey(action.getId())
                    || Objects.equals(previous.get(action.getId()), action.getStartDate())) continue;
            access.validationRecipientFor(action).filter(user -> user.getEmail() != null && !user.getEmail().trim().isEmpty())
                    .ifPresent(recipient -> {
                        ActionStartDateAlert alert = new ActionStartDateAlert();
                        alert.setRecipientEmail(recipient.getEmail().trim().toLowerCase(Locale.ROOT));
                        alert.setRequestLabel(request.getModificationNumber());
                        alert.setActionTitle(action.getTitle());
                        alert.setChangedBy(actor == null ? "Recalcul du planning" :
                                actor.getFullName() == null ? actor.getEmail() : actor.getFullName());
                        alert.setPreviousDate(previous.get(action.getId()));
                        alert.setNewDate(action.getStartDate());
                        alerts.save(alert);
                        events.publishEvent(new Created(alert.getId()));
                    });
        }
    }

    private boolean unfinished(EcrAction action) {
        return !action.isChecked() && action.getStatus() != ActionStatus.DONE && action.getStatus() != ActionStatus.DONE_LATE;
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

    private void send(ActionStartDateAlert alert) {
        if (alert.getMailSentAt() != null || alert.getMailAttemptedAt().isAfter(LocalDateTime.now().minusMinutes(5))) return;
        alert.setMailAttemptedAt(LocalDateTime.now());
        try {
            mail.sendActionStartDateChangedEmail(alert);
            alert.setMailSentAt(LocalDateTime.now());
        } catch (RuntimeException exception) {
            LOGGER.error("Unable to send action start date alert {}", alert.getId(), exception);
        }
        alerts.save(alert);
    }

    public static class Created {
        private final Long id;
        public Created(Long id) { this.id = id; }
    }
}
