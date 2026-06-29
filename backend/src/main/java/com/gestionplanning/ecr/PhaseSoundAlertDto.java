package com.gestionplanning.ecr;

import java.time.LocalDateTime;

public class PhaseSoundAlertDto {
    private Long id;
    private Long requestId;
    private String recipientEmail;
    private String recipientName;
    private EcrStage approvedStage;
    private EcrStage openedStage;
    private String requestLabel;
    private String approvedPhaseLabel;
    private String openedPhaseLabel;
    private LocalDateTime createdAt;
    private LocalDateTime soundAcknowledgedAt;

    public static PhaseSoundAlertDto from(PhaseSoundAlert alert) {
        PhaseSoundAlertDto dto = new PhaseSoundAlertDto();
        dto.id = alert.getId();
        dto.requestId = alert.getRequestId();
        dto.recipientEmail = alert.getRecipientEmail();
        dto.recipientName = alert.getRecipientName();
        dto.approvedStage = alert.getApprovedStage();
        dto.openedStage = alert.getOpenedStage();
        dto.requestLabel = alert.getRequestLabel();
        dto.approvedPhaseLabel = alert.getApprovedPhaseLabel();
        dto.openedPhaseLabel = alert.getOpenedPhaseLabel();
        dto.createdAt = alert.getCreatedAt();
        dto.soundAcknowledgedAt = alert.getSoundAcknowledgedAt();
        return dto;
    }

    public Long getId() { return id; }
    public Long getRequestId() { return requestId; }
    public String getRecipientEmail() { return recipientEmail; }
    public String getRecipientName() { return recipientName; }
    public EcrStage getApprovedStage() { return approvedStage; }
    public EcrStage getOpenedStage() { return openedStage; }
    public String getRequestLabel() { return requestLabel; }
    public String getApprovedPhaseLabel() { return approvedPhaseLabel; }
    public String getOpenedPhaseLabel() { return openedPhaseLabel; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getSoundAcknowledgedAt() { return soundAcknowledgedAt; }
}
