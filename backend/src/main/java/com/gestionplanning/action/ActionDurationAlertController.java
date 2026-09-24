package com.gestionplanning.action;

import com.gestionplanning.auth.AuthenticatedUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/action-duration-alerts")
public class ActionDurationAlertController {
    private final ActionDurationAlertService service;
    private final AuthenticatedUserService users;

    public ActionDurationAlertController(ActionDurationAlertService service, AuthenticatedUserService users) {
        this.service = service;
        this.users = users;
    }

    @GetMapping
    public List<ActionDurationAlert> pending(@RequestAttribute("authenticatedUserId") Long userId) {
        return service.pending(users.require(userId));
    }

    @PostMapping("/acknowledge")
    public ResponseEntity<Void> acknowledge(@RequestAttribute("authenticatedUserId") Long userId, @RequestBody List<Long> ids) {
        service.acknowledge(users.require(userId), ids);
        return ResponseEntity.noContent().build();
    }
}
