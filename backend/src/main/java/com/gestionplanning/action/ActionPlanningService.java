package com.gestionplanning.action;

import com.gestionplanning.ecr.EcrRequest;
import com.gestionplanning.ecr.EcrRequestRepository;
import com.gestionplanning.ecr.EcrStage;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
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

        if (request.getCurrentStage() == EcrStage.CANCELLED) {
            recalculateCancelledRequest(request, actions);
            return;
        }

        Map<String, ActionPlanningRule> rules = ruleRepository.findAll().stream()
                .filter(rule -> request.isNewVersion() ? rule.isAppliesToNewProject() : rule.isAppliesToModification())
                .collect(Collectors.toMap(this::ruleKey, Function.identity(), (first, second) -> second));
        LocalDate fallbackStart = request.getReceptionDate() == null ? LocalDate.now(ZoneId.systemDefault()) : request.getReceptionDate();

        LocalDate nextPhaseStart = fallbackStart;
        for (EcrStage stage : EcrStage.allowedStages(request.isNewVersion())) {
            nextPhaseStart = recalculateStage(request, actions, rules, stage, nextPhaseStart);
        }

        List<EcrAction> plannedActions = actions.stream()
                .filter(action -> action.getStage() != EcrStage.CANCELLED)
                .filter(action -> !action.isRoutineAction())
                .collect(Collectors.toList());
        updateSopDate(request, plannedActions, fallbackStart);
        syncRoutineStagesByDate(request, actions);
        refreshActionStatuses(actions);
        actionRepository.saveAll(actions);
        requestRepository.save(request);
    }

    private void recalculateCancelledRequest(EcrRequest request, List<EcrAction> actions) {
        Map<String, ActionPlanningRule> rules = ruleRepository.findAll().stream()
                .filter(rule -> rule.getStage() == EcrStage.CANCELLED)
                .filter(rule -> request.isNewVersion() ? rule.isAppliesToNewProject() : rule.isAppliesToModification())
                .collect(Collectors.toMap(this::ruleKey, Function.identity(), (first, second) -> second));
        LocalDate actionStart = (request.getCancelledDate() == null ? LocalDate.now(ZoneId.systemDefault()) : request.getCancelledDate()).plusDays(1);

        List<EcrAction> cancelledActions = actions.stream()
                .filter(action -> action.getStage() == EcrStage.CANCELLED)
                .filter(action -> !action.isRoutineAction())
                .sorted(this::compareActionsForPlanning)
                .collect(Collectors.toList());
        for (EcrAction action : cancelledActions) {
            if (action != null) {
                recalculateCancelledAction(request, rules, actionStart, action);
                actionStart = action.getEndDate() == null ? actionStart : action.getEndDate().plusDays(1);
            }
        }

        refreshActionStatuses(actions);
        actionRepository.saveAll(actions);
        requestRepository.save(request);
    }

    private void recalculateCancelledAction(EcrRequest request, Map<String, ActionPlanningRule> rules, LocalDate actionStart, EcrAction action) {
        resolveOpenActionAssignees(request, action);
        action.setWorkDurationDays(durationFor(action, rules.get(actionKey(action))));
        shiftActionTo(action, actionStart);
    }

    private LocalDate recalculateStage(EcrRequest request, List<EcrAction> actions, Map<String, ActionPlanningRule> rules,
                                       EcrStage stage, LocalDate nextPhaseStart) {
        List<EcrAction> stageActions = actions.stream()
                .filter(action -> action.getStage() == stage)
                .filter(action -> !action.isRoutineAction())
                .sorted(this::compareActionsForPlanning)
                .collect(Collectors.toList());
        if (stageActions.isEmpty()) {
            return nextPhaseStart;
        }
        Map<Long, EcrAction> stageActionsById = stageActions.stream()
                .filter(action -> action.getId() != null)
                .collect(Collectors.toMap(EcrAction::getId, Function.identity(), (first, second) -> first));
        Set<Long> plannedActionIds = new HashSet<>();
        for (EcrAction action : stageActions) {
            recalculateAction(request, rules, nextPhaseStart, action, stageActionsById, plannedActionIds, new HashSet<>());
        }
        return stageActions.stream()
                .map(EcrAction::getEndDate)
                .filter(Objects::nonNull)
                .max(LocalDate::compareTo)
                .map(date -> date.plusDays(1))
                .orElse(nextPhaseStart);
    }

    private void recalculateAction(EcrRequest request, Map<String, ActionPlanningRule> rules, LocalDate phaseStart,
                                   EcrAction action, Map<Long, EcrAction> stageActionsById,
                                   Set<Long> plannedActionIds, Set<Long> visitingActionIds) {
        if (action == null) {
            return;
        }
        Long actionId = action.getId();
        if (actionId != null && plannedActionIds.contains(actionId)) {
            return;
        }

        LocalDate actionStart = phaseStart;
        Long dependencyId = action.getDependsOnActionId();
        EcrAction dependency = dependencyId == null ? null : stageActionsById.get(dependencyId);
        if (dependency != null && !Objects.equals(actionId, dependencyId)) {
            boolean cycle = !visitingActionIds.add(dependencyId);
            if (!cycle) {
                recalculateAction(request, rules, phaseStart, dependency, stageActionsById, plannedActionIds, visitingActionIds);
                if (dependency.getEndDate() != null) {
                    actionStart = dependency.getEndDate().plusDays(1);
                }
                visitingActionIds.remove(dependencyId);
            }
        }
        resolveOpenActionAssignees(request, action);
        action.setWorkDurationDays(durationFor(action, rules.get(actionKey(action))));
        shiftActionTo(action, actionStart);
        if (actionId != null) {
            plannedActionIds.add(actionId);
        }
    }

    private void resolveOpenActionAssignees(EcrRequest request, EcrAction action) {
        if (action == null) {
            return;
        }
        if (isDone(action) || isValidationApproved(action)) {
            return;
        }
        action.setResponsible(assigneeResolver.resolve(request, action.getResponsible()));
        if (action.getValidatorRole() == null || action.getValidatorRole().trim().isEmpty()) {
            action.setValidatorRole(action.getValidator());
        }
        action.setValidator(assigneeResolver.resolveOptional(request, action.getValidatorRole()));
    }

    private boolean isValidationApproved(EcrAction action) {
        if (action == null) {
            return false;
        }
        return "APPROVED".equals(String.valueOf(action.getValidationStatus()));
    }

    private boolean isDone(EcrAction action) {
        if (action == null) {
            return false;
        }
        return action.isChecked() || action.getStatus() == ActionStatus.DONE || action.getStatus() == ActionStatus.DONE_LATE;
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
        if (changedAction.isRoutineAction()) {
            changedAction.setWorkDurationDays(durationOrDefault(changedAction.getWorkDurationDays()));
            changedAction.setEndDate(startDate.plusDays(changedAction.getWorkDurationDays()));
            changedAction.setDeadline(changedAction.getEndDate());
            actionRepository.save(changedAction);
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
                if (!Objects.equals(action.getId(), changedAction.getId())
                        && action.getStartDate() != null
                        && action.getStartDate().isAfter(effectivePreviousEndDate)) {
                    shiftActionBy(action, deltaDays);
                }
            }
            actionRepository.saveAll(actions);
        }
        recalculateRequest(changedAction.getRequest());
    }

    public void refreshActionStatuses(List<EcrAction> actions) {
        LocalDate today = LocalDate.now(ZoneId.systemDefault());
        for (EcrAction action : actions) {
            refreshActionStatus(action, today);
        }
    }

    public void refreshActionStatus(EcrAction action) {
        refreshActionStatus(action, LocalDate.now(ZoneId.systemDefault()));
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

    private void syncRoutineStagesByDate(EcrRequest request, List<EcrAction> actions) {
        if (request == null || actions == null || actions.isEmpty()) {
            return;
        }
        List<EcrAction> baseActions = actions.stream()
                .filter(action -> !action.isRoutineAction())
                .filter(action -> action.getStage() != EcrStage.CANCELLED)
                .collect(Collectors.toList());
        List<EcrStage> allowedStages = EcrStage.allowedStages(request.isNewVersion());
        for (EcrAction routineAction : actions) {
            if (routineAction.isRoutineAction() && routineAction.getStage() != EcrStage.CANCELLED) {
                EcrStage stage = stageForRoutineDate(request, routineAction.getStartDate(), baseActions, allowedStages);
                if (stage != null && routineAction.getStage() != stage) {
                    routineAction.setStage(stage);
                    routineAction.setValidationStatus(null);
                    routineAction.setValidationRequestedAt(null);
                    routineAction.setValidationReviewedAt(null);
                    routineAction.setValidationReviewedBy(null);
                    routineAction.setValidationRefusalReason(null);
                }
            }
        }
    }

    private EcrStage stageForRoutineDate(EcrRequest request, LocalDate date, List<EcrAction> baseActions, List<EcrStage> allowedStages) {
        if (date == null || allowedStages == null || allowedStages.isEmpty()) {
            return null;
        }
        EcrStage selectedStage = allowedStages.get(0);
        LocalDate selectedStart = phaseStartDate(request, selectedStage, baseActions);
        for (EcrStage stage : allowedStages) {
            if (stage != EcrStage.CANCELLED) {
                LocalDate stageStart = phaseStartDate(request, stage, baseActions);
                if (stageStart != null && !stageStart.isAfter(date) && (selectedStart == null || stageStart.isAfter(selectedStart))) {
                    selectedStage = stage;
                    selectedStart = stageStart;
                }
            }
        }
        return selectedStage;
    }

    private LocalDate phaseStartDate(EcrRequest request, EcrStage stage, List<EcrAction> baseActions) {
        LocalDate phaseStart = baseActions.stream()
                .filter(action -> action.getStage() == stage)
                .map(EcrAction::getStartDate)
                .filter(Objects::nonNull)
                .min(LocalDate::compareTo)
                .orElse(null);
        if (phaseStart != null) {
            return phaseStart;
        }
        return request.getReceptionDate() == null ? LocalDate.now(ZoneId.systemDefault()) : request.getReceptionDate();
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
