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
                    rule.setActionTitle(updatedRule.getActionTitle());
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
        return rule;
    }

    private void recalculateAllRequests() {
        requestRepository.findAll().forEach(planningService::recalculateRequest);
    }
}
