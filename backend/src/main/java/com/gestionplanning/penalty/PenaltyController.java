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
    private final EcrRequestRepository requestRepository;

    public PenaltyController(PenaltyRepository penaltyRepository, EcrRequestRepository requestRepository) {
        this.penaltyRepository = penaltyRepository;
        this.requestRepository = requestRepository;
    }

    @GetMapping("/penalties")
    public List<PenaltyDto> list() {
        return penaltyRepository.findAll().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @GetMapping("/ecr-requests/{requestId}/penalties")
    public ResponseEntity<List<PenaltyDto>> listByRequest(@PathVariable Long requestId) {
        if (!requestRepository.existsById(requestId)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(penaltyRepository.findByRequest_IdOrderByDateDescIdDesc(requestId).stream()
                .map(this::toDto)
                .collect(Collectors.toList()));
    }

    @PostMapping("/ecr-requests/{requestId}/penalties")
    public ResponseEntity<PenaltyDto> create(@PathVariable Long requestId, @Valid @RequestBody PenaltyDto penaltyDto) {
        return requestRepository.findById(requestId)
                .map(request -> {
                    Penalty penalty = toEntity(penaltyDto);
                    penalty.setRequest(request);
                    Penalty saved = penaltyRepository.save(penalty);
                    return ResponseEntity.created(URI.create("/api/penalties/" + saved.getId())).body(toDto(saved));
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

    private Penalty toEntity(PenaltyDto dto) {
        Penalty penalty = new Penalty();
        penalty.setPilot(dto.getPilot());
        penalty.setDelayType(dto.getDelayType());
        penalty.setAmount(dto.getAmount());
        penalty.setDate(dto.getDate());
        penalty.setComment(dto.getComment());
        return penalty;
    }

    private PenaltyDto toDto(Penalty penalty) {
        PenaltyDto dto = new PenaltyDto();
        dto.setId(penalty.getId());
        dto.setRequestId(penalty.getRequestId());
        dto.setPilot(penalty.getPilot());
        dto.setDelayType(penalty.getDelayType());
        dto.setAmount(penalty.getAmount());
        dto.setDate(penalty.getDate());
        dto.setComment(penalty.getComment());
        return dto;
    }
}
