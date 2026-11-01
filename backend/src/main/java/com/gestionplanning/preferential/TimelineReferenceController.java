package com.gestionplanning.preferential;

import com.gestionplanning.audit.AuditLogService;
import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.user.AppUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/preferentials/timelines")
public class TimelineReferenceController {
    private final TimelineReferenceRepository repository;
    private final AuditLogService auditLogService;
    private final AccessControlService accessControlService;

    public TimelineReferenceController(TimelineReferenceRepository repository, AuditLogService auditLogService,
                                     AccessControlService accessControlService) {
        this.repository = repository;
        this.auditLogService = auditLogService;
        this.accessControlService = accessControlService;
    }

    private ReferenceDto toDto(TimelineReference entity) {
        ReferenceDto dto = new ReferenceDto(entity.getId(), entity.getName());
        dto.setComment(entity.getComment());
        return dto;
    }

    private TimelineReference toEntity(ReferenceDto dto) {
        TimelineReference entity = new TimelineReference();
        entity.setName(dto.getName().trim());
        entity.setComment(dto.getComment());
        return entity;
    }

    @GetMapping
    public List<ReferenceDto> list() {
        return repository.findAllByOrderByNameAsc().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @PostMapping
    public ResponseEntity<ReferenceDto> create(@Valid @RequestBody ReferenceDto timeline,
                                               @RequestAttribute("authenticatedUser") Object userAttribute) {
        AppUser user = (AppUser) userAttribute;
        if (!accessControlService.isAdmin(user)) {
            return ResponseEntity.status(403).<ReferenceDto>build();
        }
        TimelineReference entity = toEntity(timeline);
        TimelineReference saved = repository.save(entity);
        auditLogService.recordBusinessEvent(user, "AJOUT_TIMELINE", "timeline", saved.getId() == null ? null : String.valueOf(saved.getId()), "Ajout de la timeline: " + saved.getName());
        return ResponseEntity.ok(toDto(saved));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ReferenceDto> update(@PathVariable Long id, @Valid @RequestBody ReferenceDto updatedTimeline,
                                               @RequestAttribute("authenticatedUser") Object userAttribute) {
        AppUser user = (AppUser) userAttribute;
        if (!accessControlService.isAdmin(user)) {
            return ResponseEntity.status(403).<ReferenceDto>build();
        }
        return repository.findById(id)
                .map(timeline -> {
                    timeline.setName(updatedTimeline.getName().trim());
                    timeline.setComment(updatedTimeline.getComment());
                    return ResponseEntity.ok(toDto(repository.save(timeline)));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @RequestAttribute("authenticatedUser") Object userAttribute) {
        AppUser user = (AppUser) userAttribute;
        if (!accessControlService.isAdmin(user)) {
            return ResponseEntity.status(403).build();
        }
        if (!repository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

}
