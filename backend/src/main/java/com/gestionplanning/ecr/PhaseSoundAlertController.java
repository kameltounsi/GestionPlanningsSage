package com.gestionplanning.ecr;

import com.gestionplanning.auth.AuthenticatedUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/phase-sound-alerts")
public class PhaseSoundAlertController {
    private final PhaseSoundAlertService alertService;
    private final AuthenticatedUserService authenticatedUserService;

    public PhaseSoundAlertController(PhaseSoundAlertService alertService,
                                     AuthenticatedUserService authenticatedUserService) {
        this.alertService = alertService;
        this.authenticatedUserService = authenticatedUserService;
    }

    @GetMapping("/pending-sound")
    public List<PhaseSoundAlertDto> pendingSoundAlerts(@RequestAttribute("authenticatedUserId") Long userId) {
        return alertService.pendingSoundAlertsFor(authenticatedUserService.require(userId)).stream()
                .map(PhaseSoundAlertDto::from)
                .collect(Collectors.toList());
    }

    @PostMapping("/ack-sound")
    public ResponseEntity<Void> acknowledgeSoundAlerts(@RequestAttribute("authenticatedUserId") Long userId,
                                                       @RequestBody List<Long> ids) {
        alertService.acknowledgeSoundAlerts(authenticatedUserService.require(userId), ids);
        return ResponseEntity.noContent().build();
    }
}
