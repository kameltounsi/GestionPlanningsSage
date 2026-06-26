package com.gestionplanning.ecr;

import com.gestionplanning.action.ActionPlanningService;
import com.gestionplanning.action.ActionStatus;
import com.gestionplanning.action.EcrAction;
import com.gestionplanning.action.EcrActionRepository;
import com.gestionplanning.audit.AuditLogService;
import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.preferential.FinishedProductReference;
import com.gestionplanning.preferential.FinishedProductReferenceRepository;
import com.gestionplanning.storage.CloudinaryStorageService;
import com.gestionplanning.storage.CloudinaryStorageService.DownloadException;
import com.gestionplanning.storage.CloudinaryStorageService.DownloadedAsset;
import com.gestionplanning.storage.StoredAsset;
import com.gestionplanning.user.AccountMailService;
import com.gestionplanning.user.AppUser;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.validation.Valid;
import java.net.URI;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/ecr-requests")
public class EcrRequestController {
    private final EcrRequestRepository requestRepository;
    private final ChecklistItemRepository checklistItemRepository;
    private final CloudinaryStorageService storageService;
    private final EcrTemplateService templateService;
    private final ActionPlanningService planningService;
    private final EcrActionRepository actionRepository;
    private final AccessControlService accessControlService;
    private final PhaseValidationRequestRepository validationRepository;
    private final AuditLogService auditLogService;
    private final AccountMailService accountMailService;
    private final FinishedProductReferenceRepository finishedProductRepository;

    public EcrRequestController(EcrRequestRepository requestRepository, ChecklistItemRepository checklistItemRepository,
                                CloudinaryStorageService storageService, EcrTemplateService templateService,
                                ActionPlanningService planningService, EcrActionRepository actionRepository, AccessControlService accessControlService,
                                PhaseValidationRequestRepository validationRepository, AuditLogService auditLogService,
                                AccountMailService accountMailService,
                                FinishedProductReferenceRepository finishedProductRepository) {
        this.requestRepository = requestRepository;
        this.checklistItemRepository = checklistItemRepository;
        this.storageService = storageService;
        this.templateService = templateService;
        this.planningService = planningService;
        this.actionRepository = actionRepository;
        this.accessControlService = accessControlService;
        this.validationRepository = validationRepository;
        this.auditLogService = auditLogService;
        this.accountMailService = accountMailService;
        this.finishedProductRepository = finishedProductRepository;
    }

