package com.gestionplanning.preferential;

import com.gestionplanning.audit.AuditLogService;
import com.gestionplanning.user.AppUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/preferentials/products")
public class ProductReferenceController {
    private final ProductReferenceRepository repository;
    private final AuditLogService auditLogService;

    public ProductReferenceController(ProductReferenceRepository repository, AuditLogService auditLogService) {
        this.repository = repository;
        this.auditLogService = auditLogService;
    }

    @GetMapping
    public List<ProductReference> list() {
        return repository.findAllByOrderByNameAsc();
    }

    @PostMapping
    public ResponseEntity<ProductReference> create(@Valid @RequestBody ProductReference product,
                                                   @RequestAttribute("authenticatedUser") AppUser user) {
        product.setName(product.getName().trim());
        ProductReference saved = repository.save(product);
        auditLogService.recordBusinessEvent(user, "AJOUT_PRODUIT", "produit", saved.getId() == null ? null : String.valueOf(saved.getId()), "Ajout du produit: " + saved.getName());
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProductReference> update(@PathVariable Long id, @Valid @RequestBody ProductReference updatedProduct) {
        return repository.findById(id)
                .map(product -> {
                    product.setName(updatedProduct.getName().trim());
                    return ResponseEntity.ok(repository.save(product));
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
