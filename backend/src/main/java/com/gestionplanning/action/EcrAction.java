package com.gestionplanning.action;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.gestionplanning.ecr.EcrRequest;
import com.gestionplanning.ecr.EcrStage;

import javax.persistence.*;
import javax.validation.constraints.NotBlank;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "ecr_action")
public class EcrAction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ecr_id", nullable = false)
    @JsonIgnore
    private EcrRequest request;

    @NotBlank
    @Column(nullable = false, length = 1000)
    private String title;

    @Column(length = 2000)
    private String description;

    @Column(length = 1000)
    private String topicRisk;

    @Column(length = 1000)
    private String responsible;

    @Column(length = 1000)
    private String validator;

    @Column(length = 1000)
    private String validatorRole;

    @Transient
    private String validatorDisplayName;

    private String criticality;

    @Column(length = 3000)
    private String expectedEvidence;

    @Column(length = 3000)
    private String evidence;

    private String evidenceFileName;
    private String evidenceContentType;
    private Long evidenceFileSize;
    @Column(length = 2000)
    private String evidenceFileUrl;
    private String evidencePublicId;
    private String evidenceResourceType;
    private boolean evidenceRequired;

    @OneToMany(mappedBy = "action", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("uploadedAt DESC, id DESC")
    private List<EcrActionAsset> assets = new ArrayList<>();

    @Column(length = 3000)
    private String proofDocument;
    private String proofDocumentFileName;
    private String proofDocumentContentType;
    private Long proofDocumentFileSize;
    @Column(length = 2000)
    private String proofDocumentFileUrl;
    private String proofDocumentPublicId;
    private String proofDocumentResourceType;

    @OneToMany(mappedBy = "action", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("uploadedAt DESC, id DESC")
    private List<EcrActionProofDocument> proofDocuments = new ArrayList<>();

    private boolean checked;
    private LocalDate deadline;
    private LocalDate date1;
    private LocalDate date2;
    private LocalDate date3;
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer workDurationDays;
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean durationOverridden;
    private Long dependsOnActionId;
    private String dependencyAnchor;
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean routineAction;
    private Integer recurrenceIntervalDays;
    private String routineSeriesId;
    private Integer routineOccurrenceIndex;

    @Enumerated(EnumType.STRING)
    private EcrStage stage = EcrStage.FEASIBILITY_VALIDATION;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ActionStatus status = ActionStatus.TODO;

    private LocalDate closedDate;
    private LocalDateTime finalizationDate;
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @Enumerated(EnumType.STRING)
    private ActionValidationStatus validationStatus;

    private LocalDateTime validationRequestedAt;
    private LocalDateTime validationReviewedAt;
    private String validationReviewedBy;
    @Column(length = 3000)
    private String validationRefusalReason;

    @Column(length = 2000)
    private String comment;

    @Column(length = 10000)
    private String dossierReview;

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
        return request == null ? null : request.getId();
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getTopicRisk() {
        return topicRisk;
    }

    public void setTopicRisk(String topicRisk) {
        this.topicRisk = topicRisk;
    }

    public String getResponsible() {
        return responsible;
    }

    public void setResponsible(String responsible) {
        this.responsible = responsible;
    }

    public String getValidator() {
        return validator;
    }

    public void setValidator(String validator) {
        this.validator = validator;
    }

    public String getValidatorRole() {
        return validatorRole;
    }

    public void setValidatorRole(String validatorRole) {
        this.validatorRole = validatorRole;
    }

    public String getValidatorDisplayName() {
        return validatorDisplayName == null || validatorDisplayName.trim().isEmpty() ? validator : validatorDisplayName;
    }

    public void setValidatorDisplayName(String validatorDisplayName) {
        this.validatorDisplayName = validatorDisplayName;
    }

    public String getCriticality() {
        return criticality;
    }

    public void setCriticality(String criticality) {
        this.criticality = criticality;
    }

    public String getExpectedEvidence() {
        return expectedEvidence;
    }

    public void setExpectedEvidence(String expectedEvidence) {
        this.expectedEvidence = expectedEvidence;
    }

    public String getEvidence() {
        return evidence;
    }

    public void setEvidence(String evidence) {
        this.evidence = evidence;
    }

    public String getEvidenceFileName() {
        return evidenceFileName;
    }

    public void setEvidenceFileName(String evidenceFileName) {
        this.evidenceFileName = evidenceFileName;
    }

    public String getEvidenceContentType() {
        return evidenceContentType;
    }

    public void setEvidenceContentType(String evidenceContentType) {
        this.evidenceContentType = evidenceContentType;
    }

    public Long getEvidenceFileSize() {
        return evidenceFileSize;
    }

    public void setEvidenceFileSize(Long evidenceFileSize) {
        this.evidenceFileSize = evidenceFileSize;
    }

    public String getEvidenceFileUrl() {
        return evidenceFileUrl;
    }

    public void setEvidenceFileUrl(String evidenceFileUrl) {
        this.evidenceFileUrl = evidenceFileUrl;
    }

    public String getEvidencePublicId() {
        return evidencePublicId;
    }

    public void setEvidencePublicId(String evidencePublicId) {
        this.evidencePublicId = evidencePublicId;
    }

    public String getEvidenceResourceType() {
        return evidenceResourceType;
    }

    public void setEvidenceResourceType(String evidenceResourceType) {
        this.evidenceResourceType = evidenceResourceType;
    }

    public boolean isEvidenceRequired() {
        return evidenceRequired;
    }

    public void setEvidenceRequired(boolean evidenceRequired) {
        this.evidenceRequired = evidenceRequired;
    }

    public List<EcrActionAsset> getAssets() {
        return assets;
    }

    public void setAssets(List<EcrActionAsset> assets) {
        this.assets = assets == null ? new ArrayList<>() : assets;
    }

    public String getProofDocument() {
        return proofDocument;
    }

    public void setProofDocument(String proofDocument) {
        this.proofDocument = proofDocument;
    }

    public String getProofDocumentFileName() {
        return proofDocumentFileName;
    }

    public void setProofDocumentFileName(String proofDocumentFileName) {
        this.proofDocumentFileName = proofDocumentFileName;
    }

    public String getProofDocumentContentType() {
        return proofDocumentContentType;
    }

    public void setProofDocumentContentType(String proofDocumentContentType) {
        this.proofDocumentContentType = proofDocumentContentType;
    }

    public Long getProofDocumentFileSize() {
        return proofDocumentFileSize;
    }

    public void setProofDocumentFileSize(Long proofDocumentFileSize) {
        this.proofDocumentFileSize = proofDocumentFileSize;
    }

    public String getProofDocumentFileUrl() {
        return proofDocumentFileUrl;
    }

    public void setProofDocumentFileUrl(String proofDocumentFileUrl) {
        this.proofDocumentFileUrl = proofDocumentFileUrl;
    }

    public String getProofDocumentPublicId() {
        return proofDocumentPublicId;
    }

    public void setProofDocumentPublicId(String proofDocumentPublicId) {
        this.proofDocumentPublicId = proofDocumentPublicId;
    }

    public String getProofDocumentResourceType() {
        return proofDocumentResourceType;
    }

    public void setProofDocumentResourceType(String proofDocumentResourceType) {
        this.proofDocumentResourceType = proofDocumentResourceType;
    }

    public List<EcrActionProofDocument> getProofDocuments() {
        return proofDocuments;
    }

    public void setProofDocuments(List<EcrActionProofDocument> proofDocuments) {
        this.proofDocuments = proofDocuments == null ? new ArrayList<>() : proofDocuments;
    }

    public boolean isChecked() {
        return checked;
    }

    public void setChecked(boolean checked) {
        this.checked = checked;
    }

    public LocalDate getDeadline() {
        return deadline;
    }

    public void setDeadline(LocalDate deadline) {
        this.deadline = deadline;
    }

    public LocalDate getDate1() {
        return date1;
    }

    public void setDate1(LocalDate date1) {
        this.date1 = date1;
    }

    public LocalDate getDate2() {
        return date2;
    }

    public void setDate2(LocalDate date2) {
        this.date2 = date2;
    }

    public LocalDate getDate3() {
        return date3;
    }

    public void setDate3(LocalDate date3) {
        this.date3 = date3;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }

    public Integer getWorkDurationDays() {
        return workDurationDays;
    }

    public void setWorkDurationDays(Integer workDurationDays) {
        this.workDurationDays = workDurationDays;
    }

    public boolean isDurationOverridden() {
        return durationOverridden;
    }

    public void setDurationOverridden(boolean durationOverridden) {
        this.durationOverridden = durationOverridden;
    }

    public Long getDependsOnActionId() {
        return dependsOnActionId;
    }

    public void setDependsOnActionId(Long dependsOnActionId) {
        this.dependsOnActionId = dependsOnActionId;
    }

    public String getDependencyAnchor() {
        return dependencyAnchor;
    }

    public void setDependencyAnchor(String dependencyAnchor) {
        this.dependencyAnchor = dependencyAnchor;
    }

    public boolean isRoutineAction() {
        return routineAction;
    }

    public void setRoutineAction(boolean routineAction) {
        this.routineAction = routineAction;
    }

    public Integer getRecurrenceIntervalDays() {
        return recurrenceIntervalDays;
    }

    public void setRecurrenceIntervalDays(Integer recurrenceIntervalDays) {
        this.recurrenceIntervalDays = recurrenceIntervalDays;
    }

    public String getRoutineSeriesId() {
        return routineSeriesId;
    }

    public void setRoutineSeriesId(String routineSeriesId) {
        this.routineSeriesId = routineSeriesId;
    }

    public Integer getRoutineOccurrenceIndex() {
        return routineOccurrenceIndex;
    }

    public void setRoutineOccurrenceIndex(Integer routineOccurrenceIndex) {
        this.routineOccurrenceIndex = routineOccurrenceIndex;
    }

    public EcrStage getStage() {
        return stage == null ? EcrStage.FEASIBILITY_VALIDATION : stage;
    }

    public void setStage(EcrStage stage) {
        this.stage = stage == null ? EcrStage.FEASIBILITY_VALIDATION : stage;
    }

    public ActionStatus getStatus() {
        return status;
    }

    public void setStatus(ActionStatus status) {
        this.status = status;
    }

    public LocalDate getClosedDate() {
        return closedDate;
    }

    public void setClosedDate(LocalDate closedDate) {
        this.closedDate = closedDate;
    }

    public LocalDateTime getFinalizationDate() {
        return finalizationDate;
    }

    public void setFinalizationDate(LocalDateTime finalizationDate) {
        this.finalizationDate = finalizationDate;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public ActionValidationStatus getValidationStatus() {
        return validationStatus;
    }

    public void setValidationStatus(ActionValidationStatus validationStatus) {
        this.validationStatus = validationStatus;
    }

    public LocalDateTime getValidationRequestedAt() {
        return validationRequestedAt;
    }

    public void setValidationRequestedAt(LocalDateTime validationRequestedAt) {
        this.validationRequestedAt = validationRequestedAt;
    }

    public LocalDateTime getValidationReviewedAt() {
        return validationReviewedAt;
    }

    public void setValidationReviewedAt(LocalDateTime validationReviewedAt) {
        this.validationReviewedAt = validationReviewedAt;
    }

    public String getValidationReviewedBy() {
        return validationReviewedBy;
    }

    public void setValidationReviewedBy(String validationReviewedBy) {
        this.validationReviewedBy = validationReviewedBy;
    }

    public String getValidationRefusalReason() {
        return validationRefusalReason;
    }

    public void setValidationRefusalReason(String validationRefusalReason) {
        this.validationRefusalReason = validationRefusalReason;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public String getDossierReview() {
        return dossierReview;
    }

    public void setDossierReview(String dossierReview) {
        this.dossierReview = dossierReview;
    }

    public boolean isLate() {
        return deadline != null && deadline.isBefore(LocalDate.now()) && status != ActionStatus.DONE && status != ActionStatus.DONE_LATE;
    }

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
