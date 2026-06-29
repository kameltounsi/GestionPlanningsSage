package com.gestionplanning.project;

import com.gestionplanning.audit.AuditLogService;
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
    private final EcrRequestRepository requestRepository;
    private final EcrActionRepository actionRepository;
    private final AuditLogService auditLogService;
    private final AccessControlService accessControlService;

    public ProjectReferenceController(ProjectReferenceRepository projectRepository, AuditLogService auditLogService,
                                      AccessControlService accessControlService, EcrRequestRepository requestRepository,
                                      EcrActionRepository actionRepository) {
        this.projectRepository = projectRepository;
        this.requestRepository = requestRepository;
        this.actionRepository = actionRepository;
        this.auditLogService = auditLogService;
        this.accessControlService = accessControlService;
    }

    @GetMapping
    public List<ProjectReferenceDto> list() {
        return projectRepository.findAllByOrderByNameAsc().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @PostMapping
    public ResponseEntity<ProjectReferenceDto> create(@Valid @RequestBody ProjectReferenceDto project,
                                                      @RequestAttribute("authenticatedUser") Object userAttribute) {
                                                          AppUser user = (AppUser) userAttribute;
        if (!accessControlService.isAdmin(user)) {
            return ResponseEntity.status(403).<ProjectReferenceDto>build();
        }
        Optional<String> validationError = validateProjectTeam(project.getProjectTeam());
        if (validationError.isPresent()) {
            return ResponseEntity.badRequest().<ProjectReferenceDto>build();
        }
        ProjectReference entity = new ProjectReference();
        entity.setName(project.getName().trim());
        entity.setProjectTeam(project.getProjectTeam());
        ProjectReference saved = projectRepository.save(entity);
        auditLogService.recordBusinessEvent(user, "AJOUT_PROJET", "projet", saved.getName(), "Ajout du projet: " + saved.getName());
        return ResponseEntity.ok(toDto(saved));
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
                    Optional<String> validationError = validateProjectTeam(updatedProject.getProjectTeam());
                    if (validationError.isPresent()) {
                        return ResponseEntity.badRequest().<ProjectReferenceDto>build();
                    }
                    String previousProjectLead = projectLeadName(project.getProjectTeam()).orElse(null);
                    String nextProjectLead = projectLeadName(updatedProject.getProjectTeam()).orElse(null);
                    project.setProjectTeam(updatedProject.getProjectTeam());
                    ProjectReference saved = projectRepository.save(project);
                    syncProjectLeadOnRequests(saved.getName(), previousProjectLead, nextProjectLead);
                    auditLogService.recordBusinessEvent(user, "MODIFICATION_PROJET_EQUIPE", "projet", saved.getName(), "Modification du projet ou de son equipe: " + saved.getName());
                    return ResponseEntity.ok(toDto(saved));
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
        Set<String> usedRoles = new HashSet<>();
        for (ProjectTeamEntry entry : entries) {
            for (String role : entry.roles) {
                if (!usedRoles.add(role)) {
                    return Optional.of("Chaque role doit etre attribue une seule fois par projet.");
                }
            }
        }
        long projectLeadCount = entries.stream()
                .filter(entry -> entry.roles.stream().anyMatch(role -> role.equals(PROJECT_LEAD_ROLE)))
                .count();
        if (projectLeadCount != 1) {
            return Optional.of("Selectionnez exactement un utilisateur avec le role Chef de projet.");
        }
        return Optional.empty();
    }

    private ProjectReferenceDto toDto(ProjectReference project) {
        return new ProjectReferenceDto(project.getName(), project.getProjectTeam());
    }

    private void syncProjectLeadOnRequests(String projectName, String previousProjectLead, String nextProjectLead) {
        if (nextProjectLead == null || nextProjectLead.trim().isEmpty() || normalize(previousProjectLead).equals(normalize(nextProjectLead))) {
            return;
        }
        List<EcrRequest> requests = requestRepository.findByModificationProject(projectName);
        if (requests.isEmpty()) {
            return;
        }
        for (EcrRequest request : requests) {
            if (!isTerminalRequest(request)) {
                if (!normalize(request.getPilot()).equals(normalize(nextProjectLead))) {
                    request.setPreviousPilot(request.getPilot());
                }
                request.setPilot(nextProjectLead);
                updateOpenActionsForProjectLeadChange(request, previousProjectLead, nextProjectLead);
            }
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

    private void updateOpenActionsForProjectLeadChange(EcrRequest request, String previousProjectLead, String nextProjectLead) {
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
                if (matchesProjectLeadReference(action.getResponsible(), previousProjectLead)) {
                    action.setResponsible(nextProjectLead);
                    changed = true;
                }
                if (matchesProjectLeadReference(action.getValidator(), previousProjectLead)
                        || matchesProjectLeadReference(action.getValidatorRole(), previousProjectLead)) {
                    action.setValidator(nextProjectLead);
                    changed = true;
                }
            }
        }
        if (changed) {
            actionRepository.saveAll(actions);
        }
    }

    private boolean isHistoricalAction(EcrAction action) {
        return action != null && (action.isChecked()
                || action.getStatus() == ActionStatus.DONE
                || action.getStatus() == ActionStatus.DONE_LATE
                || "APPROVED".equals(String.valueOf(action.getValidationStatus())));
    }

    private boolean matchesProjectLeadReference(String value, String previousProjectLead) {
        String normalized = normalize(value);
        return !normalized.isEmpty()
                && (normalized.equals(PROJECT_LEAD_ROLE)
                || normalized.equals(normalize(previousProjectLead)));
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
