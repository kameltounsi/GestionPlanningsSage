package com.gestionplanning.penalty;

import com.gestionplanning.ecr.EcrRequestRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api")
public class PenaltyController {
    private final PenaltyRepository penaltyRepository;
    private final EcrRequestRepository requestRepository;

    public PenaltyController(PenaltyRepository penaltyRepository, EcrRequestRepository requestRepository) {
        this.penaltyRepository = penaltyRepository;
        this.requestRepository = requestRepository;
    }

    @GetMapping("/penalties")
    public List<Penalty> list() {
        return penaltyRepository.findAll();
    }

    @GetMapping("/ecr-requests/{requestId}/penalties")
    public ResponseEntity<List<Penalty>> listByRequest(@PathVariable Long requestId) {
        if (!requestRepository.existsById(requestId)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(penaltyRepository.findByRequest_IdOrderByDateDescIdDesc(requestId));
    }

    @PostMapping("/ecr-requests/{requestId}/penalties")
    public ResponseEntity<Penalty> create(@PathVariable Long requestId, @Valid @RequestBody Penalty penalty) {
        return requestRepository.findById(requestId)
                .map(request -> {
                    penalty.setRequest(request);
                    Penalty saved = penaltyRepository.save(penalty);
                    return ResponseEntity.created(URI.create("/api/penalties/" + saved.getId())).body(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/penalties/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!penaltyRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        penaltyRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
