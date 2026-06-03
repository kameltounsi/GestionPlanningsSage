package com.gestionplanning.ecr;

import com.gestionplanning.action.ActionStatus;
import com.gestionplanning.action.ActionPlanningRule;
import com.gestionplanning.action.ActionPlanningRuleRepository;
import com.gestionplanning.action.ActionPlanningService;
import com.gestionplanning.action.EcrAction;
import com.gestionplanning.action.EcrActionRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class EcrTemplateService {
    private final EcrActionRepository actionRepository;
    private final ActionPlanningRuleRepository ruleRepository;
    private final ActionPlanningService planningService;

    public EcrTemplateService(EcrActionRepository actionRepository, ActionPlanningRuleRepository ruleRepository,
                              ActionPlanningService planningService) {
        this.actionRepository = actionRepository;
        this.ruleRepository = ruleRepository;
        this.planningService = planningService;
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
        }
    }

    private List<EcrAction> defaultActionsFor(EcrRequest request) {
        List<EcrAction> actions = new ArrayList<>();
        for (EcrStage stage : EcrStage.allowedStages(request.isNewVersion())) {
            EcrAction action = new EcrAction();
            action.setRequest(request);
            action.setStage(stage);
            action.setTitle("Revue et validation - " + stage.getLabel(request.isNewVersion()));
            action.setTopicRisk("Suivi ECR");
            action.setResponsible(request.getPilot());
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
        action.setStage(rule.getStage());
        action.setTitle(rule.getActionTitle());
        action.setTopicRisk(rule.getTopicRisk());
        action.setResponsible(rule.getResponsible() == null || rule.getResponsible().trim().isEmpty() ? request.getPilot() : rule.getResponsible());
        action.setCriticality(rule.getCriticality());
        action.setExpectedEvidence(rule.getExpectedEvidence());
        action.setEvidenceRequired(rule.isEvidenceRequired());
        action.setWorkDurationDays(rule.getDurationDays());
        action.setDependencyAnchor(rule.getDependencyAnchor());
        action.setStatus(ActionStatus.TODO);
        action.setChecked(false);
        return action;
    }

    private boolean appliesToRequest(ActionPlanningRule rule, EcrRequest request) {
        return request.isNewVersion() ? rule.isAppliesToNewProject() : rule.isAppliesToModification();
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
