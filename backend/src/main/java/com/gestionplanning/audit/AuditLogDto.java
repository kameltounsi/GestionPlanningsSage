package com.gestionplanning.audit;

import java.time.LocalDateTime;

public class AuditLogDto {
    private Long id;
    private LocalDateTime occurredAt;
    private Long actorId;
    private String actorName;
    private String actorRole;
    private String actionType;
    private String httpMethod;
    private String path;
    private String targetType;
    private String targetId;
    private Integer responseStatus;
    private String details;

    public static AuditLogDto from(AuditLog log) {
        AuditLogDto dto = new AuditLogDto();
        dto.id = log.getId();
        dto.occurredAt = log.getOccurredAt();
        dto.actorId = log.getActorId();
        dto.actorName = log.getActorName();
        dto.actorRole = log.getActorRole();
        dto.actionType = log.getActionType();
        dto.httpMethod = log.getHttpMethod();
        dto.path = log.getPath();
        dto.targetType = log.getTargetType();
        dto.targetId = log.getTargetId();
        dto.responseStatus = log.getResponseStatus();
        dto.details = log.getDetails();
        return dto;
    }

    public Long getId() { return id; }
    public LocalDateTime getOccurredAt() { return occurredAt; }
    public Long getActorId() { return actorId; }
    public String getActorName() { return actorName; }
    public String getActorRole() { return actorRole; }
    public String getActionType() { return actionType; }
    public String getHttpMethod() { return httpMethod; }
    public String getPath() { return path; }
    public String getTargetType() { return targetType; }
    public String getTargetId() { return targetId; }
    public Integer getResponseStatus() { return responseStatus; }
    public String getDetails() { return details; }
}
