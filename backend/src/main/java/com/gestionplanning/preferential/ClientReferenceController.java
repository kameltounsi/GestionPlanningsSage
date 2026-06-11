package com.gestionplanning.preferential;

import com.gestionplanning.audit.AuditLogService;
import com.gestionplanning.user.AppUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/preferentials/clients")
public class ClientReferenceController {
    private final ClientReferenceRepository repository;
    private final AuditLogService auditLogService;

    public ClientReferenceController(ClientReferenceRepository repository, AuditLogService auditLogService) {
        this.repository = repository;
        this.auditLogService = auditLogService;
    }

    @GetMapping
    public List<ClientReference> list() {
        return repository.findAllByOrderByNameAsc();
    }

    @PostMapping
    public ResponseEntity<ClientReference> create(@Valid @RequestBody ClientReference client,
                                                  @RequestAttribute("authenticatedUser") AppUser user) {
        client.setName(client.getName().trim());
        ClientReference saved = repository.save(client);
        auditLogService.recordBusinessEvent(user, "AJOUT_CLIENT", "client", saved.getId() == null ? null : String.valueOf(saved.getId()), "Ajout du client: " + saved.getName());
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ClientReference> update(@PathVariable Long id, @Valid @RequestBody ClientReference updatedClient) {
        return repository.findById(id)
                .map(client -> {
                    client.setName(updatedClient.getName().trim());
                    return ResponseEntity.ok(repository.save(client));
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
