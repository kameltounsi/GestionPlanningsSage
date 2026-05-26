package com.gestionplanning.action;

import com.gestionplanning.ecr.EcrRequestRepository;
import com.gestionplanning.ecr.EcrStage;
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

    public EcrActionController(EcrActionRepository actionRepository, EcrActionEvidenceRepository evidenceRepository,
                               EcrRequestRepository requestRepository, ActionPlanningService planningService) {
        this.actionRepository = actionRepository;
        this.evidenceRepository = evidenceRepository;
        this.requestRepository = requestRepository;
        this.planningService = planningService;
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
                    action.setEvidence(updatedAction.getEvidence());
                    action.setProofDocument(updatedAction.getProofDocument());
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
                    try {
                        action.setEvidenceFileName(file.getOriginalFilename());
                        action.setEvidenceContentType(file.getContentType());
                        action.setEvidenceFileSize(file.getSize());
                        action.setEvidence(file.getOriginalFilename());
                        EcrAction savedAction = actionRepository.save(action);
                        evidenceRepository.save(new EcrActionEvidence(savedAction.getId(), file.getBytes()));
                        return ResponseEntity.ok(savedAction);
                    } catch (Exception exception) {
                        throw new IllegalStateException("Impossible d'enregistrer le fichier evidence", exception);
                    }
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/actions/{id}/evidence")
    public ResponseEntity<byte[]> downloadEvidence(@PathVariable Long id) {
        return actionRepository.findById(id)
                .flatMap(action -> evidenceRepository.findById(id)
                        .map(evidence -> ResponseEntity.ok()
                                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + safeFileName(action.getEvidenceFileName()) + "\"")
                                .contentType(MediaType.parseMediaType(action.getEvidenceContentType() == null ? MediaType.APPLICATION_OCTET_STREAM_VALUE : action.getEvidenceContentType()))
                                .body(evidence.getData())))
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/actions/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!actionRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        evidenceRepository.deleteById(id);
        actionRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private String safeFileName(String fileName) {
        if (fileName == null || fileName.trim().isEmpty()) {
            return "evidence";
        }
        return fileName.replace("\"", "");
    }
}
