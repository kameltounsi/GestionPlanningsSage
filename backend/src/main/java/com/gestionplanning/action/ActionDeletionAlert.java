package com.gestionplanning.action;

import javax.persistence.*;

import java.time.LocalDateTime;

/** Durable mail snapshot, independent of subsequent action edits or deletion. */
@Entity
public class ActionDeletionAlert {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String recipientEmail;
    private String requestLabel;
    @Column(length = 2000)
    private String actionTitle;
    private String changedBy;
    private String phaseLabel;
    private String projectLead;
    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime mailSentAt;
    private LocalDateTime mailAttemptedAt = LocalDateTime.now().minusHours(1);

    public Long getId() { return id; }
    public String getRecipientEmail() { return recipientEmail; }
    public void setRecipientEmail(String value) { recipientEmail = value; }
    public String getRequestLabel() { return requestLabel; }
    public void setRequestLabel(String value) { requestLabel = value; }
    public String getActionTitle() { return actionTitle; }
    public void setActionTitle(String value) { actionTitle = value; }
    public String getChangedBy() { return changedBy; }
    public void setChangedBy(String value) { changedBy = value; }
    public String getPhaseLabel() { return phaseLabel; }
    public void setPhaseLabel(String value) { phaseLabel = value; }
    public String getProjectLead() { return projectLead; }
    public void setProjectLead(String value) { projectLead = value; }
    public LocalDateTime getMailSentAt() { return mailSentAt; }
    public void setMailSentAt(LocalDateTime value) { mailSentAt = value; }
    public LocalDateTime getMailAttemptedAt() { return mailAttemptedAt; }
    public void setMailAttemptedAt(LocalDateTime value) { mailAttemptedAt = value; }
}
