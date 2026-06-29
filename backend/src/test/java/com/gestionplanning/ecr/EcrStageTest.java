package com.gestionplanning.ecr;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EcrStageTest {
    @Test
    void allowedStagesForModificationExcludeNewProjectOnlyStages() {
        List<EcrStage> stages = EcrStage.allowedStages(false);

        assertTrue(stages.contains(EcrStage.FEASIBILITY_VALIDATION));
        assertTrue(stages.contains(EcrStage.CUSTOMER_VALIDATION));
        assertFalse(stages.contains(EcrStage.PROCESS_DEVELOPMENT));
        assertFalse(stages.contains(EcrStage.LAUNCH));
    }

    @Test
    void allowedStagesForNewProjectUseNewProjectWorkflow() {
        List<EcrStage> stages = EcrStage.allowedStages(true);

        assertTrue(stages.contains(EcrStage.PROCESS_DEVELOPMENT));
        assertTrue(stages.contains(EcrStage.LAUNCH));
        assertFalse(stages.contains(EcrStage.CUSTOMER_VALIDATION));
        assertFalse(stages.contains(EcrStage.CLOSURE_STATUS));
    }

    @Test
    void cancelledIsAllowedForBothWorkflows() {
        assertTrue(EcrStage.isAllowed(EcrStage.CANCELLED, false));
        assertTrue(EcrStage.isAllowed(EcrStage.CANCELLED, true));
        assertFalse(EcrStage.isAllowed(EcrStage.CLOSED, false));
        assertFalse(EcrStage.isAllowed(EcrStage.CLOSED, true));
    }

    @Test
    void firstAllowedStageIsFeasibilityValidation() {
        assertSame(EcrStage.FEASIBILITY_VALIDATION, EcrStage.firstAllowed(false));
        assertSame(EcrStage.FEASIBILITY_VALIDATION, EcrStage.firstAllowed(true));
    }

    @Test
    void labelDependsOnWorkflowType() {
        assertEquals("Process Development", EcrStage.PROCESS_DEVELOPMENT.getLabel(false));
        assertEquals("Production Set-up & Pre-Series", EcrStage.PPAP_SOP_PREPARATION.getLabel(true));
    }
}
