package com.gestionplanning.ecr;

import com.gestionplanning.action.ActionStatus;
import com.gestionplanning.action.ActionValidationStatus;
import com.gestionplanning.action.EcrAction;
import com.gestionplanning.action.EcrActionRepository;
import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.user.AccountMailService;
import com.gestionplanning.user.AppUser;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

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
                .map(request -> ResponseEntity.ok(enrichValidations(validationRepository.findByRequest_IdOrderByRequestedAtDescIdDesc(requestId))))
                .orElse(ResponseEntity.status(403).<List<PhaseValidationRequest>>build());
    }

    @PostMapping
    @Transactional
    public ResponseEntity<PhaseValidationRequest> requestValidation(@PathVariable Long requestId,
                                                                    @RequestBody ValidationCreateRequest payload,
                                                                    @RequestAttribute("authenticatedUser") AppUser user) {
        return requestRepository.findById(requestId)
                .filter(request -> accessControlService.canAccessRequest(user, request))
                .map(request -> {
                    if (!accessControlService.canRequestPhaseValidation(user, request)) {
                        return ResponseEntity.status(403).<PhaseValidationRequest>build();
                    }
                    EcrStage stage = payload == null || payload.getStage() == null ? request.getCurrentStage() : payload.getStage();
                    if (stage != request.getCurrentStage() || isApprovedStage(requestId, stage) || !allStageActionsDone(requestId, stage)) {
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
                    List<EcrAction> actions = actionRepository.findByRequest_IdAndStageOrderByDeadlineAscIdAsc(requestId, stage);
                    actions.forEach(action -> {
                        action.setValidationStatus(ActionValidationStatus.PENDING);
                        action.setValidationRequestedAt(LocalDateTime.now());
                        action.setValidationReviewedAt(null);
                        action.setValidationReviewedBy(null);
                    });
                    actionRepository.saveAll(actions);
                    for (EcrAction action : actions) {
                        AppUser recipient = accessControlService.validationRecipientFor(action)
                                .orElseThrow(() -> new IllegalStateException("Aucun destinataire de validation trouve pour l'action: " + action.getTitle()));
                        accountMailService.sendActionValidationEmail(request, stage, action, recipient);
                    }
                    return ResponseEntity.ok(enrichValidation(saved));
                })
                .orElse(ResponseEntity.status(403).<PhaseValidationRequest>build());
    }

    @PostMapping("/{validationId}/actions/{actionId}/approve")
    @Transactional
    public ResponseEntity<PhaseValidationRequest> approveAction(@PathVariable Long requestId,
                                                                @PathVariable Long validationId,
                                                                @PathVariable Long actionId,
                                                                @RequestAttribute("authenticatedUser") AppUser user) {
        Optional<PhaseValidationRequest> validationItem = validationRepository.findById(validationId);
        if (!validationItem.isPresent()) {
            return ResponseEntity.status(403).<PhaseValidationRequest>build();
        }
        PhaseValidationRequest validation = validationItem.get();
        if (!validation.getRequestId().equals(requestId)
                || validation.getStatus() != PhaseValidationStatus.PENDING
                || validation.getStage() != validation.getRequest().getCurrentStage()
                || !accessControlService.wasPhaseValidationRequestedByPilot(validation)) {
            return ResponseEntity.status(403).<PhaseValidationRequest>build();
        }
        return actionRepository.findById(actionId)
                .filter(action -> action.getRequestId().equals(requestId))
                .filter(action -> action.getStage() == validation.getStage())
                .filter(action -> action.getValidationStatus() == ActionValidationStatus.PENDING)
                .filter(action -> accessControlService.canValidateAction(user, action))
                .map(action -> {
                    action.setValidationStatus(ActionValidationStatus.APPROVED);
                    action.setValidationReviewedAt(LocalDateTime.now());
                    action.setValidationReviewedBy(displayName(user));
                    actionRepository.save(action);

                    PhaseValidationRequest updatedValidation = enrichValidation(validation);
                    if (updatedValidation.getValidationRate() >= 100) {
                        updatedValidation.setStatus(PhaseValidationStatus.APPROVED);
                        updatedValidation.setReviewedBy("Validation automatique");
                        updatedValidation.setReviewedAt(LocalDateTime.now());
                        validationRepository.save(updatedValidation);
                        EcrRequest request = updatedValidation.getRequest();
                        request.setCurrentStage(nextStage(request, updatedValidation.getStage()));
                        requestRepository.save(request);
                    }
                    return ResponseEntity.ok(enrichValidation(updatedValidation));
                })
                .orElse(ResponseEntity.status(403).<PhaseValidationRequest>build());
    }

    @PostMapping("/{validationId}/approve")
    public ResponseEntity<EcrRequest> approve(@PathVariable Long requestId,
                                              @PathVariable Long validationId,
                                              @RequestAttribute("authenticatedUser") AppUser user) {
        return validationRepository.findById(validationId)
                .filter(validation -> validation.getRequestId().equals(requestId))
                .filter(validation -> accessControlService.canValidateRequest(user, validation.getRequest()))
                .filter(validation -> validation.getStatus() == PhaseValidationStatus.PENDING)
                .filter(validation -> validation.getStage() == validation.getRequest().getCurrentStage())
                .filter(accessControlService::wasPhaseValidationRequestedByPilot)
                .map(validation -> {
                    validation.setStatus(PhaseValidationStatus.APPROVED);
                    validation.setReviewedBy(displayName(user));
                    validation.setReviewedAt(LocalDateTime.now());
                    validationRepository.save(validation);
                    EcrRequest request = validation.getRequest();
                    request.setCurrentStage(nextStage(request, validation.getStage()));
                    return ResponseEntity.ok(requestRepository.save(request));
                })
                .orElse(ResponseEntity.status(403).<EcrRequest>build());
    }

    @PostMapping("/{validationId}/reject")
    @Transactional
    public ResponseEntity<PhaseValidationRequest> reject(@PathVariable Long requestId,
                                                         @PathVariable Long validationId,
                                                         @RequestBody ValidationDecisionRequest payload,
                                                         @RequestAttribute("authenticatedUser") AppUser user) {
        return validationRepository.findById(validationId)
                .filter(validation -> validation.getRequestId().equals(requestId))
                .filter(validation -> accessControlService.canValidateRequest(user, validation.getRequest()))
                .filter(validation -> validation.getStatus() == PhaseValidationStatus.PENDING)
                .filter(validation -> validation.getStage() == validation.getRequest().getCurrentStage())
                .filter(accessControlService::wasPhaseValidationRequestedByPilot)
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
                .orElse(ResponseEntity.status(403).<PhaseValidationRequest>build());
    }

    private boolean allStageActionsDone(Long requestId, EcrStage stage) {
        List<EcrAction> actions = actionRepository.findByRequest_IdAndStageOrderByDeadlineAscIdAsc(requestId, stage);
        return !actions.isEmpty() && actions.stream().allMatch(this::isDone);
    }

    private boolean isApprovedStage(Long requestId, EcrStage stage) {
        return validationRepository.findFirstByRequest_IdAndStageOrderByRequestedAtDescIdDesc(requestId, stage)
                .map(validation -> validation.getStatus() == PhaseValidationStatus.APPROVED)
                .orElse(false);
    }

    private boolean isDone(EcrAction action) {
        return action.isChecked() || action.getStatus() == ActionStatus.DONE || action.getStatus() == ActionStatus.DONE_LATE;
    }

    private List<PhaseValidationRequest> enrichValidations(List<PhaseValidationRequest> validations) {
        validations.forEach(this::enrichValidation);
        return validations;
    }

    private PhaseValidationRequest enrichValidation(PhaseValidationRequest validation) {
        if (validation == null || validation.getRequestId() == null || validation.getStage() == null) {
            return validation;
        }
        List<EcrAction> actions = actionRepository.findByRequest_IdAndStageOrderByDeadlineAscIdAsc(validation.getRequestId(), validation.getStage());
        int total = actions.size();
        int approved = (int) actions.stream()
                .filter(action -> action.getValidationStatus() == ActionValidationStatus.APPROVED)
                .count();
        validation.setTotalActions(total);
        validation.setApprovedActions(approved);
        validation.setValidationRate(total == 0 ? 0 : (int) Math.round(approved * 100.0 / total));
        return validation;
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
