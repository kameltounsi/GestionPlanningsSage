package com.gestionplanning.action;

import com.gestionplanning.ecr.EcrStage;

import javax.persistence.*;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "action_planning_rule")
public class ActionPlanningRule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EcrStage stage = EcrStage.FEASIBILITY_VALIDATION;

    private boolean appliesToModification = true;

    private boolean appliesToNewProject = true;

    @NotBlank
    @Column(nullable = false, length = 1000)
    private String actionTitle;

    @Column(length = 1000)
    private String topicRisk;

    @Column(length = 1000)
    private String responsible;

    @Column(length = 1000)
    private String validator;

    private String criticality = "3-faible";

    @Column(length = 3000)
    private String expectedEvidence;

    @Column(length = 3000)
    private String proofDocument;
    private String proofDocumentFileName;
    private String proofDocumentContentType;
    private Long proofDocumentFileSize;
    @Column(length = 2000)
    private String proofDocumentFileUrl;
    private String proofDocumentPublicId;
    private String proofDocumentResourceType;

    @OneToMany(mappedBy = "rule", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("uploadedAt DESC, id DESC")
    private List<ActionPlanningRuleProofDocument> proofDocuments = new ArrayList<>();

    private boolean evidenceRequired;

    @Column(length = 1000)
    private String dependencyActionTitle;

    @Column(nullable = false)
    private String dependencyAnchor = "OUTPUT";

    @Min(0)
    @Column(nullable = false)
    private Integer durationDays = 1;

    public Long getId() {
        return id;
    }

    public EcrStage getStage() {
        return stage;
    }

    public void setStage(EcrStage stage) {
        this.stage = stage;
    }

    public boolean isAppliesToModification() {
        return appliesToModification;
    }

    public void setAppliesToModification(boolean appliesToModification) {
        this.appliesToModification = appliesToModification;
    }

    public boolean isAppliesToNewProject() {
        return appliesToNewProject;
    }

    public void setAppliesToNewProject(boolean appliesToNewProject) {
        this.appliesToNewProject = appliesToNewProject;
    }

    public String getActionTitle() {
        return actionTitle;
    }

    public void setActionTitle(String actionTitle) {
        this.actionTitle = actionTitle;
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

    public List<ActionPlanningRuleProofDocument> getProofDocuments() {
        return proofDocuments;
    }

    public void setProofDocuments(List<ActionPlanningRuleProofDocument> proofDocuments) {
        this.proofDocuments = proofDocuments == null ? new ArrayList<>() : proofDocuments;
    }

    public boolean isEvidenceRequired() {
        return evidenceRequired;
    }

    public void setEvidenceRequired(boolean evidenceRequired) {
        this.evidenceRequired = evidenceRequired;
    }

    public String getDependencyActionTitle() {
        return dependencyActionTitle;
    }

    public void setDependencyActionTitle(String dependencyActionTitle) {
        this.dependencyActionTitle = dependencyActionTitle;
    }

    public String getDependencyAnchor() {
        return dependencyAnchor;
    }

    public void setDependencyAnchor(String dependencyAnchor) {
        this.dependencyAnchor = dependencyAnchor;
    }

    public Integer getDurationDays() {
        return durationDays;
    }

    public void setDurationDays(Integer durationDays) {
        this.durationDays = durationDays;
    }
}
