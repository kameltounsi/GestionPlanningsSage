package com.gestionplanning.ecr;

import com.fasterxml.jackson.annotation.JsonAutoDetect;

import java.time.LocalDateTime;

@JsonAutoDetect(fieldVisibility = JsonAutoDetect.Visibility.ANY)
public class PhaseValidationRequestDto {
    private Long id;
    private Long requestId;
    private EcrStage stage;
    private PhaseValidationStatus status;
    private String requestedBy;
    private LocalDateTime requestedAt;
    private String reviewedBy;
    private LocalDateTime reviewedAt;
    private String refusalReason;
    private String actionsToRevisit;
    private int validationRate;
    private int approvedActions;
    private int totalActions;

    public static PhaseValidationRequestDto from(PhaseValidationRequest validation) {
        if (validation == null) {
            return null;
        }
        PhaseValidationRequestDto dto = new PhaseValidationRequestDto();
        dto.id = validation.getId();
        dto.requestId = validation.getRequestId();
        dto.stage = validation.getStage();
        dto.status = validation.getStatus();
        dto.requestedBy = validation.getRequestedBy();
        dto.requestedAt = validation.getRequestedAt();
        dto.reviewedBy = validation.getReviewedBy();
        dto.reviewedAt = validation.getReviewedAt();
        dto.refusalReason = validation.getRefusalReason();
        dto.actionsToRevisit = validation.getActionsToRevisit();
        dto.validationRate = validation.getValidationRate();
        dto.approvedActions = validation.getApprovedActions();
        dto.totalActions = validation.getTotalActions();
        return dto;
    }

    public Long getId() { return id; }
    public Long getRequestId() { return requestId; }
    public EcrStage getStage() { return stage; }
    public PhaseValidationStatus getStatus() { return status; }
    public String getRequestedBy() { return requestedBy; }
    public LocalDateTime getRequestedAt() { return requestedAt; }
    public String getReviewedBy() { return reviewedBy; }
    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public String getRefusalReason() { return refusalReason; }
    public String getActionsToRevisit() { return actionsToRevisit; }
    public int getValidationRate() { return validationRate; }
    public int getApprovedActions() { return approvedActions; }
    public int getTotalActions() { return totalActions; }
}
