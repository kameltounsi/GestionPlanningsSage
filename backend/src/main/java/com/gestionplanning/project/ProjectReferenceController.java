package com.gestionplanning.project;

import com.gestionplanning.audit.AuditLogService;
import com.gestionplanning.user.AppUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/projects")
public class ProjectReferenceController {
    private final ProjectReferenceRepository projectRepository;
    private final AuditLogService auditLogService;

    public ProjectReferenceController(ProjectReferenceRepository projectRepository, AuditLogService auditLogService) {
        this.projectRepository = projectRepository;
        this.auditLogService = auditLogService;
    }

    @GetMapping
    public List<ProjectReference> list() {
        return projectRepository.findAllByOrderByNameAsc();
    }

    @PostMapping
    public ResponseEntity<ProjectReference> create(@Valid @RequestBody ProjectReference project,
                                                   @RequestAttribute("authenticatedUser") AppUser user) {
        project.setName(project.getName().trim());
        ProjectReference saved = projectRepository.save(project);
        auditLogService.recordBusinessEvent(user, "AJOUT_PROJET", "projet", saved.getName(), "Ajout du projet: " + saved.getName());
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{name}")
    public ResponseEntity<ProjectReference> update(@PathVariable String name, @Valid @RequestBody ProjectReference updatedProject,
                                                   @RequestAttribute("authenticatedUser") AppUser user) {
        return projectRepository.findById(name)
                .map(project -> {
                    project.setProjectTeam(updatedProject.getProjectTeam());
                    ProjectReference saved = projectRepository.save(project);
                    auditLogService.recordBusinessEvent(user, "MODIFICATION_PROJET_EQUIPE", "projet", saved.getName(), "Modification du projet ou de son equipe: " + saved.getName());
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{name}")
    public ResponseEntity<Void> delete(@PathVariable String name) {
        if (!projectRepository.existsById(name)) {
            return ResponseEntity.notFound().build();
        }
        projectRepository.deleteById(name);
        return ResponseEntity.noContent().build();
    }
}
