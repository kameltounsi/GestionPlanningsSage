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
@RequestMapping("/api/preferentials/clients")
public class ClientReferenceController {
    private final ClientReferenceRepository repository;

    public ClientReferenceController(ClientReferenceRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<ClientReference> list() {
        return repository.findAllByOrderByNameAsc();
    }

    @PostMapping
    public ResponseEntity<ClientReference> create(@Valid @RequestBody ClientReference client) {
        client.setName(client.getName().trim());
        return ResponseEntity.ok(repository.save(client));
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
