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
        LocalDate fallbackStart = request.getReceptionDate() == null ? LocalDate.now() : request.getReceptionDate();

        LocalDate nextPhaseStart = fallbackStart;
        for (EcrStage stage : EcrStage.allowedStages(request.isNewVersion())) {
            List<EcrAction> stageActions = actions.stream()
                    .filter(action -> action.getStage() == stage)
                    .sorted(this::compareActionsForPlanning)
                    .collect(Collectors.toList());
            if (stageActions.isEmpty()) {
                continue;
            }
            LocalDate actionStart = nextPhaseStart;
            for (EcrAction action : stageActions) {
                action.setResponsible(assigneeResolver.resolve(request, action.getResponsible()));
                if (action.getValidatorRole() == null || action.getValidatorRole().trim().isEmpty()) {
                    action.setValidatorRole(action.getValidator());
                }
                action.setWorkDurationDays(durationFor(action, rules.get(actionKey(action))));
                shiftActionTo(action, actionStart);
                actionStart = action.getEndDate() == null ? actionStart : action.getEndDate().plusDays(1);
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

    public void recalculateAfterDurationChange(EcrAction changedAction, Integer previousDuration) {
        recalculateAfterDurationChange(changedAction, previousDuration, null);
    }

    public void recalculateAfterDurationChange(EcrAction changedAction, Integer previousDuration, LocalDate previousEndDate) {
        if (changedAction == null || changedAction.getRequest() == null || changedAction.getRequest().getId() == null) {
            return;
        }
        LocalDate startDate = changedAction.getStartDate();
        if (startDate == null) {
            recalculateRequest(changedAction.getRequest());
            return;
        }
        int oldDuration = durationOrDefault(previousDuration);
        int newDuration = durationOrDefault(changedAction.getWorkDurationDays());
        LocalDate effectivePreviousEndDate = previousEndDate == null ? startDate.plusDays(oldDuration) : previousEndDate;
        LocalDate nextEndDate = startDate.plusDays(newDuration);
        long deltaDays = java.time.temporal.ChronoUnit.DAYS.between(effectivePreviousEndDate, nextEndDate);
        changedAction.setEndDate(nextEndDate);
        changedAction.setDeadline(nextEndDate);
        actionRepository.save(changedAction);

        if (deltaDays != 0) {
            List<EcrAction> actions = actionRepository.findByRequest_IdOrderByDeadlineAscIdAsc(changedAction.getRequest().getId());
            for (EcrAction action : actions) {
                if (Objects.equals(action.getId(), changedAction.getId()) || action.getStartDate() == null) {
                    continue;
                }
                if (action.getStartDate().isAfter(effectivePreviousEndDate)) {
                    shiftActionBy(action, deltaDays);
                }
            }
            actionRepository.saveAll(actions);
        }
        recalculateRequest(changedAction.getRequest());
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

    private void shiftActionTo(EcrAction action, LocalDate start) {
        int duration = durationOrDefault(action.getWorkDurationDays());
        action.setStartDate(start);
        action.setEndDate(start.plusDays(duration));
        action.setDeadline(action.getEndDate());
    }

    private void shiftActionBy(EcrAction action, long deltaDays) {
        if (action.getStartDate() != null) {
            action.setStartDate(action.getStartDate().plusDays(deltaDays));
        }
        if (action.getEndDate() != null) {
            action.setEndDate(action.getEndDate().plusDays(deltaDays));
            action.setDeadline(action.getEndDate());
        } else if (action.getStartDate() != null) {
            shiftActionTo(action, action.getStartDate());
        }
    }

    private void updateSopDate(EcrRequest request, List<EcrAction> actions, LocalDate fallbackStart) {
        LocalDate latestEndDate = actions.stream()
                .map(EcrAction::getEndDate)
                .filter(Objects::nonNull)
                .max(LocalDate::compareTo)
                .orElse(null);
        if (latestEndDate != null) {
            request.setSopDate(latestEndDate);
            return;
        }
        int totalDuration = actions.stream()
                .map(EcrAction::getWorkDurationDays)
                .mapToInt(this::durationOrDefault)
                .sum();
        request.setSopDate(fallbackStart.plusDays(totalDuration));
    }

    private int durationOrDefault(Integer duration) {
        return duration == null ? 1 : Math.max(0, duration);
    }

    private int ruleDurationOrDefault(ActionPlanningRule rule) {
        return rule == null ? 1 : durationOrDefault(rule.getDurationDays());
    }

    private int durationFor(EcrAction action, ActionPlanningRule rule) {
        return action == null || action.getWorkDurationDays() == null
                ? ruleDurationOrDefault(rule)
                : durationOrDefault(action.getWorkDurationDays());
    }

    private int compareActionsForPlanning(EcrAction first, EcrAction second) {
        Comparator<EcrAction> comparator = Comparator
                .comparing(EcrAction::getStartDate, Comparator.nullsLast(LocalDate::compareTo))
                .thenComparing(EcrAction::getEndDate, Comparator.nullsLast(LocalDate::compareTo))
                .thenComparing(EcrAction::getDeadline, Comparator.nullsLast(LocalDate::compareTo))
                .thenComparing(action -> action.getId() == null ? Long.MAX_VALUE : action.getId());
        return comparator.compare(first, second);
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
