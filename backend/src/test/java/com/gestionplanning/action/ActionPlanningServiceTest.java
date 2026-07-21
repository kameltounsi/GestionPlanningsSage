package com.gestionplanning.action;

import com.gestionplanning.ecr.EcrRequest;
import com.gestionplanning.ecr.EcrRequestRepository;
import com.gestionplanning.ecr.EcrStage;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ActionPlanningServiceTest {

    @Test
    void calculatesDatesFromPhaseStartAndExplicitDependencies() throws Exception {
        EcrActionRepository actionRepository = mock(EcrActionRepository.class);
        ActionPlanningRuleRepository ruleRepository = mock(ActionPlanningRuleRepository.class);
        ActionAssigneeResolver assigneeResolver = mock(ActionAssigneeResolver.class);
        EcrRequestRepository requestRepository = mock(EcrRequestRepository.class);
        ActionPlanningService service = new ActionPlanningService(
                actionRepository, ruleRepository, assigneeResolver, requestRepository);

        EcrRequest request = new EcrRequest();
        setId(request, 10L);
        request.setReceptionDate(LocalDate.of(2026, 7, 1));

        EcrAction firstRoot = action(1L, request, EcrStage.FEASIBILITY_VALIDATION, 2, null);
        EcrAction secondRoot = action(2L, request, EcrStage.FEASIBILITY_VALIDATION, 1, null);
        EcrAction linked = action(3L, request, EcrStage.FEASIBILITY_VALIDATION, 1, 1L);
        EcrAction nextPhaseRoot = action(4L, request, EcrStage.PROJECT_MANAGEMENT, 1, null);

        when(actionRepository.findByRequest_IdOrderByDeadlineAscIdAsc(10L))
                .thenReturn(Arrays.asList(firstRoot, secondRoot, linked, nextPhaseRoot));
        when(ruleRepository.findAll()).thenReturn(Collections.emptyList());

        service.recalculateRequest(request);

        assertEquals(LocalDate.of(2026, 7, 1), firstRoot.getStartDate());
        assertEquals(LocalDate.of(2026, 7, 1), secondRoot.getStartDate());
        assertEquals(LocalDate.of(2026, 7, 4), linked.getStartDate());
        assertEquals(LocalDate.of(2026, 7, 6), nextPhaseRoot.getStartDate());
    }

    private EcrAction action(Long id, EcrRequest request, EcrStage stage, int duration, Long dependencyId) throws Exception {
        EcrAction action = new EcrAction();
        setId(action, id);
        action.setRequest(request);
        action.setStage(stage);
        action.setWorkDurationDays(duration);
        action.setDependsOnActionId(dependencyId);
        return action;
    }

    private void setId(Object entity, Long id) throws Exception {
        Field field = entity.getClass().getDeclaredField("id");
        field.setAccessible(true);
        field.set(entity, id);
    }
}
