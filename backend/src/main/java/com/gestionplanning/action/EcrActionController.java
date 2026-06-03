package com.gestionplanning.action;

import com.gestionplanning.ecr.EcrRequestRepository;
import com.gestionplanning.ecr.EcrStage;
import com.gestionplanning.storage.CloudinaryStorageService;
import com.gestionplanning.storage.DownloadedAsset;
import com.gestionplanning.storage.StoredAsset;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.validation.Valid;
import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class EcrActionController {
    private final EcrActionRepository actionRepository;
    private final EcrActionEvidenceRepository evidenceRepository;
    private final EcrRequestRepository requestRepository;
    private final ActionPlanningService planningService;
    private final CloudinaryStorageService storageService;

    public EcrActionController(EcrActionRepository actionRepository, EcrActionEvidenceRepository evidenceRepository,
                               EcrRequestRepository requestRepository, ActionPlanningService planningService,
                               CloudinaryStorageService storageService) {
        this.actionRepository = actionRepository;
        this.evidenceRepository = evidenceRepository;
        this.requestRepository = requestRepository;
        this.planningService = planningService;
        this.storageService = storageService;
    }

    @GetMapping("/actions")
    public List<EcrAction> list(@RequestParam(required = false) Boolean late) {
        if (Boolean.TRUE.equals(late)) {
            return actionRepository.findByDeadlineBeforeAndStatusNotOrderByDeadlineAsc(LocalDate.now(), ActionStatus.DONE);
        }
        return actionRepository.findAll();
    }

    @GetMapping("/ecr-requests/{requestId}/actions")
    public ResponseEntity<List<EcrAction>> listByRequest(@PathVariable Long requestId, @RequestParam(required = false) EcrStage stage) {
        if (!requestRepository.existsById(requestId)) {
            return ResponseEntity.notFound().build();
        }
        if (stage != null) {
            List<EcrAction> actions = actionRepository.findByRequest_IdOrderByDeadlineAscIdAsc(requestId).stream()
                    .filter(action -> action.getStage() == stage)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(actions);
        }
        return ResponseEntity.ok(actionRepository.findByRequest_IdOrderByDeadlineAscIdAsc(requestId));
    }

    @PostMapping("/ecr-requests/{requestId}/actions")
    public ResponseEntity<EcrAction> create(@PathVariable Long requestId, @Valid @RequestBody EcrAction action) {
        return requestRepository.findById(requestId)
                .map(request -> {
                    if (isDone(action) && action.isEvidenceRequired()) {
                        return ResponseEntity.badRequest().<EcrAction>build();
                    }
                    action.setRequest(request);
                    EcrAction saved = actionRepository.save(action);
                    planningService.recalculateRequest(request);
                    return ResponseEntity.created(URI.create("/api/actions/" + saved.getId())).body(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/actions/{id}")
    public ResponseEntity<EcrAction> update(@PathVariable Long id, @Valid @RequestBody EcrAction updatedAction) {
        return actionRepository.findById(id)
                .map(action -> {
                    action.setTitle(updatedAction.getTitle());
                    action.setDescription(updatedAction.getDescription());
                    action.setTopicRisk(updatedAction.getTopicRisk());
                    action.setResponsible(updatedAction.getResponsible());
                    action.setCriticality(updatedAction.getCriticality());
                    action.setExpectedEvidence(updatedAction.getExpectedEvidence());
                    action.setEvidenceRequired(updatedAction.isEvidenceRequired());
                    action.setEvidence(updatedAction.getEvidence());
                    action.setProofDocument(updatedAction.getProofDocument());
                    if (isDone(updatedAction) && updatedAction.isEvidenceRequired() && !hasEvidence(action)) {
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
                    action.setComment(updatedAction.getComment());
                    EcrAction saved = actionRepository.save(action);
                    planningService.recalculateRequest(saved.getRequest());
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping(value = "/actions/{id}/evidence", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<EcrAction> uploadEvidence(@PathVariable Long id, @RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return actionRepository.findById(id)
                .map(action -> {
                    storageService.deleteQuietly(action.getEvidencePublicId(), action.getEvidenceResourceType());
                    StoredAsset asset = storageService.upload(file, "gestion-planning/actions/" + id);
                    action.setEvidenceFileName(asset.getFileName());
                    action.setEvidenceContentType(asset.getContentType());
                    action.setEvidenceFileSize(asset.getSize());
                    action.setEvidenceFileUrl(asset.getUrl());
                    action.setEvidencePublicId(asset.getPublicId());
                    action.setEvidenceResourceType(asset.getResourceType());
                    action.setEvidence(asset.getFileName());
                    deleteLocalEvidenceIfPresent(id);
                    return ResponseEntity.ok(actionRepository.save(action));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/actions/{id}/evidence")
    public ResponseEntity<?> downloadEvidence(@PathVariable Long id) {
        return actionRepository.findById(id).map(action -> {
            if (action.getEvidenceFileUrl() != null && !action.getEvidenceFileUrl().trim().isEmpty()) {
                DownloadedAsset asset = storageService.download(action.getEvidenceFileUrl(), action.getEvidenceContentType());
                return ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + safeFileName(action.getEvidenceFileName()) + "\"")
                        .contentType(MediaType.parseMediaType(asset.getContentType()))
                        .body(asset.getData());
            }
            return evidenceRepository.findById(id)
                    .map(evidence -> ResponseEntity.ok()
                            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + safeFileName(action.getEvidenceFileName()) + "\"")
                            .contentType(MediaType.parseMediaType(action.getEvidenceContentType() == null ? MediaType.APPLICATION_OCTET_STREAM_VALUE : action.getEvidenceContentType()))
                            .body(evidence.getData()))
                    .orElse(ResponseEntity.notFound().build());
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/actions/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!actionRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        actionRepository.findById(id).ifPresent(action -> {
            storageService.deleteQuietly(action.getEvidencePublicId(), action.getEvidenceResourceType());
            deleteLocalEvidenceIfPresent(id);
            actionRepository.deleteById(id);
        });
        return ResponseEntity.noContent().build();
    }

    private void deleteLocalEvidenceIfPresent(Long actionId) {
        if (evidenceRepository.existsById(actionId)) {
            evidenceRepository.deleteById(actionId);
        }
    }

    private boolean hasEvidence(EcrAction action) {
        return action.getEvidenceFileName() != null && !action.getEvidenceFileName().trim().isEmpty();
    }

    private boolean isDone(EcrAction action) {
        return action != null && (action.isChecked() || action.getStatus() == ActionStatus.DONE);
    }

    private boolean isDependencyCompleted(EcrAction action) {
        if (action == null || action.getDependsOnActionId() == null) {
            return true;
        }
        return actionRepository.findById(action.getDependsOnActionId())
                .map(dependency -> dependency.isChecked() || dependency.getStatus() == ActionStatus.DONE)
                .orElse(false);
    }

    private String safeFileName(String fileName) {
        if (fileName == null || fileName.trim().isEmpty()) {
            return "evidence";
        }
        return fileName.replace("\"", "");
    }
}
