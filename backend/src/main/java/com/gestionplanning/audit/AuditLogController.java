package com.gestionplanning.audit;

import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.auth.AuthenticatedUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/audit")
public class AuditLogController {
    private final AuditLogRepository repository;
    private final AccessControlService accessControlService;
    private final AuthenticatedUserService authenticatedUserService;

    public AuditLogController(AuditLogRepository repository, AccessControlService accessControlService,
                              AuthenticatedUserService authenticatedUserService) {
        this.repository = repository;
        this.accessControlService = accessControlService;
        this.authenticatedUserService = authenticatedUserService;
    }

    @GetMapping
    public ResponseEntity<List<AuditLogDto>> list(@RequestAttribute("authenticatedUserId") Long userId) {
        if (!accessControlService.isAdmin(authenticatedUserService.require(userId))) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(repository.findTop300ByOrderByOccurredAtDescIdDesc().stream()
                .map(AuditLogDto::from)
                .collect(Collectors.toList()));
    }
}
