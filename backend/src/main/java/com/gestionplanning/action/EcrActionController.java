package com.gestionplanning.action;

import com.gestionplanning.ecr.EcrRequestRepository;
import com.gestionplanning.ecr.EcrStage;
import com.gestionplanning.ecr.EcrTemplateService;
import com.gestionplanning.audit.AuditLogService;
import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.storage.CloudinaryStorageService;
import com.gestionplanning.storage.CloudinaryStorageService.DownloadedAsset;
import com.gestionplanning.storage.StoredAsset;
import com.gestionplanning.user.AppUser;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.validation.Valid;
import java.net.URI;
import java.util.Arrays;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class EcrActionController {
    private final EcrActionRepository actionRepository;
    private final EcrActionEvidenceRepository evidenceRepository;
    private final EcrActionAssetRepository assetRepository;
    private final EcrRequestRepository requestRepository;
    private final ActionPlanningService planningService;
    private final EcrTemplateService templateService;
    private final CloudinaryStorageService storageService;
    private final ActionAssigneeResolver assigneeResolver;
    private final AccessControlService accessControlService;
    private final AuditLogService auditLogService;

    public EcrActionController(EcrActionRepository actionRepository, EcrActionEvidenceRepository evidenceRepository,
                               EcrActionAssetRepository assetRepository,
                               EcrRequestRepository requestRepository, ActionPlanningService planningService,
                               EcrTemplateService templateService, CloudinaryStorageService storageService,
                               ActionAssigneeResolver assigneeResolver, AccessControlService accessControlService,
                               AuditLogService auditLogService) {
        this.actionRepository = actionRepository;
        this.evidenceRepository = evidenceRepository;
        this.assetRepository = assetRepository;
        this.requestRepository = requestRepository;
        this.planningService = planningService;
        this.templateService = templateService;
        this.storageService = storageService;
        this.assigneeResolver = assigneeResolver;
        this.accessControlService = accessControlService;
        this.auditLogService = auditLogService;
    }

    @GetMapping("/actions")
    public List<EcrAction> list(@RequestParam(required = false) Boolean late) {
        if (Boolean.TRUE.equals(late)) {
            List<EcrAction> actions = actionRepository.findByDeadlineBeforeAndStatusNotInOrderByDeadlineAsc(LocalDate.now(), Arrays.asList(ActionStatus.DONE, ActionStatus.DONE_LATE));
            planningService.refreshActionStatuses(actions);
            return enrichActions(actionRepository.saveAll(actions).stream()
                    .filter(action -> action.getStatus() != ActionStatus.DONE && action.getStatus() != ActionStatus.DONE_LATE)
                    .collect(Collectors.toList()));
        }
        List<EcrAction> actions = actionRepository.findAll();
        planningService.refreshActionStatuses(actions);
        return enrichActions(actionRepository.saveAll(actions));
    }

    @GetMapping("/ecr-requests/{requestId}/actions")
    public ResponseEntity<List<EcrAction>> listByRequest(@PathVariable Long requestId, @RequestParam(required = false) EcrStage stage,
                                                         @RequestAttribute("authenticatedUser") AppUser user) {
        return requestRepository.findById(requestId).map(request -> {
            if (!accessControlService.canAccessRequest(user, request)) {
                return ResponseEntity.status(403).<List<EcrAction>>build();
            }
            if (!accessControlService.isAdmin(user) && stage != null && EcrStage.allowedStages(request.isNewVersion()).indexOf(stage) > EcrStage.allowedStages(request.isNewVersion()).indexOf(request.getCurrentStage())) {
                return ResponseEntity.status(403).<List<EcrAction>>build();
            }
            templateService.ensureActionsFor(request);
            planningService.recalculateRequest(request);
            List<EcrAction> actions = actionRepository.findByRequest_IdOrderByDeadlineAscIdAsc(requestId);
            if (!accessControlService.canSeeAllActions(user, request)) {
                actions = visibleActionsForUser(actions, user);
            }
            if (stage != null) {
                actions = actions.stream()
                        .filter(action -> action.getStage() == stage)
                        .collect(Collectors.toList());
            }
            return ResponseEntity.ok(enrichActions(actions));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/ecr-requests/{requestId}/actions")
    public ResponseEntity<EcrAction> create(@PathVariable Long requestId, @Valid @RequestBody EcrAction action,
                                            @RequestAttribute("authenticatedUser") AppUser user) {
        if (!accessControlService.isAdmin(user)) {
            return ResponseEntity.status(403).build();
        }
        return requestRepository.findById(requestId)
                .map(request -> {
                    if (isDone(action) && requiresEvidence(action)) {
                        return ResponseEntity.badRequest().<EcrAction>build();
                    }
                    action.setRequest(request);
                    action.setResponsible(assigneeResolver.resolve(request, action.getResponsible()));
                    action.setValidatorRole(action.getValidator());
                    action.setValidator(action.getValidator());
                    syncFinalizationDate(action, action);
                    EcrAction saved = actionRepository.save(action);
                    planningService.recalculateRequest(request);
                    return ResponseEntity.created(URI.create("/api/actions/" + saved.getId())).body(enrichAction(saved));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/actions/{id}")
    @Transactional
    public ResponseEntity<EcrAction> update(@PathVariable Long id, @Valid @RequestBody EcrAction updatedAction,
                                            @RequestAttribute("authenticatedUser") AppUser user) {
        return actionRepository.findById(id)
                .filter(action -> accessControlService.canManageAction(user, action))
                .map(action -> {
                    boolean completingAction = isCompletingAction(action, updatedAction);
                    if (completingAction && !accessControlService.canCompleteAction(user, action)) {
                        return ResponseEntity.status(403).<EcrAction>build();
                    }
                    if (!accessControlService.isAdmin(user)) {
                        return updateActionProgress(action, updatedAction, user);
                    }
                    if (isReopeningAction(action, updatedAction) && !isActionInCurrentPhase(action)) {
                        return ResponseEntity.badRequest().<EcrAction>build();
                    }
                    action.setTitle(updatedAction.getTitle());
                    action.setDescription(updatedAction.getDescription());
                    action.setTopicRisk(updatedAction.getTopicRisk());
                    action.setResponsible(assigneeResolver.resolve(action.getRequest(), updatedAction.getResponsible()));
                    action.setValidatorRole(updatedAction.getValidatorRole() == null || updatedAction.getValidatorRole().trim().isEmpty() ? updatedAction.getValidator() : updatedAction.getValidatorRole());
                    action.setValidator(updatedAction.getValidator());
                    action.setCriticality(updatedAction.getCriticality());
                    action.setExpectedEvidence(updatedAction.getExpectedEvidence());
                    action.setEvidenceRequired(updatedAction.isEvidenceRequired());
                    action.setEvidence(updatedAction.getEvidence());
                    action.setProofDocument(updatedAction.getProofDocument());
                    if (isDone(updatedAction) && requiresEvidence(updatedAction) && !hasEvidence(action)) {
                        return ResponseEntity.badRequest().<EcrAction>build();
                    }
                    if (isDone(updatedAction) && !isDependencyCompleted(action)) {
                        return ResponseEntity.badRequest().<EcrAction>build();
                    }
                    action.setChecked(updatedAction.isChecked());
                    action.setDeadline(updatedAction.getDeadline());
                    action.setDate1(updatedAction.getDate1());
                    action.setDate2(updatedAction.getDate2());
                    action.setDate3(updatedAction.getDate3());
                    action.setStartDate(updatedAction.getStartDate());
                    action.setEndDate(updatedAction.getEndDate());
                    action.setWorkDurationDays(updatedAction.getWorkDurationDays());
                    action.setDependsOnActionId(updatedAction.getDependsOnActionId());
                    action.setDependencyAnchor(updatedAction.getDependencyAnchor());
                    action.setStage(updatedAction.getStage());
                    if (isDone(updatedAction) && !isDependencyCompleted(action)) {
                        return ResponseEntity.badRequest().<EcrAction>build();
                    }
                    action.setStatus(updatedAction.getStatus());
                    action.setClosedDate(updatedAction.getClosedDate());
                    syncFinalizationDate(action, updatedAction);
                    syncValidationAfterProgressChange(action);
                    action.setComment(updatedAction.getComment());
                    action.setDossierReview(updatedAction.getDossierReview());
                    EcrAction saved = actionRepository.save(action);
                    planningService.recalculateRequest(saved.getRequest());
                    if (completingAction) {
                        recordActionCompleted(user, saved);
                    }
                    return ResponseEntity.ok(enrichAction(saved));
                })
                .orElse(ResponseEntity.status(403).build());
    }

    private ResponseEntity<EcrAction> updateActionProgress(EcrAction action, EcrAction updatedAction, AppUser user) {
        boolean completingAction = isCompletingAction(action, updatedAction);
        if (completingAction && !accessControlService.canCompleteAction(user, action)) {
            return ResponseEntity.status(403).build();
        }
        if (isReopeningAction(action, updatedAction) && !isActionInCurrentPhase(action)) {
            return ResponseEntity.badRequest().build();
        }
        if (isDone(updatedAction) && requiresEvidence(action) && !hasEvidence(action)) {
            return ResponseEntity.badRequest().build();
        }
        if (isDone(updatedAction) && !isDependencyCompleted(action)) {
            return ResponseEntity.badRequest().build();
        }
        action.setChecked(updatedAction.isChecked());
        action.setStatus(updatedAction.getStatus());
        action.setComment(updatedAction.getComment());
        syncFinalizationDate(action, updatedAction);
        syncValidationAfterProgressChange(action);
        EcrAction saved = actionRepository.save(action);
        planningService.recalculateRequest(saved.getRequest());
        if (completingAction) {
            recordActionCompleted(user, saved);
        }
        return ResponseEntity.ok(enrichAction(saved));
    }

    @PostMapping(value = "/actions/{id}/evidence", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<EcrAction> uploadEvidence(@PathVariable Long id, @RequestParam("file") MultipartFile file,
                                                    @RequestAttribute("authenticatedUser") AppUser user) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return actionRepository.findById(id)
                .filter(action -> accessControlService.canManageAction(user, action))
                .map(action -> {
                    StoredAsset asset = storageService.upload(file, "gestion-planning/actions/" + id);
                    EcrActionAsset actionAsset = new EcrActionAsset();
                    actionAsset.setAction(action);
                    actionAsset.setFileName(asset.getFileName());
                    actionAsset.setContentType(asset.getContentType());
                    actionAsset.setFileSize(asset.getSize());
                    actionAsset.setFileUrl(asset.getUrl());
                    actionAsset.setPublicId(asset.getPublicId());
                    actionAsset.setResourceType(asset.getResourceType());
                    assetRepository.save(actionAsset);
                    action.setEvidenceFileName(asset.getFileName());
                    action.setEvidenceContentType(asset.getContentType());
                    action.setEvidenceFileSize(asset.getSize());
                    action.setEvidenceFileUrl(asset.getUrl());
                    action.setEvidencePublicId(asset.getPublicId());
                    action.setEvidenceResourceType(asset.getResourceType());
                    action.setEvidence(asset.getFileName());
                    return ResponseEntity.ok(enrichAction(actionRepository.save(action)));
                })
                .orElse(ResponseEntity.status(403).build());
    }

    @PostMapping(value = "/actions/{id}/proof-document", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<EcrAction> uploadProofDocument(@PathVariable Long id, @RequestParam("file") MultipartFile file,
                                                         @RequestAttribute("authenticatedUser") AppUser user) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return actionRepository.findById(id)
                .filter(action -> accessControlService.canManageAction(user, action))
                .map(action -> {
                    storageService.deleteQuietly(action.getProofDocumentPublicId(), action.getProofDocumentResourceType());
                    StoredAsset asset = storageService.upload(file, "gestion-planning/actions/" + id + "/proof-document");
                    action.setProofDocument(asset.getFileName());
                    action.setProofDocumentFileName(asset.getFileName());
                    action.setProofDocumentContentType(asset.getContentType());
                    action.setProofDocumentFileSize(asset.getSize());
                    action.setProofDocumentFileUrl(asset.getUrl());
                    action.setProofDocumentPublicId(asset.getPublicId());
                    action.setProofDocumentResourceType(asset.getResourceType());
                    action.setEvidenceRequired(true);
                    return ResponseEntity.ok(enrichAction(actionRepository.save(action)));
                })
                .orElse(ResponseEntity.status(403).build());
    }

    @GetMapping("/actions/{id}/evidence")
    public ResponseEntity<?> downloadEvidence(@PathVariable Long id) {
        return actionRepository.findById(id).<ResponseEntity<?>>map(action -> {
            if (action.getEvidenceFileUrl() != null && !action.getEvidenceFileUrl().trim().isEmpty()) {
                DownloadedAsset asset = storageService.download(action.getEvidencePublicId(), action.getEvidenceResourceType(), action.getEvidenceFileUrl(), action.getEvidenceContentType());
                return ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(action.getEvidenceFileName(), asset.getContentType()))
                        .contentType(MediaType.parseMediaType(asset.getContentType()))
                            .body(asset.getData());
            }
            return evidenceRepository.findById(id)
                    .<ResponseEntity<?>>map(evidence -> ResponseEntity.ok()
                            .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(action.getEvidenceFileName(), action.getEvidenceContentType()))
                            .contentType(MediaType.parseMediaType(action.getEvidenceContentType() == null ? MediaType.APPLICATION_OCTET_STREAM_VALUE : action.getEvidenceContentType()))
                            .body(evidence.getData()))
                    .orElseGet(() -> ResponseEntity.notFound().build());
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/actions/{id}/proof-document")
    public ResponseEntity<?> downloadProofDocument(@PathVariable Long id) {
        return actionRepository.findById(id).<ResponseEntity<?>>map(action -> {
            if (action.getProofDocumentFileUrl() == null || action.getProofDocumentFileUrl().trim().isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            DownloadedAsset asset = storageService.download(action.getProofDocumentPublicId(), action.getProofDocumentResourceType(), action.getProofDocumentFileUrl(), action.getProofDocumentContentType());
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(action.getProofDocumentFileName(), asset.getContentType()))
                    .contentType(MediaType.parseMediaType(asset.getContentType()))
                    .body(asset.getData());
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/actions/{id}/proof-document")
    public ResponseEntity<EcrAction> deleteProofDocument(@PathVariable Long id,
                                                         @RequestAttribute("authenticatedUser") AppUser user) {
        return actionRepository.findById(id)
                .filter(action -> accessControlService.canManageAction(user, action))
                .map(action -> {
                    storageService.deleteQuietly(action.getProofDocumentPublicId(), action.getProofDocumentResourceType());
                    clearProofDocument(action);
                    return ResponseEntity.ok(enrichAction(actionRepository.save(action)));
                })
                .orElse(ResponseEntity.status(403).build());
    }

    @GetMapping("/action-assets/{assetId}/download")
    public ResponseEntity<?> downloadActionAsset(@PathVariable Long assetId) {
        return assetRepository.findById(assetId)
                .<ResponseEntity<?>>map(actionAsset -> {
                    DownloadedAsset asset = storageService.download(actionAsset.getPublicId(), actionAsset.getResourceType(), actionAsset.getFileUrl(), actionAsset.getContentType());
                    return ResponseEntity.ok()
                            .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(actionAsset.getFileName(), asset.getContentType()))
                            .contentType(MediaType.parseMediaType(asset.getContentType()))
                            .body(asset.getData());
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/action-assets/{assetId}")
    @Transactional
    public ResponseEntity<EcrAction> deleteActionAsset(@PathVariable Long assetId,
                                                       @RequestAttribute("authenticatedUser") AppUser user) {
        return assetRepository.findById(assetId)
                .filter(asset -> accessControlService.canManageAction(user, asset.getAction()))
                .map(asset -> {
                    EcrAction action = asset.getAction();
                    storageService.deleteQuietly(asset.getPublicId(), asset.getResourceType());
                    assetRepository.delete(asset);
                    assetRepository.flush();
                    syncLatestEvidenceMetadata(action);
                    return ResponseEntity.ok(enrichAction(actionRepository.save(action)));
                })
                .orElse(ResponseEntity.status(403).build());
    }

    @DeleteMapping("/actions/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @RequestAttribute("authenticatedUser") AppUser user) {
        if (!accessControlService.isAdmin(user)) {
            return ResponseEntity.status(403).build();
        }
        return actionRepository.findById(id).map(action -> {
            Long requestId = action.getRequestId();
            assetRepository.findByAction_IdOrderByUploadedAtDescIdDesc(id)
                    .forEach(asset -> storageService.deleteQuietly(asset.getPublicId(), asset.getResourceType()));
            storageService.deleteQuietly(action.getEvidencePublicId(), action.getEvidenceResourceType());
            storageService.deleteQuietly(action.getProofDocumentPublicId(), action.getProofDocumentResourceType());
            assetRepository.deleteByAction_Id(id);
            deleteLocalEvidenceIfPresent(id);
            actionRepository.deleteById(id);
            requestRepository.findById(requestId).ifPresent(planningService::recalculateRequest);
            return ResponseEntity.noContent().<Void>build();
        }).orElse(ResponseEntity.notFound().build());
    }

    private void deleteLocalEvidenceIfPresent(Long actionId) {
        if (evidenceRepository.existsById(actionId)) {
            evidenceRepository.deleteById(actionId);
        }
    }

    private boolean hasEvidence(EcrAction action) {
        return action.getEvidenceFileName() != null && !action.getEvidenceFileName().trim().isEmpty()
                || action.getId() != null && !assetRepository.findByAction_IdOrderByUploadedAtDescIdDesc(action.getId()).isEmpty();
    }

    private void syncLatestEvidenceMetadata(EcrAction action) {
        if (action == null || action.getId() == null) {
            return;
        }
        List<EcrActionAsset> remainingAssets = assetRepository.findByAction_IdOrderByUploadedAtDescIdDesc(action.getId());
        if (remainingAssets.isEmpty()) {
            action.setEvidenceFileName(null);
            action.setEvidenceContentType(null);
            action.setEvidenceFileSize(null);
            action.setEvidenceFileUrl(null);
            action.setEvidencePublicId(null);
            action.setEvidenceResourceType(null);
            action.setEvidence(null);
            return;
        }
        EcrActionAsset latest = remainingAssets.get(0);
        action.setEvidenceFileName(latest.getFileName());
        action.setEvidenceContentType(latest.getContentType());
        action.setEvidenceFileSize(latest.getFileSize());
        action.setEvidenceFileUrl(latest.getFileUrl());
        action.setEvidencePublicId(latest.getPublicId());
        action.setEvidenceResourceType(latest.getResourceType());
        action.setEvidence(latest.getFileName());
    }

    private boolean requiresEvidence(EcrAction action) {
        return action != null && (action.isEvidenceRequired()
                || hasProofDocument(action)
                || String.valueOf(action.getCriticality()).startsWith("1"));
    }

    private boolean hasProofDocument(EcrAction action) {
        return action != null && (hasText(action.getProofDocumentFileName()) || hasText(action.getProofDocumentFileUrl()));
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private void clearProofDocument(EcrAction action) {
        action.setProofDocument(null);
        action.setProofDocumentFileName(null);
        action.setProofDocumentContentType(null);
        action.setProofDocumentFileSize(null);
        action.setProofDocumentFileUrl(null);
        action.setProofDocumentPublicId(null);
        action.setProofDocumentResourceType(null);
    }

    private boolean isDone(EcrAction action) {
        return action != null && (action.isChecked() || action.getStatus() == ActionStatus.DONE || action.getStatus() == ActionStatus.DONE_LATE);
    }

    private boolean isReopeningAction(EcrAction currentAction, EcrAction updatedAction) {
        return isDone(currentAction) && !isDone(updatedAction);
    }

    private boolean isCompletingAction(EcrAction currentAction, EcrAction updatedAction) {
        return !isDone(currentAction) && isDone(updatedAction);
    }

    private void recordActionCompleted(AppUser user, EcrAction action) {
        String actionTitle = action.getTitle() == null || action.getTitle().trim().isEmpty()
                ? "action sans titre"
                : action.getTitle().trim();
        String modificationName = action.getRequest() == null || action.getRequest().getModificationNumber() == null || action.getRequest().getModificationNumber().trim().isEmpty()
                ? "modification sans nom"
                : action.getRequest().getModificationNumber().trim();
        String projectName = action.getRequest() == null || action.getRequest().getModificationProject() == null || action.getRequest().getModificationProject().trim().isEmpty()
                ? "projet non renseigne"
                : action.getRequest().getModificationProject().trim();
        auditLogService.recordBusinessEvent(
                user,
                "ACTION_TERMINEE",
                "modification",
                modificationName,
                "Action marquee terminee: " + actionTitle + " - Modification: " + modificationName + " - Projet: " + projectName
        );
    }

    private boolean isActionInCurrentPhase(EcrAction action) {
        return action != null && action.getRequest() != null && action.getStage() == action.getRequest().getCurrentStage();
    }

    private void syncFinalizationDate(EcrAction target, EcrAction source) {
        if (isDone(target)) {
            target.setFinalizationDate(source.getFinalizationDate() == null ? LocalDateTime.now() : source.getFinalizationDate());
        } else {
            target.setFinalizationDate(null);
        }
    }

    private void syncValidationAfterProgressChange(EcrAction action) {
        if (isDone(action)) {
            return;
        }
        action.setValidationStatus(null);
        action.setValidationRequestedAt(null);
        action.setValidationReviewedAt(null);
        action.setValidationReviewedBy(null);
    }

    private boolean isDependencyCompleted(EcrAction action) {
        if (action == null || action.getDependsOnActionId() == null) {
            return true;
        }
        return actionRepository.findById(action.getDependsOnActionId())
                .map(this::isDone)
                .orElse(false);
    }

    private List<EcrAction> enrichActions(List<EcrAction> actions) {
        return actions.stream()
                .map(this::enrichAction)
                .collect(Collectors.toList());
    }

    private EcrAction enrichAction(EcrAction action) {
        if (action != null) {
            action.setValidatorDisplayName(assigneeResolver.displayFor(action.getRequest(), action.getValidatorRole(), action.getValidator()));
        }
        return action;
    }

    private List<EcrAction> visibleActionsForUser(List<EcrAction> actions, AppUser user) {
        Set<Long> visibleIds = actions.stream()
                .filter(action -> accessControlService.canViewAction(user, enrichAction(action)))
                .map(EcrAction::getId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        boolean changed;
        do {
            changed = false;
            for (EcrAction action : actions) {
                if (action.getId() == null || visibleIds.contains(action.getId())) {
                    continue;
                }
                Long dependencyId = action.getDependsOnActionId();
                boolean dependsOnVisibleAction = dependencyId != null && visibleIds.contains(dependencyId);
                boolean visibleActionDependsOnThis = actions.stream()
                        .anyMatch(item -> item.getId() != null
                                && visibleIds.contains(item.getId())
                                && action.getId().equals(item.getDependsOnActionId()));
                if (dependsOnVisibleAction || visibleActionDependsOnThis) {
                    visibleIds.add(action.getId());
                    changed = true;
                }
            }
        } while (changed);
        return actions.stream()
                .filter(action -> action.getId() != null && visibleIds.contains(action.getId()))
                .collect(Collectors.toList());
    }

    private String safeFileName(String fileName) {
        if (fileName == null || fileName.trim().isEmpty()) {
            return "evidence";
        }
        return fileName.replace("\"", "");
    }

    private String contentDisposition(String fileName, String contentType) {
        String disposition = contentType != null && (contentType.equalsIgnoreCase(MediaType.APPLICATION_PDF_VALUE) || contentType.startsWith("image/"))
                ? "inline"
                : "attachment";
        return disposition + "; filename=\"" + safeFileName(fileName) + "\"";
    }
}
