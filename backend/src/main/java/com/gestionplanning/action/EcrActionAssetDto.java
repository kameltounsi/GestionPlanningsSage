package com.gestionplanning.action;

import java.time.LocalDateTime;

public class EcrActionAssetDto {
    private Long id;
    private Long actionId;
    private String fileName;
    private String contentType;
    private Long fileSize;
    private String fileUrl;
    private String publicId;
    private String resourceType;
    private LocalDateTime uploadedAt;

    public static EcrActionAssetDto from(EcrActionAsset asset) {
        if (asset == null) {
            return null;
        }
        EcrActionAssetDto dto = new EcrActionAssetDto();
        dto.id = asset.getId();
        dto.actionId = asset.getActionId();
        dto.fileName = asset.getFileName();
        dto.contentType = asset.getContentType();
        dto.fileSize = asset.getFileSize();
        dto.fileUrl = asset.getFileUrl();
        dto.publicId = asset.getPublicId();
        dto.resourceType = asset.getResourceType();
        dto.uploadedAt = asset.getUploadedAt();
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
