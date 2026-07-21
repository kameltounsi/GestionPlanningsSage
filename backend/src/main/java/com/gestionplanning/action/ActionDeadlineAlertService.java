package com.gestionplanning.action;

import com.gestionplanning.ecr.EcrRequest;
import com.gestionplanning.user.AccountMailService;
import com.gestionplanning.user.AppUser;
import com.gestionplanning.user.AppUserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class ActionDeadlineAlertService {
    private static final Logger LOGGER = LoggerFactory.getLogger(ActionDeadlineAlertService.class);
    private static final List<ActionStatus> DONE_STATUSES = Arrays.asList(ActionStatus.DONE, ActionStatus.DONE_LATE);

    private final EcrActionRepository actionRepository;
    private final ActionDeadlineAlertRepository alertRepository;
    private final AppUserRepository userRepository;
    private final AccountMailService mailService;

    public ActionDeadlineAlertService(EcrActionRepository actionRepository,
                                      ActionDeadlineAlertRepository alertRepository,
                                      AppUserRepository userRepository,
                                      AccountMailService mailService) {
        this.actionRepository = actionRepository;
        this.alertRepository = alertRepository;
        this.userRepository = userRepository;
        this.mailService = mailService;
    }

    @Scheduled(fixedDelayString = "${app.action-deadline-alert.scan-delay-ms:300000}",
            initialDelayString = "${app.action-deadline-alert.initial-delay-ms:30000}")
    @Transactional
    public void scheduledScan() {
        generateDueAlertsInternal();
    }

    @Transactional
    public void generateDueAlerts() {
        generateDueAlertsInternal();
    }

    private void generateDueAlertsInternal() {
        LocalDate today = LocalDate.now(ZoneId.systemDefault());
        List<EcrAction> actions = actionRepository.findByRequest_ArchivedFalseAndEndDateBetweenAndStatusNotInOrderByEndDateAscIdAsc(today.minusDays(2), today.plusDays(2), DONE_STATUSES);
        for (EcrAction action : actions) {
            generateDueAlertFor(action, today);
        }
    }

    private void generateDueAlertFor(EcrAction action, LocalDate today) {
        if (isDone(action) || action.getEndDate() == null || isArchived(action)) {
            return;
        }
        ActionDeadlineAlertType alertType = alertTypeFor(today, action.getEndDate());
        if (alertType == null) {
            return;
        }
        for (AppUser recipient : recipientsFor(action)) {
            ActionDeadlineAlert alert = alertRepository
                    .findByAction_IdAndRecipientEmailAndAlertType(action.getId(), normalizeEmail(recipient.getEmail()), alertType)
                    .orElseGet(() -> alertRepository.save(newAlert(action, recipient, alertType, today)));
            sendMailIfNeeded(alert, recipient);
        }
    }

    @Transactional
    public List<ActionDeadlineAlert> pendingSoundAlertsFor(AppUser user) {
        if (user == null || isBlank(user.getEmail())) {
            return new ArrayList<>();
        }
        generateDueAlertsInternal();
        LocalDateTime now = LocalDateTime.now(ZoneId.systemDefault());
        List<ActionDeadlineAlert> alerts = alertRepository.findByRecipientEmailAndSoundAcknowledgedAtIsNullOrderByCreatedAtAscIdAsc(normalizeEmail(user.getEmail()));
        List<ActionDeadlineAlert> activeAlerts = new ArrayList<>();
        for (ActionDeadlineAlert alert : alerts) {
            if (alert.getAction() != null && !isDone(alert.getAction()) && !isArchived(alert.getAction())) {
                activeAlerts.add(alert);
            } else {
                alert.setSoundAcknowledgedAt(now);
            }
        }
        alertRepository.saveAll(alerts);
        return activeAlerts;
    }

    @Transactional
    public void acknowledgeSoundAlerts(AppUser user, List<Long> ids) {
        if (user == null || isBlank(user.getEmail()) || ids == null || ids.isEmpty()) {
            return;
        }
        String email = normalizeEmail(user.getEmail());
        LocalDateTime now = LocalDateTime.now(ZoneId.systemDefault());
        List<ActionDeadlineAlert> alerts = alertRepository.findAllById(ids).stream()
                .filter(alert -> email.equals(normalizeEmail(alert.getRecipientEmail())))
                .collect(Collectors.toList());
        alerts.forEach(alert -> alert.setSoundAcknowledgedAt(now));
        alertRepository.saveAll(alerts);
    }

    private ActionDeadlineAlert newAlert(EcrAction action, AppUser recipient, ActionDeadlineAlertType alertType, LocalDate today) {
        EcrRequest request = action.getRequest();
        ActionDeadlineAlert alert = new ActionDeadlineAlert();
        alert.setAction(action);
        alert.setRecipientEmail(normalizeEmail(recipient.getEmail()));
        alert.setRecipientName(displayName(recipient));
        alert.setAlertType(alertType);
        alert.setAlertDate(today);
        alert.setActionEndDate(action.getEndDate());
        alert.setActionTitle(action.getTitle());
        alert.setActionResponsible(action.getResponsible());
        alert.setRequestLabel(requestLabel(request));
        alert.setPhaseLabel(action.getStage() == null ? "-" : action.getStage().getLabel(request.isNewVersion()));
        alert.setCreatedAt(LocalDateTime.now(ZoneId.systemDefault()));
        return alert;
    }

    private void sendMailIfNeeded(ActionDeadlineAlert alert, AppUser recipient) {
        if (alert.getMailSentAt() != null || isArchived(alert.getAction()) || recipient == null) {
            return;
        }
        LocalDateTime now = LocalDateTime.now(ZoneId.systemDefault());
        if (alert.getMailAttemptedAt() != null && alert.getMailAttemptedAt().isAfter(now.minusMinutes(30))) {
            return;
        }
        alert.setMailAttemptedAt(now);
        try {
            List<AppUser> escalationCc = escalationCcFor(alert.getAction(), alert.getAlertType(), recipient);
            boolean escalationAlert = isEscalationAlert(alert.getAlertType());
            mailService.sendActionDeadlineEmail(alert.getAction().getRequest(), alert.getAction(), recipient, escalationCc, timingLabel(alert.getAlertType()), timingMessage(alert.getAlertType()), escalationAlert);
            alert.setMailSentAt(now);
            alert.setMailError(null);
            alertRepository.save(alert);
        } catch (RuntimeException exception) {
            LOGGER.error("Unable to send action deadline alert {} to {}", alert.getAlertType(), recipient.getEmail(), exception);
            alert.setMailError(rootMessage(exception));
            alertRepository.save(alert);
        }
    }

    private List<AppUser> recipientsFor(EcrAction action) {
        Map<String, AppUser> recipients = new LinkedHashMap<>();
        findUser(action.getResponsible()).ifPresent(user -> recipients.put(normalizeEmail(user.getEmail()), user));
        return recipients.values().stream()
                .filter(user -> !isBlank(user.getEmail()))
                .collect(Collectors.toList());
    }

    private List<AppUser> escalationCcFor(EcrAction action, ActionDeadlineAlertType alertType, AppUser recipient) {
        if (action == null || alertType == null) {
            return Collections.emptyList();
        }
        Optional<AppUser> actionPilot = findUser(action.getResponsible());
        if (!actionPilot.isPresent()) {
            return Collections.emptyList();
        }
        Map<String, AppUser> cc = new LinkedHashMap<>();
        if (alertType == ActionDeadlineAlertType.J_PLUS_1 || alertType == ActionDeadlineAlertType.J_PLUS_2) {
            findUser(actionPilot.get().getChef1()).ifPresent(user -> cc.put(normalizeEmail(user.getEmail()), user));
        }
        if (alertType == ActionDeadlineAlertType.J_PLUS_2) {
            Optional<AppUser> chef2 = findUser(actionPilot.get().getChef2());
            if (!chef2.isPresent()) {
                chef2 = findUser(actionPilot.get().getChef1()).flatMap(chef1 -> findUser(chef1.getChef1()));
            }
            chef2.ifPresent(user -> cc.put(normalizeEmail(user.getEmail()), user));
        }
        String recipientEmail = normalizeEmail(recipient == null ? null : recipient.getEmail());
        return cc.entrySet().stream()
                .filter(entry -> !isBlank(entry.getKey()))
                .filter(entry -> !entry.getKey().equals(recipientEmail))
                .map(Map.Entry::getValue)
                .collect(Collectors.toList());
    }

    private Optional<AppUser> findUser(String value) {
        String normalized = normalize(value);
        if (normalized.isEmpty()) {
            return Optional.empty();
        }
        return userRepository.findAll().stream()
                .filter(AppUser::isEnabled)
                .filter(user -> normalize(user.getFullName()).equals(normalized)
                        || normalize(user.getUsername()).equals(normalized)
                        || normalize(user.getEmail()).equals(normalized)
                        || normalize(user.getJobTitle()).equals(normalized)
                        || normalize(user.getRole()).equals(normalized))
                .findFirst();
    }

    private ActionDeadlineAlertType alertTypeFor(LocalDate today, LocalDate endDate) {
        long daysUntilEnd = ChronoUnit.DAYS.between(today, endDate);
        if (daysUntilEnd == 2) return ActionDeadlineAlertType.J_MINUS_2;
        if (daysUntilEnd == 1) return ActionDeadlineAlertType.J_MINUS_1;
        if (daysUntilEnd == 0) return ActionDeadlineAlertType.DUE_TODAY;
        if (daysUntilEnd == -1) return ActionDeadlineAlertType.J_PLUS_1;
        if (daysUntilEnd == -2) return ActionDeadlineAlertType.J_PLUS_2;
        return null;
    }

    private boolean isDone(EcrAction action) {
        return action.isChecked() || action.getStatus() == ActionStatus.DONE || action.getStatus() == ActionStatus.DONE_LATE;
    }

    private boolean isArchived(EcrAction action) {
        return action == null || action.getRequest() == null || action.getRequest().isArchived();
    }

    private boolean isEscalationAlert(ActionDeadlineAlertType type) {
        return type == ActionDeadlineAlertType.J_PLUS_1 || type == ActionDeadlineAlertType.J_PLUS_2;
    }

    private String timingLabel(ActionDeadlineAlertType type) {
        if (type == ActionDeadlineAlertType.J_MINUS_2) return "J-2";
        if (type == ActionDeadlineAlertType.J_MINUS_1) return "J-1";
        if (type == ActionDeadlineAlertType.DUE_TODAY) return "Jour J";
        if (type == ActionDeadlineAlertType.J_PLUS_1) return "J+1";
        if (type == ActionDeadlineAlertType.J_PLUS_2) return "J+2";
        return "Alerte";
    }

    private String timingMessage(ActionDeadlineAlertType type) {
        if (type == ActionDeadlineAlertType.J_PLUS_2) {
            return "La date de fin de l'action est expirée depuis 2 jours et l'action n'a toujours pas avancé.";
        }
        if (type == ActionDeadlineAlertType.J_PLUS_1) {
            return "La date de fin de l'action a été expirée et l'action n'est pas marquée terminée.";
        }
        return "La date de fin de l'action va expirer et l'action n'est pas encore marquée terminée.";
    }

    private String requestLabel(EcrRequest request) {
        if (request == null) {
            return "-";
        }
        if (!isBlank(request.getModificationNumber())) {
            return request.getModificationNumber();
        }
        if (!isBlank(request.getModificationProject())) {
            return request.getModificationProject();
        }
        return request.getId() == null ? "-" : "#" + request.getId();
    }

    private String displayName(AppUser user) {
        if (user == null) {
            return "";
        }
        if (!isBlank(user.getFullName())) return user.getFullName().trim();
        if (!isBlank(user.getUsername())) return user.getUsername().trim();
        return user.getEmail();
    }

    private String normalizeEmail(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .trim()
                .toLowerCase(Locale.ROOT)
                .replace("_", " ");
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String rootMessage(Throwable throwable) {
        Throwable current = throwable;
        while (current.getCause() != null) {
            current = current.getCause();
        }
        return current.getMessage() == null ? current.getClass().getSimpleName() : current.getMessage();
    }
}
