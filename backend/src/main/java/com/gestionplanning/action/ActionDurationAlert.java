package com.gestionplanning.action;

import com.fasterxml.jackson.annotation.JsonIgnore;
import javax.persistence.*;
import java.time.LocalDateTime;

/** Immutable notification details survive subsequent edits to the action. */
@Entity
public class ActionDurationAlert {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long requestId;
    private Long actionId;
    @JsonIgnore
    private String recipientEmail;
    @Column(length = 2000)
    private String actionTitle;
    private String requestLabel;
    private String changedBy;
    private Integer previousDays;
    private Integer newDays;
    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime acknowledgedAt;
    @JsonIgnore
    private LocalDateTime mailSentAt;
    @JsonIgnore
    private LocalDateTime mailAttemptedAt = LocalDateTime.now().minusHours(1);

    public Long getId() { return id; }
    public Long getRequestId() { return requestId; }
    public void setRequestId(Long value) { requestId = value; }
    public Long getActionId() { return actionId; }
    public void setActionId(Long value) { actionId = value; }
    public String getRecipientEmail() { return recipientEmail; }
    public void setRecipientEmail(String value) { recipientEmail = value; }
    public String getActionTitle() { return actionTitle; }
    public void setActionTitle(String value) { actionTitle = value; }
    public String getRequestLabel() { return requestLabel; }
    public void setRequestLabel(String value) { requestLabel = value; }
    public String getChangedBy() { return changedBy; }
    public void setChangedBy(String value) { changedBy = value; }
    public Integer getPreviousDays() { return previousDays; }
    public void setPreviousDays(Integer value) { previousDays = value; }
    public Integer getNewDays() { return newDays; }
    public void setNewDays(Integer value) { newDays = value; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getAcknowledgedAt() { return acknowledgedAt; }
    public void setAcknowledgedAt(LocalDateTime value) { acknowledgedAt = value; }
    public LocalDateTime getMailSentAt() { return mailSentAt; }
    public void setMailSentAt(LocalDateTime value) { mailSentAt = value; }
    public LocalDateTime getMailAttemptedAt() { return mailAttemptedAt; }
    public void setMailAttemptedAt(LocalDateTime value) { mailAttemptedAt = value; }
}
