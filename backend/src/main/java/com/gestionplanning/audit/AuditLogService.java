package com.gestionplanning.audit;

import com.gestionplanning.user.AppUser;
import org.springframework.stereotype.Service;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;

@Service
public class AuditLogService {
    private final AuditLogRepository repository;

    public AuditLogService(AuditLogRepository repository) {
        this.repository = repository;
    }

    public void record(HttpServletRequest request, HttpServletResponse response, AppUser actor) {
        try {
            String actionType = actionType(request.getMethod(), request.getRequestURI());
            if (actionType == null) {
                return;
            }
            AuditLog log = new AuditLog();
            log.setOccurredAt(LocalDateTime.now());
            fillActor(log, actor);
            log.setHttpMethod(request.getMethod());
            log.setPath(pathWithQuery(request));
            log.setActionType(actionType);
            log.setTargetType(targetType(actionType));
            log.setTargetId(targetId(actionType, request.getRequestURI()));
            log.setResponseStatus(response.getStatus());
            log.setDetails(details(log.getActionType(), log.getTargetType(), log.getTargetId(), response));
            repository.save(log);
        } catch (Exception ignored) {
        }
    }

    public void recordBusinessEvent(AppUser actor, String actionType, String targetType, String targetId, String details) {
        try {
            AuditLog log = new AuditLog();
            log.setOccurredAt(LocalDateTime.now());
            fillActor(log, actor);
            log.setActionType(actionType);
            log.setHttpMethod("ACTION");
            log.setPath("");
            log.setTargetType(targetType);
            log.setTargetId(targetId);
            log.setResponseStatus(200);
            log.setDetails(details);
            repository.save(log);
        } catch (Exception ignored) {
        }
    }

    private String actionType(String method, String path) {
        if ("POST".equalsIgnoreCase(method) && path.matches("/api/ecr-requests")) return "CREATION_MODIFICATION";
        if ("PUT".equalsIgnoreCase(method) && path.matches("/api/ecr-requests/\\d+")) return "MODIFICATION_MODIFICATION";
        if ("POST".equalsIgnoreCase(method) && path.matches("/api/ecr-requests/\\d+/phase-validations/\\d+/approve")) return "VALIDATION_PHASE";
        if ("POST".equalsIgnoreCase(method) && path.matches("/api/ecr-requests/\\d+/phase-validations/\\d+/actions/\\d+/approve")) return "VALIDATION_ACTION";
        if ("POST".equalsIgnoreCase(method) && path.matches("/api/preferentials/clients")) return "AJOUT_CLIENT";
        if ("POST".equalsIgnoreCase(method) && path.matches("/api/preferentials/products")) return "AJOUT_PRODUIT";
        if ("POST".equalsIgnoreCase(method) && path.matches("/api/projects")) return "AJOUT_PROJET";
        if ("PUT".equalsIgnoreCase(method) && path.matches("/api/projects/.+")) return "MODIFICATION_PROJET_EQUIPE";
        return null;
    }

    private String targetType(String actionType) {
        if ("CREATION_MODIFICATION".equals(actionType) || "MODIFICATION_MODIFICATION".equals(actionType)) return "modification";
        if ("VALIDATION_PHASE".equals(actionType) || "REOUVERTURE_PHASE".equals(actionType)) return "phase";
        if ("ACTION_TERMINEE".equals(actionType) || "VALIDATION_ACTION".equals(actionType) || "REFUS_VALIDATION_ACTION".equals(actionType)) return "action";
        if ("AJOUT_CLIENT".equals(actionType)) return "client";
        if ("AJOUT_PRODUIT".equals(actionType)) return "produit";
        if ("AJOUT_PROJET".equals(actionType) || "MODIFICATION_PROJET_EQUIPE".equals(actionType)) return "projet";
        return "element";
    }

    private String targetId(String actionType, String path) {
        if ("AJOUT_PROJET".equals(actionType)) {
            return null;
        }
        if ("MODIFICATION_PROJET_EQUIPE".equals(actionType)) {
            String value = path.replaceFirst("^/api/projects/?", "");
            return value.isEmpty() ? null : decode(value);
        }
        for (String part : path.replaceFirst("^/api/?", "").split("/")) {
            if (part.matches("\\d+")) return part;
        }
        return null;
    }

    private String pathWithQuery(HttpServletRequest request) {
        String query = request.getQueryString();
        return query == null || query.trim().isEmpty() ? request.getRequestURI() : request.getRequestURI() + "?" + query;
    }

    private String details(String actionType, String targetType, String targetId, HttpServletResponse response) {
        String reference = targetId == null || targetId.trim().isEmpty() ? "" : " - Reference: " + targetId;
        return readableAction(actionType) + " - " + readableTarget(targetType) + reference + " - " + (response.getStatus() >= 400 ? "Echec" : "Reussie");
    }

    private String readableAction(String actionType) {
        if ("CREATION_MODIFICATION".equals(actionType)) return "Creation d'une modification";
        if ("MODIFICATION_MODIFICATION".equals(actionType)) return "Modification d'une modification";
        if ("VALIDATION_PHASE".equals(actionType)) return "Validation d'une phase";
        if ("REOUVERTURE_PHASE".equals(actionType)) return "Reouverture d'une phase";
        if ("ACTION_TERMINEE".equals(actionType)) return "Action marquee terminee";
        if ("VALIDATION_ACTION".equals(actionType)) return "Validation d'une action";
        if ("REFUS_VALIDATION_ACTION".equals(actionType)) return "Refus de validation d'une action";
        if ("AJOUT_CLIENT".equals(actionType)) return "Ajout d'un client";
        if ("AJOUT_PRODUIT".equals(actionType)) return "Ajout d'un produit";
        if ("AJOUT_PROJET".equals(actionType)) return "Ajout d'un projet";
        if ("MODIFICATION_PROJET_EQUIPE".equals(actionType)) return "Modification d'un projet ou de son equipe";
        return actionType == null ? "Action" : actionType;
    }

    private String readableTarget(String targetType) {
        if ("modification".equals(targetType)) return "Modification";
        if ("phase".equals(targetType)) return "Phase";
        if ("action".equals(targetType)) return "Action";
        if ("client".equals(targetType)) return "Client";
        if ("produit".equals(targetType)) return "Produit";
        if ("projet".equals(targetType)) return "Projet";
        return targetType == null ? "Element" : targetType;
    }

    private void fillActor(AuditLog log, AppUser actor) {
        if (actor != null) {
            log.setActorId(actor.getId());
            log.setActorName(displayName(actor));
            log.setActorRole(actor.getRole());
        } else {
            log.setActorName("Utilisateur non authentifie");
        }
    }

    private String decode(String value) {
        try {
            return URLDecoder.decode(value, StandardCharsets.UTF_8.name());
        } catch (Exception exception) {
            return value;
        }
    }

    private String displayName(AppUser user) {
        if (user.getFullName() != null && !user.getFullName().trim().isEmpty()) return user.getFullName();
        if (user.getUsername() != null && !user.getUsername().trim().isEmpty()) return user.getUsername();
        return user.getEmail();
    }
}
