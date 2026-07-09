package com.gestionplanning.preferential;

import com.gestionplanning.audit.AuditLogService;
import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.user.AppUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/preferentials/clients")
public class ClientReferenceController {
    private final ClientReferenceRepository repository;
    private final ReferenceMapper referenceMapper;
    private final AuditLogService auditLogService;
    private final AccessControlService accessControlService;

    public ClientReferenceController(ClientReferenceRepository repository, ReferenceMapper referenceMapper, AuditLogService auditLogService,
                                     AccessControlService accessControlService) {
        this.repository = repository;
        this.referenceMapper = referenceMapper;
        this.auditLogService = auditLogService;
        this.accessControlService = accessControlService;
    }

    @GetMapping
    public List<ReferenceDto> list() {
        return repository.findAllByOrderByNameAsc().stream()
                .map(referenceMapper::toDto)
                .collect(Collectors.toList());
    }

    @PostMapping
    public ResponseEntity<ReferenceDto> create(@Valid @RequestBody ReferenceDto client,
                                               @RequestAttribute("authenticatedUser") Object userAttribute) {
                                                   AppUser user = (AppUser) userAttribute;
        if (!accessControlService.isAdmin(user)) {
            return ResponseEntity.status(403).<ReferenceDto>build();
        }
        ClientReference entity = referenceMapper.toClientEntity(client);
        ClientReference saved = repository.save(entity);
        auditLogService.recordBusinessEvent(user, "AJOUT_CLIENT", "client", saved.getId() == null ? null : String.valueOf(saved.getId()), "Ajout du client: " + saved.getName());
        return ResponseEntity.ok(referenceMapper.toDto(saved));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ReferenceDto> update(@PathVariable Long id, @Valid @RequestBody ReferenceDto updatedClient,
                                               @RequestAttribute("authenticatedUser") Object userAttribute) {
                                                   AppUser user = (AppUser) userAttribute;
        if (!accessControlService.isAdmin(user)) {
            return ResponseEntity.status(403).<ReferenceDto>build();
        }
        return repository.findById(id)
                .map(client -> {
                    referenceMapper.updateClientEntity(client, updatedClient);
                    return ResponseEntity.ok(referenceMapper.toDto(repository.save(client)));
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

}
