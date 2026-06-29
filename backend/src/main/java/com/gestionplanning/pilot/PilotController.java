package com.gestionplanning.pilot;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/pilots")
public class PilotController {
    private final PilotRepository pilotRepository;

    public PilotController(PilotRepository pilotRepository) {
        this.pilotRepository = pilotRepository;
    }

    @GetMapping
    public List<PilotDto> list() {
        return pilotRepository.findAllByOrderByNameAsc().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @PostMapping
    public ResponseEntity<PilotDto> create(@RequestBody PilotDto pilot) {
        return ResponseEntity.ok(toDto(pilotRepository.save(toEntity(pilot))));
    }

    @PutMapping("/{name}")
    public ResponseEntity<PilotDto> update(@PathVariable String name, @RequestBody PilotDto updatedPilot) {
        return pilotRepository.findById(name)
                .map(pilot -> {
                    pilot.setManager(updatedPilot.getManager());
                    return ResponseEntity.ok(toDto(pilotRepository.save(pilot)));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{name}")
    public ResponseEntity<Void> delete(@PathVariable String name) {
        if (!pilotRepository.existsById(name)) {
            return ResponseEntity.notFound().build();
        }
        pilotRepository.deleteById(name);
        return ResponseEntity.noContent().build();
    }

    private Pilot toEntity(PilotDto dto) {
        Pilot pilot = new Pilot();
        pilot.setName(dto.getName());
        pilot.setManager(dto.getManager());
        return pilot;
    }

    private PilotDto toDto(Pilot pilot) {
        return new PilotDto(pilot.getName(), pilot.getManager());
    }
}
