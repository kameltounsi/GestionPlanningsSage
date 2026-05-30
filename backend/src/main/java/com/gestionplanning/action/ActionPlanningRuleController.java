package com.gestionplanning.action;

import com.gestionplanning.ecr.EcrRequestRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/action-planning-rules")
public class ActionPlanningRuleController {
    private final ActionPlanningRuleRepository ruleRepository;
    private final EcrRequestRepository requestRepository;
    private final ActionPlanningService planningService;

    public ActionPlanningRuleController(ActionPlanningRuleRepository ruleRepository, EcrRequestRepository requestRepository,
                                        ActionPlanningService planningService) {
        this.ruleRepository = ruleRepository;
        this.requestRepository = requestRepository;
        this.planningService = planningService;
    }

    @GetMapping
    public List<ActionPlanningRule> list() {
        return ruleRepository.findAllByOrderByStageAscActionTitleAsc();
    }

    @PostMapping
    public ResponseEntity<ActionPlanningRule> create(@Valid @RequestBody ActionPlanningRule rule) {
        ActionPlanningRule savedRule = ruleRepository.save(normalize(rule));
        recalculateAllRequests();
        return ResponseEntity.created(URI.create("/api/action-planning-rules/" + savedRule.getId())).body(savedRule);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ActionPlanningRule> update(@PathVariable Long id, @Valid @RequestBody ActionPlanningRule updatedRule) {
        return ruleRepository.findById(id)
                .map(rule -> {
                    rule.setStage(updatedRule.getStage());
                    rule.setAppliesToModification(updatedRule.isAppliesToModification());
                    rule.setAppliesToNewProject(updatedRule.isAppliesToNewProject());
                    rule.setActionTitle(updatedRule.getActionTitle());
                    rule.setTopicRisk(updatedRule.getTopicRisk());
                    rule.setResponsible(updatedRule.getResponsible());
                    rule.setCriticality(updatedRule.getCriticality());
                    rule.setExpectedEvidence(updatedRule.getExpectedEvidence());
                    rule.setEvidenceRequired(updatedRule.isEvidenceRequired());
                    rule.setDependencyActionTitle(updatedRule.getDependencyActionTitle());
                    rule.setDependencyAnchor(updatedRule.getDependencyAnchor());
                    rule.setDurationDays(updatedRule.getDurationDays());
                    ActionPlanningRule savedRule = ruleRepository.save(normalize(rule));
                    recalculateAllRequests();
                    return ResponseEntity.ok(savedRule);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!ruleRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        ruleRepository.deleteById(id);
        recalculateAllRequests();
        return ResponseEntity.noContent().build();
    }

    private ActionPlanningRule normalize(ActionPlanningRule rule) {
        if (rule.getDependencyAnchor() == null || rule.getDependencyAnchor().trim().isEmpty()) {
            rule.setDependencyAnchor("OUTPUT");
        }
        if (rule.getDurationDays() == null) {
            rule.setDurationDays(1);
        }
        if (rule.getCriticality() == null || rule.getCriticality().trim().isEmpty()) {
            rule.setCriticality("3-faible");
        }
        if (!rule.isAppliesToModification() && !rule.isAppliesToNewProject()) {
            rule.setAppliesToModification(true);
        }
        return rule;
    }

    private void recalculateAllRequests() {
        requestRepository.findAll().forEach(planningService::recalculateRequest);
    }
}
