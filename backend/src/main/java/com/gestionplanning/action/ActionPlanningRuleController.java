package com.gestionplanning.action;

import com.gestionplanning.ecr.EcrRequestRepository;
import com.gestionplanning.ecr.EcrStage;
import com.gestionplanning.ecr.EcrTemplateService;
import com.gestionplanning.storage.CloudinaryStorageService;
import com.gestionplanning.storage.CloudinaryStorageService.DownloadedAsset;
import com.gestionplanning.storage.StoredAsset;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.validation.Valid;
import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/action-planning-rules")
public class ActionPlanningRuleController {
    private final ActionPlanningRuleRepository ruleRepository;
    private final EcrRequestRepository requestRepository;
    private final ActionPlanningService planningService;
    private final EcrTemplateService templateService;
    private final CloudinaryStorageService storageService;
    private final ActionPlanningRuleProofDocumentRepository proofDocumentRepository;

    public ActionPlanningRuleController(ActionPlanningRuleRepository ruleRepository, EcrRequestRepository requestRepository,
                                        ActionPlanningService planningService, EcrTemplateService templateService,
                                        CloudinaryStorageService storageService,
                                        ActionPlanningRuleProofDocumentRepository proofDocumentRepository) {
        this.ruleRepository = ruleRepository;
        this.requestRepository = requestRepository;
        this.planningService = planningService;
        this.templateService = templateService;
        this.storageService = storageService;
        this.proofDocumentRepository = proofDocumentRepository;
    }

    @GetMapping
    public List<ActionPlanningRule> list() {
        return ruleRepository.findAllByOrderByStageAscActionTitleAsc();
    }

