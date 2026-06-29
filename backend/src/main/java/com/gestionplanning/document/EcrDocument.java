package com.gestionplanning.document;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.gestionplanning.ecr.EcrRequest;

import javax.persistence.*;
import javax.validation.constraints.NotBlank;
import java.time.LocalDateTime;
import java.time.ZoneId;

@Entity
@Table(name = "ecr_document")
public class EcrDocument {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ecr_id", nullable = false)
    @JsonIgnore
    private EcrRequest request;

    @NotBlank
    @Column(nullable = false)
    private String fileName;

    @NotBlank
    @Column(nullable = false, length = 2000)
    private String fileUrl;

    private String publicId;
    private String resourceType;
    private String fileType;
    private Long fileSize;
    private String uploadedBy;

    @Column(nullable = false, updatable = false)
    private LocalDateTime uploadedAt = LocalDateTime.now(ZoneId.systemDefault());

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

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getFileUrl() {
        return fileUrl;
    }

    public void setFileUrl(String fileUrl) {
        this.fileUrl = fileUrl;
    }

    public String getPublicId() {
        return publicId;
    }

    public void setPublicId(String publicId) {
        this.publicId = publicId;
    }

    public String getResourceType() {
        return resourceType;
    }

    public void setResourceType(String resourceType) {
        this.resourceType = resourceType;
    }

    public String getFileType() {
        return fileType;
    }

    public void setFileType(String fileType) {
        this.fileType = fileType;
    }

    public Long getFileSize() {
        return fileSize;
    }

    public void setFileSize(Long fileSize) {
        this.fileSize = fileSize;
    }

    public String getUploadedBy() {
        return uploadedBy;
    }

    public void setUploadedBy(String uploadedBy) {
        this.uploadedBy = uploadedBy;
    }

    public LocalDateTime getUploadedAt() {
        return uploadedAt;
    }
}
