package com.gestionplanning.action;

import com.gestionplanning.ecr.EcrStage;

import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

public class ActionPlanningRuleDto {
    private Long id;
    private EcrStage stage;
    private boolean appliesToModification;
    private boolean appliesToNewProject;

    @NotBlank
    private String actionTitle;

    private String topicRisk;
    private String responsible;
    private String validator;
    private String criticality;
    private String expectedEvidence;
    private String proofDocument;
    private String proofDocumentFileName;
    private String proofDocumentContentType;
    private Long proofDocumentFileSize;
    private String proofDocumentFileUrl;
    private String proofDocumentPublicId;
    private String proofDocumentResourceType;
    private List<ActionPlanningRuleProofDocumentDto> proofDocuments = new ArrayList<>();
    private boolean evidenceRequired;
    private String dependencyActionTitle;
    private String dependencyAnchor;

    @Min(0)
    private Integer durationDays;

    private boolean routineAction;
    private Integer recurrenceIntervalDays;

    public static ActionPlanningRuleDto from(ActionPlanningRule rule) {
        ActionPlanningRuleDto dto = new ActionPlanningRuleDto();
        dto.id = rule.getId();
        dto.stage = rule.getStage();
        dto.appliesToModification = rule.isAppliesToModification();
        dto.appliesToNewProject = rule.isAppliesToNewProject();
        dto.actionTitle = rule.getActionTitle();
        dto.topicRisk = rule.getTopicRisk();
        dto.responsible = rule.getResponsible();
        dto.validator = rule.getValidator();
        dto.criticality = rule.getCriticality();
        dto.expectedEvidence = rule.getExpectedEvidence();
        dto.proofDocument = rule.getProofDocument();
        dto.proofDocumentFileName = rule.getProofDocumentFileName();
        dto.proofDocumentContentType = rule.getProofDocumentContentType();
        dto.proofDocumentFileSize = rule.getProofDocumentFileSize();
        dto.proofDocumentFileUrl = rule.getProofDocumentFileUrl();
        dto.proofDocumentPublicId = rule.getProofDocumentPublicId();
        dto.proofDocumentResourceType = rule.getProofDocumentResourceType();
        dto.proofDocuments = rule.getProofDocuments().stream().map(ActionPlanningRuleProofDocumentDto::from).collect(Collectors.toList());
        dto.evidenceRequired = rule.isEvidenceRequired();
        dto.dependencyActionTitle = rule.getDependencyActionTitle();
        dto.dependencyAnchor = rule.getDependencyAnchor();
        dto.durationDays = rule.getDurationDays();
        dto.routineAction = rule.isRoutineAction();
        dto.recurrenceIntervalDays = rule.getRecurrenceIntervalDays();
        return dto;
    }

    public Long getId() { return id; }
    public EcrStage getStage() { return stage; }
    public void setStage(EcrStage stage) { this.stage = stage; }
    public boolean isAppliesToModification() { return appliesToModification; }
    public void setAppliesToModification(boolean appliesToModification) { this.appliesToModification = appliesToModification; }
    public boolean isAppliesToNewProject() { return appliesToNewProject; }
    public void setAppliesToNewProject(boolean appliesToNewProject) { this.appliesToNewProject = appliesToNewProject; }
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
    public List<ActionPlanningRuleProofDocumentDto> getProofDocuments() { return proofDocuments; }
    public boolean isEvidenceRequired() { return evidenceRequired; }
    public void setEvidenceRequired(boolean evidenceRequired) { this.evidenceRequired = evidenceRequired; }
    public String getDependencyActionTitle() { return dependencyActionTitle; }
    public void setDependencyActionTitle(String dependencyActionTitle) { this.dependencyActionTitle = dependencyActionTitle; }
    public String getDependencyAnchor() { return dependencyAnchor; }
    public void setDependencyAnchor(String dependencyAnchor) { this.dependencyAnchor = dependencyAnchor; }
    public Integer getDurationDays() { return durationDays; }
    public void setDurationDays(Integer durationDays) { this.durationDays = durationDays; }
    public boolean isRoutineAction() { return routineAction; }
    public void setRoutineAction(boolean routineAction) { this.routineAction = routineAction; }
    public Integer getRecurrenceIntervalDays() { return recurrenceIntervalDays; }
    public void setRecurrenceIntervalDays(Integer recurrenceIntervalDays) { this.recurrenceIntervalDays = recurrenceIntervalDays; }
}
