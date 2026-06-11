package com.gestionplanning.ecr;

import com.gestionplanning.action.EcrAction;
import com.gestionplanning.action.EcrActionAssetRepository;
import com.gestionplanning.action.EcrActionEvidenceRepository;
import com.gestionplanning.action.EcrActionRepository;
import com.gestionplanning.action.ActionPlanningService;
import com.gestionplanning.audit.AuditLogService;
import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.document.EcrDocument;
import com.gestionplanning.document.EcrDocumentRepository;
import com.gestionplanning.penalty.PenaltyRepository;
import com.gestionplanning.storage.CloudinaryStorageService.DownloadedAsset;
import com.gestionplanning.storage.CloudinaryStorageService;
import com.gestionplanning.storage.StoredAsset;
import com.gestionplanning.user.AppUser;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.validation.Valid;
import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/ecr-requests")
public class EcrRequestController {
    private final EcrRequestRepository requestRepository;
    private final ChecklistItemRepository checklistItemRepository;
    private final EcrActionRepository actionRepository;
    private final EcrActionEvidenceRepository evidenceRepository;
    private final EcrActionAssetRepository assetRepository;
    private final EcrDocumentRepository documentRepository;
    private final PenaltyRepository penaltyRepository;
    private final CloudinaryStorageService storageService;
    private final EcrTemplateService templateService;
    private final ActionPlanningService planningService;
    private final AccessControlService accessControlService;
    private final PhaseValidationRequestRepository validationRepository;
    private final AuditLogService auditLogService;

    public EcrRequestController(EcrRequestRepository requestRepository, ChecklistItemRepository checklistItemRepository,
                                EcrActionRepository actionRepository, EcrActionEvidenceRepository evidenceRepository,
                                EcrActionAssetRepository assetRepository,
                                EcrDocumentRepository documentRepository, PenaltyRepository penaltyRepository,
                                CloudinaryStorageService storageService, EcrTemplateService templateService,
                                ActionPlanningService planningService, AccessControlService accessControlService,
                                PhaseValidationRequestRepository validationRepository, AuditLogService auditLogService) {
        this.requestRepository = requestRepository;
        this.checklistItemRepository = checklistItemRepository;
        this.actionRepository = actionRepository;
        this.evidenceRepository = evidenceRepository;
        this.assetRepository = assetRepository;
        this.documentRepository = documentRepository;
        this.penaltyRepository = penaltyRepository;
        this.storageService = storageService;
        this.templateService = templateService;
        this.planningService = planningService;
        this.accessControlService = accessControlService;
        this.validationRepository = validationRepository;
        this.auditLogService = auditLogService;
    }

