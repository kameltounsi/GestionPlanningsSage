package com.gestionplanning.penalty;

import com.gestionplanning.ecr.EcrRequestRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class PenaltyController {
    private final PenaltyRepository penaltyRepository;
    private final PenaltyMapper penaltyMapper;
    private final EcrRequestRepository requestRepository;

    public PenaltyController(PenaltyRepository penaltyRepository, PenaltyMapper penaltyMapper, EcrRequestRepository requestRepository) {
        this.penaltyRepository = penaltyRepository;
        this.penaltyMapper = penaltyMapper;
        this.requestRepository = requestRepository;
    }

    @GetMapping("/penalties")
    public List<PenaltyDto> list() {
        return penaltyRepository.findAll().stream()
                .map(penaltyMapper::toDto)
                .collect(Collectors.toList());
    }

    @GetMapping("/ecr-requests/{requestId}/penalties")
    public ResponseEntity<List<PenaltyDto>> listByRequest(@PathVariable Long requestId) {
        if (!requestRepository.existsById(requestId)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(penaltyRepository.findByRequest_IdOrderByDateDescIdDesc(requestId).stream()
                .map(penaltyMapper::toDto)
                .collect(Collectors.toList()));
    }

    @PostMapping("/ecr-requests/{requestId}/penalties")
    public ResponseEntity<PenaltyDto> create(@PathVariable Long requestId, @Valid @RequestBody PenaltyDto penaltyDto) {
        return requestRepository.findById(requestId)
                .map(request -> {
                    Penalty penalty = penaltyMapper.toEntity(penaltyDto);
                    penalty.setRequest(request);
                    Penalty saved = penaltyRepository.save(penalty);
                    return ResponseEntity.created(URI.create("/api/penalties/" + saved.getId())).body(penaltyMapper.toDto(saved));
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
