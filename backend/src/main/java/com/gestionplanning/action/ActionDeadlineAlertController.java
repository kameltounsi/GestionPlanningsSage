package com.gestionplanning.action;

import com.gestionplanning.auth.AuthenticatedUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/action-deadline-alerts")
public class ActionDeadlineAlertController {
    private final ActionDeadlineAlertService alertService;
    private final AuthenticatedUserService authenticatedUserService;

    public ActionDeadlineAlertController(ActionDeadlineAlertService alertService,
                                         AuthenticatedUserService authenticatedUserService) {
        this.alertService = alertService;
        this.authenticatedUserService = authenticatedUserService;
    }

    @GetMapping("/pending-sound")
    public List<ActionDeadlineAlertDto> pendingSoundAlerts(@RequestAttribute("authenticatedUserId") Long userId) {
        return alertService.pendingSoundAlertsFor(authenticatedUserService.require(userId)).stream()
                .map(ActionDeadlineAlertDto::from)
                .collect(Collectors.toList());
    }

    @PostMapping("/ack-sound")
    public ResponseEntity<Void> acknowledgeSoundAlerts(@RequestAttribute("authenticatedUserId") Long userId,
                                                       @RequestBody List<Long> ids) {
        alertService.acknowledgeSoundAlerts(authenticatedUserService.require(userId), ids);
        return ResponseEntity.noContent().build();
    }
}
