package com.gestionplanning.ecr;

import com.fasterxml.jackson.annotation.JsonIgnore;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.time.ZoneId;

@Entity
@Table(name = "phase_validation_request")
public class PhaseValidationRequest {
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

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PhaseValidationStatus status = PhaseValidationStatus.PENDING;

    private String requestedBy;
    private LocalDateTime requestedAt = LocalDateTime.now(ZoneId.systemDefault());
    private String reviewedBy;
    private LocalDateTime reviewedAt;

    @Column(length = 3000)
    private String refusalReason;

    @Column(length = 3000)
    private String actionsToRevisit;

    @Transient
    private int validationRate;

    @Transient
    private int approvedActions;

    @Transient
    private int totalActions;

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

    public EcrStage getStage() {
        return stage;
    }

    public void setStage(EcrStage stage) {
        this.stage = stage;
    }

    public PhaseValidationStatus getStatus() {
        return status;
    }

    public void setStatus(PhaseValidationStatus status) {
        this.status = status;
    }

    public String getRequestedBy() {
        return requestedBy;
    }

    public void setRequestedBy(String requestedBy) {
        this.requestedBy = requestedBy;
    }

    public LocalDateTime getRequestedAt() {
        return requestedAt;
    }

    public void setRequestedAt(LocalDateTime requestedAt) {
        this.requestedAt = requestedAt;
    }

    public String getReviewedBy() {
        return reviewedBy;
    }

    public void setReviewedBy(String reviewedBy) {
        this.reviewedBy = reviewedBy;
    }

    public LocalDateTime getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(LocalDateTime reviewedAt) {
        this.reviewedAt = reviewedAt;
    }

    public String getRefusalReason() {
        return refusalReason;
    }

    public void setRefusalReason(String refusalReason) {
        this.refusalReason = refusalReason;
    }

    public String getActionsToRevisit() {
        return actionsToRevisit;
    }

    public void setActionsToRevisit(String actionsToRevisit) {
        this.actionsToRevisit = actionsToRevisit;
    }

    public int getValidationRate() {
        return validationRate;
    }

    public void setValidationRate(int validationRate) {
        this.validationRate = validationRate;
    }

    public int getApprovedActions() {
        return approvedActions;
    }

    public void setApprovedActions(int approvedActions) {
        this.approvedActions = approvedActions;
    }

    public int getTotalActions() {
        return totalActions;
    }

    public void setTotalActions(int totalActions) {
        this.totalActions = totalActions;
    }
}