    @GetMapping
    public List<EcrRequest> list(@RequestParam(defaultValue = "false") boolean includeArchived,
                                 @RequestParam(required = false) String view,
                                 @RequestAttribute("authenticatedUser") AppUser user) {
        requestRepository.findByArchivedFalseOrderByReceptionDateDescIdDesc().stream()
                .filter(request -> request.getCurrentStage() != EcrStage.CLOSED && request.getCurrentStage() != EcrStage.CANCELLED)
                .forEach(templateService::ensureMissingActionsFor);
        String normalizedView = normalizeView(view, includeArchived);
        boolean admin = accessControlService.isAdmin(user);
        List<EcrRequest> requests = (admin && ("all".equals(normalizedView) || "archived".equals(normalizedView)))
                ? requestRepository.findAllByOrderByReceptionDateDescIdDesc()
                : requestRepository.findByArchivedFalseOrderByReceptionDateDescIdDesc();
        return requests.stream()
                .filter(request -> accessControlService.canAccessRequest(user, request))
                .filter(request -> matchesView(request, normalizedView, admin))
                .collect(java.util.stream.Collectors.toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<EcrRequest> get(@PathVariable Long id, @RequestAttribute("authenticatedUser") AppUser user) {
        return requestRepository.findById(id)
                .filter(request -> accessControlService.canAccessRequest(user, request))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(403).build());
    }

    @GetMapping("/{id}/progress")
    public ResponseEntity<RequestProgress> progress(@PathVariable Long id, @RequestAttribute("authenticatedUser") AppUser user) {
        java.util.Optional<EcrRequest> requestOptional = requestRepository.findById(id)
                .filter(request -> accessControlService.canAccessRequest(user, request));
        if (!requestOptional.isPresent()) {
            return ResponseEntity.status(403).<RequestProgress>build();
        }
        EcrRequest request = requestOptional.get();
        List<EcrAction> actions = actionRepository.findByRequest_IdOrderByStartDateAscEndDateAscDeadlineAscCreatedAtAscIdAsc(id);
        planningService.refreshActionStatuses(actions);
        long doneActions = actions.stream().filter(this::isDone).count();
        int totalActions = actions.size();
        int progress = totalActions == 0 ? 0 : Math.round((doneActions * 100f) / totalActions);
        if (request.getCurrentStage() == EcrStage.CLOSED || request.isClosureStatus()) {
            progress = 100;
            doneActions = totalActions;
        }
        return ResponseEntity.ok(new RequestProgress(totalActions, (int) doneActions, progress));
    }

    @PostMapping
    public ResponseEntity<EcrRequest> create(@Valid @RequestBody EcrRequest request,
                                             @RequestAttribute("authenticatedUser") AppUser user) {
        normalizeRequestFields(request);
        if (requestRepository.existsByModificationNumberIgnoreCase(request.getModificationNumber())
                || !finishedProductsSelectionValid(request)) {
            return ResponseEntity.badRequest().build();
        }
        if (request.getAccessInternalNumber() == null) {
            request.setAccessInternalNumber(requestRepository.findMaxAccessInternalNumber() + 1);
        }
        if (!EcrStage.isAllowed(request.getCurrentStage(), request.isNewVersion())) {
            request.setCurrentStage(EcrStage.firstAllowed(request.isNewVersion()));
        }
        templateService.applyTo(request);
        List<com.gestionplanning.action.EcrAction> initialActions = request.getInitialActions();
        EcrRequest saved = requestRepository.save(request);
        templateService.createActionsFor(saved, initialActions);
        auditLogService.recordBusinessEvent(
                user,
                "CREATION_MODIFICATION",
                "modification",
                saved.getId() == null ? null : String.valueOf(saved.getId()),
                "Création de la modification: " + requestLabel(saved)
        );
        return ResponseEntity.created(URI.create("/api/ecr-requests/" + saved.getId())).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<EcrRequest> update(@PathVariable Long id, @Valid @RequestBody EcrRequest updatedRequest,
                                             @RequestAttribute("authenticatedUser") AppUser user) {
        return requestRepository.findById(id)
                .filter(request -> accessControlService.canAccessRequest(user, request))
                .map(request -> {
                    if (isTerminalRequest(request)) {
                        return ResponseEntity.status(403).<EcrRequest>build();
                    }
                    if (dossierReviewChanged(request.getDossierReview(), updatedRequest.getDossierReview())
                            && !canManageDossierReview(user, request)) {
                        return ResponseEntity.status(403).<EcrRequest>build();
                    }
                    normalizeRequestFields(updatedRequest);
                    if (requestRepository.existsByModificationNumberIgnoreCaseAndIdNot(updatedRequest.getModificationNumber(), id)
                            || !finishedProductsSelectionValid(updatedRequest)) {
                        return ResponseEntity.badRequest().<EcrRequest>build();
                    }
                    request.setModificationNumber(updatedRequest.getModificationNumber());
                    request.setClient(updatedRequest.getClient());
                    request.setProduct(updatedRequest.getProduct());
                    request.setFinishedProducts(updatedRequest.getFinishedProducts());
                    request.setModificationProject(updatedRequest.getModificationProject());
                    request.setReceptionDate(updatedRequest.getReceptionDate());
                    request.setPilot(updatedRequest.getPilot());
                    request.setModificationReason(updatedRequest.getModificationReason());
                    request.setModificationDetail(updatedRequest.getModificationDetail());
                    request.setBeforePhoto(updatedRequest.getBeforePhoto());
                    request.setAfterPhoto(updatedRequest.getAfterPhoto());
                    request.setMixability(updatedRequest.getMixability());
                    request.setDossierReview(updatedRequest.getDossierReview());
                    request.setTechnicalFile(updatedRequest.getTechnicalFile());
                    request.setClientPlanning(updatedRequest.getClientPlanning());
                    request.setInternalPlanning(updatedRequest.getInternalPlanning());
                    request.setOilList(updatedRequest.getOilList());
                    request.setDigitChange(updatedRequest.isDigitChange());
                    request.setComponentChange(updatedRequest.isComponentChange());
                    request.setProcessChange(updatedRequest.isProcessChange());
                    request.setSupplierChange(updatedRequest.isSupplierChange());
                    request.setNewVersion(updatedRequest.isNewVersion());
                    EcrStage updatedStage = updatedRequest.getCurrentStage();
                    EcrStage nextStage = updatedStage == EcrStage.CANCELLED || EcrStage.isAllowed(updatedStage, updatedRequest.isNewVersion())
                            ? updatedStage
                            : EcrStage.firstAllowed(updatedRequest.isNewVersion());
                    if (nextStage == EcrStage.CLOSED && request.getCurrentStage() != EcrStage.CLOSED) {
                        return ResponseEntity.badRequest().<EcrRequest>build();
                    }
                    if (nextStage != request.getCurrentStage() && !accessControlService.isAdmin(user)) {
                        return ResponseEntity.status(403).<EcrRequest>build();
                    }
                    if (isApprovedStage(request, nextStage) && nextStage != request.getCurrentStage()) {
                        return ResponseEntity.badRequest().<EcrRequest>build();
                    }
                    request.setCurrentStage(nextStage);
                    EcrRequest saved = requestRepository.save(request);
                    planningService.recalculateRequest(saved);
                    auditLogService.recordBusinessEvent(
                            user,
                            "MODIFICATION_MODIFICATION",
                            "modification",
                            saved.getId() == null ? null : String.valueOf(saved.getId()),
                            "Modification mise à jour: " + requestLabel(saved)
                    );
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.status(403).build());
    }

    @PostMapping(value = "/{id}/images/{type}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<EcrRequest> uploadImage(@PathVariable Long id, @PathVariable String type, @RequestParam("file") MultipartFile file) {
        if (file.isEmpty() || file.getContentType() == null) {
            return ResponseEntity.badRequest().build();
        }
        return requestRepository.findById(id)
                .map(request -> {
                    if (isTerminalRequest(request)) {
                        return ResponseEntity.status(403).<EcrRequest>build();
                    }
                    if ("before".equalsIgnoreCase(type)) {
                        storageService.deleteQuietly(request.getBeforePhotoPublicId(), request.getBeforePhotoResourceType());
                        StoredAsset asset = storageService.upload(file, "gestion-planning/ecr-requests/" + id + "/before");
                        request.setBeforePhoto(asset.getFileName());
                        request.setBeforePhotoContentType(asset.getContentType());
                        request.setBeforePhotoFileSize(asset.getSize());
                        request.setBeforePhotoUrl(asset.getUrl());
                        request.setBeforePhotoPublicId(asset.getPublicId());
                        request.setBeforePhotoResourceType(asset.getResourceType());
                    } else if ("after".equalsIgnoreCase(type)) {
                        storageService.deleteQuietly(request.getAfterPhotoPublicId(), request.getAfterPhotoResourceType());
                        StoredAsset asset = storageService.upload(file, "gestion-planning/ecr-requests/" + id + "/after");
                        request.setAfterPhoto(asset.getFileName());
                        request.setAfterPhotoContentType(asset.getContentType());
                        request.setAfterPhotoFileSize(asset.getSize());
                        request.setAfterPhotoUrl(asset.getUrl());
                        request.setAfterPhotoPublicId(asset.getPublicId());
                        request.setAfterPhotoResourceType(asset.getResourceType());
                    } else {
                        return ResponseEntity.badRequest().<EcrRequest>build();
                    }
                    return ResponseEntity.ok(requestRepository.save(request));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/files/{type}/download")
    public ResponseEntity<?> downloadRequestFile(@PathVariable Long id, @PathVariable String type) {
        return requestRepository.findById(id)
                .<ResponseEntity<?>>map(request -> {
                    RequestFile file = requestFile(request, type);
                    if (file == null || file.url() == null || file.url().trim().isEmpty()) {
                        return ResponseEntity.notFound().build();
                    }
                    try {
                        DownloadedAsset asset = storageService.download(file.publicId(), file.resourceType(), file.url(), file.contentType());
                        return ResponseEntity.ok()
                                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(file.fileName(), asset.getContentType()))
                                .contentType(MediaType.parseMediaType(asset.getContentType()))
                                .body(asset.getData());
                    } catch (DownloadException exception) {
                        return ResponseEntity.status(502)
                                .contentType(MediaType.TEXT_PLAIN)
                                .body("Téléchargement impossible depuis Cloudinary. Vérifiez la connexion réseau ou réessayez plus tard.");
                    }
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @RequestAttribute("authenticatedUser") AppUser user) {
        if (!accessControlService.isAdmin(user)) {
            return ResponseEntity.status(403).build();
        }
        return requestRepository.findById(id)
                .filter(request -> accessControlService.canAccessRequest(user, request))
                .map(request -> {
                    request.setArchived(true);
                    EcrRequest saved = requestRepository.save(request);
                    auditLogService.recordBusinessEvent(
                            user,
                            "ARCHIVAGE_MODIFICATION",
                            "modification",
                            requestLabel(saved),
                            "Modification archivée: " + requestLabel(saved)
                    );
                    return ResponseEntity.noContent().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/stage")
    public ResponseEntity<EcrRequest> updateStage(@PathVariable Long id, @RequestParam EcrStage stage,
                                                  @RequestAttribute("authenticatedUser") AppUser user) {
        if (!accessControlService.isAdmin(user)) {
            return ResponseEntity.status(403).build();
        }
        return requestRepository.findById(id)
                .filter(request -> accessControlService.canAccessRequest(user, request))
                .map(request -> {
                    if (isTerminalRequest(request)) {
                        return ResponseEntity.status(403).<EcrRequest>build();
                    }
                    if (!EcrStage.isAllowed(stage, request.isNewVersion()) || stage == EcrStage.CANCELLED || stage == EcrStage.CLOSED) {
                        return ResponseEntity.badRequest().<EcrRequest>build();
                    }
                    boolean reopeningApprovedStage = isApprovedStage(request, stage) && stage != request.getCurrentStage();
                    if (reopeningApprovedStage) {
                        reopenApprovedStage(request, stage, user);
                    }
                    if (request.getCurrentStage() == EcrStage.CANCELLED) {
                        request.setCancelledStatus(false);
                        request.setCancelledDate(null);
                        request.setCancelledFromStage(null);
                    }
                    request.setCurrentStage(stage);
                    request.setClosureRequested(false);
                    request.setClosureRequestedDate(null);
                    request.setClosureRequestedBy(null);
                    if (stage != EcrStage.CLOSED) {
                        request.setClosureStatus(false);
                        request.setClosureDate(null);
                    }
                    EcrRequest saved = requestRepository.save(request);
                    if (reopeningApprovedStage) {
                        auditLogService.recordBusinessEvent(
                                user,
                                "REOUVERTURE_PHASE",
                                "modification",
                                requestLabel(saved),
                                "Phase rouverte: " + stageLabel(stage) + " - Modification: " + requestLabel(saved)
                        );
                    }
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.status(403).build());
    }

    @PatchMapping("/{id}/cancel")
    public ResponseEntity<EcrRequest> cancel(@PathVariable Long id,
                                             @RequestAttribute("authenticatedUser") AppUser user) {
        return requestRepository.findById(id)
                .filter(request -> accessControlService.canAccessRequest(user, request))
                .filter(request -> accessControlService.canCancelRequest(user, request))
                .map(request -> {
                    if (isTerminalRequest(request) || request.getCurrentStage() == EcrStage.CANCELLED) {
                        return ResponseEntity.badRequest().<EcrRequest>build();
                    }
                    request.setCancelledFromStage(request.getCurrentStage());
                    request.setCurrentStage(EcrStage.CANCELLED);
                    request.setCancelledStatus(true);
                    request.setCancelledDate(java.time.LocalDate.now());
                    request.setClosureStatus(false);
                    request.setClosureDate(null);
                    request.setClosureRequested(false);
                    request.setClosureRequestedDate(null);
                    request.setClosureRequestedBy(null);
                    EcrRequest saved = requestRepository.save(request);
                    templateService.cancelOpenActionsBeforeCancelledPhase(saved);
                    templateService.ensureMissingActionsForStage(saved, EcrStage.CANCELLED);
                    planningService.recalculateRequest(saved);
                    auditLogService.recordBusinessEvent(
                            user,
                            "ANNULATION_MODIFICATION",
                            "modification",
                            requestLabel(saved),
                            "Modification annulée: " + requestLabel(saved)
                    );
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.status(403).build());
    }

    @PatchMapping("/{id}/request-closure")
    public ResponseEntity<EcrRequest> requestClosure(@PathVariable Long id,
                                                     @RequestAttribute("authenticatedUser") AppUser user) {
        return requestRepository.findById(id)
                .filter(request -> accessControlService.canAccessRequest(user, request))
                .filter(request -> accessControlService.isRequestPilot(user, request))
                .map(request -> {
                    if (isTerminalRequest(request) || !allWorkflowStagesApproved(request)) {
                        return ResponseEntity.badRequest().<EcrRequest>build();
                    }
                    request.setClosureRequested(true);
                    request.setClosureRequestedDate(LocalDate.now());
                    request.setClosureRequestedBy(displayName(user));
                    request.setClosureStatus(false);
                    request.setClosureDate(null);
                    EcrRequest saved = requestRepository.save(request);
                    notifyClosureRequested(saved, user);
                    auditLogService.recordBusinessEvent(
                            user,
                            "DEMANDE_CLOTURE_MODIFICATION",
                            "modification",
                            requestLabel(saved),
                            "Demande de cloture: " + requestLabel(saved)
                    );
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.status(403).build());
    }

    @PatchMapping("/{id}/close")
    public ResponseEntity<EcrRequest> close(@PathVariable Long id,
                                            @RequestAttribute("authenticatedUser") AppUser user) {
        if (!accessControlService.isAdmin(user)) {
            return ResponseEntity.status(403).build();
        }
        return requestRepository.findById(id)
                .filter(request -> accessControlService.canAccessRequest(user, request))
                .map(request -> {
                    if (isTerminalRequest(request) || !request.isClosureRequested() || !allWorkflowStagesApproved(request)) {
                        return ResponseEntity.badRequest().<EcrRequest>build();
                    }
                    if (!request.isCancelledStatus()) {
                        request.setCurrentStage(EcrStage.CLOSED);
                    }
                    request.setClosureStatus(true);
                    request.setClosureDate(LocalDate.now());
                    request.setClosureRequested(false);
                    EcrRequest saved = requestRepository.save(request);
                    notifyModificationCompleted(saved);
                    auditLogService.recordBusinessEvent(
                            user,
                            "CLOTURE_MODIFICATION",
                            "modification",
                            requestLabel(saved),
                            "Modification marquee terminee/cloturee: " + requestLabel(saved)
                    );
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.status(403).build());
    }

    @PatchMapping("/{id}/archive")
    public ResponseEntity<EcrRequest> updateArchiveStatus(@PathVariable Long id, @RequestParam(defaultValue = "true") boolean archived,
                                                          @RequestAttribute("authenticatedUser") AppUser user) {
        if (!accessControlService.isAdmin(user)) {
            return ResponseEntity.status(403).build();
        }
        return requestRepository.findById(id)
                .filter(request -> accessControlService.canAccessRequest(user, request))
                .map(request -> {
                    request.setArchived(archived);
                    EcrRequest saved = requestRepository.save(request);
                    auditLogService.recordBusinessEvent(
                            user,
                            archived ? "ARCHIVAGE_MODIFICATION" : "DESARCHIVAGE_MODIFICATION",
                            "modification",
                            requestLabel(saved),
                            (archived ? "Modification archivée: " : "Modification désarchivée: ") + requestLabel(saved)
                    );
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.status(403).build());
    }

    @GetMapping("/{id}/checklist")
    public ResponseEntity<List<ChecklistItem>> checklist(@PathVariable Long id, @RequestParam(required = false) EcrStage stage,
                                                         @RequestAttribute("authenticatedUser") AppUser user) {
        return requestRepository.findById(id)
                .filter(request -> accessControlService.canAccessRequest(user, request))
                .map(request -> {
                    if (stage == null) {
                        return ResponseEntity.ok(request.getChecklistItems());
                    }
                    return ResponseEntity.ok(checklistItemRepository.findByRequestIdAndStageOrderById(id, stage));
                })
                .orElse(ResponseEntity.status(403).build());
    }

    private boolean isApprovedStage(EcrRequest request, EcrStage stage) {
        return validationRepository.findFirstByRequest_IdAndStageOrderByRequestedAtDescIdDesc(request.getId(), stage)
                .map(validation -> validation.getStatus() == PhaseValidationStatus.APPROVED)
                .orElse(false);
    }

    private boolean allWorkflowStagesApproved(EcrRequest request) {
        if (request == null || request.getId() == null) {
            return false;
        }
        if (request.getCurrentStage() == EcrStage.CANCELLED) {
            return isApprovedStage(request, EcrStage.CANCELLED);
        }
        return EcrStage.allowedStages(request.isNewVersion()).stream()
                .allMatch(stage -> isApprovedStage(request, stage));
    }

    private void notifyClosureRequested(EcrRequest request, AppUser requester) {
        Map<String, AppUser> recipients = new LinkedHashMap<>();
        accessControlService.adminsFor(request)
                .forEach(user -> recipients.put(normalizeEmail(user.getEmail()), user));
        recipients.remove("");
        accountMailService.sendModificationClosureRequestedEmail(request, requester, recipients.values());
    }

    private void notifyModificationCompleted(EcrRequest request) {
        Map<String, AppUser> recipients = new LinkedHashMap<>();
        accessControlService.projectLeadFor(request)
                .ifPresent(user -> recipients.put(normalizeEmail(user.getEmail()), user));
        accessControlService.adminsFor(request)
                .forEach(user -> recipients.put(normalizeEmail(user.getEmail()), user));
        recipients.remove("");
        accountMailService.sendModificationCompletedEmail(request, recipients.values());
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeView(String view, boolean includeArchived) {
        if (includeArchived) {
            return "all";
        }
        String normalized = view == null ? "" : view.trim().toLowerCase(Locale.ROOT);
        switch (normalized) {
            case "active":
            case "closed":
            case "cancelled":
            case "archived":
            case "all":
                return normalized;
            default:
                return "all";
        }
    }

    private boolean matchesView(EcrRequest request, String view, boolean admin) {
        if (request == null) {
            return false;
        }
        if ("archived".equals(view)) {
            return admin && request.isArchived();
        }
        if (!admin && request.isArchived()) {
            return false;
        }
        if (!"all".equals(view) && request.isArchived()) {
            return false;
        }
        if ("active".equals(view)) {
            return request.getCurrentStage() != EcrStage.CLOSED && request.getCurrentStage() != EcrStage.CANCELLED;
        }
        if ("closed".equals(view)) {
            return request.getCurrentStage() == EcrStage.CLOSED;
        }
        if ("cancelled".equals(view)) {
            return request.getCurrentStage() == EcrStage.CANCELLED;
        }
        return true;
    }

    private boolean canManageDossierReview(AppUser user, EcrRequest request) {
        return accessControlService.isAdmin(user) || accessControlService.isRequestPilot(user, request);
    }

    private void normalizeRequestFields(EcrRequest request) {
        if (request == null) {
            return;
        }
        request.setModificationNumber(trimToNull(request.getModificationNumber()));
        request.setClient(trimToNull(request.getClient()));
        request.setProduct(trimToNull(request.getProduct()));
        request.setFinishedProducts(trimToNull(request.getFinishedProducts()));
        request.setModificationProject(trimToNull(request.getModificationProject()));
        request.setPilot(trimToNull(request.getPilot()));
        request.setModificationReason(trimToNull(request.getModificationReason()));
        request.setModificationDetail(trimToNull(request.getModificationDetail()));
        request.setMixability(trimToNull(request.getMixability()));
        request.setDossierReview(trimToNull(request.getDossierReview()));
    }

    private boolean finishedProductsSelectionValid(EcrRequest request) {
        List<String> linkedFinishedProducts = linkedFinishedProductKeys(request);
        if (linkedFinishedProducts.isEmpty()) {
            return true;
        }
        List<String> selectedFinishedProducts = selectedTokens(request == null ? null : request.getFinishedProducts());
        return !selectedFinishedProducts.isEmpty()
                && selectedFinishedProducts.stream().allMatch(selected -> linkedFinishedProducts.stream().anyMatch(linked -> linked.equalsIgnoreCase(selected)));
    }

    private List<String> linkedFinishedProductKeys(EcrRequest request) {
        if (request == null || isBlank(request.getClient()) || isBlank(request.getModificationProject()) || isBlank(request.getProduct())) {
            return java.util.Collections.emptyList();
        }
        List<String> products = selectedTokens(request.getProduct());
        if (products.isEmpty()) {
            return java.util.Collections.emptyList();
        }
        return finishedProductRepository.findAll().stream()
                .filter(reference -> equalsNormalized(reference.getClient(), request.getClient()))
                .filter(reference -> equalsNormalized(reference.getProject(), request.getModificationProject()))
                .filter(reference -> products.stream().anyMatch(product -> equalsNormalized(reference.getProduct(), product)))
                .map(FinishedProductReference::getPartNumber)
                .filter(value -> !isBlank(value))
                .map(String::trim)
                .collect(java.util.stream.Collectors.toList());
    }

    private List<String> selectedTokens(String value) {
        if (isBlank(value)) {
            return java.util.Collections.emptyList();
        }
        return java.util.Arrays.stream(value.split("[,;]+"))
                .map(String::trim)
                .filter(token -> !token.isEmpty())
                .collect(java.util.stream.Collectors.toList());
    }

    private boolean equalsNormalized(String left, String right) {
        return normalizeText(left).equals(normalizeText(right));
    }

    private String normalizeText(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String trimToNull(String value) {
        return isBlank(value) ? null : value.trim();
    }

    private boolean isTerminalRequest(EcrRequest request) {
        return request != null && (request.getCurrentStage() == EcrStage.CLOSED || request.isClosureStatus());
    }

    private boolean isDone(EcrAction action) {
        return action != null && (action.isChecked() || action.getStatus() == ActionStatus.DONE || action.getStatus() == ActionStatus.DONE_LATE);
    }

    private boolean dossierReviewChanged(String currentValue, String nextValue) {
        return !Objects.equals(normalizeDossierReview(currentValue), normalizeDossierReview(nextValue));
    }

    private String normalizeDossierReview(String value) {
        return value == null || value.trim().isEmpty() ? "" : value;
    }

    private void reopenApprovedStage(EcrRequest request, EcrStage stage, AppUser user) {
        validationRepository.findFirstByRequest_IdAndStageOrderByRequestedAtDescIdDesc(request.getId(), stage)
                .filter(validation -> validation.getStatus() == PhaseValidationStatus.APPROVED)
                .ifPresent(validation -> {
                    validation.setStatus(PhaseValidationStatus.REOPENED);
                    validation.setReviewedBy(displayName(user));
                    validation.setReviewedAt(java.time.LocalDateTime.now());
                    validation.setRefusalReason("Phase rouverte par l'admin.");
                    validationRepository.save(validation);
                });
    }

    private String displayName(AppUser user) {
        return user == null || user.getFullName() == null || user.getFullName().trim().isEmpty() ? user == null ? "" : user.getEmail() : user.getFullName();
    }

    private RequestFile requestFile(EcrRequest request, String type) {
        if ("before".equalsIgnoreCase(type)) {
            return new RequestFile(
                    request.getBeforePhoto(),
                    request.getBeforePhotoContentType(),
                    request.getBeforePhotoUrl(),
                    request.getBeforePhotoPublicId(),
                    request.getBeforePhotoResourceType()
            );
        }
        if ("after".equalsIgnoreCase(type)) {
            return new RequestFile(
                    request.getAfterPhoto(),
                    request.getAfterPhotoContentType(),
                    request.getAfterPhotoUrl(),
                    request.getAfterPhotoPublicId(),
                    request.getAfterPhotoResourceType()
            );
        }
        return null;
    }

    private String safeFileName(String fileName) {
        if (fileName == null || fileName.trim().isEmpty()) {
            return "document";
        }
        return fileName.replace("\"", "");
    }

    private String contentDisposition(String fileName, String contentType) {
        String disposition = contentType != null && (contentType.equalsIgnoreCase(MediaType.APPLICATION_PDF_VALUE) || contentType.startsWith("image/"))
                ? "inline"
                : "attachment";
        return disposition + "; filename=\"" + safeFileName(fileName) + "\"";
    }

    private String requestLabel(EcrRequest request) {
        if (request == null) {
            return "-";
        }
        if (request.getModificationNumber() != null && !request.getModificationNumber().trim().isEmpty()) {
            return request.getModificationNumber();
        }
        if (request.getClient() != null && !request.getClient().trim().isEmpty()) {
            return request.getClient();
        }
        return "Modification " + request.getId();
    }

    private String stageLabel(EcrStage stage) {
        if (stage == null) return "-";
        switch (stage) {
            case FEASIBILITY_VALIDATION:
                return "Feasibility validation";
            case PROJECT_MANAGEMENT:
                return "Project management";
            case PRODUCT_DEVELOPMENT:
                return "Product development";
            case PROCESS_DEVELOPMENT:
                return "Process development";
            case CUSTOMER_VALIDATION:
                return "Customer validation";
            case PPAP_SOP_PREPARATION:
                return "PPAP SOP preparation";
            case CLOSURE_STATUS:
                return "Closure status";
            case CLOSED:
                return "Closed";
            case CANCELLED:
                return "Cancelled";
            default:
                return stage.name();
        }
    }

    private static class RequestFile {
        private final String fileName;
        private final String contentType;
        private final String url;
        private final String publicId;
        private final String resourceType;

        private RequestFile(String fileName, String contentType, String url, String publicId, String resourceType) {
            this.fileName = fileName;
            this.contentType = contentType;
            this.url = url;
            this.publicId = publicId;
            this.resourceType = resourceType;
        }

        private String fileName() {
            return fileName;
        }

        private String contentType() {
            return contentType;
        }

        private String url() {
            return url;
        }

        private String publicId() {
            return publicId;
        }

        private String resourceType() {
            return resourceType;
        }
    }

    public static class RequestProgress {
        private final int totalActions;
        private final int doneActions;
        private final int progress;

        public RequestProgress(int totalActions, int doneActions, int progress) {
            this.totalActions = totalActions;
            this.doneActions = doneActions;
            this.progress = progress;
        }

        public int getTotalActions() {
            return totalActions;
        }

        public int getDoneActions() {
            return doneActions;
        }

        public int getProgress() {
            return progress;
        }
    }

}
