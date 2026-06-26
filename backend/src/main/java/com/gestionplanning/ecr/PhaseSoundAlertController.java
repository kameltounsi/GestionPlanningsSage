package com.gestionplanning.ecr;

import com.gestionplanning.user.AppUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/phase-sound-alerts")
public class PhaseSoundAlertController {
    private final PhaseSoundAlertService alertService;

    public PhaseSoundAlertController(PhaseSoundAlertService alertService) {
        this.alertService = alertService;
    }

    @GetMapping("/pending-sound")
    public List<PhaseSoundAlert> pendingSoundAlerts(@RequestAttribute("authenticatedUser") AppUser user) {
        return alertService.pendingSoundAlertsFor(user);
    }

    @PostMapping("/ack-sound")
    public ResponseEntity<Void> acknowledgeSoundAlerts(@RequestAttribute("authenticatedUser") AppUser user,
                                                       @RequestBody List<Long> ids) {
        alertService.acknowledgeSoundAlerts(user, ids);
        return ResponseEntity.noContent().build();
    }
}
