package com.gestionplanning.action;

import com.fasterxml.jackson.annotation.JsonIgnore;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.time.ZoneId;

@Entity
public class ActionPlanningRuleProofDocument {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rule_id", nullable = false)
    @JsonIgnore
    private ActionPlanningRule rule;

    private String fileName;
    private String contentType;
    private Long fileSize;

    @Column(length = 2000)
    private String fileUrl;

    private String publicId;
    private String resourceType;

    @Column(nullable = false, updatable = false)
    private LocalDateTime uploadedAt = LocalDateTime.now(ZoneId.systemDefault());

    public Long getId() {
        return id;
    }

    public ActionPlanningRule getRule() {
        return rule;
    }

    public void setRule(ActionPlanningRule rule) {
        this.rule = rule;
    }

    public Long getRuleId() {
        return rule == null ? null : rule.getId();
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }

    public Long getFileSize() {
        return fileSize;
    }

    public void setFileSize(Long fileSize) {
        this.fileSize = fileSize;
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

    public LocalDateTime getUploadedAt() {
        return uploadedAt;
    }
}
