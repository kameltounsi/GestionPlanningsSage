package com.gestionplanning.project;

import com.gestionplanning.user.AppUser;
import com.gestionplanning.user.AppUserRepository;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class ProjectReferenceMapper {
    private static final String PERMANENT_ADMIN_USERNAME = "fchelbi";
    private static final String PERMANENT_ADMIN_EMAIL = "f.chalbi@sagetunisia.com";
    private static final String PERMANENT_ADMIN_FALLBACK_NAME = "Fethi Chelbi";
    private static final String PERMANENT_ADMIN_PROJECT_ROLE = "Admin";

    private final AppUserRepository userRepository;

    public ProjectReferenceMapper(AppUserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public ProjectReference toEntity(ProjectReferenceDto dto) {
        ProjectReference entity = new ProjectReference();
        entity.setName(dto.getName().trim());
        updateEntity(entity, dto);
        return entity;
    }

    public void updateEntity(ProjectReference entity, ProjectReferenceDto dto) {
        entity.setProjectTeam(projectTeamForSave(dto));
    }

    public ProjectReferenceDto toDto(ProjectReference entity) {
        return new ProjectReferenceDto(entity.getName(), withPermanentAdmin(entity.getProjectTeam()));
    }

    public String projectTeamForSave(ProjectReferenceDto dto) {
        return withPermanentAdmin(dto == null ? null : dto.getProjectTeam());
    }

    private String withPermanentAdmin(String projectTeam) {
        List<ProjectTeamEntry> entries = parseTeamEntries(projectTeam);
        if (entries.stream().anyMatch(entry -> isPermanentAdminName(entry.name))) {
            return normalizeProjectTeam(projectTeam);
        }
        String permanentAdminEntry = permanentAdminDisplayName() + "::" + PERMANENT_ADMIN_PROJECT_ROLE;
        String normalizedProjectTeam = normalizeProjectTeam(projectTeam);
        if (normalizedProjectTeam.isEmpty()) {
            return permanentAdminEntry;
        }
        return normalizedProjectTeam + "; " + permanentAdminEntry;
    }

    private String normalizeProjectTeam(String projectTeam) {
        return parseTeamEntries(projectTeam).stream()
                .map(entry -> entry.name + "::" + String.join("|", entry.roles))
                .collect(Collectors.joining("; "));
    }

    private String permanentAdminDisplayName() {
        Optional<AppUser> permanentAdmin = userRepository.findByUsername(PERMANENT_ADMIN_USERNAME);
        if (!permanentAdmin.isPresent()) {
            permanentAdmin = userRepository.findByEmail(PERMANENT_ADMIN_EMAIL);
        }
        return permanentAdmin
                .map(admin -> firstText(admin.getFullName(), admin.getUsername(), admin.getEmail()))
                .orElse(PERMANENT_ADMIN_FALLBACK_NAME);
    }

    private boolean isPermanentAdminName(String name) {
        String normalized = normalize(name);
        return normalized.equals(normalize(PERMANENT_ADMIN_USERNAME))
                || normalized.equals(normalize(PERMANENT_ADMIN_EMAIL))
                || normalized.equals(normalize(PERMANENT_ADMIN_FALLBACK_NAME))
                || normalized.equals(normalize(permanentAdminDisplayName()));
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String firstText(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (hasText(value)) {
                return value.trim();
            }
        }
        return null;
    }

    private List<ProjectTeamEntry> parseTeamEntries(String projectTeam) {
        return Arrays.stream(String.valueOf(projectTeam == null ? "" : projectTeam).split("[;\\n]"))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .flatMap(value -> value.contains("::") ? Arrays.stream(new String[]{value}) : Arrays.stream(value.split(",")))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(value -> {
                    String[] parts = value.split("::", 2);
                    Set<String> roles = parts.length > 1
                            ? Arrays.stream(parts[1].split("[,|]")).map(ProjectReferenceMapper::normalize).filter(role -> !role.isEmpty()).collect(Collectors.toSet())
                            : new HashSet<>();
                    return new ProjectTeamEntry(parts[0].trim(), roles);
                })
                .collect(Collectors.toList());
    }

    private static String normalize(String value) {
        String text = Normalizer.normalize(String.valueOf(value == null ? "" : value), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return text.trim().toLowerCase(Locale.ROOT).replace('_', ' ');
    }

    private static class ProjectTeamEntry {
        private final String name;
        private final Set<String> roles;

        private ProjectTeamEntry(String name, Set<String> roles) {
            this.name = name;
            this.roles = roles;
        }
    }
}
