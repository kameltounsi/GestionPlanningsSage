package com.gestionplanning.action;

import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.auth.AuthenticatedUserService;
import com.gestionplanning.user.AppUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/action-standard-suggestions")
public class ActionStandardSuggestionController {
    private final ActionStandardSuggestionRepository suggestionRepository;
    private final ActionPlanningRuleRepository ruleRepository;
    private final AccessControlService accessControlService;
    private final AuthenticatedUserService authenticatedUserService;

    public ActionStandardSuggestionController(ActionStandardSuggestionRepository suggestionRepository,
                                              ActionPlanningRuleRepository ruleRepository,
                                              AccessControlService accessControlService,
                                              AuthenticatedUserService authenticatedUserService) {
        this.suggestionRepository = suggestionRepository;
        this.ruleRepository = ruleRepository;
        this.accessControlService = accessControlService;
        this.authenticatedUserService = authenticatedUserService;
    }

    @GetMapping
    public ResponseEntity<List<ActionStandardSuggestionDto>> list(@RequestAttribute("authenticatedUserId") Long userId) {
        AppUser user = authenticatedUserService.require(userId);
        if (!accessControlService.isAdmin(user)) {
            return ResponseEntity.status(403).<List<ActionStandardSuggestionDto>>build();
        }
        return ResponseEntity.ok(suggestionRepository.findByStatusOrderByCreatedAtDescIdDesc(ActionStandardSuggestionStatus.PENDING).stream()
                .map(ActionStandardSuggestionDto::from)
                .collect(Collectors.toList()));
    }

    @PostMapping("/{id}/add-to-defaults")
    public ResponseEntity<ActionPlanningRuleDto> addToDefaults(@PathVariable Long id,
                                                               @RequestAttribute("authenticatedUserId") Long userId) {
        AppUser user = authenticatedUserService.require(userId);
        if (!accessControlService.isAdmin(user)) {
            return ResponseEntity.status(403).<ActionPlanningRuleDto>build();
        }
        return suggestionRepository.findById(id)
                .filter(suggestion -> suggestion.getStatus() == ActionStandardSuggestionStatus.PENDING)
                .map(suggestion -> {
                    if (standardActionExists(suggestion)) {
                        return ResponseEntity.status(409).<ActionPlanningRuleDto>build();
                    }
                    ActionPlanningRule rule = new ActionPlanningRule();
                    rule.setStage(suggestion.getStage());
                    rule.setAppliesToNewProject(suggestion.isNewProject());
                    rule.setAppliesToModification(!suggestion.isNewProject());
                    rule.setActionTitle(suggestion.getActionTitle());
                    rule.setTopicRisk(suggestion.getTopicRisk());
                    rule.setResponsible(suggestion.getResponsible());
                    rule.setValidator(suggestion.getValidator());
                    rule.setCriticality(suggestion.getCriticality());
                    rule.setExpectedEvidence(suggestion.getExpectedEvidence());
                    rule.setEvidenceRequired(suggestion.isEvidenceRequired());
                    rule.setProofDocument(suggestion.getProofDocument());
                    rule.setProofDocumentFileName(suggestion.getProofDocumentFileName());
                    rule.setProofDocumentContentType(suggestion.getProofDocumentContentType());
                    rule.setProofDocumentFileSize(suggestion.getProofDocumentFileSize());
                    rule.setProofDocumentFileUrl(suggestion.getProofDocumentFileUrl());
                    rule.setProofDocumentPublicId(suggestion.getProofDocumentPublicId());
                    rule.setProofDocumentResourceType(suggestion.getProofDocumentResourceType());
                    rule.setDependencyAnchor(suggestion.getDependencyAnchor() == null || suggestion.getDependencyAnchor().trim().isEmpty() ? "OUTPUT" : suggestion.getDependencyAnchor());
                    rule.setDurationDays(suggestion.getDurationDays() == null ? 1 : suggestion.getDurationDays());
                    ActionPlanningRule savedRule = ruleRepository.save(rule);
                    suggestion.setStatus(ActionStandardSuggestionStatus.ADDED_TO_DEFAULTS);
                    suggestion.setReviewedBy(displayName(user));
                    suggestion.setReviewedAt(LocalDateTime.now(ZoneId.systemDefault()));
                    suggestionRepository.save(suggestion);
                    return ResponseEntity.created(URI.create("/api/action-planning-rules/" + savedRule.getId())).body(ActionPlanningRuleDto.from(savedRule));
                })
                .orElse(ResponseEntity.status(404).<ActionPlanningRuleDto>build());
    }

    @PostMapping("/{id}/ignore")
    public ResponseEntity<ActionStandardSuggestionDto> ignore(@PathVariable Long id,
                                                              @RequestAttribute("authenticatedUserId") Long userId) {
        AppUser user = authenticatedUserService.require(userId);
        if (!accessControlService.isAdmin(user)) {
            return ResponseEntity.status(403).<ActionStandardSuggestionDto>build();
        }
        return suggestionRepository.findById(id)
                .filter(suggestion -> suggestion.getStatus() == ActionStandardSuggestionStatus.PENDING)
                .map(suggestion -> {
                    suggestion.setStatus(ActionStandardSuggestionStatus.IGNORED);
                    suggestion.setReviewedBy(displayName(user));
                    suggestion.setReviewedAt(LocalDateTime.now(ZoneId.systemDefault()));
                    return ResponseEntity.ok(ActionStandardSuggestionDto.from(suggestionRepository.save(suggestion)));
                })
                .orElse(ResponseEntity.status(404).<ActionStandardSuggestionDto>build());
    }

    private boolean standardActionExists(ActionStandardSuggestion suggestion) {
        String title = normalize(suggestion.getActionTitle());
        return ruleRepository.findAll().stream()
                .filter(rule -> rule.getStage() == suggestion.getStage())
                .filter(rule -> suggestion.isNewProject() ? rule.isAppliesToNewProject() : rule.isAppliesToModification())
                .anyMatch(rule -> normalize(rule.getActionTitle()).equals(title));
    }

    private String displayName(AppUser user) {
        if (user == null) return "";
        return user.getFullName() == null || user.getFullName().trim().isEmpty() ? user.getEmail() : user.getFullName();
    }

    private String normalize(String value) {
        if (value == null) return "";
        String ascii = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return ascii.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }
}
