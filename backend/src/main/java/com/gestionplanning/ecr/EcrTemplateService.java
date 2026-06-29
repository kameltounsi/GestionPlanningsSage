package com.gestionplanning.ecr;

import com.gestionplanning.action.ActionStatus;
import com.gestionplanning.action.ActionPlanningRule;
import com.gestionplanning.action.ActionPlanningRuleRepository;
import com.gestionplanning.action.ActionPlanningRuleProofDocument;
import com.gestionplanning.action.ActionPlanningService;
import com.gestionplanning.action.ActionAssigneeResolver;
import com.gestionplanning.action.EcrAction;
import com.gestionplanning.action.EcrActionProofDocument;
import com.gestionplanning.action.EcrActionRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class EcrTemplateService {
    private final EcrActionRepository actionRepository;
    private final ActionPlanningRuleRepository ruleRepository;
    private final ActionPlanningService planningService;
    private final ActionAssigneeResolver assigneeResolver;

    public EcrTemplateService(EcrActionRepository actionRepository, ActionPlanningRuleRepository ruleRepository,
                              ActionPlanningService planningService, ActionAssigneeResolver assigneeResolver) {
        this.actionRepository = actionRepository;
        this.ruleRepository = ruleRepository;
        this.planningService = planningService;
        this.assigneeResolver = assigneeResolver;
    }

    public void applyTo(EcrRequest request) {
        createDefaultChecklistForAllStages(request);
    }

    public void createActionsFor(EcrRequest request, List<EcrAction> initialActions) {
        List<EcrAction> sourceActions = initialActions == null ? new ArrayList<>() : initialActions;
        List<EcrAction> actions = sourceActions.stream()
                .filter(action -> action.getTitle() != null && !action.getTitle().trim().isEmpty())
                .filter(action -> EcrStage.isAllowed(action.getStage(), request.isNewVersion()))
                .map(action -> {
                    action.setRequest(request);
                    action.setStatus(action.getStatus() == null ? ActionStatus.TODO : action.getStatus());
                    action.setResponsible(assigneeResolver.resolve(request, action.getResponsible()));
                    String validatorRole = action.getValidatorRole();
                    if (validatorRole == null || validatorRole.trim().isEmpty()) {
                        validatorRole = action.getValidator();
                    }
                    action.setValidatorRole(validatorRole);
                    action.setValidator(assigneeResolver.resolveOptional(request, action.getValidatorRole()));
                    action.setEvidenceRequired(action.isEvidenceRequired()
                            || String.valueOf(action.getCriticality()).startsWith("1"));
                    action.setChecked(false);
                    return action;
                })
                .collect(Collectors.toList());
        if (actions.isEmpty()) {
            actions = ruleRepository.findAllByOrderByStageAscActionTitleAsc().stream()
                    .filter(rule -> EcrStage.isAllowed(rule.getStage(), request.isNewVersion()))
                    .filter(rule -> appliesToRequest(rule, request))
                    .filter(rule -> !rule.isRoutineAction())
                    .map(rule -> fromRule(request, rule))
                    .collect(Collectors.toList());
        }
        if (actions.isEmpty()) {
            actions = defaultActionsFor(request);
        }
        if (!actions.isEmpty()) {
            actionRepository.saveAll(actions);
            syncActionDependenciesFromRules(request, actions, rulesFor(request));
            planningService.recalculateRequest(request);
            ensureRoutineActionsFor(request);
        }
    }

    public void ensureActionsFor(EcrRequest request) {
        if (request == null || request.getId() == null) {
            return;
        }
        if (actionRepository.findByRequest_IdOrderByDeadlineAscIdAsc(request.getId()).isEmpty()) {
            createActionsFor(request, new ArrayList<>());
            return;
        }
        ensureMissingActionsFor(request);
    }

    public void ensureMissingActionsFor(EcrRequest request) {
        if (request == null || request.getId() == null || request.getCurrentStage() == EcrStage.CLOSED || request.getCurrentStage() == EcrStage.CANCELLED) {
            return;
        }

        List<EcrAction> existingActions = actionRepository.findByRequest_IdOrderByDeadlineAscIdAsc(request.getId());
        Set<String> existingKeys = existingActions.stream()
                .map(this::actionKey)
                .collect(Collectors.toCollection(HashSet::new));
        List<ActionPlanningRule> rules = ruleRepository.findAllByOrderByStageAscActionTitleAsc().stream()
                .filter(rule -> EcrStage.isAllowed(rule.getStage(), request.isNewVersion()))
                .filter(rule -> appliesToRequest(rule, request))
                .collect(Collectors.toList());

        syncExistingActionsFromRules(request, existingActions, rules.stream()
                .filter(rule -> !rule.isRoutineAction())
                .collect(Collectors.toList()));

        List<EcrAction> missingActions = rules.stream()
                .filter(rule -> !rule.isRoutineAction())
                .filter(rule -> !existingKeys.contains(ruleKey(rule)))
                .map(rule -> fromRule(request, rule))
                .collect(Collectors.toList());

        if (!missingActions.isEmpty()) {
            actionRepository.saveAll(missingActions);
            existingActions = actionRepository.findByRequest_IdOrderByDeadlineAscIdAsc(request.getId());
        }
        syncActionDependenciesFromRules(request, existingActions, rules);
        if (!missingActions.isEmpty()) {
            planningService.recalculateRequest(request);
        }
        ensureRoutineActionsFor(request);
    }

    public void ensureMissingActionsForStage(EcrRequest request, EcrStage stage) {
        if (request == null || request.getId() == null || stage == null) {
            return;
        }
        List<EcrAction> existingActions = actionRepository.findByRequest_IdOrderByDeadlineAscIdAsc(request.getId());
        Set<String> existingKeys = existingActions.stream()
                .map(this::actionKey)
                .collect(Collectors.toCollection(HashSet::new));
        List<ActionPlanningRule> rules = ruleRepository.findAllByOrderByStageAscActionTitleAsc().stream()
                .filter(rule -> rule.getStage() == stage)
                .filter(rule -> EcrStage.isAllowed(rule.getStage(), request.isNewVersion()))
                .filter(rule -> appliesToRequest(rule, request))
                .collect(Collectors.toList());

        syncExistingActionsFromRules(request, existingActions, rules.stream()
                .filter(rule -> !rule.isRoutineAction())
                .collect(Collectors.toList()));

        List<EcrAction> missingActions = rules.stream()
                .filter(rule -> !rule.isRoutineAction())
                .filter(rule -> !existingKeys.contains(ruleKey(rule)))
                .map(rule -> fromRule(request, rule))
                .collect(Collectors.toList());

        if (!missingActions.isEmpty()) {
            actionRepository.saveAll(missingActions);
            existingActions = actionRepository.findByRequest_IdOrderByDeadlineAscIdAsc(request.getId());
        }
        syncActionDependenciesFromRules(request, existingActions, rules);
        if (!missingActions.isEmpty()) {
            planningService.recalculateRequest(request);
        }
        ensureRoutineActionsFor(request);
    }

    private void ensureRoutineActionsFor(EcrRequest request) {
        if (request == null || request.getId() == null || request.getSopDate() == null) {
            return;
        }
        List<EcrAction> existingActions = actionRepository.findByRequest_IdOrderByDeadlineAscIdAsc(request.getId());
        Set<String> existingSeries = existingActions.stream()
                .map(EcrAction::getRoutineSeriesId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(HashSet::new));
        List<EcrAction> routineActions = new ArrayList<>();
        for (ActionPlanningRule rule : rulesFor(request)) {
            if (rule.isRoutineAction() && rule.getId() != null) {
                String seriesId = routineSeriesId(rule);
                if (!existingSeries.contains(seriesId)) {
                    routineActions.addAll(routineActionsFromRule(request, rule, existingActions));
                }
            }
        }
        if (!routineActions.isEmpty()) {
            actionRepository.saveAll(routineActions);
            planningService.recalculateRequest(request);
        }
    }

    private List<EcrAction> routineActionsFromRule(EcrRequest request, ActionPlanningRule rule, List<EcrAction> existingActions) {
        LocalDate sopDate = request.getSopDate();
        LocalDate phaseStart = phaseStartDate(request, rule.getStage(), existingActions);
        int intervalDays = Math.max(1, rule.getRecurrenceIntervalDays() == null ? 1 : rule.getRecurrenceIntervalDays());
        int durationDays = Math.max(0, rule.getDurationDays() == null ? 1 : rule.getDurationDays());
        List<EcrAction> actions = new ArrayList<>();
        int occurrenceIndex = 1;
        LocalDate occurrenceStart = phaseStart;
        while (sopDate != null && occurrenceStart != null && !occurrenceStart.plusDays(durationDays).isAfter(sopDate)) {
            EcrAction action = fromRule(request, rule);
            action.setStage(stageForDate(request, occurrenceStart, existingActions, rule.getStage()));
            action.setRoutineAction(true);
            action.setRecurrenceIntervalDays(intervalDays);
            action.setRoutineSeriesId(routineSeriesId(rule));
            action.setRoutineOccurrenceIndex(occurrenceIndex);
            action.setDependsOnActionId(null);
            action.setDependencyAnchor("OUTPUT");
            action.setStartDate(occurrenceStart);
            action.setEndDate(occurrenceStart.plusDays(durationDays));
            action.setDeadline(action.getEndDate());
            actions.add(action);
            occurrenceIndex += 1;
            occurrenceStart = occurrenceStart.plusDays(intervalDays);
        }
        return actions;
    }

    private EcrStage stageForDate(EcrRequest request, LocalDate date, List<EcrAction> actions, EcrStage fallbackStage) {
        if (date == null) {
            return fallbackStage;
        }
        List<EcrStage> stages = EcrStage.allowedStages(request.isNewVersion());
        EcrStage selectedStage = fallbackStage;
        LocalDate selectedStart = null;
        for (EcrStage stage : stages) {
            LocalDate stageStart = actualPhaseStartDate(stage, actions);
            if (stageStart != null && !stageStart.isAfter(date) && (selectedStart == null || stageStart.isAfter(selectedStart))) {
                selectedStage = stage;
                selectedStart = stageStart;
            }
        }
        return selectedStage;
    }

    private LocalDate phaseStartDate(EcrRequest request, EcrStage stage, List<EcrAction> actions) {
        LocalDate plannedStart = actualPhaseStartDate(stage, actions);
        if (plannedStart != null) {
            return plannedStart;
        }
        return request.getReceptionDate() == null ? LocalDate.now(ZoneId.systemDefault()) : request.getReceptionDate();
    }

    private LocalDate actualPhaseStartDate(EcrStage stage, List<EcrAction> actions) {
        return actions.stream()
                .filter(action -> !action.isRoutineAction())
                .filter(action -> action.getStage() == stage)
                .map(EcrAction::getStartDate)
                .filter(Objects::nonNull)
                .min(LocalDate::compareTo)
                .orElse(null);
    }

    private String routineSeriesId(ActionPlanningRule rule) {
        return "rule-" + rule.getId();
    }

    public void cancelOpenActionsBeforeCancelledPhase(EcrRequest request) {
        if (request == null || request.getId() == null) {
            return;
        }
        List<EcrAction> changedActions = actionRepository.findByRequest_IdOrderByDeadlineAscIdAsc(request.getId()).stream()
                .filter(action -> action.getStage() != EcrStage.CANCELLED)
                .filter(action -> !isDone(action))
                .filter(action -> action.getStatus() != ActionStatus.CANCELLED)
                .map(action -> {
                    action.setChecked(false);
                    action.setStatus(ActionStatus.CANCELLED);
                    action.setClosedDate(null);
                    action.setFinalizationDate(null);
                    action.setValidationStatus(null);
                    action.setValidationRequestedAt(null);
                    action.setValidationReviewedAt(null);
                    action.setValidationReviewedBy(null);
                    action.setValidationRefusalReason(null);
                    return action;
                })
                .collect(Collectors.toList());
        if (!changedActions.isEmpty()) {
            actionRepository.saveAll(changedActions);
        }
    }

    public void syncActionRuleFor(EcrRequest request, ActionPlanningRule previousRule, ActionPlanningRule updatedRule) {
        if (request == null || request.getId() == null || updatedRule == null || request.getCurrentStage() == EcrStage.CLOSED || request.getCurrentStage() == EcrStage.CANCELLED) {
            return;
        }
        if (!EcrStage.isAllowed(updatedRule.getStage(), request.isNewVersion()) || !appliesToRequest(updatedRule, request)) {
            return;
        }
        String previousKey = previousRule == null ? ruleKey(updatedRule) : ruleKey(previousRule);
        String currentKey = ruleKey(updatedRule);
        List<EcrAction> actions = actionRepository.findByRequest_IdOrderByDeadlineAscIdAsc(request.getId());
        actions.stream()
                .filter(action -> actionKey(action).equals(previousKey) || actionKey(action).equals(currentKey))
                .filter(action -> !isDone(action))
                .findFirst()
                .ifPresent(action -> {
                    applyRuleMetadata(request, action, updatedRule);
                    applyRulePlanning(action, updatedRule);
                    actionRepository.save(action);
                    syncActionDependenciesFromRules(request,
                            actionRepository.findByRequest_IdOrderByDeadlineAscIdAsc(request.getId()),
                            rulesFor(request));
                });
    }

    private List<EcrAction> defaultActionsFor(EcrRequest request) {
        List<EcrAction> actions = new ArrayList<>();
        for (EcrStage stage : EcrStage.allowedStages(request.isNewVersion())) {
            EcrAction action = new EcrAction();
            action.setRequest(request);
            action.setStage(stage);
            action.setTitle("Revue et validation - " + stage.getLabel(request.isNewVersion()));
            action.setTopicRisk("Suivi ECR");
            action.setResponsible(assigneeResolver.resolve(request, request.getPilot()));
            action.setValidatorRole("Validateur");
            action.setValidator(assigneeResolver.resolveOptional(request, "Validateur"));
            action.setCriticality("3-faible");
            action.setExpectedEvidence("Compte rendu, preuve ou document de validation");
            action.setEvidenceRequired(false);
            action.setWorkDurationDays(1);
            action.setDependencyAnchor("OUTPUT");
            action.setStatus(ActionStatus.TODO);
            action.setChecked(false);
            actions.add(action);
        }
        return actions;
    }

    private EcrAction fromRule(EcrRequest request, ActionPlanningRule rule) {
        EcrAction action = new EcrAction();
        action.setRequest(request);
        applyRuleMetadata(request, action, rule);
        applyRulePlanning(action, rule);
        action.setStatus(ActionStatus.TODO);
        action.setChecked(false);
        return action;
    }

    private void applyRuleMetadata(EcrRequest request, EcrAction action, ActionPlanningRule rule) {
        applyRuleMetadata(request, action, rule, true);
    }

    private void applyRuleMetadata(EcrRequest request, EcrAction action, ActionPlanningRule rule, boolean replaceProofDocuments) {
        action.setStage(rule.getStage());
        action.setTitle(rule.getActionTitle());
        action.setTopicRisk(rule.getTopicRisk());
        action.setResponsible(assigneeResolver.resolve(request, rule.getResponsible()));
        action.setValidatorRole(rule.getValidator());
        action.setValidator(assigneeResolver.resolveOptional(request, rule.getValidator()));
        action.setCriticality(rule.getCriticality());
        action.setExpectedEvidence(rule.getExpectedEvidence());
        copyProofDocument(action, rule, replaceProofDocuments);
        action.setEvidenceRequired(rule.isEvidenceRequired()
                || hasProofDocument(rule)
                || String.valueOf(rule.getCriticality()).startsWith("1"));
    }

    private void syncExistingActionsFromRules(EcrRequest request, List<EcrAction> actions, List<ActionPlanningRule> rules) {
        java.util.Map<String, ActionPlanningRule> rulesByKey = rules.stream()
                .collect(Collectors.toMap(this::ruleKey, rule -> rule, (first, second) -> second));
        List<EcrAction> changedActions = actions.stream()
                .filter(action -> rulesByKey.containsKey(actionKey(action)))
                .filter(action -> !isDone(action))
                .map(action -> {
                    ActionPlanningRule rule = rulesByKey.get(actionKey(action));
                    applyRuleMetadata(request, action, rule, false);
                    applyRulePlanning(action, rule);
                    return action;
                })
                .collect(Collectors.toList());
        if (!changedActions.isEmpty()) {
            actionRepository.saveAll(changedActions);
        }
    }

    private boolean appliesToRequest(ActionPlanningRule rule, EcrRequest request) {
        return request.isNewVersion() ? rule.isAppliesToNewProject() : rule.isAppliesToModification();
    }

    private List<ActionPlanningRule> rulesFor(EcrRequest request) {
        return ruleRepository.findAllByOrderByStageAscActionTitleAsc().stream()
                .filter(rule -> EcrStage.isAllowed(rule.getStage(), request.isNewVersion()))
                .filter(rule -> appliesToRequest(rule, request))
                .collect(Collectors.toList());
    }

    private String ruleKey(ActionPlanningRule rule) {
        return key(rule.getStage().name(), rule.getActionTitle());
    }

    private String actionKey(EcrAction action) {
        return key(action.getStage().name(), action.getTitle());
    }

    private String key(String stage, String title) {
        return stage + "::" + normalize(title);
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private void applyRulePlanning(EcrAction action, ActionPlanningRule rule) {
        if (!action.isDurationOverridden()) {
            action.setWorkDurationDays(rule.getDurationDays());
        }
        action.setDependencyAnchor(rule.getDependencyAnchor());
    }

    private void syncActionDependenciesFromRules(EcrRequest request, List<EcrAction> actions, List<ActionPlanningRule> rules) {
        if (request == null || actions == null || actions.isEmpty() || rules == null || rules.isEmpty()) {
            return;
        }
        Map<String, ActionPlanningRule> rulesByKey = rules.stream()
                .collect(Collectors.toMap(this::ruleKey, Function.identity(), (first, second) -> second));
        Map<String, EcrAction> actionsByKey = actions.stream()
                .collect(Collectors.toMap(this::actionKey, Function.identity(), (first, second) -> second));
        List<EcrAction> changedActions = new ArrayList<>();
        for (EcrAction action : actions) {
            if (action != null && !isDone(action)) {
                ActionPlanningRule rule = rulesByKey.get(actionKey(action));
                if (rule != null) {
                    Long dependencyId = dependencyActionId(action, rule, actionsByKey);
                    if (!Objects.equals(action.getDependsOnActionId(), dependencyId)) {
                        action.setDependsOnActionId(dependencyId);
                        changedActions.add(action);
                    }
                }
            }
        }
        if (!changedActions.isEmpty()) {
            actionRepository.saveAll(changedActions);
        }
    }

    private Long dependencyActionId(EcrAction action, ActionPlanningRule rule, Map<String, EcrAction> actionsByKey) {
        if (!hasText(rule.getDependencyActionTitle())) {
            return null;
        }
        EcrAction dependency = actionsByKey.get(key(rule.getStage().name(), rule.getDependencyActionTitle()));
        if (dependency == null || Objects.equals(dependency.getId(), action.getId())) {
            return null;
        }
        return dependency.getId();
    }

    private boolean isDone(EcrAction action) {
        if (action == null) {
            return false;
        }
        return action.isChecked()
                || action.getStatus() == ActionStatus.DONE
                || action.getStatus() == ActionStatus.DONE_LATE;
    }

    private void copyProofDocument(EcrAction action, ActionPlanningRule rule, boolean replaceDocumentItems) {
        action.setProofDocument(rule.getProofDocument());
        action.setProofDocumentFileName(rule.getProofDocumentFileName());
        action.setProofDocumentContentType(rule.getProofDocumentContentType());
        action.setProofDocumentFileSize(rule.getProofDocumentFileSize());
        action.setProofDocumentFileUrl(rule.getProofDocumentFileUrl());
        action.setProofDocumentPublicId(null);
        action.setProofDocumentResourceType(rule.getProofDocumentResourceType());
        if (!replaceDocumentItems) {
            return;
        }
        action.getProofDocuments().clear();
        for (ActionPlanningRuleProofDocument ruleDocument : rule.getProofDocuments()) {
            EcrActionProofDocument actionDocument = new EcrActionProofDocument();
            actionDocument.setAction(action);
            actionDocument.setFileName(ruleDocument.getFileName());
            actionDocument.setContentType(ruleDocument.getContentType());
            actionDocument.setFileSize(ruleDocument.getFileSize());
            actionDocument.setFileUrl(ruleDocument.getFileUrl());
            actionDocument.setPublicId(null);
            actionDocument.setResourceType(ruleDocument.getResourceType());
            action.getProofDocuments().add(actionDocument);
        }
    }

    private boolean hasProofDocument(ActionPlanningRule rule) {
        return rule != null && (hasText(rule.getProofDocumentFileName())
                || hasText(rule.getProofDocumentFileUrl())
                || !rule.getProofDocuments().isEmpty());
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private void createDefaultChecklistForAllStages(EcrRequest request) {
        for (EcrStage stage : EcrStage.allowedStages(request.isNewVersion())) {
            ChecklistItem item = new ChecklistItem();
            item.setStage(stage);
            item.setTopicRisk("Phase ECR");
            item.setVerificationPoint(stage.getLabel(request.isNewVersion()));
            item.setExpectedEvidence("Validation de la phase " + stage.getLabel(request.isNewVersion()));
            item.setStatus(ChecklistStatus.IN_PROGRESS);
            item.setPilot(request.getPilot());
            request.addChecklistItem(item);
        }
    }

}
