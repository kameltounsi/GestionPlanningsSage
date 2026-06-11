package com.gestionplanning.audit;

import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.user.AppUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/audit")
public class AuditLogController {
    private final AuditLogRepository repository;
    private final AccessControlService accessControlService;

    public AuditLogController(AuditLogRepository repository, AccessControlService accessControlService) {
        this.repository = repository;
        this.accessControlService = accessControlService;
    }

    @GetMapping
    public ResponseEntity<List<AuditLog>> list(@RequestAttribute("authenticatedUser") AppUser user) {
        if (!accessControlService.isAdmin(user)) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(repository.findTop300ByOrderByOccurredAtDescIdDesc());
    }
}
