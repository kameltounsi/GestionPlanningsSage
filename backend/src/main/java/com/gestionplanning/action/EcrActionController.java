package com.gestionplanning.action;

import com.gestionplanning.ecr.EcrRequestRepository;
import com.gestionplanning.ecr.EcrStage;
import com.gestionplanning.ecr.EcrTemplateService;
import com.gestionplanning.ecr.PhaseValidationRequest;
import com.gestionplanning.ecr.PhaseValidationRequestRepository;
import com.gestionplanning.ecr.PhaseValidationStatus;
import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.storage.CloudinaryStorageService;
import com.gestionplanning.storage.CloudinaryStorageService.DownloadedAsset;
import com.gestionplanning.storage.StoredAsset;
import com.gestionplanning.user.AccountMailService;
import com.gestionplanning.user.AppUser;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.validation.Valid;
import java.net.URI;
import java.util.Arrays;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
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
    private final PhaseValidationRequestRepository validationRepository;
    private final AccountMailService accountMailService;

    public EcrActionController(EcrActionRepository actionRepository, EcrActionEvidenceRepository evidenceRepository,
                               EcrActionAssetRepository assetRepository,
                               EcrRequestRepository requestRepository, ActionPlanningService planningService,
                               EcrTemplateService templateService, CloudinaryStorageService storageService,
                               ActionAssigneeResolver assigneeResolver, AccessControlService accessControlService,
                               PhaseValidationRequestRepository validationRepository, AccountMailService accountMailService) {
        this.actionRepository = actionRepository;
        this.evidenceRepository = evidenceRepository;
        this.assetRepository = assetRepository;
        this.requestRepository = requestRepository;
        this.planningService = planningService;
        this.templateService = templateService;
        this.storageService = storageService;
        this.assigneeResolver = assigneeResolver;
        this.accessControlService = accessControlService;
        this.validationRepository = validationRepository;
        this.accountMailService = accountMailService;
    }

    @GetMapping("/actions")
    public List<EcrAction> list(@RequestParam(required = false) Boolean late) {
        if (Boolean.TRUE.equals(late)) {
            List<EcrAction> actions = actionRepository.findByDeadlineBeforeAndStatusNotInOrderByDeadlineAsc(LocalDate.now(), Arrays.asList(ActionStatus.DONE, ActionStatus.DONE_LATE));
            planningService.refreshActionStatuses(actions);
            return actionRepository.saveAll(actions).stream()
                    .filter(action -> action.getStatus() != ActionStatus.DONE && action.getStatus() != ActionStatus.DONE_LATE)
                    .collect(Collectors.toList());
        }
        List<EcrAction> actions = actionRepository.findAll();
        planningService.refreshActionStatuses(actions);
        return actionRepository.saveAll(actions);
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
            if (stage != null) {
                actions = actions.stream()
                        .filter(action -> action.getStage() == stage)
                        .collect(Collectors.toList());
            }
            return ResponseEntity.ok(actions);
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
                    syncFinalizationDate(action, action);
                    EcrAction saved = actionRepository.save(action);
                    planningService.recalculateRequest(request);
                    return ResponseEntity.created(URI.create("/api/actions/" + saved.getId())).body(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/actions/{id}")
    public ResponseEntity<EcrAction> update(@PathVariable Long id, @Valid @RequestBody EcrAction updatedAction,
                                            @RequestAttribute("authenticatedUser") AppUser user) {
        return actionRepository.findById(id)
                .filter(action -> accessControlService.canAccessRequest(user, action.getRequest()))
                .map(action -> {
                    action.setTitle(updatedAction.getTitle());
                    action.setDescription(updatedAction.getDescription());
                    action.setTopicRisk(updatedAction.getTopicRisk());
                    action.setResponsible(assigneeResolver.resolve(action.getRequest(), updatedAction.getResponsible()));
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
                    action.setComment(updatedAction.getComment());
                    EcrAction saved = actionRepository.save(action);
                    planningService.recalculateRequest(saved.getRequest());
                    notifyIfPhaseReady(saved.getRequest(), saved.getStage(), user);
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.status(403).build());
    }

    @PostMapping(value = "/actions/{id}/evidence", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<EcrAction> uploadEvidence(@PathVariable Long id, @RequestParam("file") MultipartFile file,
                                                    @RequestAttribute("authenticatedUser") AppUser user) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return actionRepository.findById(id)
                .filter(action -> accessControlService.canAccessRequest(user, action.getRequest()))
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
                    return ResponseEntity.ok(actionRepository.save(action));
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

    private boolean requiresEvidence(EcrAction action) {
        return action != null && (action.isEvidenceRequired() || String.valueOf(action.getCriticality()).startsWith("1"));
    }

    private boolean isDone(EcrAction action) {
        return action != null && (action.isChecked() || action.getStatus() == ActionStatus.DONE || action.getStatus() == ActionStatus.DONE_LATE);
    }

    private void syncFinalizationDate(EcrAction target, EcrAction source) {
        if (isDone(target)) {
            target.setFinalizationDate(source.getFinalizationDate() == null ? LocalDateTime.now() : source.getFinalizationDate());
        } else {
            target.setFinalizationDate(null);
        }
    }

    private boolean isDependencyCompleted(EcrAction action) {
        if (action == null || action.getDependsOnActionId() == null) {
            return true;
        }
        return actionRepository.findById(action.getDependsOnActionId())
                .map(this::isDone)
                .orElse(false);
    }

    private void notifyIfPhaseReady(com.gestionplanning.ecr.EcrRequest request, EcrStage stage, AppUser user) {
        if (request == null || stage == null || stage != request.getCurrentStage()) {
            return;
        }
        List<EcrAction> stageActions = actionRepository.findByRequest_IdAndStageOrderByDeadlineAscIdAsc(request.getId(), stage);
        if (stageActions.isEmpty() || stageActions.stream().anyMatch(action -> !isDone(action))) {
            return;
        }
        boolean pendingExists = validationRepository.findFirstByRequest_IdAndStageOrderByRequestedAtDescIdDesc(request.getId(), stage)
                .map(validation -> validation.getStatus() == PhaseValidationStatus.PENDING)
                .orElse(false);
        if (pendingExists) {
            return;
        }
        PhaseValidationRequest validation = new PhaseValidationRequest();
        validation.setRequest(request);
        validation.setStage(stage);
        validation.setStatus(PhaseValidationStatus.PENDING);
        validation.setRequestedBy(user.getFullName() == null || user.getFullName().trim().isEmpty() ? user.getEmail() : user.getFullName());
        validation.setRequestedAt(LocalDateTime.now());
        validationRepository.save(validation);
        accountMailService.sendPhaseReadyEmail(request, stage, accessControlService.validatorsAndManagersFor(request));
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
