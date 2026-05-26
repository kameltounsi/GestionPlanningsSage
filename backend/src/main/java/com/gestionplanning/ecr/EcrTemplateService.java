package com.gestionplanning.ecr;

import com.gestionplanning.action.ActionStatus;
import com.gestionplanning.action.ActionPlanningService;
import com.gestionplanning.action.EcrAction;
import com.gestionplanning.action.EcrActionRepository;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@Service
public class EcrTemplateService {
    private static final String TEMPLATE_PATH = "planning-sage-action-template.tsv";

    private final EcrActionRepository actionRepository;
    private final ActionPlanningService planningService;
    private final List<ActionTemplate> actionTemplates;

    public EcrTemplateService(EcrActionRepository actionRepository, ActionPlanningService planningService) {
        this.actionRepository = actionRepository;
        this.planningService = planningService;
        this.actionTemplates = loadActionTemplates();
    }

    public void applyTo(EcrRequest request) {
        createDefaultChecklistForAllStages(request);
    }

    public void createActionsFor(EcrRequest request) {
        List<EcrAction> actions = new ArrayList<>();
        for (ActionTemplate template : actionTemplates) {
            if (!EcrStage.isAllowed(template.stage, request.isNewVersion())) {
                continue;
            }
            EcrAction action = new EcrAction();
            action.setRequest(request);
            action.setStage(template.stage);
            action.setTopicRisk(template.topicRisk);
            action.setTitle(template.title);
            action.setResponsible(template.responsible);
            action.setCriticality(template.criticality);
            action.setExpectedEvidence(template.expectedEvidence);
            action.setEvidence(template.evidence);
            action.setProofDocument(template.proofDocument);
            action.setStatus(ActionStatus.IN_PROGRESS);
            action.setChecked(false);
            actions.add(action);
        }
        actionRepository.saveAll(actions);
        planningService.recalculateRequest(request);
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

    private List<ActionTemplate> loadActionTemplates() {
        try {
            ClassPathResource resource = new ClassPathResource(TEMPLATE_PATH);
            List<ActionTemplate> templates = new ArrayList<>();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {
                String line = reader.readLine();
                while ((line = reader.readLine()) != null) {
                    String[] parts = line.split("\t", -1);
                    if (parts.length < 9 || parts[3].trim().isEmpty()) {
                        continue;
                    }
                    templates.add(new ActionTemplate(
                            EcrStage.valueOf(parts[0]),
                            emptyToNull(parts[2]),
                            parts[3],
                            emptyToNull(parts[4]),
                            emptyToNull(parts[5]),
                            emptyToNull(parts[6]),
                            emptyToNull(parts[7]),
                            emptyToNull(parts[8])
                    ));
                }
            }
            return templates;
        } catch (Exception exception) {
            throw new IllegalStateException("Impossible de charger le template Access " + TEMPLATE_PATH, exception);
        }
    }

    private static String emptyToNull(String value) {
        return value == null || value.trim().isEmpty() ? null : value;
    }

    private static class ActionTemplate {
        private final EcrStage stage;
        private final String topicRisk;
        private final String title;
        private final String responsible;
        private final String criticality;
        private final String expectedEvidence;
        private final String evidence;
        private final String proofDocument;

        private ActionTemplate(EcrStage stage, String topicRisk, String title, String responsible, String criticality,
                               String expectedEvidence, String evidence, String proofDocument) {
            this.stage = stage;
            this.topicRisk = topicRisk;
            this.title = title;
            this.responsible = responsible;
            this.criticality = criticality;
            this.expectedEvidence = expectedEvidence;
            this.evidence = evidence;
            this.proofDocument = proofDocument;
        }
    }
}
