package com.gestionplanning.action;

import com.gestionplanning.ecr.EcrRequestRepository;
import com.gestionplanning.ecr.EcrStage;
import com.gestionplanning.ecr.EcrTemplateService;
import com.gestionplanning.ecr.PhaseValidationRequestRepository;
import com.gestionplanning.ecr.PhaseValidationStatus;
import com.gestionplanning.audit.AuditLogService;
import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.auth.AuthenticatedUserService;
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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class EcrActionController {
    private static final String MODIFICATION_DETAIL_SEPARATOR = " - Modification: ";

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
    private final AuthenticatedUserService authenticatedUserService;

    @SuppressWarnings("java:S107")
    public EcrActionController(EcrActionRepository actionRepository, EcrActionEvidenceRepository evidenceRepository,
                               EcrActionAssetRepository assetRepository,
                               EcrActionProofDocumentRepository proofDocumentRepository,
                               EcrRequestRepository requestRepository, ActionPlanningService planningService,
                               EcrTemplateService templateService, CloudinaryStorageService storageService,
                               ActionAssigneeResolver assigneeResolver, AccessControlService accessControlService,
                               AuditLogService auditLogService, ActionStandardSuggestionRepository suggestionRepository,
                               PhaseValidationRequestRepository validationRepository,
                               AuthenticatedUserService authenticatedUserService) {
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
        this.authenticatedUserService = authenticatedUserService;
    }

    @GetMapping("/actions")
    public List<EcrActionDto> list(@RequestParam(required = false) Boolean late) {
        if (Boolean.TRUE.equals(late)) {
            List<EcrAction> actions = actionRepository.findByDeadlineBeforeAndStatusNotInOrderByDeadlineAsc(LocalDate.now(ZoneId.systemDefault()), Arrays.asList(ActionStatus.DONE, ActionStatus.DONE_LATE));
            planningService.refreshActionStatuses(actions);
            return toDtos(enrichActions(actionRepository.saveAll(actions).stream()
                    .filter(action -> action.getStatus() != ActionStatus.DONE && action.getStatus() != ActionStatus.DONE_LATE)
                    .collect(Collectors.toList())));
        }
        List<EcrAction> actions = actionRepository.findAll();
        planningService.refreshActionStatuses(actions);
        return toDtos(enrichActions(actionRepository.saveAll(actions)));
    }

    @GetMapping("/ecr-requests/{requestId}/actions")
    public ResponseEntity<List<EcrActionDto>> listByRequest(@PathVariable Long requestId, @RequestParam(required = false) EcrStage stage,
                                                         @RequestAttribute("authenticatedUserId") Long userId) {
        AppUser user = authenticatedUserService.require(userId);
        Optional<com.gestionplanning.ecr.EcrRequest> optionalRequest = requestRepository.findById(requestId);
        if (!optionalRequest.isPresent()) {
            return ResponseEntity.notFound().build();
        }
        com.gestionplanning.ecr.EcrRequest request = optionalRequest.get();
        boolean admin = accessControlService.isAdmin(user);
        if (!admin && !accessControlService.canAccessRequest(user, request)) {
            return ResponseEntity.status(403).build();
        }
        if (!actionRepository.existsByRequest_Id(requestId)) {
            templateService.ensureActionsFor(request);
        }
        if (!admin) {
            if (stage != null && !canViewStage(request, stage)) {
                return ResponseEntity.ok(java.util.Collections.<EcrActionDto>emptyList());
            }
        }
        boolean canSeeAllActions = accessControlService.canSeeAllActions(user, request);
        List<EcrAction> actions = loadRequestActions(requestId, stage, !admin && !canSeeAllActions);
        planningService.refreshActionStatuses(actions);
        if (!admin) {
            actions = actions.stream()
                    .filter(action -> canViewStage(request, action.getStage()))
                    .collect(Collectors.toList());
        }
        if (!canSeeAllActions) {
            actions = visibleActionsForUser(actions, user);
        }
        if (stage != null) {
            actions = actions.stream()
                    .filter(action -> action.getStage() == stage)
                    .collect(Collectors.toList());
        }
        return ResponseEntity.ok(toDtos(enrichActions(actions)));
    }

    private List<EcrAction> loadRequestActions(Long requestId, EcrStage stage, boolean needsFullActionGraph) {
        if (stage != null && !needsFullActionGraph) {
            return actionRepository.findByRequest_IdAndStageOrderByStartDateAscEndDateAscDeadlineAscCreatedAtAscIdAsc(requestId, stage);
        }
        return actionRepository.findByRequest_IdOrderByStartDateAscEndDateAscDeadlineAscCreatedAtAscIdAsc(requestId);
    }

    @PostMapping("/ecr-requests/{requestId}/actions")
    @Transactional
    @SuppressWarnings("java:S3776")
    public ResponseEntity<EcrActionDto> create(@PathVariable Long requestId, @Valid @RequestBody EcrActionDto actionDto,
                                            @RequestAttribute("authenticatedUserId") Long userId) {
        AppUser user = authenticatedUserService.require(userId);
        EcrAction action = actionDto.toEntity();
        return requestRepository.findById(requestId)
                .map(request -> {
                    if (isTerminalRequest(request)) {
                        return ResponseEntity.status(403).<EcrActionDto>build();
                    }
                    boolean admin = accessControlService.isAdmin(user);
                    boolean pilot = accessControlService.isRequestPilot(user, request);
                    if (!admin && !pilot) {
                        return ResponseEntity.status(403).<EcrActionDto>build();
                    }
                    action.setRoutineAction(false);
                    action.setRecurrenceIntervalDays(null);
                    EcrStage actionStage = action.getStage() == null ? request.getCurrentStage() : action.getStage();
                    if (request.getCurrentStage() == EcrStage.CANCELLED && actionStage != EcrStage.CANCELLED) {
                        return ResponseEntity.status(403).<EcrActionDto>build();
                    }
                    if (isPhaseApproved(requestId, actionStage)) {
                        return ResponseEntity.status(403).<EcrActionDto>build();
                    }
                    if (isDone(action) && requiresEvidence(action)) {
                        return ResponseEntity.badRequest().<EcrActionDto>build();
                    }
                    if (!hasText(action.getResponsible()) || !hasText(action.getValidator())) {
                        return ResponseEntity.badRequest().<EcrActionDto>build();
                    }
                    if (!isActionStartBeforeNextPhase(request, action, null)) {
                        return ResponseEntity.status(422).<EcrActionDto>build();
                    }
                    action.setRequest(request);
                    action.setStage(actionStage);
                    action.setDurationOverridden(true);
                    if (!isValidPreviousDependency(action, action.getDependsOnActionId(), actionStage)) {
                        return ResponseEntity.status(422).<EcrActionDto>build();
                    }
                    if (isDone(action) && !isDependencyCompleted(action)) {
                        return ResponseEntity.badRequest().<EcrActionDto>build();
                    }
                    action.setResponsible(assigneeResolver.resolve(request, action.getResponsible()));
                    if (isDone(action) && !accessControlService.canCompleteAction(user, action)) {
                        return ResponseEntity.status(403).<EcrActionDto>build();
                    }
                    String validatorRole = action.getValidator();
                    action.setValidatorRole(validatorRole);
                    action.setValidator(assigneeResolver.resolveOptional(request, validatorRole));
                    if (isDone(action)) {
                        freezeActionAssignees(action);
                    }
                    syncFinalizationDate(action, action);
                    EcrAction saved = actionRepository.save(action);
                    if (!admin && pilot) {
                        suggestionRepository.save(suggestionFor(saved, requestLabel(request), displayName(user), request.isNewVersion()));
                    }
                    planningService.recalculateRequest(request);
                    return ResponseEntity.created(URI.create("/api/actions/" + saved.getId())).body(toDto(enrichAction(saved)));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/actions/{id}")
    @Transactional
    @SuppressWarnings("java:S3776")
    public ResponseEntity<EcrActionDto> update(@PathVariable Long id, @Valid @RequestBody EcrActionDto updatedActionDto,
                                            @RequestAttribute("authenticatedUserId") Long userId) {
        AppUser user = authenticatedUserService.require(userId);
        EcrAction updatedAction = updatedActionDto.toEntity();
        return actionRepository.findById(id)
                .filter(this::canMutateAction)
                .filter(action -> accessControlService.canManageAction(user, action) || canUpdateDuration(user, action))
                .map(action -> {
                    boolean completingAction = isCompletingAction(action, updatedAction);
                    Integer previousDuration = action.getWorkDurationDays();
                    LocalDate previousEndDate = action.getEndDate();
                    if (completingAction && !accessControlService.canCompleteAction(user, action)) {
                        return ResponseEntity.status(403).<EcrActionDto>build();
                    }
                    if (!accessControlService.isAdmin(user)) {
                        if (!accessControlService.canManageAction(user, action) && canUpdateDuration(user, action)) {
                            return updateActionDuration(action, updatedAction);
                        }
                        return updateActionProgress(action, updatedAction, user);
                    }
                    if (isReopeningAction(action, updatedAction) && !isActionInCurrentPhase(action)) {
                        return ResponseEntity.badRequest().<EcrActionDto>build();
                    }
                    if (!isActionStartBeforeNextPhase(action.getRequest(), updatedAction, action.getId())) {
                        return ResponseEntity.status(422).<EcrActionDto>build();
                    }
                    action.setTitle(updatedAction.getTitle());
                    action.setDescription(updatedAction.getDescription());
                    action.setTopicRisk(updatedAction.getTopicRisk());
                    action.setResponsible(assigneeResolver.resolve(action.getRequest(), updatedAction.getResponsible()));
                    String validatorRole = updatedAction.getValidatorRole() == null || updatedAction.getValidatorRole().trim().isEmpty() ? updatedAction.getValidator() : updatedAction.getValidatorRole();
                    action.setValidatorRole(validatorRole);
                    action.setValidator(assigneeResolver.resolveOptional(action.getRequest(), validatorRole));
                    action.setCriticality(updatedAction.getCriticality());
                    action.setExpectedEvidence(updatedAction.getExpectedEvidence());
                    action.setEvidenceRequired(updatedAction.isEvidenceRequired());
                    action.setEvidence(updatedAction.getEvidence());
                    action.setProofDocument(updatedAction.getProofDocument());
                    if (isDone(updatedAction) && requiresEvidence(updatedAction) && !hasEvidence(action)) {
                        return ResponseEntity.badRequest().<EcrActionDto>build();
                    }
                    if (isDone(updatedAction) && !isDependencyCompleted(action)) {
                        return ResponseEntity.badRequest().<EcrActionDto>build();
                    }
                    action.setChecked(updatedAction.isChecked());
                    action.setDeadline(updatedAction.getDeadline());
                    action.setDate1(updatedAction.getDate1());
                    action.setDate2(updatedAction.getDate2());
                    action.setDate3(updatedAction.getDate3());
                    action.setStartDate(updatedAction.getStartDate());
                    action.setEndDate(updatedAction.getEndDate());
                    action.setWorkDurationDays(updatedAction.getWorkDurationDays());
                    action.setDurationOverridden(action.isDurationOverridden() || !Objects.equals(defaultDuration(previousDuration), defaultDuration(updatedAction.getWorkDurationDays())));
                    EcrStage updatedStage = updatedAction.getStage() == null ? action.getStage() : updatedAction.getStage();
                    if (!isValidPreviousDependency(action, updatedAction.getDependsOnActionId(), updatedStage)) {
                        return ResponseEntity.status(422).<EcrActionDto>build();
                    }
                    action.setDependsOnActionId(updatedAction.getDependsOnActionId());
                    action.setDependencyAnchor(updatedAction.getDependencyAnchor());
                    action.setStage(updatedStage);
                    if (isDone(updatedAction) && !isDependencyCompleted(action)) {
                        return ResponseEntity.badRequest().<EcrActionDto>build();
                    }
                    action.setStatus(updatedAction.getStatus());
                    action.setClosedDate(updatedAction.getClosedDate());
                    syncFinalizationDate(action, updatedAction);
                    if (isDone(action)) {
                        freezeActionAssignees(action);
                    }
                    syncValidationAfterProgressChange(action);
                    action.setComment(updatedAction.getComment());
                    action.setDossierReview(updatedAction.getDossierReview());
                    EcrAction saved = actionRepository.save(action);
                    recalculateAfterActionChange(saved, previousDuration, previousEndDate);
                    if (completingAction) {
                        recordActionCompleted(user, saved);
                    }
                    return ResponseEntity.ok(toDto(enrichAction(saved)));
                })
                .orElse(ResponseEntity.status(403).build());
    }

    private ResponseEntity<EcrActionDto> updateActionProgress(EcrAction action, EcrAction updatedAction, AppUser user) {
        if (updatedAction == null) {
            return ResponseEntity.badRequest().build();
        }
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
            action.setDurationOverridden(action.isDurationOverridden() || !Objects.equals(defaultDuration(previousDuration), defaultDuration(updatedAction.getWorkDurationDays())));
        }
        syncFinalizationDate(action, updatedAction);
        if (isDone(action)) {
            freezeActionAssignees(action);
        }
        syncValidationAfterProgressChange(action);
        EcrAction saved = actionRepository.save(action);
        recalculateAfterActionChange(saved, previousDuration, previousEndDate);
        if (completingAction) {
            recordActionCompleted(user, saved);
        }
        return ResponseEntity.ok(toDto(enrichAction(saved)));
    }

    private ResponseEntity<EcrActionDto> updateActionDuration(EcrAction action, EcrAction updatedAction) {
        if (!canChangeDuration(action)) {
            return ResponseEntity.badRequest().build();
        }
        Integer previousDuration = action.getWorkDurationDays();
        LocalDate previousEndDate = action.getEndDate();
        action.setWorkDurationDays(defaultDuration(updatedAction.getWorkDurationDays()));
        action.setDurationOverridden(true);
        EcrAction saved = actionRepository.save(action);
        planningService.recalculateAfterDurationChange(saved, previousDuration, previousEndDate);
        return ResponseEntity.ok(toDto(enrichAction(saved)));
    }

    private void recalculateAfterActionChange(EcrAction saved, Integer previousDuration, LocalDate previousEndDate) {
        if (!Objects.equals(defaultDuration(previousDuration), defaultDuration(saved.getWorkDurationDays()))) {
            planningService.recalculateAfterDurationChange(saved, previousDuration, previousEndDate);
            return;
        }
        planningService.recalculateRequest(saved.getRequest());
    }

    @PostMapping(value = "/actions/{id}/evidence", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<EcrActionDto> uploadEvidence(@PathVariable Long id, @RequestParam("file") MultipartFile file,
                                                    @RequestAttribute("authenticatedUserId") Long userId) {
        AppUser user = authenticatedUserService.require(userId);
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return actionRepository.findById(id)
                .filter(action -> accessControlService.canCompleteAction(user, action) && canMutateAction(action))
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
                    return ResponseEntity.ok(toDto(enrichAction(actionRepository.save(action))));
                })
                .orElse(ResponseEntity.status(403).build());
    }

    @PostMapping("/actions/{id}/evidence-link")
    public ResponseEntity<EcrActionDto> addEvidenceLink(@PathVariable Long id, @RequestBody LinkPayload payload,
                                                     @RequestAttribute("authenticatedUserId") Long userId) {
        AppUser user = authenticatedUserService.require(userId);
        String url = normalizeSharedLink(payload == null ? null : payload.getUrl());
        if (url == null) {
            return ResponseEntity.badRequest().build();
        }
        return actionRepository.findById(id)
                .filter(action -> accessControlService.canCompleteAction(user, action) && canMutateAction(action))
                .map(action -> {
                    String label = normalizeText(payload.getName());
                    EcrActionAsset actionAsset = new EcrActionAsset();
                    actionAsset.setAction(action);
                    actionAsset.setFileName(label == null ? url : label);
                    actionAsset.setContentType(MediaType.TEXT_PLAIN_VALUE);
                    actionAsset.setFileSize(null);
                    actionAsset.setFileUrl(url);
                    actionAsset.setPublicId(null);
                    actionAsset.setResourceType("link");
                    assetRepository.save(actionAsset);
                    action.setEvidenceFileName(actionAsset.getFileName());
                    action.setEvidenceContentType(actionAsset.getContentType());
                    action.setEvidenceFileSize(null);
                    action.setEvidenceFileUrl(url);
                    action.setEvidencePublicId(null);
                    action.setEvidenceResourceType("link");
                    action.setEvidence(actionAsset.getFileName());
                    return ResponseEntity.ok(toDto(enrichAction(actionRepository.save(action))));
                })
                .orElse(ResponseEntity.status(403).build());
    }

    @PostMapping(value = "/actions/{id}/proof-document", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<EcrActionDto> uploadProofDocument(@PathVariable Long id, @RequestParam("file") MultipartFile file,
                                                         @RequestAttribute("authenticatedUserId") Long userId) {
        AppUser user = authenticatedUserService.require(userId);
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
                    return ResponseEntity.ok(toDto(enrichAction(saved)));
                })
                .orElse(ResponseEntity.status(403).build());
    }

    @PostMapping("/actions/{id}/proof-document-link")
    public ResponseEntity<EcrActionDto> addProofDocumentLink(@PathVariable Long id, @RequestBody LinkPayload payload,
                                                          @RequestAttribute("authenticatedUserId") Long userId) {
        AppUser user = authenticatedUserService.require(userId);
        String url = normalizeSharedLink(payload == null ? null : payload.getUrl());
        if (url == null) {
            return ResponseEntity.badRequest().build();
        }
        return actionRepository.findById(id)
                .filter(action -> accessControlService.canManageAction(user, action) && canMutateAction(action))
                .map(action -> {
                    String label = normalizeText(payload.getName());
                    EcrActionProofDocument proofDocument = new EcrActionProofDocument();
                    proofDocument.setAction(action);
                    proofDocument.setFileName(label == null ? url : label);
                    proofDocument.setContentType(MediaType.TEXT_PLAIN_VALUE);
                    proofDocument.setFileSize(null);
                    proofDocument.setFileUrl(url);
                    proofDocument.setPublicId(null);
                    proofDocument.setResourceType("link");
                    proofDocumentRepository.save(proofDocument);
                    action.setProofDocument(proofDocument.getFileName());
                    action.setProofDocumentFileName(proofDocument.getFileName());
                    action.setProofDocumentContentType(proofDocument.getContentType());
                    action.setProofDocumentFileSize(null);
                    action.setProofDocumentFileUrl(url);
                    action.setProofDocumentPublicId(null);
                    action.setProofDocumentResourceType("link");
                    action.setEvidenceRequired(true);
                    EcrAction saved = actionRepository.save(action);
                    syncPendingSuggestionProofDocument(saved);
                    return ResponseEntity.ok(toDto(enrichAction(saved)));
                })
                .orElse(ResponseEntity.status(403).build());
    }

    @GetMapping("/actions/{id}/evidence")
    public ResponseEntity<Object> downloadEvidence(@PathVariable Long id) {
        return actionRepository.findById(id).<ResponseEntity<Object>>map(action -> {
            if (isExternalLink(action.getEvidenceFileUrl(), action.getEvidencePublicId(), action.getEvidenceResourceType())) {
                return ResponseEntity.status(302).location(URI.create(action.getEvidenceFileUrl())).build();
            }
            if (isSharedReference(action.getEvidenceFileUrl(), action.getEvidencePublicId(), action.getEvidenceResourceType())) {
                return sharedReferenceResponse(action.getEvidenceFileName(), action.getEvidenceFileUrl());
            }
            if (action.getEvidenceFileUrl() != null && !action.getEvidenceFileUrl().trim().isEmpty()) {
                DownloadedAsset asset = storageService.download(action.getEvidencePublicId(), action.getEvidenceResourceType(), action.getEvidenceFileUrl(), action.getEvidenceContentType());
                return ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(action.getEvidenceFileName(), asset.getContentType()))
                        .contentType(MediaType.parseMediaType(asset.getContentType()))
                            .body(asset.getData());
            }
            return evidenceRepository.findById(id)
                    .<ResponseEntity<Object>>map(evidence -> ResponseEntity.ok()
                            .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(action.getEvidenceFileName(), action.getEvidenceContentType()))
                            .contentType(MediaType.parseMediaType(action.getEvidenceContentType() == null ? MediaType.APPLICATION_OCTET_STREAM_VALUE : action.getEvidenceContentType()))
                            .body(evidence.getData()))
                    .orElseGet(() -> ResponseEntity.notFound().build());
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/actions/{id}/proof-document")
    public ResponseEntity<Object> downloadProofDocument(@PathVariable Long id) {
        return actionRepository.findById(id).<ResponseEntity<Object>>map(action -> {
            if (action.getProofDocumentFileUrl() == null || action.getProofDocumentFileUrl().trim().isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            if (isExternalLink(action.getProofDocumentFileUrl(), action.getProofDocumentPublicId(), action.getProofDocumentResourceType())) {
                return ResponseEntity.status(302).location(URI.create(action.getProofDocumentFileUrl())).build();
            }
            if (isSharedReference(action.getProofDocumentFileUrl(), action.getProofDocumentPublicId(), action.getProofDocumentResourceType())) {
                return sharedReferenceResponse(action.getProofDocumentFileName(), action.getProofDocumentFileUrl());
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
    public ResponseEntity<Object> downloadActionProofDocument(@PathVariable Long proofDocumentId) {
        return proofDocumentRepository.findById(proofDocumentId)
                .<ResponseEntity<Object>>map(proofDocument -> {
                    if (isExternalLink(proofDocument.getFileUrl(), proofDocument.getPublicId(), proofDocument.getResourceType())) {
                        return ResponseEntity.status(302).location(URI.create(proofDocument.getFileUrl())).build();
                    }
                    if (isSharedReference(proofDocument.getFileUrl(), proofDocument.getPublicId(), proofDocument.getResourceType())) {
                        return sharedReferenceResponse(proofDocument.getFileName(), proofDocument.getFileUrl());
                    }
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
    public ResponseEntity<EcrActionDto> deleteProofDocument(@PathVariable Long id,
                                                         @RequestAttribute("authenticatedUserId") Long userId) {
        AppUser user = authenticatedUserService.require(userId);
        return actionRepository.findById(id)
                .filter(action -> accessControlService.canManageAction(user, action) && canMutateAction(action))
                .map(action -> {
                    storageService.deleteQuietly(action.getProofDocumentPublicId(), action.getProofDocumentResourceType());
                    proofDocumentRepository.findByAction_IdOrderByUploadedAtDescIdDesc(id)
                            .forEach(proofDocument -> storageService.deleteQuietly(proofDocument.getPublicId(), proofDocument.getResourceType()));
                    proofDocumentRepository.deleteByAction_Id(id);
                    clearProofDocument(action);
                    return ResponseEntity.ok(toDto(enrichAction(actionRepository.save(action))));
                })
                .orElse(ResponseEntity.status(403).build());
    }

    @DeleteMapping("/action-proof-documents/{proofDocumentId}")
    @Transactional
    public ResponseEntity<EcrActionDto> deleteActionProofDocument(@PathVariable Long proofDocumentId,
                                                               @RequestAttribute("authenticatedUserId") Long userId) {
        AppUser user = authenticatedUserService.require(userId);
        return proofDocumentRepository.findById(proofDocumentId)
                .filter(proofDocument -> accessControlService.canManageAction(user, proofDocument.getAction()) && canMutateAction(proofDocument.getAction()))
                .map(proofDocument -> {
                    EcrAction action = proofDocument.getAction();
                    storageService.deleteQuietly(proofDocument.getPublicId(), proofDocument.getResourceType());
                    proofDocumentRepository.delete(proofDocument);
                    proofDocumentRepository.flush();
                    syncLatestProofDocumentMetadata(action);
                    return ResponseEntity.ok(toDto(enrichAction(actionRepository.save(action))));
                })
                .orElse(ResponseEntity.status(403).build());
    }

    @GetMapping("/action-assets/{assetId}/download")
    public ResponseEntity<Object> downloadActionAsset(@PathVariable Long assetId) {
        return assetRepository.findById(assetId)
                .<ResponseEntity<Object>>map(actionAsset -> {
                    if (isExternalLink(actionAsset.getFileUrl(), actionAsset.getPublicId(), actionAsset.getResourceType())) {
                        return ResponseEntity.status(302).location(URI.create(actionAsset.getFileUrl())).build();
                    }
                    if (isSharedReference(actionAsset.getFileUrl(), actionAsset.getPublicId(), actionAsset.getResourceType())) {
                        return sharedReferenceResponse(actionAsset.getFileName(), actionAsset.getFileUrl());
                    }
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
    public ResponseEntity<EcrActionDto> deleteActionAsset(@PathVariable Long assetId,
                                                       @RequestAttribute("authenticatedUserId") Long userId) {
        AppUser user = authenticatedUserService.require(userId);
        return assetRepository.findById(assetId)
                .filter(asset -> accessControlService.canManageAction(user, asset.getAction()) && canMutateAction(asset.getAction()))
                .map(asset -> {
                    EcrAction action = asset.getAction();
                    storageService.deleteQuietly(asset.getPublicId(), asset.getResourceType());
                    assetRepository.delete(asset);
                    assetRepository.flush();
                    syncLatestEvidenceMetadata(action);
                    return ResponseEntity.ok(toDto(enrichAction(actionRepository.save(action))));
                })
                .orElse(ResponseEntity.status(403).build());
    }

    @DeleteMapping("/actions/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id, @RequestAttribute("authenticatedUserId") Long userId) {
        AppUser user = authenticatedUserService.require(userId);
        return actionRepository.findById(id).map(action -> {
            if (!canDeleteAction(user, action)) {
                return ResponseEntity.status(403).<Void>build();
            }
            Long requestId = action.getRequestId();
            templateService.suppressActionFor(action.getRequest(), action);
            if (action.getRequest() != null) {
                requestRepository.save(action.getRequest());
            }
            assetRepository.findByAction_IdOrderByUploadedAtDescIdDesc(id)
                    .forEach(asset -> storageService.deleteQuietly(asset.getPublicId(), asset.getResourceType()));
            storageService.deleteQuietly(action.getEvidencePublicId(), action.getEvidenceResourceType());
            storageService.deleteQuietly(action.getProofDocumentPublicId(), action.getProofDocumentResourceType());
            proofDocumentRepository.findByAction_IdOrderByUploadedAtDescIdDesc(id)
                    .forEach(proofDocument -> storageService.deleteQuietly(proofDocument.getPublicId(), proofDocument.getResourceType()));
            clearDependenciesOnDeletedAction(id);
            assetRepository.deleteByAction_Id(id);
            proofDocumentRepository.deleteByAction_Id(id);
            deleteLocalEvidenceIfPresent(id);
            actionRepository.deleteById(id);
            requestRepository.findById(requestId).ifPresent(planningService::recalculateRequest);
            return ResponseEntity.noContent().<Void>build();
        }).orElse(ResponseEntity.notFound().build());
    }

    private boolean canDeleteAction(AppUser user, EcrAction action) {
        if (!canDeleteActionState(action)) {
            return false;
        }
        if (accessControlService.isAdmin(user)) {
            return true;
        }
        return accessControlService.canCompleteAction(user, action);
    }

    private boolean canDeleteActionState(EcrAction action) {
        if (action == null || action.getRequest() == null || isTerminalRequest(action.getRequest())) {
            return false;
        }
        if (action.getRequest().getCurrentStage() == EcrStage.CANCELLED && action.getStage() != EcrStage.CANCELLED) {
            return false;
        }
        return !isDone(action);
    }

    private boolean canMutateAction(EcrAction action) {
        return action != null
                && action.getRequest() != null
                && !isTerminalRequest(action.getRequest())
                && (action.getRequest().getCurrentStage() != EcrStage.CANCELLED || action.getStage() == EcrStage.CANCELLED)
                && !isActionPhaseApproved(action);
    }

    private void clearDependenciesOnDeletedAction(Long actionId) {
        if (actionId == null) {
            return;
        }
        List<EcrAction> dependentActions = actionRepository.findByDependsOnActionId(actionId);
        if (dependentActions.isEmpty()) {
            return;
        }
        dependentActions.forEach(action -> action.setDependsOnActionId(null));
        actionRepository.saveAll(dependentActions);
    }

    private boolean isTerminalRequest(com.gestionplanning.ecr.EcrRequest request) {
        return request != null && (request.getCurrentStage() == EcrStage.CLOSED || request.isClosureStatus());
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
        if (request != null && request.getCurrentStage() == EcrStage.CANCELLED) {
            return isStageInCancelledHistory(request, stage);
        }
        return stage == request.getCurrentStage() || isCompletedOrCurrentWorkflowStage(request, stage) || isPhaseApproved(request.getId(), stage);
    }

    private boolean isCompletedOrCurrentWorkflowStage(com.gestionplanning.ecr.EcrRequest request, EcrStage stage) {
        if (request == null || stage == null) {
            return false;
        }
        List<EcrStage> stages = EcrStage.allowedStages(request.isNewVersion());
        int stageIndex = stages.indexOf(stage);
        int currentIndex = stages.indexOf(request.getCurrentStage());
        return stageIndex >= 0 && currentIndex >= 0 && stageIndex <= currentIndex;
    }

    private boolean isStageInCancelledHistory(com.gestionplanning.ecr.EcrRequest request, EcrStage stage) {
        if (request == null || stage == null || request.getCurrentStage() != EcrStage.CANCELLED) {
            return false;
        }
        if (stage == EcrStage.CANCELLED) {
            return true;
        }
        List<EcrStage> stages = EcrStage.allowedStages(request.isNewVersion());
        int cancelledFromIndex = stages.indexOf(request.getCancelledFromStage());
        int stageIndex = stages.indexOf(stage);
        return cancelledFromIndex >= 0 && stageIndex >= 0 && stageIndex <= cancelledFromIndex;
    }

    private boolean canUpdateDuration(AppUser user, EcrAction action) {
        return accessControlService.isRequestPilot(user, action == null ? null : action.getRequest())
                && canChangeDuration(action);
    }

    private boolean canChangeDuration(EcrAction action) {
        return action != null
                && action.getRequest() != null
                && action.getRequest().getCurrentStage() != EcrStage.CLOSED
                && !action.getRequest().isClosureStatus()
                && (action.getRequest().getCurrentStage() != EcrStage.CANCELLED || action.getStage() == EcrStage.CANCELLED)
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
        if (action == null) {
            return false;
        }
        return action.isChecked() || action.getStatus() == ActionStatus.DONE || action.getStatus() == ActionStatus.DONE_LATE;
    }

    private boolean isReopeningAction(EcrAction currentAction, EcrAction updatedAction) {
        return isDone(currentAction) && !isDone(updatedAction);
    }

    private boolean isCompletingAction(EcrAction currentAction, EcrAction updatedAction) {
        return !isDone(currentAction) && isDone(updatedAction);
    }

    private boolean isValidPreviousDependency(EcrAction action, Long dependencyId, EcrStage proposedStage) {
        if (dependencyId == null) {
            return true;
        }
        if (action == null || action.getRequest() == null || action.getRequest().getId() == null) {
            return false;
        }
        if (Objects.equals(action.getId(), dependencyId)) {
            return false;
        }
        return actionRepository.findById(dependencyId)
                .filter(dependency -> dependency.getRequest() != null)
                .filter(dependency -> Objects.equals(dependency.getRequest().getId(), action.getRequest().getId()))
                .filter(dependency -> dependency.getStage() == proposedStage)
                .map(dependency -> isDependencyBeforeAction(dependency, action))
                .orElse(false);
    }

    private boolean isDependencyBeforeAction(EcrAction dependency, EcrAction action) {
        if (dependency == null) {
            return false;
        }
        if (action.getId() == null) {
            return true;
        }
        LocalDate dependencyOrderDate = actionOrderDate(dependency);
        LocalDate actionOrderDate = actionOrderDate(action);
        if (dependencyOrderDate != null && actionOrderDate != null) {
            int dateComparison = dependencyOrderDate.compareTo(actionOrderDate);
            if (dateComparison != 0) {
                return dateComparison < 0;
            }
        }
        if (dependency.getCreatedAt() != null && action.getCreatedAt() != null) {
            int dateComparison = dependency.getCreatedAt().compareTo(action.getCreatedAt());
            if (dateComparison != 0) {
                return dateComparison < 0;
            }
        }
        if (dependency.getId() == null || action.getId() == null) {
            return false;
        }
        return dependency.getId() < action.getId();
    }

    private LocalDate actionOrderDate(EcrAction action) {
        if (action == null) {
            return null;
        }
        if (action.getStartDate() != null) {
            return action.getStartDate();
        }
        if (action.getEndDate() != null) {
            return action.getEndDate();
        }
        return action.getDeadline();
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
        LocalDate fallbackStart = request.getReceptionDate() == null ? LocalDate.now(ZoneId.systemDefault()) : request.getReceptionDate();
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
                "Action marquée terminée: " + actionTitle + MODIFICATION_DETAIL_SEPARATOR + modificationName + " - Projet: " + projectName
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
        if (target == null || source == null) {
            return;
        }
        if (isDone(target)) {
            target.setFinalizationDate(source.getFinalizationDate() == null ? LocalDateTime.now(ZoneId.systemDefault()) : source.getFinalizationDate());
        } else {
            target.setFinalizationDate(null);
        }
    }

    private void freezeActionAssignees(EcrAction action) {
        if (action == null || action.getRequest() == null) {
            return;
        }
        if (hasText(action.getResponsible())) {
            action.setResponsible(assigneeResolver.resolve(action.getRequest(), action.getResponsible()));
        }
        String validatorRole = hasText(action.getValidatorRole()) ? action.getValidatorRole() : action.getValidator();
        if (hasText(validatorRole)) {
            action.setValidatorRole(validatorRole);
            action.setValidator(assigneeResolver.resolveOptional(action.getRequest(), validatorRole));
        }
    }

    private void syncValidationAfterProgressChange(EcrAction action) {
        if (action == null) {
            return;
        }
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

    private List<EcrActionDto> toDtos(List<EcrAction> actions) {
        return actions.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    private EcrActionDto toDto(EcrAction action) {
        return EcrActionDto.from(action);
    }

    private EcrAction enrichAction(EcrAction action) {
        if (action != null) {
            action.setValidatorDisplayName(historicalAction(action)
                    ? firstText(action.getValidationReviewedBy(), action.getValidator(), assigneeResolver.displayFor(action.getRequest(), action.getValidatorRole(), action.getValidator()))
                    : assigneeResolver.displayFor(action.getRequest(), action.getValidatorRole(), action.getValidator()));
        }
        return action;
    }

    private boolean historicalAction(EcrAction action) {
        if (action == null) {
            return false;
        }
        return isDone(action) || action.getValidationStatus() == ActionValidationStatus.APPROVED;
    }

    private String firstText(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (hasText(value)) {
                return value.trim();
            }
        }
        return null;
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
                changed = expandVisibleActionLinks(action, currentVisibleIds, visibleIds) || changed;
            }
        } while (changed);
        return enrichedActions.stream()
                .filter(action -> action.getId() != null && visibleIds.contains(action.getId()))
                .collect(Collectors.toList());
    }

    private boolean expandVisibleActionLinks(EcrAction action, Set<Long> currentVisibleIds, Set<Long> visibleIds) {
        Long actionId = action.getId();
        Long dependencyId = action.getDependsOnActionId();
        if (actionId == null || dependencyId == null) {
            return false;
        }
        return currentVisibleIds.contains(actionId) && visibleIds.add(dependencyId);
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

    private ResponseEntity<Object> cloudinaryDownloadError(CloudinaryStorageService.DownloadException exception) {
        String message = exception.isNotFound()
                ? "Fichier introuvable dans Cloudinary. Il a peut-être été supprimé ou déplacé."
                : "Téléchargement impossible depuis Cloudinary. Réessayez plus tard ou vérifiez la configuration Cloudinary.";
        return ResponseEntity.status(exception.isNotFound() ? 404 : 502)
                .contentType(MediaType.TEXT_PLAIN)
                .body(message);
    }

    private ResponseEntity<Object> sharedReferenceResponse(String fileName, String value) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(fileName, MediaType.TEXT_PLAIN_VALUE))
                .contentType(MediaType.TEXT_PLAIN)
                .body(value);
    }

    private String normalizeSharedLink(String value) {
        return normalizeText(value);
    }

    private String normalizeText(String value) {
        if (value == null) {
            return null;
        }
        String text = value.trim();
        return text.isEmpty() ? null : text;
    }

    private boolean isExternalLink(String fileUrl, String publicId, String resourceType) {
        return isHttpSharedLink(fileUrl)
                && (publicId == null || publicId.trim().isEmpty())
                && "link".equalsIgnoreCase(String.valueOf(resourceType));
    }

    private boolean isSharedReference(String fileUrl, String publicId, String resourceType) {
        return normalizeSharedLink(fileUrl) != null
                && (publicId == null || publicId.trim().isEmpty())
                && "link".equalsIgnoreCase(String.valueOf(resourceType));
    }

    private boolean isHttpSharedLink(String value) {
        String url = normalizeText(value);
        if (url == null || !(url.startsWith("http://") || url.startsWith("https://"))) {
            return false;
        }
        try {
            URI.create(url);
            return true;
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    public static class LinkPayload {
        private String name;
        private String url;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getUrl() {
            return url;
        }

        public void setUrl(String url) {
            this.url = url;
        }
    }
}
