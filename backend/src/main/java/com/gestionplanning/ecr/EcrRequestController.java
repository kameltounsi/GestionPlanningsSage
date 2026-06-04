package com.gestionplanning.ecr;

import com.gestionplanning.action.EcrAction;
import com.gestionplanning.action.EcrActionAssetRepository;
import com.gestionplanning.action.EcrActionEvidenceRepository;
import com.gestionplanning.action.EcrActionRepository;
import com.gestionplanning.action.ActionPlanningService;
import com.gestionplanning.document.EcrDocument;
import com.gestionplanning.document.EcrDocumentRepository;
import com.gestionplanning.penalty.PenaltyRepository;
import com.gestionplanning.storage.CloudinaryStorageService;
import com.gestionplanning.storage.StoredAsset;
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

    public EcrRequestController(EcrRequestRepository requestRepository, ChecklistItemRepository checklistItemRepository,
                                EcrActionRepository actionRepository, EcrActionEvidenceRepository evidenceRepository,
                                EcrActionAssetRepository assetRepository,
                                EcrDocumentRepository documentRepository, PenaltyRepository penaltyRepository,
                                CloudinaryStorageService storageService, EcrTemplateService templateService,
                                ActionPlanningService planningService) {
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
    }

    @GetMapping
    public List<EcrRequest> list() {
        requestRepository.findAll().stream()
                .filter(request -> request.getCurrentStage() != EcrStage.CLOSED && request.getCurrentStage() != EcrStage.CANCELLED)
                .forEach(templateService::ensureMissingActionsFor);
        return requestRepository.findAllByOrderByReceptionDateDescIdDesc();
    }

    @GetMapping("/{id}")
    public ResponseEntity<EcrRequest> get(@PathVariable Long id) {
        return requestRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<EcrRequest> create(@Valid @RequestBody EcrRequest request) {
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
        return ResponseEntity.created(URI.create("/api/ecr-requests/" + saved.getId())).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<EcrRequest> update(@PathVariable Long id, @Valid @RequestBody EcrRequest updatedRequest) {
        return requestRepository.findById(id)
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
                    request.setCurrentStage(EcrStage.isAllowed(updatedRequest.getCurrentStage(), updatedRequest.isNewVersion())
                            ? updatedRequest.getCurrentStage()
                            : EcrStage.firstAllowed(updatedRequest.isNewVersion()));
                    EcrRequest saved = requestRepository.save(request);
                    planningService.recalculateRequest(saved);
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping(value = "/{id}/images/{type}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<EcrRequest> uploadImage(@PathVariable Long id, @PathVariable String type, @RequestParam("file") MultipartFile file) {
        if (file.isEmpty() || file.getContentType() == null || !file.getContentType().startsWith("image/")) {
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
    public ResponseEntity<EcrRequest> updateStage(@PathVariable Long id, @RequestParam EcrStage stage) {
        return requestRepository.findById(id)
                .map(request -> {
                    if (!EcrStage.isAllowed(stage, request.isNewVersion())) {
                        return ResponseEntity.badRequest().<EcrRequest>build();
                    }
                    request.setCurrentStage(stage);
                    return ResponseEntity.ok(requestRepository.save(request));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/checklist")
    public ResponseEntity<List<ChecklistItem>> checklist(@PathVariable Long id, @RequestParam(required = false) EcrStage stage) {
        if (!requestRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        if (stage == null) {
            return ResponseEntity.ok(requestRepository.findById(id).get().getChecklistItems());
        }
        return ResponseEntity.ok(checklistItemRepository.findByRequestIdAndStageOrderById(id, stage));
    }

}
