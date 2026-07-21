package com.gestionplanning.action;

import com.gestionplanning.action.ActionPlanningRulePropagationService.CloudAssetReference;
import com.gestionplanning.storage.CloudinaryStorageService;
import com.gestionplanning.storage.CloudinaryStorageService.DownloadedAsset;
import com.gestionplanning.storage.StoredAsset;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.validation.Valid;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/action-planning-rules")
public class ActionPlanningRuleController {
    private final ActionPlanningRuleRepository ruleRepository;
    private final CloudinaryStorageService storageService;
    private final ActionPlanningRuleProofDocumentRepository proofDocumentRepository;
    private final ActionPlanningRuleMapper ruleMapper;
    private final ActionPlanningRulePropagationService propagationService;

    public ActionPlanningRuleController(ActionPlanningRuleRepository ruleRepository,
                                        CloudinaryStorageService storageService,
                                        ActionPlanningRuleProofDocumentRepository proofDocumentRepository,
                                        ActionPlanningRuleMapper ruleMapper,
                                        ActionPlanningRulePropagationService propagationService) {
        this.ruleRepository = ruleRepository;
        this.storageService = storageService;
        this.proofDocumentRepository = proofDocumentRepository;
        this.ruleMapper = ruleMapper;
        this.propagationService = propagationService;
    }

    @GetMapping
    public List<ActionPlanningRuleDto> list() {
        return ruleRepository.findAllByOrderByStageAscActionTitleAsc().stream()
                .map(ruleMapper::toDto)
                .collect(Collectors.toList());
    }

