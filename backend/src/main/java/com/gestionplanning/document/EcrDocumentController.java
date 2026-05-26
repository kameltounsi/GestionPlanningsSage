package com.gestionplanning.document;

import com.gestionplanning.ecr.EcrRequestRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api")
public class EcrDocumentController {
    private final EcrDocumentRepository documentRepository;
    private final EcrRequestRepository requestRepository;

    public EcrDocumentController(EcrDocumentRepository documentRepository, EcrRequestRepository requestRepository) {
        this.documentRepository = documentRepository;
        this.requestRepository = requestRepository;
    }

    @GetMapping("/ecr-requests/{requestId}/documents")
    public ResponseEntity<List<EcrDocument>> listByRequest(@PathVariable Long requestId) {
        if (!requestRepository.existsById(requestId)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(documentRepository.findByRequest_IdOrderByUploadedAtDescIdDesc(requestId));
    }

    @PostMapping("/ecr-requests/{requestId}/documents")
    public ResponseEntity<EcrDocument> create(@PathVariable Long requestId, @Valid @RequestBody EcrDocument document) {
        return requestRepository.findById(requestId)
                .map(request -> {
                    document.setRequest(request);
                    EcrDocument saved = documentRepository.save(document);
                    return ResponseEntity.created(URI.create("/api/documents/" + saved.getId())).body(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/documents/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!documentRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        documentRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
