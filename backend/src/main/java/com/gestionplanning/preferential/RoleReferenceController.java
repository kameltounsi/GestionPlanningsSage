package com.gestionplanning.preferential;

import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.user.AppUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RestController;

import javax.validation.Valid;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/preferentials/roles")
public class RoleReferenceController {
    private final RoleReferenceRepository repository;
    private final AccessControlService accessControlService;

    public RoleReferenceController(RoleReferenceRepository repository, AccessControlService accessControlService) {
        this.repository = repository;
        this.accessControlService = accessControlService;
    }

    @GetMapping
    public List<ReferenceDto> list() {
        return repository.findAllByOrderByNameAsc().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @PostMapping
    public ResponseEntity<ReferenceDto> create(@Valid @RequestBody ReferenceDto role,
                                               @RequestAttribute("authenticatedUser") Object userAttribute) {
                                                   AppUser user = (AppUser) userAttribute;
        if (!accessControlService.isAdmin(user)) {
            return ResponseEntity.status(403).<ReferenceDto>build();
        }
        RoleReference entity = new RoleReference();
        entity.setName(role.getName().trim());
        return ResponseEntity.ok(toDto(repository.save(entity)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ReferenceDto> update(@PathVariable Long id, @Valid @RequestBody ReferenceDto updatedRole,
                                               @RequestAttribute("authenticatedUser") Object userAttribute) {
                                                   AppUser user = (AppUser) userAttribute;
        if (!accessControlService.isAdmin(user)) {
            return ResponseEntity.status(403).<ReferenceDto>build();
        }
        return repository.findById(id)
                .map(role -> {
                    role.setName(updatedRole.getName().trim());
                    return ResponseEntity.ok(toDto(repository.save(role)));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @RequestAttribute("authenticatedUser") Object userAttribute) {
        AppUser user = (AppUser) userAttribute;
        if (!accessControlService.isAdmin(user)) {
            return ResponseEntity.status(403).build();
        }
        if (!repository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private ReferenceDto toDto(RoleReference role) {
        return new ReferenceDto(role.getId(), role.getName());
    }
}
