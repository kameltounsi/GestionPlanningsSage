package com.gestionplanning.action;

import com.gestionplanning.ecr.EcrStage;

import javax.validation.constraints.NotBlank;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

public class EcrActionDto {
    private Long id;
    private Long requestId;
    @NotBlank
    private String title;
    private String description;
    private String topicRisk;
    private String responsible;
    private String validator;
    private String validatorRole;
    private String validatorDisplayName;
    private String criticality;
    private String expectedEvidence;
    private String evidence;
    private String evidenceFileName;
    private String evidenceContentType;
    private Long evidenceFileSize;
    private String evidenceFileUrl;
    private String evidencePublicId;
    private String evidenceResourceType;
    private boolean evidenceRequired;
    private List<EcrActionAssetDto> assets;
    private String proofDocument;
    private String proofDocumentFileName;
    private String proofDocumentContentType;
    private Long proofDocumentFileSize;
    private String proofDocumentFileUrl;
    private String proofDocumentPublicId;
    private String proofDocumentResourceType;
    private List<EcrActionProofDocumentDto> proofDocuments;
    private boolean checked;
    private LocalDate deadline;
    private LocalDate date1;
    private LocalDate date2;
    private LocalDate date3;
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer workDurationDays;
    private boolean durationOverridden;
    private Long dependsOnActionId;
    private String dependencyAnchor;
    private boolean routineAction;
    private Integer recurrenceIntervalDays;
    private String routineSeriesId;
    private Integer routineOccurrenceIndex;
    private EcrStage stage;
    private ActionStatus status;
    private LocalDate closedDate;
    private LocalDateTime finalizationDate;
    private LocalDateTime createdAt;
    private ActionValidationStatus validationStatus;
    private LocalDateTime validationRequestedAt;
    private LocalDateTime validationReviewedAt;
    private String validationReviewedBy;
    private String validationRefusalReason;
    private String comment;
    private String dossierReview;
    private boolean late;

    public static EcrActionDto from(EcrAction action) {
        if (action == null) {
            return null;
        }
        EcrActionDto dto = new EcrActionDto();
        dto.id = action.getId();
        dto.requestId = action.getRequestId();
        dto.title = action.getTitle();
        dto.description = action.getDescription();
        dto.topicRisk = action.getTopicRisk();
        dto.responsible = action.getResponsible();
        dto.validator = action.getValidator();
        dto.validatorRole = action.getValidatorRole();
        dto.validatorDisplayName = action.getValidatorDisplayName();
        dto.criticality = action.getCriticality();
        dto.expectedEvidence = action.getExpectedEvidence();
        dto.evidence = action.getEvidence();
        dto.evidenceFileName = action.getEvidenceFileName();
        dto.evidenceContentType = action.getEvidenceContentType();
        dto.evidenceFileSize = action.getEvidenceFileSize();
        dto.evidenceFileUrl = action.getEvidenceFileUrl();
        dto.evidencePublicId = action.getEvidencePublicId();
        dto.evidenceResourceType = action.getEvidenceResourceType();
        dto.evidenceRequired = action.isEvidenceRequired();
        dto.assets = action.getAssets() == null ? null : action.getAssets().stream().map(EcrActionAssetDto::from).collect(Collectors.toList());
        dto.proofDocument = action.getProofDocument();
        dto.proofDocumentFileName = action.getProofDocumentFileName();
        dto.proofDocumentContentType = action.getProofDocumentContentType();
        dto.proofDocumentFileSize = action.getProofDocumentFileSize();
        dto.proofDocumentFileUrl = action.getProofDocumentFileUrl();
        dto.proofDocumentPublicId = action.getProofDocumentPublicId();
        dto.proofDocumentResourceType = action.getProofDocumentResourceType();
        dto.proofDocuments = action.getProofDocuments() == null ? null : action.getProofDocuments().stream().map(EcrActionProofDocumentDto::from).collect(Collectors.toList());
        dto.checked = action.isChecked();
        dto.deadline = action.getDeadline();
        dto.date1 = action.getDate1();
        dto.date2 = action.getDate2();
        dto.date3 = action.getDate3();
        dto.startDate = action.getStartDate();
        dto.endDate = action.getEndDate();
        dto.workDurationDays = action.getWorkDurationDays();
        dto.durationOverridden = action.isDurationOverridden();
        dto.dependsOnActionId = action.getDependsOnActionId();
        dto.dependencyAnchor = action.getDependencyAnchor();
        dto.routineAction = action.isRoutineAction();
        dto.recurrenceIntervalDays = action.getRecurrenceIntervalDays();
        dto.routineSeriesId = action.getRoutineSeriesId();
        dto.routineOccurrenceIndex = action.getRoutineOccurrenceIndex();
        dto.stage = action.getStage();
        dto.status = action.getStatus();
        dto.closedDate = action.getClosedDate();
        dto.finalizationDate = action.getFinalizationDate();
        dto.createdAt = action.getCreatedAt();
        dto.validationStatus = action.getValidationStatus();
        dto.validationRequestedAt = action.getValidationRequestedAt();
        dto.validationReviewedAt = action.getValidationReviewedAt();
        dto.validationReviewedBy = action.getValidationReviewedBy();
        dto.validationRefusalReason = action.getValidationRefusalReason();
        dto.comment = action.getComment();
        dto.dossierReview = action.getDossierReview();
        dto.late = action.isLate();
        return dto;
    }

