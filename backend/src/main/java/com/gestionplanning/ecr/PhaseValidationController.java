package com.gestionplanning.ecr;

import com.gestionplanning.action.ActionStatus;
import com.gestionplanning.action.ActionValidationStatus;
import com.gestionplanning.action.EcrAction;
import com.gestionplanning.action.EcrActionRepository;
import com.gestionplanning.audit.AuditLogService;
import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.user.AccountMailService;
import com.gestionplanning.user.AppUser;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/ecr-requests/{requestId}/phase-validations")
public class PhaseValidationController {
    private final EcrRequestRepository requestRepository;
    private final EcrActionRepository actionRepository;
    private final PhaseValidationRequestRepository validationRepository;
    private final AccessControlService accessControlService;
    private final AccountMailService accountMailService;
    private final AuditLogService auditLogService;

    public PhaseValidationController(EcrRequestRepository requestRepository,
                                     EcrActionRepository actionRepository,
                                     PhaseValidationRequestRepository validationRepository,
                                     AccessControlService accessControlService,
                                     AccountMailService accountMailService,
                                     AuditLogService auditLogService) {
        this.requestRepository = requestRepository;
        this.actionRepository = actionRepository;
        this.validationRepository = validationRepository;
        this.accessControlService = accessControlService;
        this.accountMailService = accountMailService;
        this.auditLogService = auditLogService;
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
                        action.setValidationRefusalReason(null);
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

    @PostMapping("/{validationId}/actions/{actionId}/request")
    @Transactional
    public ResponseEntity<PhaseValidationRequest> requestActionValidation(@PathVariable Long requestId,
                                                                          @PathVariable Long validationId,
                                                                          @PathVariable Long actionId,
                                                                          @RequestAttribute("authenticatedUser") AppUser user) {
        Optional<PhaseValidationRequest> validationItem = validationRepository.findById(validationId);
        if (!validationItem.isPresent()) {
            return ResponseEntity.status(403).<PhaseValidationRequest>build();
        }
        PhaseValidationRequest validation = validationItem.get();
        if (!isOpenCurrentValidation(validation, requestId)) {
            return ResponseEntity.status(403).<PhaseValidationRequest>build();
        }
        return actionRepository.findById(actionId)
                .filter(action -> action.getRequestId().equals(requestId))
                .filter(action -> action.getStage() == validation.getStage())
                .filter(action -> action.getValidationStatus() == ActionValidationStatus.REJECTED)
                .filter(this::isDone)
                .filter(action -> canRequestActionValidation(user, action))
                .map(action -> {
                    action.setValidationStatus(ActionValidationStatus.PENDING);
                    action.setValidationRequestedAt(LocalDateTime.now());
                    action.setValidationReviewedAt(null);
                    action.setValidationReviewedBy(null);
                    action.setValidationRefusalReason(null);
                    actionRepository.save(action);
                    accessControlService.validationRecipientFor(action)
                            .ifPresent(recipient -> accountMailService.sendActionValidationEmail(validation.getRequest(), validation.getStage(), action, recipient));
                    return ResponseEntity.ok(enrichValidation(validation));
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
                || validation.getStage() != validation.getRequest().getCurrentStage()) {
            return ResponseEntity.status(403).<PhaseValidationRequest>build();
        }
        return actionRepository.findById(actionId)
                .filter(action -> action.getRequestId().equals(requestId))
                .filter(action -> action.getStage() == validation.getStage())
                .filter(action -> isActionAwaitingValidation(action, validation))
                .filter(action -> accessControlService.canValidateAction(user, action))
                .map(action -> {
                    action.setValidationStatus(ActionValidationStatus.APPROVED);
                    action.setValidationReviewedAt(LocalDateTime.now());
                    action.setValidationReviewedBy(displayName(user));
                    action.setValidationRefusalReason(null);
                    actionRepository.save(action);
                    auditLogService.recordBusinessEvent(
                            user,
                            "VALIDATION_ACTION",
                            "action",
                            action.getId() == null ? null : String.valueOf(action.getId()),
                            "Validation de l'action: " + actionLabel(action) + " - Modification: " + requestLabel(action.getRequest())
                    );

                    PhaseValidationRequest updatedValidation = enrichValidation(validation);
                    if (updatedValidation.getValidationRate() >= 100) {
                        updatedValidation.setStatus(PhaseValidationStatus.APPROVED);
                        updatedValidation.setReviewedBy("Validation automatique");
                        updatedValidation.setReviewedAt(LocalDateTime.now());
                        validationRepository.save(updatedValidation);
                        EcrRequest request = updatedValidation.getRequest();
                        advanceRequestAfterPhaseApproval(request, updatedValidation.getStage());
                        auditLogService.recordBusinessEvent(
                                user,
                                "VALIDATION_PHASE",
                                "modification",
                                requestLabel(request),
                                "Validation de la phase: " + stageLabel(updatedValidation.getStage(), request.isNewVersion()) + " - Modification: " + requestLabel(request)
                        );
                    }
                    return ResponseEntity.ok(enrichValidation(updatedValidation));
                })
                .orElse(ResponseEntity.status(403).<PhaseValidationRequest>build());
    }

    @PostMapping("/{validationId}/actions/{actionId}/reject")
    @Transactional
    public ResponseEntity<PhaseValidationRequest> rejectAction(@PathVariable Long requestId,
                                                               @PathVariable Long validationId,
                                                               @PathVariable Long actionId,
                                                               @RequestBody ValidationDecisionRequest payload,
                                                               @RequestAttribute("authenticatedUser") AppUser user) {
        Optional<PhaseValidationRequest> validationItem = validationRepository.findById(validationId);
        if (!validationItem.isPresent()) {
            return ResponseEntity.status(403).<PhaseValidationRequest>build();
        }
        PhaseValidationRequest validation = validationItem.get();
        if (!isOpenCurrentValidation(validation, requestId)) {
            return ResponseEntity.status(403).<PhaseValidationRequest>build();
        }
        String reason = payload == null ? null : payload.getReason();
        if (reason == null || reason.trim().isEmpty()) {
            return ResponseEntity.badRequest().<PhaseValidationRequest>build();
        }
        return actionRepository.findById(actionId)
                .filter(action -> action.getRequestId().equals(requestId))
                .filter(action -> action.getStage() == validation.getStage())
                .filter(action -> isActionAwaitingValidation(action, validation))
                .filter(action -> accessControlService.canValidateAction(user, action))
                .map(action -> {
                    action.setValidationStatus(ActionValidationStatus.REJECTED);
                    action.setValidationReviewedAt(LocalDateTime.now());
                    action.setValidationReviewedBy(displayName(user));
                    action.setValidationRefusalReason(reason.trim());
                    action.setChecked(false);
                    action.setStatus(ActionStatus.TODO);
                    action.setClosedDate(null);
                    action.setFinalizationDate(null);
                    actionRepository.save(action);
                    notifyActionRejected(validation.getRequest(), validation.getStage(), action, reason.trim());
                    auditLogService.recordBusinessEvent(
                            user,
                            "REFUS_VALIDATION_ACTION",
                            "action",
                            action.getId() == null ? null : String.valueOf(action.getId()),
                            "Refus de validation de l'action: " + actionLabel(action) + " - Modification: " + requestLabel(action.getRequest()) + " - Motif: " + reason.trim()
                    );
                    return ResponseEntity.ok(enrichValidation(validation));
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
                .filter(this::allValidationActionsApproved)
                .map(validation -> {
                    validation.setStatus(PhaseValidationStatus.APPROVED);
                    validation.setReviewedBy(displayName(user));
                    validation.setReviewedAt(LocalDateTime.now());
                    validationRepository.save(validation);
                    EcrRequest request = validation.getRequest();
                    EcrRequest savedRequest = advanceRequestAfterPhaseApproval(request, validation.getStage());
                    auditLogService.recordBusinessEvent(
                            user,
                            "VALIDATION_PHASE",
                            "modification",
                            requestLabel(request),
                            "Validation de la phase: " + stageLabel(validation.getStage(), request.isNewVersion()) + " - Modification: " + requestLabel(request)
                    );
                    return ResponseEntity.ok(savedRequest);
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

    private boolean isActionAwaitingValidation(EcrAction action, PhaseValidationRequest validation) {
        return action != null
                && validation != null
                && validation.getStatus() == PhaseValidationStatus.PENDING
                && action.getValidationStatus() == ActionValidationStatus.PENDING;
    }

    private boolean isOpenCurrentValidation(PhaseValidationRequest validation, Long requestId) {
        return validation != null
                && validation.getRequestId().equals(requestId)
                && validation.getStatus() == PhaseValidationStatus.PENDING
                && validation.getStage() == validation.getRequest().getCurrentStage();
    }

    private boolean canRequestActionValidation(AppUser user, EcrAction action) {
        return accessControlService.isRequestPilot(user, action.getRequest())
                || accessControlService.canCompleteAction(user, action);
    }

    private void notifyActionRejected(EcrRequest request, EcrStage stage, EcrAction action, String reason) {
        Map<String, AppUser> recipients = new LinkedHashMap<>();
        accessControlService.projectLeadFor(request)
                .ifPresent(user -> recipients.put(normalizeEmail(user.getEmail()), user));
        accessControlService.actionPilotFor(action)
                .ifPresent(user -> recipients.put(normalizeEmail(user.getEmail()), user));
        recipients.values().stream()
                .filter(user -> user.getEmail() != null && !user.getEmail().trim().isEmpty())
                .forEach(user -> accountMailService.sendActionRejectedEmail(request, stage, action, user, reason));
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private boolean allValidationActionsApproved(PhaseValidationRequest validation) {
        PhaseValidationRequest enriched = enrichValidation(validation);
        return enriched.getTotalActions() > 0 && enriched.getApprovedActions() >= enriched.getTotalActions();
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
            return EcrStage.CLOSED;
        }
        return stages.get(index + 1);
    }

    private EcrRequest advanceRequestAfterPhaseApproval(EcrRequest request, EcrStage approvedStage) {
        boolean wasCompleted = request.isClosureStatus() || request.getCurrentStage() == EcrStage.CLOSED;
        EcrStage nextStage = nextStage(request, approvedStage);
        request.setCurrentStage(nextStage);
        if (nextStage == EcrStage.CLOSED) {
            request.setClosureStatus(true);
            if (request.getClosureDate() == null) {
                request.setClosureDate(LocalDate.now());
            }
            request.setCancelledStatus(false);
            request.setCancelledDate(null);
        }
        EcrRequest saved = requestRepository.save(request);
        if (nextStage == EcrStage.CLOSED && !wasCompleted) {
            notifyModificationCompleted(saved);
        }
        return saved;
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

    private String displayName(AppUser user) {
        return user.getFullName() == null || user.getFullName().trim().isEmpty() ? user.getEmail() : user.getFullName();
    }

    private String requestLabel(EcrRequest request) {
        if (request == null) return "-";
        if (request.getModificationNumber() != null && !request.getModificationNumber().trim().isEmpty()) {
            return request.getModificationNumber();
        }
        if (request.getClient() != null && !request.getClient().trim().isEmpty()) {
            return request.getClient();
        }
        return "Modification " + request.getId();
    }

    private String actionLabel(EcrAction action) {
        if (action == null) return "-";
        return action.getTitle() == null || action.getTitle().trim().isEmpty() ? "Action " + action.getId() : action.getTitle();
    }

    private String stageLabel(EcrStage stage, boolean newProject) {
        return stage == null ? "-" : stage.getLabel(newProject);
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
