package com.gestionplanning.preferential;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/preferentials/roles")
public class RoleReferenceController {
    private final RoleReferenceRepository repository;

    public RoleReferenceController(RoleReferenceRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<RoleReference> list() {
        return repository.findAllByOrderByNameAsc();
    }

    @PostMapping
    public ResponseEntity<RoleReference> create(@Valid @RequestBody RoleReference role) {
        role.setName(role.getName().trim());
        return ResponseEntity.ok(repository.save(role));
    }

    @PutMapping("/{id}")
    public ResponseEntity<RoleReference> update(@PathVariable Long id, @Valid @RequestBody RoleReference updatedRole) {
        return repository.findById(id)
                .map(role -> {
                    role.setName(updatedRole.getName().trim());
                    return ResponseEntity.ok(repository.save(role));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
