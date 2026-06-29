package com.gestionplanning.action;

import java.time.LocalDateTime;

public class EcrActionProofDocumentDto {
    private Long id;
    private Long actionId;
    private String fileName;
    private String contentType;
    private Long fileSize;
    private String fileUrl;
    private String publicId;
    private String resourceType;
    private LocalDateTime uploadedAt;

    public static EcrActionProofDocumentDto from(EcrActionProofDocument proofDocument) {
        if (proofDocument == null) {
            return null;
        }
        EcrActionProofDocumentDto dto = new EcrActionProofDocumentDto();
        dto.id = proofDocument.getId();
        dto.actionId = proofDocument.getActionId();
        dto.fileName = proofDocument.getFileName();
        dto.contentType = proofDocument.getContentType();
        dto.fileSize = proofDocument.getFileSize();
        dto.fileUrl = proofDocument.getFileUrl();
        dto.publicId = proofDocument.getPublicId();
        dto.resourceType = proofDocument.getResourceType();
        dto.uploadedAt = proofDocument.getUploadedAt();
        return dto;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getActionId() { return actionId; }
    public void setActionId(Long actionId) { this.actionId = actionId; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }
    public String getFileUrl() { return fileUrl; }
    public void setFileUrl(String fileUrl) { this.fileUrl = fileUrl; }
    public String getPublicId() { return publicId; }
    public void setPublicId(String publicId) { this.publicId = publicId; }
    public String getResourceType() { return resourceType; }
    public void setResourceType(String resourceType) { this.resourceType = resourceType; }
    public LocalDateTime getUploadedAt() { return uploadedAt; }
    public void setUploadedAt(LocalDateTime uploadedAt) { this.uploadedAt = uploadedAt; }
}
