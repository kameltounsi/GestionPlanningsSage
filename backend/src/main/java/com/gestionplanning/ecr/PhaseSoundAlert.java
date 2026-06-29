package com.gestionplanning.ecr;

import com.fasterxml.jackson.annotation.JsonIgnore;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.time.ZoneId;

@Entity
@Table(name = "phase_sound_alert")
public class PhaseSoundAlert {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "request_id", nullable = false)
    @JsonIgnore
    private EcrRequest request;

    @Column(name = "request_id", nullable = false, insertable = false, updatable = false)
    private Long requestId;

    @Column(name = "recipient_email", nullable = false)
    private String recipientEmail;

    private String recipientName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EcrStage approvedStage;

    @Enumerated(EnumType.STRING)
    private EcrStage openedStage;

    @Column(length = 1000)
    private String requestLabel;

    @Column(length = 1000)
    private String approvedPhaseLabel;

    @Column(length = 1000)
    private String openedPhaseLabel;

    private LocalDateTime createdAt = LocalDateTime.now(ZoneId.systemDefault());
    private LocalDateTime soundAcknowledgedAt;

    public Long getId() {
        return id;
    }

    public EcrRequest getRequest() {
        return request;
    }

    public void setRequest(EcrRequest request) {
        this.request = request;
    }

    public Long getRequestId() {
        return requestId;
    }

    public void setRequestId(Long requestId) {
        this.requestId = requestId;
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

    public EcrStage getApprovedStage() {
        return approvedStage;
    }

    public void setApprovedStage(EcrStage approvedStage) {
        this.approvedStage = approvedStage;
    }

    public EcrStage getOpenedStage() {
        return openedStage;
    }

    public void setOpenedStage(EcrStage openedStage) {
        this.openedStage = openedStage;
    }

    public String getRequestLabel() {
        return requestLabel;
    }

    public void setRequestLabel(String requestLabel) {
        this.requestLabel = requestLabel;
    }

    public String getApprovedPhaseLabel() {
        return approvedPhaseLabel;
    }

    public void setApprovedPhaseLabel(String approvedPhaseLabel) {
        this.approvedPhaseLabel = approvedPhaseLabel;
    }

    public String getOpenedPhaseLabel() {
        return openedPhaseLabel;
    }

    public void setOpenedPhaseLabel(String openedPhaseLabel) {
        this.openedPhaseLabel = openedPhaseLabel;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getSoundAcknowledgedAt() {
        return soundAcknowledgedAt;
    }

    public void setSoundAcknowledgedAt(LocalDateTime soundAcknowledgedAt) {
        this.soundAcknowledgedAt = soundAcknowledgedAt;
    }
}
