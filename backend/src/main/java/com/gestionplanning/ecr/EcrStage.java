package com.gestionplanning.ecr;

import java.util.Arrays;
import java.util.List;

public enum EcrStage {
    FEASIBILITY_VALIDATION("Feasability Validation", "Projet Time line"),
    PROJECT_MANAGEMENT("Validation interne status", "Project Management"),
    PRODUCT_DEVELOPMENT("VP interne valid", "Product Development"),
    PROCESS_DEVELOPMENT("Process Development", "Process Development"),
    CUSTOMER_VALIDATION("Customer validation", "Customer validation"),
    PPAP_SOP_PREPARATION("PPAP validation Preparation SOP", "Production Set-up & Pre-Series"),
    LAUNCH("Launch", "Launch"),
    CLOSURE_STATUS("Cloture status", "Cloture status"),
    CLOSED("Cloturee", "Cloturee"),
    CANCELLED("Cancelled", "Project Cancelled");

    private static final List<EcrStage> MODIFICATION_STAGES = Arrays.asList(
            FEASIBILITY_VALIDATION,
            PROJECT_MANAGEMENT,
            PRODUCT_DEVELOPMENT,
            CUSTOMER_VALIDATION,
            PPAP_SOP_PREPARATION,
            CLOSURE_STATUS
    );

    private static final List<EcrStage> NEW_PROJECT_STAGES = Arrays.asList(
            FEASIBILITY_VALIDATION,
            PROJECT_MANAGEMENT,
            PRODUCT_DEVELOPMENT,
            PROCESS_DEVELOPMENT,
            PPAP_SOP_PREPARATION,
            LAUNCH
    );

    private final String modificationLabel;
    private final String newProjectLabel;

    EcrStage(String modificationLabel, String newProjectLabel) {
        this.modificationLabel = modificationLabel;
        this.newProjectLabel = newProjectLabel;
    }

    public String getLabel() {
        return modificationLabel;
    }

    public String getLabel(boolean newProject) {
        return newProject ? newProjectLabel : modificationLabel;
    }

    public static List<EcrStage> allowedStages(boolean newProject) {
        return newProject ? NEW_PROJECT_STAGES : MODIFICATION_STAGES;
    }

    public static boolean isAllowed(EcrStage stage, boolean newProject) {
        return stage == CANCELLED || allowedStages(newProject).contains(stage);
    }

    public static EcrStage firstAllowed(boolean newProject) {
        return allowedStages(newProject).get(0);
    }
}
