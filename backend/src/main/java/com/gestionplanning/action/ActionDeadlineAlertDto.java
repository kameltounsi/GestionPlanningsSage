package com.gestionplanning.action;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class ActionDeadlineAlertDto {
    private Long id;
    private String recipientEmail;
    private String recipientName;
    private ActionDeadlineAlertType alertType;
    private LocalDate alertDate;
    private LocalDate actionEndDate;
    private String actionTitle;
    private String actionResponsible;
    private String requestLabel;
    private String phaseLabel;
    private LocalDateTime createdAt;
    private LocalDateTime mailAttemptedAt;
    private LocalDateTime mailSentAt;
    private LocalDateTime soundAcknowledgedAt;
    private String mailError;

    public static ActionDeadlineAlertDto from(ActionDeadlineAlert alert) {
        ActionDeadlineAlertDto dto = new ActionDeadlineAlertDto();
        dto.id = alert.getId();
        dto.recipientEmail = alert.getRecipientEmail();
        dto.recipientName = alert.getRecipientName();
        dto.alertType = alert.getAlertType();
        dto.alertDate = alert.getAlertDate();
        dto.actionEndDate = alert.getActionEndDate();
        dto.actionTitle = alert.getActionTitle();
        dto.actionResponsible = alert.getActionResponsible();
        dto.requestLabel = alert.getRequestLabel();
        dto.phaseLabel = alert.getPhaseLabel();
        dto.createdAt = alert.getCreatedAt();
        dto.mailAttemptedAt = alert.getMailAttemptedAt();
        dto.mailSentAt = alert.getMailSentAt();
        dto.soundAcknowledgedAt = alert.getSoundAcknowledgedAt();
        dto.mailError = alert.getMailError();
        return dto;
    }

    public Long getId() { return id; }
    public String getRecipientEmail() { return recipientEmail; }
    public String getRecipientName() { return recipientName; }
    public ActionDeadlineAlertType getAlertType() { return alertType; }
    public LocalDate getAlertDate() { return alertDate; }
    public LocalDate getActionEndDate() { return actionEndDate; }
    public String getActionTitle() { return actionTitle; }
    public String getActionResponsible() { return actionResponsible; }
    public String getRequestLabel() { return requestLabel; }
    public String getPhaseLabel() { return phaseLabel; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getMailAttemptedAt() { return mailAttemptedAt; }
    public LocalDateTime getMailSentAt() { return mailSentAt; }
    public LocalDateTime getSoundAcknowledgedAt() { return soundAcknowledgedAt; }
    public String getMailError() { return mailError; }
}
