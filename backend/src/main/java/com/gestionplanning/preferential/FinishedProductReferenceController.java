package com.gestionplanning.preferential;

import com.gestionplanning.audit.AuditLogService;
import com.gestionplanning.project.ProjectReferenceRepository;
import com.gestionplanning.user.AppUser;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/preferentials/finished-products")
public class FinishedProductReferenceController {
    private final FinishedProductReferenceRepository repository;
    private final ClientReferenceRepository clientRepository;
    private final ProjectReferenceRepository projectRepository;
    private final ProductReferenceRepository productRepository;
    private final AuditLogService auditLogService;

    public FinishedProductReferenceController(FinishedProductReferenceRepository repository,
                                              ClientReferenceRepository clientRepository,
                                              ProjectReferenceRepository projectRepository,
                                              ProductReferenceRepository productRepository,
                                              AuditLogService auditLogService) {
        this.repository = repository;
        this.clientRepository = clientRepository;
        this.projectRepository = projectRepository;
        this.productRepository = productRepository;
        this.auditLogService = auditLogService;
    }

    @GetMapping
    public List<FinishedProductReference> list() {
        return repository.findAllByOrderByProjectAscProductAscPartNumberAsc();
    }

    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody FinishedProductReference finishedProduct,
                                    @RequestAttribute("authenticatedUser") AppUser user) {
        normalize(finishedProduct);
        if (!linkedReferencesExist(finishedProduct)) {
            return ResponseEntity.badRequest().build();
        }
        String uniquenessError = uniquenessError(finishedProduct, null);
        if (uniquenessError != null) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(uniquenessError);
        }
        FinishedProductReference saved;
        try {
            saved = repository.save(finishedProduct);
        } catch (DataIntegrityViolationException exception) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("Part number ou code reduit deja existant.");
        }
        auditLogService.recordBusinessEvent(user, "AJOUT_PRODUIT_FINI", "produit_fini", saved.getId() == null ? null : String.valueOf(saved.getId()), "Ajout du produit fini: " + saved.getPartNumber());
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id,
                                    @Valid @RequestBody FinishedProductReference updatedFinishedProduct) {
        normalize(updatedFinishedProduct);
        if (!linkedReferencesExist(updatedFinishedProduct)) {
            return ResponseEntity.badRequest().build();
        }
        String uniquenessError = uniquenessError(updatedFinishedProduct, id);
        if (uniquenessError != null) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(uniquenessError);
        }
        return repository.findById(id)
                .map(finishedProduct -> {
                    finishedProduct.setClient(updatedFinishedProduct.getClient());
                    finishedProduct.setProject(updatedFinishedProduct.getProject());
                    finishedProduct.setPartNumber(updatedFinishedProduct.getPartNumber());
                    finishedProduct.setDesignation(trimToNull(updatedFinishedProduct.getDesignation()));
                    finishedProduct.setCustomerPn(trimToNull(updatedFinishedProduct.getCustomerPn()));
                    finishedProduct.setProduct(updatedFinishedProduct.getProduct());
                    finishedProduct.setCoiffeIndex(trimToNull(updatedFinishedProduct.getCoiffeIndex()));
                    finishedProduct.setDrawingIndex(trimToNull(updatedFinishedProduct.getDrawingIndex()));
                    finishedProduct.setReducedCode(updatedFinishedProduct.getReducedCode());
                    finishedProduct.setSalePrice(updatedFinishedProduct.getSalePrice());
                    finishedProduct.setProductionIntegrationDate(updatedFinishedProduct.getProductionIntegrationDate());
                    finishedProduct.setComments(trimToNull(updatedFinishedProduct.getComments()));
                    try {
                        return ResponseEntity.ok(repository.save(finishedProduct));
                    } catch (DataIntegrityViolationException exception) {
                        return ResponseEntity.status(HttpStatus.CONFLICT).body("Part number ou code reduit deja existant.");
                    }
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

    private void normalize(FinishedProductReference finishedProduct) {
        finishedProduct.setClient(finishedProduct.getClient().trim());
        finishedProduct.setProject(finishedProduct.getProject().trim());
        finishedProduct.setPartNumber(finishedProduct.getPartNumber().trim());
        finishedProduct.setDesignation(trimToNull(finishedProduct.getDesignation()));
        finishedProduct.setCustomerPn(trimToNull(finishedProduct.getCustomerPn()));
        finishedProduct.setProduct(finishedProduct.getProduct().trim());
        finishedProduct.setCoiffeIndex(trimToNull(finishedProduct.getCoiffeIndex()));
        finishedProduct.setDrawingIndex(trimToNull(finishedProduct.getDrawingIndex()));
        finishedProduct.setReducedCode(finishedProduct.getReducedCode().trim());
        finishedProduct.setComments(trimToNull(finishedProduct.getComments()));
    }

    private boolean linkedReferencesExist(FinishedProductReference finishedProduct) {
        return clientRepository.existsByName(finishedProduct.getClient())
                && projectRepository.existsById(finishedProduct.getProject())
                && productRepository.existsByName(finishedProduct.getProduct());
    }

    private String uniquenessError(FinishedProductReference finishedProduct, Long currentId) {
        boolean partNumberExists = currentId == null
                ? repository.existsByPartNumber(finishedProduct.getPartNumber())
                : repository.existsByPartNumberAndIdNot(finishedProduct.getPartNumber(), currentId);
        if (partNumberExists) {
            return "Ce part number existe deja.";
        }
        boolean reducedCodeExists = currentId == null
                ? repository.existsByReducedCode(finishedProduct.getReducedCode())
                : repository.existsByReducedCodeAndIdNot(finishedProduct.getReducedCode(), currentId);
        if (reducedCodeExists) {
            return "Ce code reduit existe deja.";
        }
        return null;
    }

    private String trimToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }
}
