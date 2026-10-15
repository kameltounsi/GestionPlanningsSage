package com.gestionplanning.action;

import com.gestionplanning.ecr.*;
import com.gestionplanning.storage.CloudinaryStorageService;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class ActionRulePropagationTest {
    @Test
    void includesArchivedButSkipsPastApprovedAndClosedPhases() {
        EcrRequestRepository requests = mock(EcrRequestRepository.class);
        EcrTemplateService templates = mock(EcrTemplateService.class);
        PhaseValidationRequestRepository validations = mock(PhaseValidationRequestRepository.class);
        ActionPlanningRulePropagationService service = new ActionPlanningRulePropagationService(requests,
                mock(ActionPlanningService.class), mock(CloudinaryStorageService.class), templates, validations);
        EcrRequest active = request(1, EcrStage.PRODUCT_DEVELOPMENT, false);
        EcrRequest archived = request(2, EcrStage.FEASIBILITY_VALIDATION, true);
        EcrRequest past = request(3, EcrStage.CUSTOMER_VALIDATION, false);
        EcrRequest approved = request(4, EcrStage.PRODUCT_DEVELOPMENT, true);
        EcrRequest closed = request(5, EcrStage.CLOSED, true);
        EcrRequest cancelled = request(6, EcrStage.CANCELLED, false);
        EcrRequest closure = request(7, EcrStage.FEASIBILITY_VALIDATION, false); closure.setClosureStatus(true);
        when(requests.findAll()).thenReturn(Arrays.asList(active, archived, past, approved, closed, cancelled, closure));
        PhaseValidationRequest validation = new PhaseValidationRequest(); validation.setStatus(PhaseValidationStatus.APPROVED);
        when(validations.findFirstByRequest_IdAndStageOrderByRequestedAtDescIdDesc(4L, EcrStage.PRODUCT_DEVELOPMENT)).thenReturn(Optional.of(validation));
        ActionPlanningRule rule = new ActionPlanningRule(); rule.setStage(EcrStage.PRODUCT_DEVELOPMENT);
        service.addRuleToExistingRequests(rule);
        verify(templates).addNewRuleFor(eq(active), eq(rule), any());
        verify(templates).addNewRuleFor(eq(archived), eq(rule), any());
        verifyNoMoreInteractions(templates);
    }

    @Test
    void createsOnlyNewActionAndDoesNotDuplicateExistingOrWrongType() {
        EcrActionRepository actions = mock(EcrActionRepository.class);
        ActionPlanningService planning = mock(ActionPlanningService.class);
        EcrTemplateService service = new EcrTemplateService(actions, mock(ActionPlanningRuleRepository.class),
                planning, mock(ActionAssigneeResolver.class), mock(ActionDeadlineAlertRepository.class));
        EcrRequest request = request(1, EcrStage.PRODUCT_DEVELOPMENT, true);
        ActionPlanningRule rule = new ActionPlanningRule(); rule.setStage(EcrStage.PRODUCT_DEVELOPMENT);
        rule.setActionTitle("Nouvelle action"); rule.setAppliesToModification(true);
        when(actions.findByRequest_IdOrderByDeadlineAscIdAsc(1L)).thenReturn(Collections.emptyList());
        service.addNewRuleFor(request, rule, stage -> true);
        verify(actions).saveAll(argThat(list -> {
            EcrAction added = list.iterator().next();
            return added.getTitle().equals("Nouvelle action") && added.getStage() == EcrStage.PRODUCT_DEVELOPMENT;
        }));
        verify(planning).recalculateRequest(request);
        clearInvocations(actions, planning);
        EcrAction existing = new EcrAction(); existing.setStage(rule.getStage()); existing.setTitle(rule.getActionTitle());
        when(actions.findByRequest_IdOrderByDeadlineAscIdAsc(1L)).thenReturn(Collections.singletonList(existing));
        service.addNewRuleFor(request, rule, stage -> true);
        service.addNewRuleFor(request, rule, stage -> false);
        rule.setAppliesToModification(false);
        service.addNewRuleFor(request, rule, stage -> true);
        verify(actions, never()).saveAll(any());
        verifyNoInteractions(planning);
    }

    private EcrRequest request(long id, EcrStage stage, boolean archived) {
        EcrRequest request = new EcrRequest(); ReflectionTestUtils.setField(request, "id", id);
        request.setCurrentStage(stage); request.setArchived(archived); return request;
    }
}
