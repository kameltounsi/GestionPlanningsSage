package com.gestionplanning.action;

import com.gestionplanning.ecr.EcrRequest;
import com.gestionplanning.ecr.EcrRequestRepository;
import com.gestionplanning.ecr.EcrStage;
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
    private final ActionAssigneeResolver assigneeResolver;
    private final EcrRequestRepository requestRepository;

    public ActionPlanningService(EcrActionRepository actionRepository, ActionPlanningRuleRepository ruleRepository,
                                 ActionAssigneeResolver assigneeResolver, EcrRequestRepository requestRepository) {
        this.actionRepository = actionRepository;
        this.ruleRepository = ruleRepository;
        this.assigneeResolver = assigneeResolver;
        this.requestRepository = requestRepository;
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
                .filter(rule -> request.isNewVersion() ? rule.isAppliesToNewProject() : rule.isAppliesToModification())
                .collect(Collectors.toMap(this::ruleKey, Function.identity(), (first, second) -> second));
        Map<String, EcrAction> actionsByKey = actions.stream()
                .collect(Collectors.toMap(this::actionKey, Function.identity(), (first, second) -> first));
        LocalDate fallbackStart = request.getReceptionDate() == null ? LocalDate.now() : request.getReceptionDate();

        LocalDate nextPhaseStart = fallbackStart;
        for (EcrStage stage : EcrStage.allowedStages(request.isNewVersion())) {
            List<EcrAction> stageActions = actions.stream()
                    .filter(action -> action.getStage() == stage)
                    .collect(Collectors.toList());
            if (stageActions.isEmpty()) {
                continue;
            }
            List<EcrAction> localActionsWithoutDates = new ArrayList<>();
            for (EcrAction action : stageActions) {
                action.setResponsible(assigneeResolver.resolve(request, action.getResponsible()));
                if (action.getValidatorRole() == null || action.getValidatorRole().trim().isEmpty()) {
                    action.setValidatorRole(action.getValidator());
                }
                boolean hasRule = rules.containsKey(actionKey(action));
                if (!hasRule && action.getStartDate() == null && action.getEndDate() == null) {
                    localActionsWithoutDates.add(action);
                    continue;
                }
                applyRule(action, rules, actionsByKey, nextPhaseStart, new HashSet<>());
                if (action.getStartDate() != null && action.getStartDate().isBefore(nextPhaseStart)) {
                    shiftActionTo(action, nextPhaseStart);
                }
            }
            LocalDate localActionStart = stageActions.stream()
                    .filter(action -> !localActionsWithoutDates.contains(action))
                    .map(EcrAction::getEndDate)
                    .filter(Objects::nonNull)
                    .max(LocalDate::compareTo)
                    .map(date -> date.plusDays(1))
                    .orElse(nextPhaseStart);
            localActionsWithoutDates.sort(Comparator.comparing(action -> action.getId() == null ? Long.MAX_VALUE : action.getId()));
            for (EcrAction action : localActionsWithoutDates) {
                action.setWorkDurationDays(durationOrDefault(action.getWorkDurationDays()));
                action.setDependsOnActionId(null);
                action.setDependencyAnchor(OUTPUT);
                shiftActionTo(action, localActionStart);
                localActionStart = action.getEndDate() == null ? localActionStart : action.getEndDate().plusDays(1);
            }
            nextPhaseStart = stageActions.stream()
                    .map(EcrAction::getEndDate)
                    .filter(Objects::nonNull)
                    .max(LocalDate::compareTo)
                    .map(date -> date.plusDays(1))
                    .orElse(nextPhaseStart);
        }

        updateSopDate(request, actions, fallbackStart);
        refreshActionStatuses(actions);
        actionRepository.saveAll(actions);
        requestRepository.save(request);
    }

    public void refreshActionStatuses(List<EcrAction> actions) {
        LocalDate today = LocalDate.now();
        for (EcrAction action : actions) {
            refreshActionStatus(action, today);
        }
    }

    public void refreshActionStatus(EcrAction action) {
        refreshActionStatus(action, LocalDate.now());
    }

    private void refreshActionStatus(EcrAction action, LocalDate today) {
        if (action == null || action.getStatus() == ActionStatus.CANCELLED && !action.isChecked()) {
            return;
        }
        if (action.isChecked() || action.getStatus() == ActionStatus.DONE || action.getStatus() == ActionStatus.DONE_LATE) {
            action.setChecked(true);
            action.setStatus(isFinishedLate(action) ? ActionStatus.DONE_LATE : ActionStatus.DONE);
            return;
        }
        action.setChecked(false);
        if (action.getEndDate() != null && today.isAfter(action.getEndDate())) {
            action.setStatus(ActionStatus.LATE);
            return;
        }
        if (action.getStartDate() != null && !today.isBefore(action.getStartDate())) {
            action.setStatus(ActionStatus.IN_PROGRESS);
            return;
        }
        action.setStatus(ActionStatus.TODO);
    }

    private boolean isFinishedLate(EcrAction action) {
        return action.getFinalizationDate() != null
                && action.getEndDate() != null
                && action.getFinalizationDate().toLocalDate().isAfter(action.getEndDate());
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

    private void shiftActionTo(EcrAction action, LocalDate start) {
        int duration = durationOrDefault(action.getWorkDurationDays());
        action.setStartDate(start);
        action.setEndDate(start.plusDays(duration));
        action.setDeadline(action.getEndDate());
    }

    private void updateSopDate(EcrRequest request, List<EcrAction> actions, LocalDate fallbackStart) {
        int totalDuration = actions.stream()
                .map(EcrAction::getWorkDurationDays)
                .mapToInt(this::durationOrDefault)
                .sum();
        request.setSopDate(fallbackStart.plusDays(totalDuration));
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