    @PostMapping
    public ResponseEntity<ActionPlanningRuleDto> create(@Valid @RequestBody ActionPlanningRuleDto ruleDto) {
        ActionPlanningRule rule = normalize(ruleMapper.toEntity(ruleDto));
        if (!hasValidDependencyGraph(rule, null)) {
            return ResponseEntity.unprocessableEntity().build();
        }
        ActionPlanningRule savedRule = ruleRepository.save(rule);
        return ResponseEntity.created(URI.create("/api/action-planning-rules/" + savedRule.getId())).body(ruleMapper.toDto(savedRule));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ActionPlanningRuleDto> update(@PathVariable Long id, @Valid @RequestBody ActionPlanningRuleDto updatedRuleDto) {
        ActionPlanningRule updatedRule = normalize(ruleMapper.toEntity(updatedRuleDto));
        if (!hasValidDependencyGraph(updatedRule, id)) {
            return ResponseEntity.unprocessableEntity().build();
        }
        return ruleRepository.findById(id)
                .map(rule -> {
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
                    rule.setRoutineAction(updatedRule.isRoutineAction());
                    rule.setRecurrenceIntervalDays(updatedRule.getRecurrenceIntervalDays());
                    ActionPlanningRule savedRule = ruleRepository.save(normalize(rule));
                    return ResponseEntity.ok(ruleMapper.toDto(savedRule));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping(value = "/{id}/proof-document", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ActionPlanningRuleDto> uploadProofDocument(@PathVariable Long id, @RequestParam("file") MultipartFile file) {
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
                    return ResponseEntity.ok(ruleMapper.toDto(savedRule));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/proof-document-link")
    public ResponseEntity<ActionPlanningRuleDto> addProofDocumentLink(@PathVariable Long id, @RequestBody LinkPayload payload) {
        String url = normalizeSharedLink(payload == null ? null : payload.getUrl());
        if (url == null) {
            return ResponseEntity.badRequest().build();
        }
        return ruleRepository.findById(id)
                .map(rule -> {
                    String label = normalizeText(payload.getName());
                    ActionPlanningRuleProofDocument proofDocument = new ActionPlanningRuleProofDocument();
                    proofDocument.setRule(rule);
                    proofDocument.setFileName(label == null ? url : label);
                    proofDocument.setContentType("text/uri-list");
                    proofDocument.setFileSize(null);
                    proofDocument.setFileUrl(url);
                    proofDocument.setPublicId(null);
                    proofDocument.setResourceType("link");
                    proofDocumentRepository.save(proofDocument);
                    rule.setProofDocument(proofDocument.getFileName());
                    rule.setProofDocumentFileName(proofDocument.getFileName());
                    rule.setProofDocumentContentType(proofDocument.getContentType());
                    rule.setProofDocumentFileSize(null);
                    rule.setProofDocumentFileUrl(url);
                    rule.setProofDocumentPublicId(null);
                    rule.setProofDocumentResourceType("link");
                    rule.setEvidenceRequired(true);
                    ActionPlanningRule savedRule = ruleRepository.save(rule);
                    return ResponseEntity.ok(ruleMapper.toDto(savedRule));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/proof-documents/{proofDocumentId}/download")
    public ResponseEntity<Object> downloadProofDocumentItem(@PathVariable Long proofDocumentId) {
        return proofDocumentRepository.findById(proofDocumentId).<ResponseEntity<Object>>map(proofDocument -> {
            if (isExternalLink(proofDocument.getFileUrl(), proofDocument.getPublicId(), proofDocument.getResourceType())) {
                return ResponseEntity.status(302).location(URI.create(proofDocument.getFileUrl())).build();
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
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/proof-document")
    public ResponseEntity<Object> downloadProofDocument(@PathVariable Long id) {
        return ruleRepository.findById(id).<ResponseEntity<Object>>map(rule -> {
            if (rule.getProofDocumentFileUrl() == null || rule.getProofDocumentFileUrl().trim().isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            if (isExternalLink(rule.getProofDocumentFileUrl(), rule.getProofDocumentPublicId(), rule.getProofDocumentResourceType())) {
                return ResponseEntity.status(302).location(URI.create(rule.getProofDocumentFileUrl())).build();
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
    public ResponseEntity<ActionPlanningRuleDto> deleteProofDocument(@PathVariable Long id) {
        return ruleRepository.findById(id)
                .map(rule -> {
                    storageService.deleteQuietly(rule.getProofDocumentPublicId(), rule.getProofDocumentResourceType());
                    proofDocumentRepository.findByRule_IdOrderByUploadedAtDescIdDesc(id)
                            .forEach(proofDocument -> storageService.deleteQuietly(proofDocument.getPublicId(), proofDocument.getResourceType()));
                    proofDocumentRepository.deleteByRule_Id(id);
                    clearProofDocument(rule);
                    ActionPlanningRule savedRule = ruleRepository.save(rule);
                    return ResponseEntity.ok(ruleMapper.toDto(savedRule));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/proof-documents/{proofDocumentId}")
    @Transactional
    public ResponseEntity<ActionPlanningRuleDto> deleteProofDocumentItem(@PathVariable Long proofDocumentId) {
        return proofDocumentRepository.findById(proofDocumentId)
                .map(proofDocument -> {
                    ActionPlanningRule rule = proofDocument.getRule();
                    storageService.deleteQuietly(proofDocument.getPublicId(), proofDocument.getResourceType());
                    proofDocumentRepository.delete(proofDocument);
                    proofDocumentRepository.flush();
                    syncLatestProofDocumentMetadata(rule);
                    ActionPlanningRule savedRule = ruleRepository.save(rule);
                    return ResponseEntity.ok(ruleMapper.toDto(savedRule));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        return ruleRepository.findById(id)
                .map(rule -> {
                    List<CloudAssetReference> cloudAssets = cloudAssetsForRule(rule);
                    proofDocumentRepository.deleteByRule_Id(id);
                    ruleRepository.delete(rule);
                    runAfterCommit(() -> propagationService.deleteCloudAssets(cloudAssets));
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
        if (rule.isRoutineAction()) {
            rule.setDependencyActionTitle(null);
            if (rule.getRecurrenceIntervalDays() == null || rule.getRecurrenceIntervalDays() < 1) {
                rule.setRecurrenceIntervalDays(1);
            }
        } else {
            rule.setRecurrenceIntervalDays(null);
        }
        if (rule.getCriticality() == null || rule.getCriticality().trim().isEmpty()) {
            rule.setCriticality("3-faible");
        }
        if (!rule.isAppliesToModification() && !rule.isAppliesToNewProject()) {
            rule.setAppliesToModification(true);
        }
        return rule;
    }

    private boolean hasValidDependencyGraph(ActionPlanningRule candidate, Long candidateId) {
        String candidateTitle = normalizedTitle(candidate.getActionTitle());
        String dependencyTitle = normalizedTitle(candidate.getDependencyActionTitle());
        if (dependencyTitle == null) {
            return true;
        }
        if (candidateTitle == null || candidateTitle.equals(dependencyTitle)) {
            return false;
        }
        java.util.Map<String, ActionPlanningRule> rulesByTitle = ruleRepository.findAll().stream()
                .filter(rule -> rule.getStage() == candidate.getStage())
                .filter(rule -> candidateId == null || !candidateId.equals(rule.getId()))
                .filter(rule -> normalizedTitle(rule.getActionTitle()) != null)
                .collect(Collectors.toMap(
                        rule -> normalizedTitle(rule.getActionTitle()),
                        rule -> rule,
                        (first, second) -> first
                ));
        rulesByTitle.put(candidateTitle, candidate);
        java.util.Set<String> visited = new java.util.HashSet<>();
        String currentTitle = dependencyTitle;
        while (currentTitle != null && visited.add(currentTitle)) {
            if (candidateTitle.equals(currentTitle)) {
                return false;
            }
            ActionPlanningRule current = rulesByTitle.get(currentTitle);
            currentTitle = current == null ? null : normalizedTitle(current.getDependencyActionTitle());
        }
        return true;
    }

    private String normalizedTitle(String value) {
        String title = normalizeText(value);
        return title == null ? null : title.toLowerCase(java.util.Locale.ROOT);
    }

    private List<CloudAssetReference> cloudAssetsForRule(ActionPlanningRule rule) {
        List<CloudAssetReference> assets = new ArrayList<>();
        addCloudAsset(assets, rule.getProofDocumentPublicId(), rule.getProofDocumentResourceType());
        proofDocumentRepository.findByRule_IdOrderByUploadedAtDescIdDesc(rule.getId())
                .forEach(proofDocument -> addCloudAsset(assets, proofDocument.getPublicId(), proofDocument.getResourceType()));
        return assets;
    }

    private void addCloudAsset(List<CloudAssetReference> assets, String publicId, String resourceType) {
        if (publicId != null && !publicId.trim().isEmpty()) {
            assets.add(new CloudAssetReference(publicId, resourceType));
        }
    }

    private void runAfterCommit(Runnable task) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    task.run();
                }
            });
            return;
        }
        task.run();
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

    private String normalizeSharedLink(String value) {
        String url = normalizeText(value);
        if (url == null || !(url.startsWith("http://") || url.startsWith("https://"))) {
            return null;
        }
        try {
            URI.create(url);
            return url;
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private String normalizeText(String value) {
        if (value == null) {
            return null;
        }
        String text = value.trim();
        return text.isEmpty() ? null : text;
    }

    private boolean isExternalLink(String fileUrl, String publicId, String resourceType) {
        return normalizeSharedLink(fileUrl) != null
                && (publicId == null || publicId.trim().isEmpty())
                && "link".equalsIgnoreCase(String.valueOf(resourceType));
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
