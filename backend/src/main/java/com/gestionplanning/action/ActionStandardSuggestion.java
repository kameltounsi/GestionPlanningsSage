package com.gestionplanning.action;

import com.gestionplanning.ecr.EcrStage;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.time.ZoneId;

@Entity
@Table(name = "action_standard_suggestion")
public class ActionStandardSuggestion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long actionId;
    private Long requestId;
    private String requestLabel;
    private boolean newProject;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EcrStage stage;

    @Column(nullable = false, length = 1000)
    private String actionTitle;

    @Column(length = 1000)
    private String topicRisk;
    @Column(length = 1000)
    private String responsible;
    @Column(length = 1000)
    private String validator;
    private String criticality;
    @Column(length = 3000)
    private String expectedEvidence;
    private boolean evidenceRequired;
    @Column(length = 3000)
    private String proofDocument;
    private String proofDocumentFileName;
    private String proofDocumentContentType;
    private Long proofDocumentFileSize;
    @Column(length = 2000)
    private String proofDocumentFileUrl;
    private String proofDocumentPublicId;
    private String proofDocumentResourceType;
    private String dependencyAnchor;
    private Integer durationDays;

    @Column(nullable = false, length = 1000)
    private String createdBy;
    private LocalDateTime createdAt = LocalDateTime.now(ZoneId.systemDefault());

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ActionStandardSuggestionStatus status = ActionStandardSuggestionStatus.PENDING;
    private String reviewedBy;
    private LocalDateTime reviewedAt;

    public Long getId() { return id; }
    public Long getActionId() { return actionId; }
    public void setActionId(Long actionId) { this.actionId = actionId; }
    public Long getRequestId() { return requestId; }
    public void setRequestId(Long requestId) { this.requestId = requestId; }
    public String getRequestLabel() { return requestLabel; }
    public void setRequestLabel(String requestLabel) { this.requestLabel = requestLabel; }
    public boolean isNewProject() { return newProject; }
    public void setNewProject(boolean newProject) { this.newProject = newProject; }
    public EcrStage getStage() { return stage; }
    public void setStage(EcrStage stage) { this.stage = stage; }
    public String getActionTitle() { return actionTitle; }
    public void setActionTitle(String actionTitle) { this.actionTitle = actionTitle; }
    public String getTopicRisk() { return topicRisk; }
    public void setTopicRisk(String topicRisk) { this.topicRisk = topicRisk; }
    public String getResponsible() { return responsible; }
    public void setResponsible(String responsible) { this.responsible = responsible; }
    public String getValidator() { return validator; }
    public void setValidator(String validator) { this.validator = validator; }
    public String getCriticality() { return criticality; }
    public void setCriticality(String criticality) { this.criticality = criticality; }
    public String getExpectedEvidence() { return expectedEvidence; }
    public void setExpectedEvidence(String expectedEvidence) { this.expectedEvidence = expectedEvidence; }
    public boolean isEvidenceRequired() { return evidenceRequired; }
    public void setEvidenceRequired(boolean evidenceRequired) { this.evidenceRequired = evidenceRequired; }
    public String getProofDocument() { return proofDocument; }
    public void setProofDocument(String proofDocument) { this.proofDocument = proofDocument; }
    public String getProofDocumentFileName() { return proofDocumentFileName; }
    public void setProofDocumentFileName(String proofDocumentFileName) { this.proofDocumentFileName = proofDocumentFileName; }
    public String getProofDocumentContentType() { return proofDocumentContentType; }
    public void setProofDocumentContentType(String proofDocumentContentType) { this.proofDocumentContentType = proofDocumentContentType; }
    public Long getProofDocumentFileSize() { return proofDocumentFileSize; }
    public void setProofDocumentFileSize(Long proofDocumentFileSize) { this.proofDocumentFileSize = proofDocumentFileSize; }
    public String getProofDocumentFileUrl() { return proofDocumentFileUrl; }
    public void setProofDocumentFileUrl(String proofDocumentFileUrl) { this.proofDocumentFileUrl = proofDocumentFileUrl; }
    public String getProofDocumentPublicId() { return proofDocumentPublicId; }
    public void setProofDocumentPublicId(String proofDocumentPublicId) { this.proofDocumentPublicId = proofDocumentPublicId; }
    public String getProofDocumentResourceType() { return proofDocumentResourceType; }
    public void setProofDocumentResourceType(String proofDocumentResourceType) { this.proofDocumentResourceType = proofDocumentResourceType; }
    public String getDependencyAnchor() { return dependencyAnchor; }
    public void setDependencyAnchor(String dependencyAnchor) { this.dependencyAnchor = dependencyAnchor; }
    public Integer getDurationDays() { return durationDays; }
    public void setDurationDays(Integer durationDays) { this.durationDays = durationDays; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public ActionStandardSuggestionStatus getStatus() { return status; }
    public void setStatus(ActionStandardSuggestionStatus status) { this.status = status; }
    public String getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(String reviewedBy) { this.reviewedBy = reviewedBy; }
    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }
}