    @PostMapping
    public ResponseEntity<ActionPlanningRule> create(@Valid @RequestBody ActionPlanningRule rule) {
        ActionPlanningRule savedRule = ruleRepository.save(normalize(rule));
        recalculateAllRequests();
        return ResponseEntity.created(URI.create("/api/action-planning-rules/" + savedRule.getId())).body(savedRule);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ActionPlanningRule> update(@PathVariable Long id, @Valid @RequestBody ActionPlanningRule updatedRule) {
        return ruleRepository.findById(id)
                .map(rule -> {
                    ActionPlanningRule previousRule = snapshotRule(rule);
                    rule.setStage(updatedRule.getStage());
                    rule.setAppliesToModification(updatedRule.isAppliesToModification());
                    rule.setAppliesToNewProject(updatedRule.isAppliesToNewProject());
                    rule.setActionTitle(updatedRule.getActionTitle());
                    rule.setTopicRisk(updatedRule.getTopicRisk());
                    rule.setResponsible(updatedRule.getResponsible());
                    rule.setValidator(updatedRule.getValidator());
                    rule.setCriticality(updatedRule.getCriticality());
                    rule.setExpectedEvidence(updatedRule.getExpectedEvidence());
                    rule.setEvidenceRequired(updatedRule.isEvidenceRequired());
                    if (updatedRule.getProofDocumentFileName() != null) {
                        rule.setProofDocument(updatedRule.getProofDocument());
                        rule.setProofDocumentFileName(updatedRule.getProofDocumentFileName());
                        rule.setProofDocumentContentType(updatedRule.getProofDocumentContentType());
                        rule.setProofDocumentFileSize(updatedRule.getProofDocumentFileSize());
                        rule.setProofDocumentFileUrl(updatedRule.getProofDocumentFileUrl());
                        rule.setProofDocumentPublicId(updatedRule.getProofDocumentPublicId());
                        rule.setProofDocumentResourceType(updatedRule.getProofDocumentResourceType());
                    }
                    rule.setDependencyActionTitle(updatedRule.getDependencyActionTitle());
                    rule.setDependencyAnchor(updatedRule.getDependencyAnchor());
                    rule.setDurationDays(updatedRule.getDurationDays());
                    ActionPlanningRule savedRule = ruleRepository.save(normalize(rule));
                    recalculateAllRequests(previousRule, savedRule);
                    return ResponseEntity.ok(savedRule);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping(value = "/{id}/proof-document", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ActionPlanningRule> uploadProofDocument(@PathVariable Long id, @RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return ruleRepository.findById(id)
                .map(rule -> {
                    StoredAsset asset = storageService.upload(file, "gestion-planning/action-planning-rules/" + id + "/proof-document");
                    ActionPlanningRuleProofDocument proofDocument = new ActionPlanningRuleProofDocument();
                    proofDocument.setRule(rule);
                    proofDocument.setFileName(asset.getFileName());
                    proofDocument.setContentType(asset.getContentType());
                    proofDocument.setFileSize(asset.getSize());
                    proofDocument.setFileUrl(asset.getUrl());
                    proofDocument.setPublicId(asset.getPublicId());
                    proofDocument.setResourceType(asset.getResourceType());
                    proofDocumentRepository.save(proofDocument);
                    rule.setProofDocument(asset.getFileName());
                    rule.setProofDocumentFileName(asset.getFileName());
                    rule.setProofDocumentContentType(asset.getContentType());
                    rule.setProofDocumentFileSize(asset.getSize());
                    rule.setProofDocumentFileUrl(asset.getUrl());
                    rule.setProofDocumentPublicId(asset.getPublicId());
                    rule.setProofDocumentResourceType(asset.getResourceType());
                    rule.setEvidenceRequired(true);
                    ActionPlanningRule savedRule = ruleRepository.save(rule);
                    recalculateAllRequests();
                    return ResponseEntity.ok(savedRule);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/proof-documents/{proofDocumentId}/download")
    public ResponseEntity<?> downloadProofDocumentItem(@PathVariable Long proofDocumentId) {
        return proofDocumentRepository.findById(proofDocumentId).<ResponseEntity<?>>map(proofDocument -> {
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
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/proof-document")
    public ResponseEntity<?> downloadProofDocument(@PathVariable Long id) {
        return ruleRepository.findById(id).<ResponseEntity<?>>map(rule -> {
            if (rule.getProofDocumentFileUrl() == null || rule.getProofDocumentFileUrl().trim().isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            try {
                DownloadedAsset asset = storageService.download(rule.getProofDocumentPublicId(), rule.getProofDocumentResourceType(), rule.getProofDocumentFileUrl(), rule.getProofDocumentContentType());
                return ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(rule.getProofDocumentFileName(), asset.getContentType()))
                        .contentType(MediaType.parseMediaType(asset.getContentType()))
                        .body(asset.getData());
            } catch (RuntimeException exception) {
                return ResponseEntity.status(502)
                        .contentType(MediaType.TEXT_PLAIN)
                        .body("Téléchargement impossible depuis Cloudinary. Activez la livraison des fichiers PDF/ZIP dans les paramètres Security de Cloudinary, puis réessayez.");
            }
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}/proof-document")
    @Transactional
    public ResponseEntity<ActionPlanningRule> deleteProofDocument(@PathVariable Long id) {
        return ruleRepository.findById(id)
                .map(rule -> {
                    storageService.deleteQuietly(rule.getProofDocumentPublicId(), rule.getProofDocumentResourceType());
                    proofDocumentRepository.findByRule_IdOrderByUploadedAtDescIdDesc(id)
                            .forEach(proofDocument -> storageService.deleteQuietly(proofDocument.getPublicId(), proofDocument.getResourceType()));
                    proofDocumentRepository.deleteByRule_Id(id);
                    clearProofDocument(rule);
                    ActionPlanningRule savedRule = ruleRepository.save(rule);
                    recalculateAllRequests();
                    return ResponseEntity.ok(savedRule);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/proof-documents/{proofDocumentId}")
    @Transactional
    public ResponseEntity<ActionPlanningRule> deleteProofDocumentItem(@PathVariable Long proofDocumentId) {
        return proofDocumentRepository.findById(proofDocumentId)
                .map(proofDocument -> {
                    ActionPlanningRule rule = proofDocument.getRule();
                    storageService.deleteQuietly(proofDocument.getPublicId(), proofDocument.getResourceType());
                    proofDocumentRepository.delete(proofDocument);
                    proofDocumentRepository.flush();
                    syncLatestProofDocumentMetadata(rule);
                    ActionPlanningRule savedRule = ruleRepository.save(rule);
                    recalculateAllRequests();
                    return ResponseEntity.ok(savedRule);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        return ruleRepository.findById(id)
                .map(rule -> {
                    storageService.deleteQuietly(rule.getProofDocumentPublicId(), rule.getProofDocumentResourceType());
                    proofDocumentRepository.findByRule_IdOrderByUploadedAtDescIdDesc(id)
                            .forEach(proofDocument -> storageService.deleteQuietly(proofDocument.getPublicId(), proofDocument.getResourceType()));
                    proofDocumentRepository.deleteByRule_Id(id);
                    ruleRepository.delete(rule);
                    recalculateAllRequests();
                    return ResponseEntity.noContent().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    private ActionPlanningRule normalize(ActionPlanningRule rule) {
        if (rule.getDependencyAnchor() == null || rule.getDependencyAnchor().trim().isEmpty()) {
            rule.setDependencyAnchor("OUTPUT");
        }
        if (rule.getDurationDays() == null) {
            rule.setDurationDays(1);
        }
        if (rule.getCriticality() == null || rule.getCriticality().trim().isEmpty()) {
            rule.setCriticality("3-faible");
        }
        if (!rule.isAppliesToModification() && !rule.isAppliesToNewProject()) {
            rule.setAppliesToModification(true);
        }
        return rule;
    }

    private void recalculateAllRequests() {
        recalculateAllRequests(null, null);
    }

    private void recalculateAllRequests(ActionPlanningRule previousRule, ActionPlanningRule updatedRule) {
        requestRepository.findAll().stream()
                .filter(request -> request.getCurrentStage() != EcrStage.CLOSED && request.getCurrentStage() != EcrStage.CANCELLED)
                .forEach(request -> {
                    if (updatedRule != null) {
                        templateService.syncActionRuleFor(request, previousRule, updatedRule);
                    }
                    templateService.ensureMissingActionsFor(request);
                    planningService.recalculateRequest(request);
                });
    }

    private ActionPlanningRule snapshotRule(ActionPlanningRule source) {
        ActionPlanningRule snapshot = new ActionPlanningRule();
        snapshot.setStage(source.getStage());
        snapshot.setAppliesToModification(source.isAppliesToModification());
        snapshot.setAppliesToNewProject(source.isAppliesToNewProject());
        snapshot.setActionTitle(source.getActionTitle());
        snapshot.setTopicRisk(source.getTopicRisk());
        snapshot.setResponsible(source.getResponsible());
        snapshot.setValidator(source.getValidator());
        snapshot.setCriticality(source.getCriticality());
        snapshot.setExpectedEvidence(source.getExpectedEvidence());
        snapshot.setEvidenceRequired(source.isEvidenceRequired());
        snapshot.setDependencyActionTitle(source.getDependencyActionTitle());
        snapshot.setDependencyAnchor(source.getDependencyAnchor());
        snapshot.setDurationDays(source.getDurationDays());
        snapshot.setProofDocument(source.getProofDocument());
        snapshot.setProofDocumentFileName(source.getProofDocumentFileName());
        snapshot.setProofDocumentContentType(source.getProofDocumentContentType());
        snapshot.setProofDocumentFileSize(source.getProofDocumentFileSize());
        snapshot.setProofDocumentFileUrl(source.getProofDocumentFileUrl());
        snapshot.setProofDocumentPublicId(source.getProofDocumentPublicId());
        snapshot.setProofDocumentResourceType(source.getProofDocumentResourceType());
        return snapshot;
    }

    private void clearProofDocument(ActionPlanningRule rule) {
        rule.setProofDocument(null);
        rule.setProofDocumentFileName(null);
        rule.setProofDocumentContentType(null);
        rule.setProofDocumentFileSize(null);
        rule.setProofDocumentFileUrl(null);
        rule.setProofDocumentPublicId(null);
        rule.setProofDocumentResourceType(null);
    }

    private void syncLatestProofDocumentMetadata(ActionPlanningRule rule) {
        if (rule == null || rule.getId() == null) {
            return;
        }
        List<ActionPlanningRuleProofDocument> documents = proofDocumentRepository.findByRule_IdOrderByUploadedAtDescIdDesc(rule.getId());
        if (documents.isEmpty()) {
            clearProofDocument(rule);
            return;
        }
        ActionPlanningRuleProofDocument latest = documents.get(0);
        rule.setProofDocument(latest.getFileName());
        rule.setProofDocumentFileName(latest.getFileName());
        rule.setProofDocumentContentType(latest.getContentType());
        rule.setProofDocumentFileSize(latest.getFileSize());
        rule.setProofDocumentFileUrl(latest.getFileUrl());
        rule.setProofDocumentPublicId(latest.getPublicId());
        rule.setProofDocumentResourceType(latest.getResourceType());
        rule.setEvidenceRequired(true);
    }

    private String safeFileName(String fileName) {
        if (fileName == null || fileName.trim().isEmpty()) {
            return "proof-document";
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
