package com.gestionplanning.ecr;

import com.gestionplanning.action.EcrAction;
import com.gestionplanning.action.EcrActionEvidenceRepository;
import com.gestionplanning.action.EcrActionRepository;
import com.gestionplanning.document.EcrDocument;
import com.gestionplanning.document.EcrDocumentRepository;
import com.gestionplanning.penalty.PenaltyRepository;
import com.gestionplanning.storage.CloudinaryStorageService;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

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
    private final EcrDocumentRepository documentRepository;
    private final PenaltyRepository penaltyRepository;
    private final CloudinaryStorageService storageService;
    private final EcrTemplateService templateService;

    public EcrRequestController(EcrRequestRepository requestRepository, ChecklistItemRepository checklistItemRepository,
                                EcrActionRepository actionRepository, EcrActionEvidenceRepository evidenceRepository,
                                EcrDocumentRepository documentRepository, PenaltyRepository penaltyRepository,
                                CloudinaryStorageService storageService, EcrTemplateService templateService) {
        this.requestRepository = requestRepository;
        this.checklistItemRepository = checklistItemRepository;
        this.actionRepository = actionRepository;
        this.evidenceRepository = evidenceRepository;
        this.documentRepository = documentRepository;
        this.penaltyRepository = penaltyRepository;
        this.storageService = storageService;
        this.templateService = templateService;
    }

    @GetMapping
    public List<EcrRequest> list() {
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
                    request.setAccessInternalNumber(updatedRequest.getAccessInternalNumber());
                    request.setModificationNumber(updatedRequest.getModificationNumber());
                    request.setClient(updatedRequest.getClient());
                    request.setProduct(updatedRequest.getProduct());
                    request.setModificationProject(updatedRequest.getModificationProject());
                    request.setReceptionDate(updatedRequest.getReceptionDate());
                    request.setSopDate(updatedRequest.getSopDate());
                    request.setPilot(updatedRequest.getPilot());
                    request.setModificationReason(updatedRequest.getModificationReason());
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
        actions.forEach(action -> storageService.deleteQuietly(action.getEvidencePublicId(), action.getEvidenceResourceType()));
        actions.forEach(action -> {
            if (evidenceRepository.existsById(action.getId())) {
                evidenceRepository.deleteById(action.getId());
            }
        });

        List<EcrDocument> documents = documentRepository.findByRequest_IdOrderByUploadedAtDescIdDesc(id);
        documents.forEach(document -> storageService.deleteQuietly(document.getPublicId(), document.getResourceType()));

        penaltyRepository.deleteByRequest_Id(id);
        documentRepository.deleteByRequest_Id(id);
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
