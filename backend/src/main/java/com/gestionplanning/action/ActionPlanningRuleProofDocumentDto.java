package com.gestionplanning.action;

import java.time.LocalDateTime;

public class ActionPlanningRuleProofDocumentDto {
    private Long id;
    private Long ruleId;
    private String fileName;
    private String contentType;
    private Long fileSize;
    private String fileUrl;
    private String publicId;
    private String resourceType;
    private LocalDateTime uploadedAt;

    public static ActionPlanningRuleProofDocumentDto from(ActionPlanningRuleProofDocument document) {
        ActionPlanningRuleProofDocumentDto dto = new ActionPlanningRuleProofDocumentDto();
        dto.id = document.getId();
        dto.ruleId = document.getRuleId();
        dto.fileName = document.getFileName();
        dto.contentType = document.getContentType();
        dto.fileSize = document.getFileSize();
        dto.fileUrl = document.getFileUrl();
        dto.publicId = document.getPublicId();
        dto.resourceType = document.getResourceType();
        dto.uploadedAt = document.getUploadedAt();
        return dto;
    }

    public Long getId() { return id; }
    public Long getRuleId() { return ruleId; }
    public String getFileName() { return fileName; }
    public String getContentType() { return contentType; }
    public Long getFileSize() { return fileSize; }
    public String getFileUrl() { return fileUrl; }
    public String getPublicId() { return publicId; }
    public String getResourceType() { return resourceType; }
    public LocalDateTime getUploadedAt() { return uploadedAt; }
}
