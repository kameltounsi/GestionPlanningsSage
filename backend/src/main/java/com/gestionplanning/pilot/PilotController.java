package com.gestionplanning.pilot;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/pilots")
public class PilotController {
    private final PilotRepository pilotRepository;

    public PilotController(PilotRepository pilotRepository) {
        this.pilotRepository = pilotRepository;
    }

    @GetMapping
    public List<Pilot> list() {
        return pilotRepository.findAllByOrderByNameAsc();
    }

    @PostMapping
    public ResponseEntity<Pilot> create(@RequestBody Pilot pilot) {
        return ResponseEntity.ok(pilotRepository.save(pilot));
    }

    @PutMapping("/{name}")
    public ResponseEntity<Pilot> update(@PathVariable String name, @RequestBody Pilot updatedPilot) {
        return pilotRepository.findById(name)
                .map(pilot -> {
                    pilot.setManager(updatedPilot.getManager());
                    return ResponseEntity.ok(pilotRepository.save(pilot));
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
}
