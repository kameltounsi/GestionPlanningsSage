package com.gestionplanning.action;

import com.gestionplanning.ecr.EcrStage;

import java.time.LocalDateTime;

public class ActionStandardSuggestionDto {
    private Long id;
    private Long actionId;
    private Long requestId;
    private String requestLabel;
    private boolean newProject;
    private EcrStage stage;
    private String actionTitle;
    private String topicRisk;
    private String responsible;
    private String validator;
    private String criticality;
    private String expectedEvidence;
    private boolean evidenceRequired;
    private String proofDocument;
    private String proofDocumentFileName;
    private String proofDocumentContentType;
    private Long proofDocumentFileSize;
    private String proofDocumentFileUrl;
    private String proofDocumentPublicId;
    private String proofDocumentResourceType;
    private String dependencyAnchor;
    private Integer durationDays;
    private String createdBy;
    private LocalDateTime createdAt;
    private ActionStandardSuggestionStatus status;
    private String reviewedBy;
    private LocalDateTime reviewedAt;

    public static ActionStandardSuggestionDto from(ActionStandardSuggestion suggestion) {
        ActionStandardSuggestionDto dto = new ActionStandardSuggestionDto();
        dto.id = suggestion.getId();
        dto.actionId = suggestion.getActionId();
        dto.requestId = suggestion.getRequestId();
        dto.requestLabel = suggestion.getRequestLabel();
        dto.newProject = suggestion.isNewProject();
        dto.stage = suggestion.getStage();
        dto.actionTitle = suggestion.getActionTitle();
        dto.topicRisk = suggestion.getTopicRisk();
        dto.responsible = suggestion.getResponsible();
        dto.validator = suggestion.getValidator();
        dto.criticality = suggestion.getCriticality();
        dto.expectedEvidence = suggestion.getExpectedEvidence();
        dto.evidenceRequired = suggestion.isEvidenceRequired();
        dto.proofDocument = suggestion.getProofDocument();
        dto.proofDocumentFileName = suggestion.getProofDocumentFileName();
        dto.proofDocumentContentType = suggestion.getProofDocumentContentType();
        dto.proofDocumentFileSize = suggestion.getProofDocumentFileSize();
        dto.proofDocumentFileUrl = suggestion.getProofDocumentFileUrl();
        dto.proofDocumentPublicId = suggestion.getProofDocumentPublicId();
        dto.proofDocumentResourceType = suggestion.getProofDocumentResourceType();
        dto.dependencyAnchor = suggestion.getDependencyAnchor();
        dto.durationDays = suggestion.getDurationDays();
        dto.createdBy = suggestion.getCreatedBy();
        dto.createdAt = suggestion.getCreatedAt();
        dto.status = suggestion.getStatus();
        dto.reviewedBy = suggestion.getReviewedBy();
        dto.reviewedAt = suggestion.getReviewedAt();
        return dto;
    }

    public Long getId() { return id; }
    public Long getActionId() { return actionId; }
    public Long getRequestId() { return requestId; }
    public String getRequestLabel() { return requestLabel; }
    public boolean isNewProject() { return newProject; }
    public EcrStage getStage() { return stage; }
    public String getActionTitle() { return actionTitle; }
    public String getTopicRisk() { return topicRisk; }
    public String getResponsible() { return responsible; }
    public String getValidator() { return validator; }
    public String getCriticality() { return criticality; }
    public String getExpectedEvidence() { return expectedEvidence; }
    public boolean isEvidenceRequired() { return evidenceRequired; }
    public String getProofDocument() { return proofDocument; }
    public String getProofDocumentFileName() { return proofDocumentFileName; }
    public String getProofDocumentContentType() { return proofDocumentContentType; }
    public Long getProofDocumentFileSize() { return proofDocumentFileSize; }
    public String getProofDocumentFileUrl() { return proofDocumentFileUrl; }
    public String getProofDocumentPublicId() { return proofDocumentPublicId; }
    public String getProofDocumentResourceType() { return proofDocumentResourceType; }
    public String getDependencyAnchor() { return dependencyAnchor; }
    public Integer getDurationDays() { return durationDays; }
    public String getCreatedBy() { return createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public ActionStandardSuggestionStatus getStatus() { return status; }
    public String getReviewedBy() { return reviewedBy; }
    public LocalDateTime getReviewedAt() { return reviewedAt; }
}
