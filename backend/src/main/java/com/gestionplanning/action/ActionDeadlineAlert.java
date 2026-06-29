package com.gestionplanning.action;

import com.fasterxml.jackson.annotation.JsonIgnore;

import javax.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

@Entity
@Table(name = "action_deadline_alert",
        uniqueConstraints = @UniqueConstraint(columnNames = {"action_id", "recipient_email", "alert_type"}))
public class ActionDeadlineAlert {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "action_id", nullable = false)
    @JsonIgnore
    private EcrAction action;

    @Column(name = "recipient_email", nullable = false)
    private String recipientEmail;

    private String recipientName;

    @Enumerated(EnumType.STRING)
    @Column(name = "alert_type", nullable = false)
    private ActionDeadlineAlertType alertType;

    private LocalDate alertDate;
    private LocalDate actionEndDate;

    @Column(length = 1000)
    private String actionTitle;

    @Column(length = 1000)
    private String actionResponsible;

    @Column(length = 1000)
    private String requestLabel;

    @Column(length = 1000)
    private String phaseLabel;

    private LocalDateTime createdAt = LocalDateTime.now(ZoneId.systemDefault());
    private LocalDateTime mailAttemptedAt;
    private LocalDateTime mailSentAt;
    private LocalDateTime soundAcknowledgedAt;

    @Column(length = 3000)
    private String mailError;

    public Long getId() {
        return id;
    }

    public EcrAction getAction() {
        return action;
    }

    public void setAction(EcrAction action) {
        this.action = action;
    }

    public String getRecipientEmail() {
        return recipientEmail;
    }

    public void setRecipientEmail(String recipientEmail) {
        this.recipientEmail = recipientEmail;
    }

    public String getRecipientName() {
        return recipientName;
    }

    public void setRecipientName(String recipientName) {
        this.recipientName = recipientName;
    }

    public ActionDeadlineAlertType getAlertType() {
        return alertType;
    }

    public void setAlertType(ActionDeadlineAlertType alertType) {
        this.alertType = alertType;
    }

    public LocalDate getAlertDate() {
        return alertDate;
    }

    public void setAlertDate(LocalDate alertDate) {
        this.alertDate = alertDate;
    }

    public LocalDate getActionEndDate() {
        return actionEndDate;
    }

    public void setActionEndDate(LocalDate actionEndDate) {
        this.actionEndDate = actionEndDate;
    }

    public String getActionTitle() {
        return actionTitle;
    }

    public void setActionTitle(String actionTitle) {
        this.actionTitle = actionTitle;
    }

    public String getActionResponsible() {
        return actionResponsible;
    }

    public void setActionResponsible(String actionResponsible) {
        this.actionResponsible = actionResponsible;
    }

    public String getRequestLabel() {
        return requestLabel;
    }

    public void setRequestLabel(String requestLabel) {
        this.requestLabel = requestLabel;
    }

    public String getPhaseLabel() {
        return phaseLabel;
    }

    public void setPhaseLabel(String phaseLabel) {
        this.phaseLabel = phaseLabel;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getMailSentAt() {
        return mailSentAt;
    }

    public LocalDateTime getMailAttemptedAt() {
        return mailAttemptedAt;
    }

    public void setMailAttemptedAt(LocalDateTime mailAttemptedAt) {
        this.mailAttemptedAt = mailAttemptedAt;
    }

    public void setMailSentAt(LocalDateTime mailSentAt) {
        this.mailSentAt = mailSentAt;
    }

    public LocalDateTime getSoundAcknowledgedAt() {
        return soundAcknowledgedAt;
    }

    public void setSoundAcknowledgedAt(LocalDateTime soundAcknowledgedAt) {
        this.soundAcknowledgedAt = soundAcknowledgedAt;
    }

    public String getMailError() {
        return mailError;
    }

    public void setMailError(String mailError) {
        this.mailError = mailError;
    }
}
