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

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
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
        List<EcrAction> actions = initialActions == null ? new ArrayList<>() : initialActions.stream()
                .filter(action -> action.getTitle() != null && !action.getTitle().trim().isEmpty())
                .filter(action -> EcrStage.isAllowed(action.getStage(), request.isNewVersion()))
                .map(action -> {
                    action.setRequest(request);
                    action.setStatus(action.getStatus() == null ? ActionStatus.TODO : action.getStatus());
                    action.setResponsible(assigneeResolver.resolve(request, action.getResponsible()));
                    action.setValidatorRole(action.getValidatorRole() == null || action.getValidatorRole().trim().isEmpty() ? action.getValidator() : action.getValidatorRole());
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
                    .map(rule -> fromRule(request, rule))
                    .collect(Collectors.toList());
        }
        if (actions.isEmpty()) {
            actions = defaultActionsFor(request);
        }
        if (!actions.isEmpty()) {
            actionRepository.saveAll(actions);
            planningService.recalculateRequest(request);
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

        syncExistingActionsFromRules(request, existingActions, rules);

        List<EcrAction> missingActions = rules.stream()
                .filter(rule -> !existingKeys.contains(ruleKey(rule)))
                .map(rule -> fromRule(request, rule))
                .collect(Collectors.toList());

        if (!missingActions.isEmpty()) {
            actionRepository.saveAll(missingActions);
            planningService.recalculateRequest(request);
        }
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

        syncExistingActionsFromRules(request, existingActions, rules);

        List<EcrAction> missingActions = rules.stream()
                .filter(rule -> !existingKeys.contains(ruleKey(rule)))
                .map(rule -> fromRule(request, rule))
                .collect(Collectors.toList());

        if (!missingActions.isEmpty()) {
            actionRepository.saveAll(missingActions);
            planningService.recalculateRequest(request);
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
                .findFirst()
                .ifPresent(action -> {
                    applyRuleMetadata(request, action, updatedRule);
                    actionRepository.save(action);
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
            action.setValidator("Validateur");
            action.setValidatorRole("Validateur");
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
        action.setWorkDurationDays(rule.getDurationDays());
        action.setDependencyAnchor(rule.getDependencyAnchor());
        action.setStatus(ActionStatus.TODO);
        action.setChecked(false);
        return action;
    }

    private void applyRuleMetadata(EcrRequest request, EcrAction action, ActionPlanningRule rule) {
        action.setStage(rule.getStage());
        action.setTitle(rule.getActionTitle());
        action.setTopicRisk(rule.getTopicRisk());
        action.setResponsible(assigneeResolver.resolve(request, rule.getResponsible()));
        action.setValidator(rule.getValidator());
        action.setValidatorRole(rule.getValidator());
        action.setCriticality(rule.getCriticality());
        action.setExpectedEvidence(rule.getExpectedEvidence());
        copyProofDocument(action, rule, true);
        action.setEvidenceRequired(rule.isEvidenceRequired()
                || hasProofDocument(rule)
                || String.valueOf(rule.getCriticality()).startsWith("1"));
    }

    private void syncExistingActionsFromRules(EcrRequest request, List<EcrAction> actions, List<ActionPlanningRule> rules) {
        java.util.Map<String, ActionPlanningRule> rulesByKey = rules.stream()
                .collect(Collectors.toMap(this::ruleKey, rule -> rule, (first, second) -> second));
        List<EcrAction> changedActions = actions.stream()
                .filter(action -> rulesByKey.containsKey(actionKey(action)))
                .peek(action -> applyRuleMetadataWithoutReplacingProofDocuments(request, action, rulesByKey.get(actionKey(action))))
                .collect(Collectors.toList());
        if (!changedActions.isEmpty()) {
            actionRepository.saveAll(changedActions);
        }
    }

    private boolean appliesToRequest(ActionPlanningRule rule, EcrRequest request) {
        return request.isNewVersion() ? rule.isAppliesToNewProject() : rule.isAppliesToModification();
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

    private void applyRuleMetadataWithoutReplacingProofDocuments(EcrRequest request, EcrAction action, ActionPlanningRule rule) {
        action.setStage(rule.getStage());
        action.setTitle(rule.getActionTitle());
        action.setTopicRisk(rule.getTopicRisk());
        action.setResponsible(assigneeResolver.resolve(request, rule.getResponsible()));
        action.setValidator(rule.getValidator());
        action.setValidatorRole(rule.getValidator());
        action.setCriticality(rule.getCriticality());
        action.setExpectedEvidence(rule.getExpectedEvidence());
        action.setEvidenceRequired(rule.isEvidenceRequired()
                || hasProofDocument(rule)
                || String.valueOf(rule.getCriticality()).startsWith("1"));
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