    @GetMapping
    public List<EcrRequest> list(@RequestAttribute("authenticatedUser") AppUser user) {
        requestRepository.findAll().stream()
                .filter(request -> request.getCurrentStage() != EcrStage.CLOSED && request.getCurrentStage() != EcrStage.CANCELLED)
                .forEach(templateService::ensureMissingActionsFor);
        return requestRepository.findAllByOrderByReceptionDateDescIdDesc().stream()
                .filter(request -> accessControlService.canAccessRequest(user, request))
                .collect(java.util.stream.Collectors.toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<EcrRequest> get(@PathVariable Long id, @RequestAttribute("authenticatedUser") AppUser user) {
        return requestRepository.findById(id)
                .filter(request -> accessControlService.canAccessRequest(user, request))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(403).build());
    }

    @PostMapping
    public ResponseEntity<EcrRequest> create(@Valid @RequestBody EcrRequest request,
                                             @RequestAttribute("authenticatedUser") AppUser user) {
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
                "Creation de la modification: " + requestLabel(saved)
        );
        return ResponseEntity.created(URI.create("/api/ecr-requests/" + saved.getId())).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<EcrRequest> update(@PathVariable Long id, @Valid @RequestBody EcrRequest updatedRequest,
                                             @RequestAttribute("authenticatedUser") AppUser user) {
        return requestRepository.findById(id)
                .filter(request -> accessControlService.canAccessRequest(user, request))
                .map(request -> {
                    request.setModificationNumber(updatedRequest.getModificationNumber());
                    request.setClient(updatedRequest.getClient());
                    request.setProduct(updatedRequest.getProduct());
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
                    EcrStage nextStage = EcrStage.isAllowed(updatedRequest.getCurrentStage(), updatedRequest.isNewVersion())
                            ? updatedRequest.getCurrentStage()
                            : EcrStage.firstAllowed(updatedRequest.isNewVersion());
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
                            "Modification mise a jour: " + requestLabel(saved)
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
                    DownloadedAsset asset = storageService.download(file.publicId(), file.resourceType(), file.url(), file.contentType());
                    return ResponseEntity.ok()
                            .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(file.fileName(), asset.getContentType()))
                            .contentType(MediaType.parseMediaType(asset.getContentType()))
                            .body(asset.getData());
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!requestRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        List<EcrAction> actions = actionRepository.findByRequest_IdOrderByDeadlineAscIdAsc(id);
        assetRepository.findByAction_Request_Id(id)
                .forEach(asset -> storageService.deleteQuietly(asset.getPublicId(), asset.getResourceType()));
        actions.forEach(action -> storageService.deleteQuietly(action.getEvidencePublicId(), action.getEvidenceResourceType()));
        actions.forEach(action -> {
            if (evidenceRepository.existsById(action.getId())) {
                evidenceRepository.deleteById(action.getId());
            }
        });

        List<EcrDocument> documents = documentRepository.findByRequest_IdOrderByUploadedAtDescIdDesc(id);
        documents.forEach(document -> storageService.deleteQuietly(document.getPublicId(), document.getResourceType()));

        requestRepository.findById(id).ifPresent(request -> {
            storageService.deleteQuietly(request.getBeforePhotoPublicId(), request.getBeforePhotoResourceType());
            storageService.deleteQuietly(request.getAfterPhotoPublicId(), request.getAfterPhotoResourceType());
        });

        penaltyRepository.deleteByRequest_Id(id);
        documentRepository.deleteByRequest_Id(id);
        assetRepository.findByAction_Request_Id(id).forEach(asset -> assetRepository.deleteById(asset.getId()));
        actionRepository.deleteByRequest_Id(id);
        requestRepository.deleteById(id);
        return ResponseEntity.noContent().build();
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
                    if (!EcrStage.isAllowed(stage, request.isNewVersion())) {
                        return ResponseEntity.badRequest().<EcrRequest>build();
                    }
                    boolean reopeningApprovedStage = isApprovedStage(request, stage) && stage != request.getCurrentStage();
                    if (reopeningApprovedStage) {
                        reopenApprovedStage(request, stage, user);
                    }
                    request.setCurrentStage(stage);
                    EcrRequest saved = requestRepository.save(request);
                    if (reopeningApprovedStage) {
                        auditLogService.recordBusinessEvent(
                                user,
                                "REOUVERTURE_PHASE",
                                "modification",
                                requestLabel(saved),
                                "Phase reouverte: " + stageLabel(stage) + " - Modification: " + requestLabel(saved)
                        );
                    }
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

    private void reopenApprovedStage(EcrRequest request, EcrStage stage, AppUser user) {
        validationRepository.findFirstByRequest_IdAndStageOrderByRequestedAtDescIdDesc(request.getId(), stage)
                .filter(validation -> validation.getStatus() == PhaseValidationStatus.APPROVED)
                .ifPresent(validation -> {
                    validation.setStatus(PhaseValidationStatus.REOPENED);
                    validation.setReviewedBy(displayName(user));
                    validation.setReviewedAt(java.time.LocalDateTime.now());
                    validation.setRefusalReason("Phase reouverte par l'admin.");
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

}
