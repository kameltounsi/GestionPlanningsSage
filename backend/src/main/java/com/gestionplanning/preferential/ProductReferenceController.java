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
@RequestMapping("/api/preferentials/products")
public class ProductReferenceController {
    private final ProductReferenceRepository repository;
    private final AuditLogService auditLogService;
    private final AccessControlService accessControlService;

    public ProductReferenceController(ProductReferenceRepository repository, AuditLogService auditLogService,
                                      AccessControlService accessControlService) {
        this.repository = repository;
        this.auditLogService = auditLogService;
        this.accessControlService = accessControlService;
    }

    @GetMapping
    public List<ReferenceDto> list() {
        return repository.findAllByOrderByNameAsc().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @PostMapping
    public ResponseEntity<ReferenceDto> create(@Valid @RequestBody ReferenceDto product,
                                               @RequestAttribute("authenticatedUser") Object userAttribute) {
                                                   AppUser user = (AppUser) userAttribute;
        if (!accessControlService.isAdmin(user)) {
            return ResponseEntity.status(403).<ReferenceDto>build();
        }
        ProductReference entity = new ProductReference();
        entity.setName(product.getName().trim());
        ProductReference saved = repository.save(entity);
        auditLogService.recordBusinessEvent(user, "AJOUT_PRODUIT", "produit", saved.getId() == null ? null : String.valueOf(saved.getId()), "Ajout du produit: " + saved.getName());
        return ResponseEntity.ok(toDto(saved));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ReferenceDto> update(@PathVariable Long id, @Valid @RequestBody ReferenceDto updatedProduct,
                                               @RequestAttribute("authenticatedUser") Object userAttribute) {
                                                   AppUser user = (AppUser) userAttribute;
        if (!accessControlService.isAdmin(user)) {
            return ResponseEntity.status(403).<ReferenceDto>build();
        }
        return repository.findById(id)
                .map(product -> {
                    product.setName(updatedProduct.getName().trim());
                    return ResponseEntity.ok(toDto(repository.save(product)));
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

    private ReferenceDto toDto(ProductReference product) {
        return new ReferenceDto(product.getId(), product.getName());
    }
}
