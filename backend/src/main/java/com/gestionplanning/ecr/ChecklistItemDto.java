package com.gestionplanning.ecr;

import com.fasterxml.jackson.annotation.JsonAutoDetect;

import java.time.LocalDate;

@JsonAutoDetect(fieldVisibility = JsonAutoDetect.Visibility.ANY)
public class ChecklistItemDto {
    private Long id;
    private EcrStage stage;
    private String topicRisk;
    private String verificationPoint;
    private String pilot;
    private String expectedEvidence;
    private ChecklistStatus status;
    private LocalDate plannedDate;
    private LocalDate doneDate;
    private LocalDate reviewDate;
    private boolean checked;
    private String criticality;
    private String evidence;
    private String proofDocument;

    public static ChecklistItemDto from(ChecklistItem item) {
        if (item == null) {
            return null;
        }
        ChecklistItemDto dto = new ChecklistItemDto();
        dto.id = item.getId();
        dto.stage = item.getStage();
        dto.topicRisk = item.getTopicRisk();
        dto.verificationPoint = item.getVerificationPoint();
        dto.pilot = item.getPilot();
        dto.expectedEvidence = item.getExpectedEvidence();
        dto.status = item.getStatus();
        dto.plannedDate = item.getPlannedDate();
        dto.doneDate = item.getDoneDate();
        dto.reviewDate = item.getReviewDate();
        dto.checked = item.isChecked();
        dto.criticality = item.getCriticality();
        dto.evidence = item.getEvidence();
        dto.proofDocument = item.getProofDocument();
        return dto;
    }

    public Long getId() { return id; }
    public EcrStage getStage() { return stage; }
    public String getTopicRisk() { return topicRisk; }
    public String getVerificationPoint() { return verificationPoint; }
    public String getPilot() { return pilot; }
    public String getExpectedEvidence() { return expectedEvidence; }
    public ChecklistStatus getStatus() { return status; }
    public LocalDate getPlannedDate() { return plannedDate; }
    public LocalDate getDoneDate() { return doneDate; }
    public LocalDate getReviewDate() { return reviewDate; }
    public boolean isChecked() { return checked; }
    public String getCriticality() { return criticality; }
    public String getEvidence() { return evidence; }
    public String getProofDocument() { return proofDocument; }
}