    public EcrAction toEntity() {
        EcrAction action = new EcrAction();
        action.setTitle(title);
        action.setDescription(description);
        action.setTopicRisk(topicRisk);
        action.setResponsible(responsible);
        action.setValidator(validator);
        action.setValidatorRole(validatorRole);
        action.setValidatorDisplayName(validatorDisplayName);
        action.setCriticality(criticality);
        action.setExpectedEvidence(expectedEvidence);
        action.setEvidence(evidence);
        action.setEvidenceFileName(evidenceFileName);
        action.setEvidenceContentType(evidenceContentType);
        action.setEvidenceFileSize(evidenceFileSize);
        action.setEvidenceFileUrl(evidenceFileUrl);
        action.setEvidencePublicId(evidencePublicId);
        action.setEvidenceResourceType(evidenceResourceType);
        action.setEvidenceRequired(evidenceRequired);
        action.setProofDocument(proofDocument);
        action.setProofDocumentFileName(proofDocumentFileName);
        action.setProofDocumentContentType(proofDocumentContentType);
        action.setProofDocumentFileSize(proofDocumentFileSize);
        action.setProofDocumentFileUrl(proofDocumentFileUrl);
        action.setProofDocumentPublicId(proofDocumentPublicId);
        action.setProofDocumentResourceType(proofDocumentResourceType);
        action.setChecked(checked);
        action.setDeadline(deadline);
        action.setDate1(date1);
        action.setDate2(date2);
        action.setDate3(date3);
        action.setStartDate(startDate);
        action.setEndDate(endDate);
        action.setWorkDurationDays(workDurationDays);
        action.setDurationOverridden(durationOverridden);
        action.setDependsOnActionId(dependsOnActionId);
        action.setDependencyAnchor(dependencyAnchor);
        action.setRoutineAction(routineAction);
        action.setRecurrenceIntervalDays(recurrenceIntervalDays);
        action.setRoutineSeriesId(routineSeriesId);
        action.setRoutineOccurrenceIndex(routineOccurrenceIndex);
        action.setStage(stage);
        action.setStatus(status);
        action.setClosedDate(closedDate);
        action.setFinalizationDate(finalizationDate);
        action.setValidationStatus(validationStatus);
        action.setValidationRequestedAt(validationRequestedAt);
        action.setValidationReviewedAt(validationReviewedAt);
        action.setValidationReviewedBy(validationReviewedBy);
        action.setValidationRefusalReason(validationRefusalReason);
        action.setComment(comment);
        action.setDossierReview(dossierReview);
        return action;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getRequestId() { return requestId; }
    public void setRequestId(Long requestId) { this.requestId = requestId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getTopicRisk() { return topicRisk; }
    public void setTopicRisk(String topicRisk) { this.topicRisk = topicRisk; }
    public String getResponsible() { return responsible; }
    public void setResponsible(String responsible) { this.responsible = responsible; }
    public String getValidator() { return validator; }
    public void setValidator(String validator) { this.validator = validator; }
    public String getValidatorRole() { return validatorRole; }
    public void setValidatorRole(String validatorRole) { this.validatorRole = validatorRole; }
    public String getValidatorDisplayName() { return validatorDisplayName; }
    public void setValidatorDisplayName(String validatorDisplayName) { this.validatorDisplayName = validatorDisplayName; }
    public String getCriticality() { return criticality; }
    public void setCriticality(String criticality) { this.criticality = criticality; }
    public String getExpectedEvidence() { return expectedEvidence; }
    public void setExpectedEvidence(String expectedEvidence) { this.expectedEvidence = expectedEvidence; }
    public String getEvidence() { return evidence; }
    public void setEvidence(String evidence) { this.evidence = evidence; }
    public String getEvidenceFileName() { return evidenceFileName; }
    public void setEvidenceFileName(String evidenceFileName) { this.evidenceFileName = evidenceFileName; }
    public String getEvidenceContentType() { return evidenceContentType; }
    public void setEvidenceContentType(String evidenceContentType) { this.evidenceContentType = evidenceContentType; }
    public Long getEvidenceFileSize() { return evidenceFileSize; }
    public void setEvidenceFileSize(Long evidenceFileSize) { this.evidenceFileSize = evidenceFileSize; }
    public String getEvidenceFileUrl() { return evidenceFileUrl; }
    public void setEvidenceFileUrl(String evidenceFileUrl) { this.evidenceFileUrl = evidenceFileUrl; }
    public String getEvidencePublicId() { return evidencePublicId; }
    public void setEvidencePublicId(String evidencePublicId) { this.evidencePublicId = evidencePublicId; }
    public String getEvidenceResourceType() { return evidenceResourceType; }
    public void setEvidenceResourceType(String evidenceResourceType) { this.evidenceResourceType = evidenceResourceType; }
    public boolean isEvidenceRequired() { return evidenceRequired; }
    public void setEvidenceRequired(boolean evidenceRequired) { this.evidenceRequired = evidenceRequired; }
    public List<EcrActionAssetDto> getAssets() { return assets; }
    public void setAssets(List<EcrActionAssetDto> assets) { this.assets = assets; }
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
    public List<EcrActionProofDocumentDto> getProofDocuments() { return proofDocuments; }
    public void setProofDocuments(List<EcrActionProofDocumentDto> proofDocuments) { this.proofDocuments = proofDocuments; }
    public boolean isChecked() { return checked; }
    public void setChecked(boolean checked) { this.checked = checked; }
    public LocalDate getDeadline() { return deadline; }
    public void setDeadline(LocalDate deadline) { this.deadline = deadline; }
    public LocalDate getDate1() { return date1; }
    public void setDate1(LocalDate date1) { this.date1 = date1; }
    public LocalDate getDate2() { return date2; }
    public void setDate2(LocalDate date2) { this.date2 = date2; }
    public LocalDate getDate3() { return date3; }
    public void setDate3(LocalDate date3) { this.date3 = date3; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public Integer getWorkDurationDays() { return workDurationDays; }
    public void setWorkDurationDays(Integer workDurationDays) { this.workDurationDays = workDurationDays; }
    public boolean isDurationOverridden() { return durationOverridden; }
    public void setDurationOverridden(boolean durationOverridden) { this.durationOverridden = durationOverridden; }
    public Long getDependsOnActionId() { return dependsOnActionId; }
    public void setDependsOnActionId(Long dependsOnActionId) { this.dependsOnActionId = dependsOnActionId; }
    public String getDependencyAnchor() { return dependencyAnchor; }
    public void setDependencyAnchor(String dependencyAnchor) { this.dependencyAnchor = dependencyAnchor; }
    public boolean isRoutineAction() { return routineAction; }
    public void setRoutineAction(boolean routineAction) { this.routineAction = routineAction; }
    public Integer getRecurrenceIntervalDays() { return recurrenceIntervalDays; }
    public void setRecurrenceIntervalDays(Integer recurrenceIntervalDays) { this.recurrenceIntervalDays = recurrenceIntervalDays; }
    public String getRoutineSeriesId() { return routineSeriesId; }
    public void setRoutineSeriesId(String routineSeriesId) { this.routineSeriesId = routineSeriesId; }
    public Integer getRoutineOccurrenceIndex() { return routineOccurrenceIndex; }
    public void setRoutineOccurrenceIndex(Integer routineOccurrenceIndex) { this.routineOccurrenceIndex = routineOccurrenceIndex; }
    public EcrStage getStage() { return stage; }
    public void setStage(EcrStage stage) { this.stage = stage; }
    public ActionStatus getStatus() { return status; }
    public void setStatus(ActionStatus status) { this.status = status; }
    public LocalDate getClosedDate() { return closedDate; }
    public void setClosedDate(LocalDate closedDate) { this.closedDate = closedDate; }
    public LocalDateTime getFinalizationDate() { return finalizationDate; }
    public void setFinalizationDate(LocalDateTime finalizationDate) { this.finalizationDate = finalizationDate; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public ActionValidationStatus getValidationStatus() { return validationStatus; }
    public void setValidationStatus(ActionValidationStatus validationStatus) { this.validationStatus = validationStatus; }
    public LocalDateTime getValidationRequestedAt() { return validationRequestedAt; }
    public void setValidationRequestedAt(LocalDateTime validationRequestedAt) { this.validationRequestedAt = validationRequestedAt; }
    public LocalDateTime getValidationReviewedAt() { return validationReviewedAt; }
    public void setValidationReviewedAt(LocalDateTime validationReviewedAt) { this.validationReviewedAt = validationReviewedAt; }
    public String getValidationReviewedBy() { return validationReviewedBy; }
    public void setValidationReviewedBy(String validationReviewedBy) { this.validationReviewedBy = validationReviewedBy; }
    public String getValidationRefusalReason() { return validationRefusalReason; }
    public void setValidationRefusalReason(String validationRefusalReason) { this.validationRefusalReason = validationRefusalReason; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
    public String getDossierReview() { return dossierReview; }
    public void setDossierReview(String dossierReview) { this.dossierReview = dossierReview; }
    public boolean isLate() { return late; }
    public void setLate(boolean late) { this.late = late; }
}
