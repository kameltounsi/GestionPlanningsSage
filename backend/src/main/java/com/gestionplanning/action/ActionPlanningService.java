package com.gestionplanning.action;

import com.gestionplanning.ecr.EcrRequest;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ActionPlanningService {
    private static final String INPUT = "INPUT";
    private static final String OUTPUT = "OUTPUT";

    private final EcrActionRepository actionRepository;
    private final ActionPlanningRuleRepository ruleRepository;

    public ActionPlanningService(EcrActionRepository actionRepository, ActionPlanningRuleRepository ruleRepository) {
        this.actionRepository = actionRepository;
        this.ruleRepository = ruleRepository;
    }

    public void recalculateRequest(EcrRequest request) {
        if (request == null || request.getId() == null) {
            return;
        }

        List<EcrAction> actions = actionRepository.findByRequest_IdOrderByDeadlineAscIdAsc(request.getId());
        if (actions.isEmpty()) {
            return;
        }

        Map<String, ActionPlanningRule> rules = ruleRepository.findAll().stream()
                .collect(Collectors.toMap(this::ruleKey, Function.identity(), (first, second) -> second));
        Map<String, EcrAction> actionsByKey = actions.stream()
                .collect(Collectors.toMap(this::actionKey, Function.identity(), (first, second) -> first));
        LocalDate fallbackStart = request.getReceptionDate() == null ? LocalDate.now() : request.getReceptionDate();

        for (EcrAction action : actions) {
            applyRule(action, rules, actionsByKey, fallbackStart, new HashSet<>());
        }

        actionRepository.saveAll(actions);
    }

    private void applyRule(EcrAction action, Map<String, ActionPlanningRule> rules, Map<String, EcrAction> actionsByKey,
                           LocalDate fallbackStart, Set<Long> visiting) {
        if (action == null || action.getId() == null || visiting.contains(action.getId())) {
            return;
        }
        visiting.add(action.getId());

        ActionPlanningRule rule = rules.get(actionKey(action));
        int duration = rule == null || rule.getDurationDays() == null ? durationOrDefault(action.getWorkDurationDays()) : Math.max(0, rule.getDurationDays());
        LocalDate start = action.getStartDate() == null ? fallbackStart : action.getStartDate();
        Long dependsOnId = null;
        String anchor = rule == null || rule.getDependencyAnchor() == null ? OUTPUT : rule.getDependencyAnchor();

        if (rule != null && rule.getDependencyActionTitle() != null && !rule.getDependencyActionTitle().trim().isEmpty()) {
            EcrAction dependency = actionsByKey.get(key(action.getStage().name(), rule.getDependencyActionTitle()));
            if (dependency != null && !Objects.equals(dependency.getId(), action.getId())) {
                applyRule(dependency, rules, actionsByKey, fallbackStart, visiting);
                dependsOnId = dependency.getId();
                LocalDate anchorDate = INPUT.equalsIgnoreCase(anchor) ? dependency.getStartDate() : dependency.getEndDate();
                if (anchorDate != null) {
                    start = INPUT.equalsIgnoreCase(anchor) ? anchorDate : anchorDate.plusDays(1);
                }
            }
        }

        action.setWorkDurationDays(duration);
        action.setDependsOnActionId(dependsOnId);
        action.setDependencyAnchor(INPUT.equalsIgnoreCase(anchor) ? INPUT : OUTPUT);
        action.setStartDate(start);
        action.setEndDate(start.plusDays(duration));
        action.setDeadline(action.getEndDate());
        visiting.remove(action.getId());
    }

    private int durationOrDefault(Integer duration) {
        return duration == null ? 1 : Math.max(0, duration);
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
}
