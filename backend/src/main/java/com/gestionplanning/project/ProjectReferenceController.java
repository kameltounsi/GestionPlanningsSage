package com.gestionplanning.project;

import com.gestionplanning.audit.AuditLogService;
import com.gestionplanning.action.ActionAssigneeResolver;
import com.gestionplanning.action.ActionStatus;
import com.gestionplanning.action.EcrAction;
import com.gestionplanning.action.EcrActionRepository;
import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.ecr.EcrRequest;
import com.gestionplanning.ecr.EcrRequestRepository;
import com.gestionplanning.ecr.EcrStage;
import com.gestionplanning.user.AppUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

import javax.validation.Valid;
import java.text.Normalizer;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/projects")
public class ProjectReferenceController {
    private static final String PROJECT_LEAD_ROLE = "chef de projet";

    private final ProjectReferenceRepository projectRepository;
    private final ProjectReferenceMapper projectMapper;
    private final EcrRequestRepository requestRepository;
    private final EcrActionRepository actionRepository;
    private final AuditLogService auditLogService;
    private final AccessControlService accessControlService;
    private final ActionAssigneeResolver assigneeResolver;

    public ProjectReferenceController(ProjectReferenceRepository projectRepository, ProjectReferenceMapper projectMapper,
                                      AuditLogService auditLogService,
                                      AccessControlService accessControlService, EcrRequestRepository requestRepository,
                                      EcrActionRepository actionRepository, ActionAssigneeResolver assigneeResolver) {
        this.projectRepository = projectRepository;
        this.projectMapper = projectMapper;
        this.requestRepository = requestRepository;
        this.actionRepository = actionRepository;
        this.auditLogService = auditLogService;
        this.accessControlService = accessControlService;
        this.assigneeResolver = assigneeResolver;
    }

    @GetMapping
    public List<ProjectReferenceDto> list() {
        return projectRepository.findAllByOrderByNameAsc().stream()
                .map(projectMapper::toDto)
                .collect(Collectors.toList());
    }

    @PostMapping
    public ResponseEntity<ProjectReferenceDto> create(@Valid @RequestBody ProjectReferenceDto project,
                                                      @RequestAttribute("authenticatedUser") Object userAttribute) {
                                                          AppUser user = (AppUser) userAttribute;
        if (!accessControlService.isAdmin(user)) {
            return ResponseEntity.status(403).<ProjectReferenceDto>build();
        }
        ProjectReference entity = projectMapper.toEntity(project);
        String projectTeam = entity.getProjectTeam();
        Optional<String> validationError = validateProjectTeam(projectTeam);
        if (validationError.isPresent()) {
            return ResponseEntity.badRequest().<ProjectReferenceDto>build();
        }
        ProjectReference saved = projectRepository.save(entity);
        auditLogService.recordBusinessEvent(user, "AJOUT_PROJET", "projet", saved.getName(), "Ajout du projet: " + saved.getName());
        return ResponseEntity.ok(projectMapper.toDto(saved));
    }

