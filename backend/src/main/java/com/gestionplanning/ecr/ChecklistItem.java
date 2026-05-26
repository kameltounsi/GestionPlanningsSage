package com.gestionplanning.ecr;

import com.fasterxml.jackson.annotation.JsonIgnore;

import javax.persistence.*;
import javax.validation.constraints.NotBlank;
import java.time.LocalDate;

@Entity
public class ChecklistItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "request_id", nullable = false)
    @JsonIgnore
    private EcrRequest request;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EcrStage stage;

    private String topicRisk;

    @NotBlank
    @Column(nullable = false, length = 1000)
    private String verificationPoint;

    private String pilot;
    private String expectedEvidence;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ChecklistStatus status = ChecklistStatus.IN_PROGRESS;

    private LocalDate plannedDate;
    private LocalDate doneDate;
    private LocalDate reviewDate;
    private boolean checked;
    private String criticality;

    @Column(length = 2000)
    private String evidence;

    @Column(length = 2000)
    private String proofDocument;

    public Long getId() {
        return id;
    }

    public EcrRequest getRequest() {
        return request;
    }

    public void setRequest(EcrRequest request) {
        this.request = request;
    }

    public EcrStage getStage() {
        return stage;
    }

    public void setStage(EcrStage stage) {
        this.stage = stage;
    }

    public String getTopicRisk() {
        return topicRisk;
    }

    public void setTopicRisk(String topicRisk) {
        this.topicRisk = topicRisk;
    }

    public String getVerificationPoint() {
        return verificationPoint;
    }

    public void setVerificationPoint(String verificationPoint) {
        this.verificationPoint = verificationPoint;
    }

    public String getPilot() {
        return pilot;
    }

    public void setPilot(String pilot) {
        this.pilot = pilot;
    }

    public String getExpectedEvidence() {
        return expectedEvidence;
    }

    public void setExpectedEvidence(String expectedEvidence) {
        this.expectedEvidence = expectedEvidence;
    }

    public ChecklistStatus getStatus() {
        return status;
    }

    public void setStatus(ChecklistStatus status) {
        this.status = status;
    }

    public LocalDate getPlannedDate() {
        return plannedDate;
    }

    public void setPlannedDate(LocalDate plannedDate) {
        this.plannedDate = plannedDate;
    }

    public LocalDate getDoneDate() {
        return doneDate;
    }

    public void setDoneDate(LocalDate doneDate) {
        this.doneDate = doneDate;
    }

    public LocalDate getReviewDate() {
        return reviewDate;
    }

    public void setReviewDate(LocalDate reviewDate) {
        this.reviewDate = reviewDate;
    }

    public boolean isChecked() {
        return checked;
    }

    public void setChecked(boolean checked) {
        this.checked = checked;
    }

    public String getCriticality() {
        return criticality;
    }

    public void setCriticality(String criticality) {
        this.criticality = criticality;
    }

    public String getEvidence() {
        return evidence;
    }

    public void setEvidence(String evidence) {
        this.evidence = evidence;
    }

    public String getProofDocument() {
        return proofDocument;
    }

    public void setProofDocument(String proofDocument) {
        this.proofDocument = proofDocument;
    }
}
