package com.gestionplanning.ecr;

import com.gestionplanning.action.ActionStatus;
import com.gestionplanning.action.EcrAction;
import com.gestionplanning.action.EcrActionRepository;
import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.user.AccountMailService;
import com.gestionplanning.user.AppUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/ecr-requests/{requestId}/phase-validations")
public class PhaseValidationController {
    private final EcrRequestRepository requestRepository;
    private final EcrActionRepository actionRepository;
    private final PhaseValidationRequestRepository validationRepository;
    private final AccessControlService accessControlService;
    private final AccountMailService accountMailService;

    public PhaseValidationController(EcrRequestRepository requestRepository,
                                     EcrActionRepository actionRepository,
                                     PhaseValidationRequestRepository validationRepository,
                                     AccessControlService accessControlService,
                                     AccountMailService accountMailService) {
        this.requestRepository = requestRepository;
        this.actionRepository = actionRepository;
        this.validationRepository = validationRepository;
        this.accessControlService = accessControlService;
        this.accountMailService = accountMailService;
    }

    @GetMapping
    public ResponseEntity<List<PhaseValidationRequest>> list(@PathVariable Long requestId,
                                                             @RequestAttribute("authenticatedUser") AppUser user) {
        return requestRepository.findById(requestId)
                .filter(request -> accessControlService.canAccessRequest(user, request))
                .map(request -> ResponseEntity.ok(validationRepository.findByRequest_IdOrderByRequestedAtDescIdDesc(requestId)))
                .orElse(ResponseEntity.status(403).build());
    }

    @PostMapping
    public ResponseEntity<PhaseValidationRequest> requestValidation(@PathVariable Long requestId,
                                                                    @RequestBody ValidationCreateRequest payload,
                                                                    @RequestAttribute("authenticatedUser") AppUser user) {
        return requestRepository.findById(requestId)
                .filter(request -> accessControlService.canAccessRequest(user, request))
                .map(request -> {
                    EcrStage stage = payload == null || payload.getStage() == null ? request.getCurrentStage() : payload.getStage();
                    if (stage != request.getCurrentStage() || !allStageActionsDone(requestId, stage)) {
                        return ResponseEntity.badRequest().<PhaseValidationRequest>build();
                    }
                    PhaseValidationRequest validation = validationRepository.findFirstByRequest_IdAndStageOrderByRequestedAtDescIdDesc(requestId, stage)
                            .filter(existing -> existing.getStatus() == PhaseValidationStatus.PENDING)
                            .orElseGet(PhaseValidationRequest::new);
                    validation.setRequest(request);
                    validation.setStage(stage);
                    validation.setStatus(PhaseValidationStatus.PENDING);
                    validation.setRequestedBy(displayName(user));
                    validation.setRequestedAt(LocalDateTime.now());
                    PhaseValidationRequest saved = validationRepository.save(validation);
                    accountMailService.sendPhaseReadyEmail(request, stage, accessControlService.validatorsAndManagersFor(request));
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.status(403).build());
    }

    @PostMapping("/{validationId}/approve")
    public ResponseEntity<EcrRequest> approve(@PathVariable Long requestId,
                                              @PathVariable Long validationId,
                                              @RequestAttribute("authenticatedUser") AppUser user) {
        return validationRepository.findById(validationId)
                .filter(validation -> validation.getRequestId().equals(requestId))
                .filter(validation -> accessControlService.canValidateRequest(user, validation.getRequest()))
                .map(validation -> {
                    validation.setStatus(PhaseValidationStatus.APPROVED);
                    validation.setReviewedBy(displayName(user));
                    validation.setReviewedAt(LocalDateTime.now());
                    validationRepository.save(validation);
                    EcrRequest request = validation.getRequest();
                    request.setCurrentStage(nextStage(request, validation.getStage()));
                    return ResponseEntity.ok(requestRepository.save(request));
                })
                .orElse(ResponseEntity.status(403).build());
    }

    @PostMapping("/{validationId}/reject")
    public ResponseEntity<PhaseValidationRequest> reject(@PathVariable Long requestId,
                                                         @PathVariable Long validationId,
                                                         @RequestBody ValidationDecisionRequest payload,
                                                         @RequestAttribute("authenticatedUser") AppUser user) {
        return validationRepository.findById(validationId)
                .filter(validation -> validation.getRequestId().equals(requestId))
                .filter(validation -> accessControlService.canValidateRequest(user, validation.getRequest()))
                .map(validation -> {
                    validation.setStatus(PhaseValidationStatus.REJECTED);
                    validation.setReviewedBy(displayName(user));
                    validation.setReviewedAt(LocalDateTime.now());
                    validation.setRefusalReason(payload == null ? null : payload.getReason());
                    validation.setActionsToRevisit(payload == null ? null : payload.getActionsToRevisit());
                    PhaseValidationRequest saved = validationRepository.save(validation);
                    accessControlService.projectLeadFor(validation.getRequest())
                            .ifPresent(projectLead -> accountMailService.sendPhaseRejectedEmail(
                                    validation.getRequest(),
                                    validation.getStage(),
                                    projectLead,
                                    validation.getRefusalReason(),
                                    validation.getActionsToRevisit()
                            ));
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.status(403).build());
    }

    private boolean allStageActionsDone(Long requestId, EcrStage stage) {
        List<EcrAction> actions = actionRepository.findByRequest_IdAndStageOrderByDeadlineAscIdAsc(requestId, stage);
        return !actions.isEmpty() && actions.stream().allMatch(this::isDone);
    }

    private boolean isDone(EcrAction action) {
        return action.isChecked() || action.getStatus() == ActionStatus.DONE || action.getStatus() == ActionStatus.DONE_LATE;
    }

    private EcrStage nextStage(EcrRequest request, EcrStage currentStage) {
        List<EcrStage> stages = EcrStage.allowedStages(request.isNewVersion());
        int index = stages.indexOf(currentStage);
        if (index < 0 || index + 1 >= stages.size()) {
            return currentStage;
        }
        return stages.get(index + 1);
    }

    private String displayName(AppUser user) {
        return user.getFullName() == null || user.getFullName().trim().isEmpty() ? user.getEmail() : user.getFullName();
    }

    public static class ValidationCreateRequest {
        private EcrStage stage;

        public EcrStage getStage() {
            return stage;
        }

        public void setStage(EcrStage stage) {
            this.stage = stage;
        }
    }

    public static class ValidationDecisionRequest {
        private String reason;
        private String actionsToRevisit;

        public String getReason() {
            return reason;
        }

        public void setReason(String reason) {
            this.reason = reason;
        }

        public String getActionsToRevisit() {
            return actionsToRevisit;
        }

        public void setActionsToRevisit(String actionsToRevisit) {
            this.actionsToRevisit = actionsToRevisit;
        }
    }
}
