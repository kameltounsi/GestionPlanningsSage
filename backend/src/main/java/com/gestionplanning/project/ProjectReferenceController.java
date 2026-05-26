package com.gestionplanning.project;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/projects")
public class ProjectReferenceController {
    private final ProjectReferenceRepository projectRepository;

    public ProjectReferenceController(ProjectReferenceRepository projectRepository) {
        this.projectRepository = projectRepository;
    }

    @GetMapping
    public List<ProjectReference> list() {
        return projectRepository.findAllByOrderByNameAsc();
    }

    @PostMapping
    public ResponseEntity<ProjectReference> create(@Valid @RequestBody ProjectReference project) {
        project.setName(project.getName().trim());
        return ResponseEntity.ok(projectRepository.save(project));
    }

    @PutMapping("/{name}")
    public ResponseEntity<ProjectReference> update(@PathVariable String name, @Valid @RequestBody ProjectReference updatedProject) {
        return projectRepository.findById(name)
                .map(project -> {
                    project.setProjectTeam(updatedProject.getProjectTeam());
                    return ResponseEntity.ok(projectRepository.save(project));
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