    @PutMapping("/{name}")
    @Transactional
    public ResponseEntity<ProjectReferenceDto> update(@PathVariable String name, @Valid @RequestBody ProjectReferenceDto updatedProject,
                                                      @RequestAttribute("authenticatedUser") Object userAttribute) {
                                                          AppUser user = (AppUser) userAttribute;
        return projectRepository.findById(name)
                .map(project -> {
                    if (!accessControlService.canManageProjectTeam(user, project)) {
                        return ResponseEntity.status(403).<ProjectReferenceDto>build();
                    }
                    String projectTeam = projectMapper.projectTeamForSave(updatedProject);
                    Optional<String> validationError = validateProjectTeam(projectTeam);
                    if (validationError.isPresent()) {
                        return ResponseEntity.badRequest().<ProjectReferenceDto>build();
                    }
                    String previousProjectTeam = project.getProjectTeam();
                    String previousProjectLead = projectLeadName(project.getProjectTeam()).orElse(null);
                    String nextProjectLead = projectLeadName(projectTeam).orElse(null);
                    projectMapper.updateEntity(project, updatedProject);
                    ProjectReference saved = projectRepository.save(project);
                    syncProjectTeamOnRequests(saved.getName(), previousProjectTeam, saved.getProjectTeam(), previousProjectLead, nextProjectLead);
                    auditLogService.recordBusinessEvent(user, "MODIFICATION_PROJET_EQUIPE", "projet", saved.getName(), "Modification du projet ou de son equipe: " + saved.getName());
                    return ResponseEntity.ok(projectMapper.toDto(saved));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{name}")
    public ResponseEntity<Void> delete(@PathVariable String name, @RequestAttribute("authenticatedUser") Object userAttribute) {
        AppUser user = (AppUser) userAttribute;
        if (!accessControlService.isAdmin(user)) {
            return ResponseEntity.status(403).build();
        }
        if (!projectRepository.existsById(name)) {
            return ResponseEntity.notFound().build();
        }
        projectRepository.deleteById(name);
        return ResponseEntity.noContent().build();
    }

    private Optional<String> validateProjectTeam(String projectTeam) {
        List<ProjectTeamEntry> entries = parseTeamEntries(projectTeam);
        if (entries.stream().anyMatch(entry -> entry.roles.isEmpty())) {
            return Optional.of("Chaque utilisateur de l'equipe projet doit avoir au moins un role.");
        }
        long projectLeadCount = entries.stream()
                .filter(entry -> entry.roles.stream().anyMatch(role -> role.equals(PROJECT_LEAD_ROLE)))
                .count();
        if (projectLeadCount != 1) {
            return Optional.of("Selectionnez exactement un utilisateur avec le role Chef de projet.");
        }
        return Optional.empty();
    }

    private void syncProjectTeamOnRequests(String projectName, String previousProjectTeam, String nextProjectTeam,
                                           String previousProjectLead, String nextProjectLead) {
        if (nextProjectLead == null || nextProjectLead.trim().isEmpty()) {
            return;
        }
        List<EcrRequest> requests = requestRepository.findByModificationProject(projectName);
        if (requests.isEmpty()) {
            return;
        }
        List<ProjectTeamEntry> previousEntries = parseTeamEntries(previousProjectTeam);
        List<ProjectTeamEntry> nextEntries = parseTeamEntries(nextProjectTeam);
        for (EcrRequest request : requests) {
            if (!isTerminalRequest(request) && !normalize(previousProjectLead).equals(normalize(nextProjectLead))) {
                if (!normalize(request.getPilot()).equals(normalize(nextProjectLead))) {
                    request.setPreviousPilot(request.getPilot());
                }
                request.setPilot(nextProjectLead);
            }
            updateOpenActionsForProjectTeamChange(request, previousEntries, nextEntries);
        }
        requestRepository.saveAll(requests);
    }

    private boolean isTerminalRequest(EcrRequest request) {
        return request == null
                || request.getCurrentStage() == EcrStage.CLOSED
                || request.getCurrentStage() == EcrStage.CANCELLED
                || request.isClosureStatus()
                || request.isCancelledStatus();
    }

    private void updateOpenActionsForProjectTeamChange(EcrRequest request, List<ProjectTeamEntry> previousEntries,
                                                       List<ProjectTeamEntry> nextEntries) {
        if (request == null || request.getId() == null) {
            return;
        }
        List<EcrAction> actions = actionRepository.findByRequest_IdOrderByDeadlineAscIdAsc(request.getId());
        if (actions.isEmpty()) {
            return;
        }
        boolean changed = false;
        for (EcrAction action : actions) {
            if (action != null && !isHistoricalAction(action)) {
                String nextResponsible = resolveTeamAssignee(request, action.getResponsible(), null, previousEntries, nextEntries);
                if (hasText(nextResponsible) && !normalize(nextResponsible).equals(normalize(action.getResponsible()))) {
                    action.setResponsible(nextResponsible);
                    changed = true;
                }

                String validatorRole = resolveTeamRole(action.getValidatorRole(), action.getValidator(), previousEntries, nextEntries);
                String nextValidator = assigneeResolver.resolveOptional(request, validatorRole);
                if (hasText(validatorRole) && !normalize(validatorRole).equals(normalize(action.getValidatorRole()))) {
                    action.setValidatorRole(validatorRole);
                    changed = true;
                }
                if (hasText(nextValidator) && !normalize(nextValidator).equals(normalize(action.getValidator()))) {
                    action.setValidator(nextValidator);
                    changed = true;
                }
            }
        }
        if (changed) {
            actionRepository.saveAll(actions);
        }
    }

    private String resolveTeamAssignee(EcrRequest request, String currentAssignee, String fallbackRole,
                                       List<ProjectTeamEntry> previousEntries, List<ProjectTeamEntry> nextEntries) {
        String role = resolveTeamRole(currentAssignee, fallbackRole, previousEntries, nextEntries);
        if (!hasText(role)) {
            return currentAssignee;
        }
        return assigneeResolver.resolve(request, role);
    }

    private String resolveTeamRole(String currentRoleOrAssignee, String fallbackRoleOrAssignee,
                                   List<ProjectTeamEntry> previousEntries, List<ProjectTeamEntry> nextEntries) {
        String current = firstText(currentRoleOrAssignee, fallbackRoleOrAssignee);
        if (!hasText(current)) {
            return current;
        }
        Optional<String> directRole = rolePresentInTeam(current, nextEntries);
        if (directRole.isPresent()) {
            return directRole.get();
        }
        return rolesForAssignee(current, previousEntries).stream()
                .filter(role -> rolePresentInTeam(role, nextEntries).isPresent())
                .findFirst()
                .orElse(current);
    }

    private Optional<String> rolePresentInTeam(String role, List<ProjectTeamEntry> entries) {
        String normalizedRole = normalize(role);
        if (normalizedRole.isEmpty()) {
            return Optional.empty();
        }
        return Optional.ofNullable(entries).orElse(Collections.emptyList()).stream()
                .flatMap(entry -> entry.roles.stream())
                .filter(candidate -> normalize(candidate).equals(normalizedRole))
                .findFirst();
    }

    private Set<String> rolesForAssignee(String assignee, List<ProjectTeamEntry> entries) {
        String normalizedAssignee = normalize(assignee);
        if (normalizedAssignee.isEmpty()) {
            return Collections.emptySet();
        }
        return Optional.ofNullable(entries).orElse(Collections.emptyList()).stream()
                .filter(entry -> normalize(entry.name).equals(normalizedAssignee))
                .flatMap(entry -> entry.roles.stream())
                .collect(Collectors.toSet());
    }

    private boolean isHistoricalAction(EcrAction action) {
        return action != null && (action.isChecked()
                || action.getStatus() == ActionStatus.DONE
                || action.getStatus() == ActionStatus.DONE_LATE
                || "APPROVED".equals(String.valueOf(action.getValidationStatus())));
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String firstText(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (hasText(value)) {
                return value.trim();
            }
        }
        return null;
    }

    private Optional<String> projectLeadName(String projectTeam) {
        return parseTeamEntries(projectTeam).stream()
                .filter(entry -> entry.roles.stream().anyMatch(role -> role.equals(PROJECT_LEAD_ROLE)))
                .map(entry -> entry.name)
                .filter(name -> name != null && !name.trim().isEmpty())
                .findFirst();
    }

    private List<ProjectTeamEntry> parseTeamEntries(String projectTeam) {
        return Arrays.stream(String.valueOf(projectTeam == null ? "" : projectTeam).split("[;\\n]"))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .flatMap(value -> value.contains("::") ? Arrays.stream(new String[]{value}) : Arrays.stream(value.split(",")))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(value -> {
                    String[] parts = value.split("::", 2);
                    Set<String> roles = parts.length > 1
                            ? Arrays.stream(parts[1].split("[,|]")).map(ProjectReferenceController::normalize).filter(role -> !role.isEmpty()).collect(Collectors.toSet())
                            : new HashSet<>();
                    return new ProjectTeamEntry(parts[0].trim(), roles);
                })
                .collect(Collectors.toList());
    }

    private static String normalize(String value) {
        String text = Normalizer.normalize(String.valueOf(value == null ? "" : value), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return text.trim().toLowerCase(Locale.ROOT).replace('_', ' ');
    }

    private static class ProjectTeamEntry {
        private final String name;
        private final Set<String> roles;

        private ProjectTeamEntry(String name, Set<String> roles) {
            this.name = name;
            this.roles = roles;
        }
    }
}
