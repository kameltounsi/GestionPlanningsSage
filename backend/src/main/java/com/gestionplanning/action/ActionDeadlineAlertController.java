package com.gestionplanning.action;

import com.gestionplanning.user.AppUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/action-deadline-alerts")
public class ActionDeadlineAlertController {
    private final ActionDeadlineAlertService alertService;

    public ActionDeadlineAlertController(ActionDeadlineAlertService alertService) {
        this.alertService = alertService;
    }

    @GetMapping("/pending-sound")
    public List<ActionDeadlineAlert> pendingSoundAlerts(@RequestAttribute("authenticatedUser") AppUser user) {
        return alertService.pendingSoundAlertsFor(user);
    }

    @PostMapping("/ack-sound")
    public ResponseEntity<Void> acknowledgeSoundAlerts(@RequestAttribute("authenticatedUser") AppUser user,
                                                       @RequestBody List<Long> ids) {
        alertService.acknowledgeSoundAlerts(user, ids);
        return ResponseEntity.noContent().build();
    }
}
