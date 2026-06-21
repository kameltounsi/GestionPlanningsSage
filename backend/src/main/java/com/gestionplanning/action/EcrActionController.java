package com.gestionplanning.action;

import com.gestionplanning.ecr.EcrRequestRepository;
import com.gestionplanning.ecr.EcrStage;
import com.gestionplanning.ecr.EcrTemplateService;
import com.gestionplanning.ecr.PhaseValidationRequestRepository;
import com.gestionplanning.ecr.PhaseValidationStatus;
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
import java.util.HashSet;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class EcrActionController {
    private final EcrActionRepository actionRepository;
    private final EcrActionEvidenceRepository evidenceRepository;
    private final EcrActionAssetRepository assetRepository;
    private final EcrActionProofDocumentRepository proofDocumentRepository;
    private final EcrRequestRepository requestRepository;
    private final ActionPlanningService planningService;
    private final EcrTemplateService templateService;
    private final CloudinaryStorageService storageService;
    private final ActionAssigneeResolver assigneeResolver;
    private final AccessControlService accessControlService;
    private final AuditLogService auditLogService;
    private final ActionStandardSuggestionRepository suggestionRepository;
    private final PhaseValidationRequestRepository validationRepository;

    public EcrActionController(EcrActionRepository actionRepository, EcrActionEvidenceRepository evidenceRepository,
                               EcrActionAssetRepository assetRepository,
                               EcrActionProofDocumentRepository proofDocumentRepository,
                               EcrRequestRepository requestRepository, ActionPlanningService planningService,
                               EcrTemplateService templateService, CloudinaryStorageService storageService,
                               ActionAssigneeResolver assigneeResolver, AccessControlService accessControlService,
                               AuditLogService auditLogService, ActionStandardSuggestionRepository suggestionRepository,
                               PhaseValidationRequestRepository validationRepository) {
        this.actionRepository = actionRepository;
        this.evidenceRepository = evidenceRepository;
        this.assetRepository = assetRepository;
        this.proofDocumentRepository = proofDocumentRepository;
        this.requestRepository = requestRepository;
        this.planningService = planningService;
        this.templateService = templateService;
        this.storageService = storageService;
        this.assigneeResolver = assigneeResolver;
        this.accessControlService = accessControlService;
        this.auditLogService = auditLogService;
        this.suggestionRepository = suggestionRepository;
        this.validationRepository = validationRepository;
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
            if (!accessControlService.isAdmin(user) && !canViewStage(request, stage)) {
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
        return requestRepository.findById(requestId)
                .map(request -> {
                    boolean admin = accessControlService.isAdmin(user);
                    boolean pilot = accessControlService.isRequestPilot(user, request);
                    if (!admin && !pilot) {
                        return ResponseEntity.status(403).<EcrAction>build();
                    }
                    EcrStage actionStage = action.getStage() == null ? request.getCurrentStage() : action.getStage();
                    if (isPhaseApproved(requestId, actionStage)) {
                        return ResponseEntity.status(403).<EcrAction>build();
                    }
                    if (isDone(action) && requiresEvidence(action)) {
                        return ResponseEntity.badRequest().<EcrAction>build();
                    }
                    if (!hasText(action.getResponsible()) || !hasText(action.getValidator())) {
                        return ResponseEntity.badRequest().<EcrAction>build();
                    }
                    if (!isActionStartBeforeNextPhase(request, action, null)) {
                        return ResponseEntity.status(422).<EcrAction>build();
                    }
                    action.setRequest(request);
                    action.setStage(actionStage);
                    action.setResponsible(assigneeResolver.resolve(request, action.getResponsible()));
                    if (isDone(action) && !accessControlService.canCompleteAction(user, action)) {
                        return ResponseEntity.status(403).<EcrAction>build();
                    }
                    action.setValidatorRole(action.getValidator());
                    action.setValidator(action.getValidator());
                    syncFinalizationDate(action, action);
                    EcrAction saved = actionRepository.save(action);
                    if (!admin && pilot) {
                        suggestionRepository.save(suggestionFor(saved, requestLabel(request), displayName(user), request.isNewVersion()));
                    }
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
                .filter(this::canMutateAction)
                .filter(action -> accessControlService.canManageAction(user, action) || canUpdateDuration(user, action))
                .map(action -> {
                    boolean completingAction = isCompletingAction(action, updatedAction);
                    Integer previousDuration = action.getWorkDurationDays();
                    LocalDate previousEndDate = action.getEndDate();
                    if (completingAction && !accessControlService.canCompleteAction(user, action)) {
                        return ResponseEntity.status(403).<EcrAction>build();
                    }
                    if (!accessControlService.isAdmin(user)) {
                        if (!accessControlService.canManageAction(user, action) && canUpdateDuration(user, action)) {
                            return updateActionDuration(action, updatedAction);
                        }
                        return updateActionProgress(action, updatedAction, user);
                    }
                    if (isReopeningAction(action, updatedAction) && !isActionInCurrentPhase(action)) {
                        return ResponseEntity.badRequest().<EcrAction>build();
                    }
                    if (!isActionStartBeforeNextPhase(action.getRequest(), updatedAction, action.getId())) {
                        return ResponseEntity.status(422).<EcrAction>build();
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
                    recalculateAfterActionChange(saved, previousDuration, previousEndDate);
                    if (completingAction) {
                        recordActionCompleted(user, saved);
                    }
                    return ResponseEntity.ok(enrichAction(saved));
                })
                .orElse(ResponseEntity.status(403).build());
    }

    private ResponseEntity<EcrAction> updateActionProgress(EcrAction action, EcrAction updatedAction, AppUser user) {
        boolean completingAction = isCompletingAction(action, updatedAction);
        Integer previousDuration = action.getWorkDurationDays();
        LocalDate previousEndDate = action.getEndDate();
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
        if (canUpdateDuration(user, action)) {
            action.setWorkDurationDays(defaultDuration(updatedAction.getWorkDurationDays()));
        }
        syncFinalizationDate(action, updatedAction);
        syncValidationAfterProgressChange(action);
        EcrAction saved = actionRepository.save(action);
        recalculateAfterActionChange(saved, previousDuration, previousEndDate);
        if (completingAction) {
            recordActionCompleted(user, saved);
        }
        return ResponseEntity.ok(enrichAction(saved));
    }

    private ResponseEntity<EcrAction> updateActionDuration(EcrAction action, EcrAction updatedAction) {
        if (!canChangeDuration(action)) {
            return ResponseEntity.badRequest().build();
        }
        Integer previousDuration = action.getWorkDurationDays();
        LocalDate previousEndDate = action.getEndDate();
        action.setWorkDurationDays(defaultDuration(updatedAction.getWorkDurationDays()));
        EcrAction saved = actionRepository.save(action);
        planningService.recalculateAfterDurationChange(saved, previousDuration, previousEndDate);
        return ResponseEntity.ok(enrichAction(saved));
    }

    private void recalculateAfterActionChange(EcrAction saved, Integer previousDuration, LocalDate previousEndDate) {
        if (!Objects.equals(defaultDuration(previousDuration), defaultDuration(saved.getWorkDurationDays()))) {
            planningService.recalculateAfterDurationChange(saved, previousDuration, previousEndDate);
            return;
        }
        planningService.recalculateRequest(saved.getRequest());
    }

    @PostMapping(value = "/actions/{id}/evidence", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<EcrAction> uploadEvidence(@PathVariable Long id, @RequestParam("file") MultipartFile file,
                                                    @RequestAttribute("authenticatedUser") AppUser user) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return actionRepository.findById(id)
                .filter(action -> accessControlService.canManageAction(user, action) && canMutateAction(action))
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
                .filter(action -> accessControlService.canManageAction(user, action) && canMutateAction(action))
                .map(action -> {
                    StoredAsset asset = storageService.upload(file, "gestion-planning/actions/" + id + "/proof-document");
                    EcrActionProofDocument proofDocument = new EcrActionProofDocument();
                    proofDocument.setAction(action);
                    proofDocument.setFileName(asset.getFileName());
                    proofDocument.setContentType(asset.getContentType());
                    proofDocument.setFileSize(asset.getSize());
                    proofDocument.setFileUrl(asset.getUrl());
                    proofDocument.setPublicId(asset.getPublicId());
                    proofDocument.setResourceType(asset.getResourceType());
                    proofDocumentRepository.save(proofDocument);
                    action.setProofDocument(asset.getFileName());
                    action.setProofDocumentFileName(asset.getFileName());
                    action.setProofDocumentContentType(asset.getContentType());
                    action.setProofDocumentFileSize(asset.getSize());
                    action.setProofDocumentFileUrl(asset.getUrl());
                    action.setProofDocumentPublicId(asset.getPublicId());
                    action.setProofDocumentResourceType(asset.getResourceType());
                    action.setEvidenceRequired(true);
                    EcrAction saved = actionRepository.save(action);
                    syncPendingSuggestionProofDocument(saved);
                    return ResponseEntity.ok(enrichAction(saved));
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
            try {
                DownloadedAsset asset = storageService.download(action.getProofDocumentPublicId(), action.getProofDocumentResourceType(), action.getProofDocumentFileUrl(), action.getProofDocumentContentType());
                return ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(action.getProofDocumentFileName(), asset.getContentType()))
                        .contentType(MediaType.parseMediaType(asset.getContentType()))
                        .body(asset.getData());
            } catch (RuntimeException exception) {
                return ResponseEntity.status(502)
                        .contentType(MediaType.TEXT_PLAIN)
                        .body("Téléchargement impossible depuis Cloudinary. Activez la livraison des fichiers PDF/ZIP dans les paramètres Security de Cloudinary, puis réessayez.");
            }
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/action-proof-documents/{proofDocumentId}/download")
    public ResponseEntity<?> downloadActionProofDocument(@PathVariable Long proofDocumentId) {
        return proofDocumentRepository.findById(proofDocumentId)
                .<ResponseEntity<?>>map(proofDocument -> {
                    try {
                        DownloadedAsset asset = storageService.download(proofDocument.getPublicId(), proofDocument.getResourceType(), proofDocument.getFileUrl(), proofDocument.getContentType());
                        return ResponseEntity.ok()
                                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(proofDocument.getFileName(), asset.getContentType()))
                                .contentType(MediaType.parseMediaType(asset.getContentType()))
                                .body(asset.getData());
                    } catch (RuntimeException exception) {
                        return ResponseEntity.status(502)
                                .contentType(MediaType.TEXT_PLAIN)
                                .body("Téléchargement impossible depuis Cloudinary. Activez la livraison des fichiers PDF/ZIP dans les paramètres Security de Cloudinary, puis réessayez.");
                    }
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/actions/{id}/proof-document")
    @Transactional
    public ResponseEntity<EcrAction> deleteProofDocument(@PathVariable Long id,
                                                         @RequestAttribute("authenticatedUser") AppUser user) {
        return actionRepository.findById(id)
                .filter(action -> accessControlService.canManageAction(user, action) && canMutateAction(action))
                .map(action -> {
                    storageService.deleteQuietly(action.getProofDocumentPublicId(), action.getProofDocumentResourceType());
                    proofDocumentRepository.findByAction_IdOrderByUploadedAtDescIdDesc(id)
                            .forEach(proofDocument -> storageService.deleteQuietly(proofDocument.getPublicId(), proofDocument.getResourceType()));
                    proofDocumentRepository.deleteByAction_Id(id);
                    clearProofDocument(action);
                    return ResponseEntity.ok(enrichAction(actionRepository.save(action)));
                })
                .orElse(ResponseEntity.status(403).build());
    }

    @DeleteMapping("/action-proof-documents/{proofDocumentId}")
    @Transactional
    public ResponseEntity<EcrAction> deleteActionProofDocument(@PathVariable Long proofDocumentId,
                                                               @RequestAttribute("authenticatedUser") AppUser user) {
        return proofDocumentRepository.findById(proofDocumentId)
                .filter(proofDocument -> accessControlService.canManageAction(user, proofDocument.getAction()) && canMutateAction(proofDocument.getAction()))
                .map(proofDocument -> {
                    EcrAction action = proofDocument.getAction();
                    storageService.deleteQuietly(proofDocument.getPublicId(), proofDocument.getResourceType());
                    proofDocumentRepository.delete(proofDocument);
                    proofDocumentRepository.flush();
                    syncLatestProofDocumentMetadata(action);
                    return ResponseEntity.ok(enrichAction(actionRepository.save(action)));
                })
                .orElse(ResponseEntity.status(403).build());
    }

    @GetMapping("/action-assets/{assetId}/download")
    public ResponseEntity<?> downloadActionAsset(@PathVariable Long assetId) {
        return assetRepository.findById(assetId)
                .<ResponseEntity<?>>map(actionAsset -> {
                    try {
                        DownloadedAsset asset = storageService.download(actionAsset.getPublicId(), actionAsset.getResourceType(), actionAsset.getFileUrl(), actionAsset.getContentType());
                        return ResponseEntity.ok()
                                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(actionAsset.getFileName(), asset.getContentType()))
                                .contentType(MediaType.parseMediaType(asset.getContentType()))
                                .body(asset.getData());
                    } catch (CloudinaryStorageService.DownloadException exception) {
                        return cloudinaryDownloadError(exception);
                    }
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/action-assets/{assetId}")
    @Transactional
    public ResponseEntity<EcrAction> deleteActionAsset(@PathVariable Long assetId,
                                                       @RequestAttribute("authenticatedUser") AppUser user) {
        return assetRepository.findById(assetId)
                .filter(asset -> accessControlService.canManageAction(user, asset.getAction()) && canMutateAction(asset.getAction()))
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
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id, @RequestAttribute("authenticatedUser") AppUser user) {
        return actionRepository.findById(id).map(action -> {
            if (!canDeleteAction(user, action)) {
                return ResponseEntity.status(403).<Void>build();
            }
            Long requestId = action.getRequestId();
            assetRepository.findByAction_IdOrderByUploadedAtDescIdDesc(id)
                    .forEach(asset -> storageService.deleteQuietly(asset.getPublicId(), asset.getResourceType()));
            storageService.deleteQuietly(action.getEvidencePublicId(), action.getEvidenceResourceType());
            storageService.deleteQuietly(action.getProofDocumentPublicId(), action.getProofDocumentResourceType());
            proofDocumentRepository.findByAction_IdOrderByUploadedAtDescIdDesc(id)
                    .forEach(proofDocument -> storageService.deleteQuietly(proofDocument.getPublicId(), proofDocument.getResourceType()));
            assetRepository.deleteByAction_Id(id);
            proofDocumentRepository.deleteByAction_Id(id);
            deleteLocalEvidenceIfPresent(id);
            actionRepository.deleteById(id);
            requestRepository.findById(requestId).ifPresent(planningService::recalculateRequest);
            return ResponseEntity.noContent().<Void>build();
        }).orElse(ResponseEntity.notFound().build());
    }

    private boolean canDeleteAction(AppUser user, EcrAction action) {
        if (!canMutateAction(action)) {
            return false;
        }
        if (accessControlService.isAdmin(user)) {
            return true;
        }
        return accessControlService.isRequestPilot(user, action == null ? null : action.getRequest())
                && canMutateAction(action);
    }

    private boolean canMutateAction(EcrAction action) {
        return !isActionPhaseApproved(action);
    }

    private boolean isActionPhaseApproved(EcrAction action) {
        if (action == null || action.getRequestId() == null || action.getStage() == null) {
            return false;
        }
        return isPhaseApproved(action.getRequestId(), action.getStage());
    }

    private boolean isPhaseApproved(Long requestId, EcrStage stage) {
        if (requestId == null || stage == null) {
            return false;
        }
        return validationRepository.findFirstByRequest_IdAndStageOrderByRequestedAtDescIdDesc(requestId, stage)
                .map(validation -> validation.getStatus() == PhaseValidationStatus.APPROVED)
                .orElse(false);
    }

    private boolean canViewStage(com.gestionplanning.ecr.EcrRequest request, EcrStage stage) {
        if (stage == null) {
            return true;
        }
        if (stage == EcrStage.CANCELLED && request.getCurrentStage() != EcrStage.CANCELLED) {
            return false;
        }
        if (request.getCurrentStage() == EcrStage.CANCELLED) {
            if (stage == EcrStage.CANCELLED) {
                return true;
            }
            List<EcrStage> stages = EcrStage.allowedStages(request.isNewVersion());
            int stageIndex = stages.indexOf(stage);
            int cancelledFromIndex = stages.indexOf(request.getCancelledFromStage());
            return stageIndex >= 0 && cancelledFromIndex >= 0 && stageIndex <= cancelledFromIndex;
        }
        List<EcrStage> stages = EcrStage.allowedStages(request.isNewVersion());
        int stageIndex = stages.indexOf(stage);
        int currentIndex = stages.indexOf(request.getCurrentStage());
        return stageIndex >= 0 && currentIndex >= 0 && stageIndex <= currentIndex;
    }

    private boolean canUpdateDuration(AppUser user, EcrAction action) {
        return accessControlService.isRequestPilot(user, action == null ? null : action.getRequest())
                && canChangeDuration(action);
    }

    private boolean canChangeDuration(EcrAction action) {
        return action != null
                && action.getRequest() != null
                && action.getRequest().getCurrentStage() != EcrStage.CLOSED
                && action.getRequest().getCurrentStage() != EcrStage.CANCELLED
                && !isActionPhaseApproved(action);
    }

    private int defaultDuration(Integer duration) {
        return duration == null ? 1 : Math.max(0, duration);
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

    private void syncLatestProofDocumentMetadata(EcrAction action) {
        if (action == null || action.getId() == null) {
            return;
        }
        List<EcrActionProofDocument> remainingDocuments = proofDocumentRepository.findByAction_IdOrderByUploadedAtDescIdDesc(action.getId());
        if (remainingDocuments.isEmpty()) {
            clearProofDocument(action);
            return;
        }
        EcrActionProofDocument latest = remainingDocuments.get(0);
        action.setProofDocument(latest.getFileName());
        action.setProofDocumentFileName(latest.getFileName());
        action.setProofDocumentContentType(latest.getContentType());
        action.setProofDocumentFileSize(latest.getFileSize());
        action.setProofDocumentFileUrl(latest.getFileUrl());
        action.setProofDocumentPublicId(latest.getPublicId());
        action.setProofDocumentResourceType(latest.getResourceType());
        action.setEvidenceRequired(true);
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
        return action != null && (hasText(action.getProofDocumentFileName())
                || hasText(action.getProofDocumentFileUrl())
                || action.getId() != null && !proofDocumentRepository.findByAction_IdOrderByUploadedAtDescIdDesc(action.getId()).isEmpty());
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

    private boolean isActionStartBeforeNextPhase(com.gestionplanning.ecr.EcrRequest request, EcrAction action, Long excludedActionId) {
        if (request == null || request.getId() == null || action == null) {
            return true;
        }
        EcrStage stage = action.getStage() == null ? request.getCurrentStage() : action.getStage();
        List<EcrStage> stages = EcrStage.allowedStages(request.isNewVersion());
        int stageIndex = stages.indexOf(stage);
        if (stageIndex < 0 || stageIndex >= stages.size() - 1) {
            return true;
        }
        List<EcrAction> requestActions = actionRepository.findByRequest_IdOrderByDeadlineAscIdAsc(request.getId()).stream()
                .filter(item -> excludedActionId == null || !Objects.equals(item.getId(), excludedActionId))
                .collect(Collectors.toList());
        Optional<LocalDate> nextPhaseStart = requestActions.stream()
                .filter(item -> stages.indexOf(item.getStage()) > stageIndex)
                .map(EcrAction::getStartDate)
                .filter(Objects::nonNull)
                .min(LocalDate::compareTo);
        if (!nextPhaseStart.isPresent()) {
            return true;
        }
        LocalDate proposedStart = action.getStartDate() == null ? estimatedStartForNewLocalAction(request, stage, requestActions) : action.getStartDate();
        return proposedStart == null || !proposedStart.isAfter(nextPhaseStart.get());
    }

    private LocalDate estimatedStartForNewLocalAction(com.gestionplanning.ecr.EcrRequest request, EcrStage stage, List<EcrAction> requestActions) {
        LocalDate fallbackStart = request.getReceptionDate() == null ? LocalDate.now() : request.getReceptionDate();
        List<EcrStage> stages = EcrStage.allowedStages(request.isNewVersion());
        LocalDate phaseStart = fallbackStart;
        for (EcrStage currentStage : stages) {
            List<EcrAction> stageActions = requestActions.stream()
                    .filter(item -> item.getStage() == currentStage)
                    .collect(Collectors.toList());
            if (currentStage == stage) {
                return stageActions.stream()
                        .map(EcrAction::getEndDate)
                        .filter(Objects::nonNull)
                        .max(LocalDate::compareTo)
                        .map(date -> date.plusDays(1))
                        .orElse(phaseStart);
            }
            if (!stageActions.isEmpty()) {
                phaseStart = stageActions.stream()
                        .map(EcrAction::getEndDate)
                        .filter(Objects::nonNull)
                        .max(LocalDate::compareTo)
                        .map(date -> date.plusDays(1))
                        .orElse(phaseStart);
            }
        }
        return phaseStart;
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
                "Action marquée terminée: " + actionTitle + " - Modification: " + modificationName + " - Projet: " + projectName
        );
    }

    private ActionStandardSuggestion suggestionFor(EcrAction action, String requestLabel, String createdBy, boolean newProject) {
        ActionStandardSuggestion suggestion = new ActionStandardSuggestion();
        suggestion.setActionId(action.getId());
        suggestion.setRequestId(action.getRequestId());
        suggestion.setRequestLabel(requestLabel);
        suggestion.setNewProject(newProject);
        suggestion.setStage(action.getStage());
        suggestion.setActionTitle(action.getTitle());
        suggestion.setTopicRisk(action.getTopicRisk());
        suggestion.setResponsible(action.getResponsible());
        suggestion.setValidator(action.getValidator());
        suggestion.setCriticality(action.getCriticality());
        suggestion.setExpectedEvidence(action.getExpectedEvidence());
        suggestion.setEvidenceRequired(action.isEvidenceRequired());
        suggestion.setProofDocument(action.getProofDocument());
        suggestion.setProofDocumentFileName(action.getProofDocumentFileName());
        suggestion.setProofDocumentContentType(action.getProofDocumentContentType());
        suggestion.setProofDocumentFileSize(action.getProofDocumentFileSize());
        suggestion.setProofDocumentFileUrl(action.getProofDocumentFileUrl());
        suggestion.setProofDocumentPublicId(action.getProofDocumentPublicId());
        suggestion.setProofDocumentResourceType(action.getProofDocumentResourceType());
        suggestion.setDependencyAnchor(action.getDependencyAnchor());
        suggestion.setDurationDays(action.getWorkDurationDays());
        suggestion.setCreatedBy(createdBy);
        return suggestion;
    }

    private void syncPendingSuggestionProofDocument(EcrAction action) {
        if (action == null || action.getId() == null) {
            return;
        }
        suggestionRepository.findFirstByActionIdAndStatus(action.getId(), ActionStandardSuggestionStatus.PENDING)
                .ifPresent(suggestion -> {
                    suggestion.setEvidenceRequired(action.isEvidenceRequired());
                    suggestion.setProofDocument(action.getProofDocument());
                    suggestion.setProofDocumentFileName(action.getProofDocumentFileName());
                    suggestion.setProofDocumentContentType(action.getProofDocumentContentType());
                    suggestion.setProofDocumentFileSize(action.getProofDocumentFileSize());
                    suggestion.setProofDocumentFileUrl(action.getProofDocumentFileUrl());
                    suggestion.setProofDocumentPublicId(action.getProofDocumentPublicId());
                    suggestion.setProofDocumentResourceType(action.getProofDocumentResourceType());
                    suggestionRepository.save(suggestion);
                });
    }

    private String requestLabel(com.gestionplanning.ecr.EcrRequest request) {
        if (request == null) return "-";
        if (request.getModificationNumber() != null && !request.getModificationNumber().trim().isEmpty()) {
            return request.getModificationNumber();
        }
        if (request.getClient() != null && !request.getClient().trim().isEmpty()) {
            return request.getClient();
        }
        return "Modification " + request.getId();
    }

    private String displayName(AppUser user) {
        if (user == null) return "";
        return user.getFullName() == null || user.getFullName().trim().isEmpty() ? user.getEmail() : user.getFullName();
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
        List<EcrAction> enrichedActions = enrichActions(actions);
        Set<Long> visibleIds = enrichedActions.stream()
                .filter(action -> accessControlService.canViewAction(user, action))
                .map(EcrAction::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(HashSet::new));
        boolean changed;
        do {
            changed = false;
            Set<Long> currentVisibleIds = new HashSet<>(visibleIds);
            for (EcrAction action : enrichedActions) {
                Long actionId = action.getId();
                Long dependencyId = action.getDependsOnActionId();
                if (actionId == null || dependencyId == null) {
                    continue;
                }
                if (currentVisibleIds.contains(actionId) && visibleIds.add(dependencyId)) {
                    changed = true;
                }
                if (currentVisibleIds.contains(dependencyId) && visibleIds.add(actionId)) {
                    changed = true;
                }
            }
        } while (changed);
        return enrichedActions.stream()
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

    private ResponseEntity<String> cloudinaryDownloadError(CloudinaryStorageService.DownloadException exception) {
        String message = exception.isNotFound()
                ? "Fichier introuvable dans Cloudinary. Il a peut-être été supprimé ou déplacé."
                : "Téléchargement impossible depuis Cloudinary. Réessayez plus tard ou vérifiez la configuration Cloudinary.";
        return ResponseEntity.status(exception.isNotFound() ? 404 : 502)
                .contentType(MediaType.TEXT_PLAIN)
                .body(message);
    }
}
