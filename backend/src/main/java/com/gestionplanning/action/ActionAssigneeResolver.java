package com.gestionplanning.action;

import com.gestionplanning.ecr.EcrRequest;
import com.gestionplanning.project.ProjectReference;
import com.gestionplanning.project.ProjectReferenceRepository;
import com.gestionplanning.user.AppUser;
import com.gestionplanning.user.AppUserRepository;
import com.gestionplanning.user.UserRole;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class ActionAssigneeResolver {
    private final ProjectReferenceRepository projectRepository;
    private final AppUserRepository userRepository;

    public ActionAssigneeResolver(ProjectReferenceRepository projectRepository, AppUserRepository userRepository) {
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
    }

    public String resolve(EcrRequest request, String responsible) {
        if (request == null) {
            return clean(responsible);
        }
        String value = clean(responsible);
        if (value == null || value.isEmpty()) {
            return request.getPilot();
        }
        Optional<UserRole> role = roleFrom(value);
        if (!role.isPresent()) {
            return findProjectMemberByRoleLabel(request, value)
                    .map(this::displayName)
                    .orElse(value);
        }
        return findProjectMemberByRole(request, role.get())
                .map(this::displayName)
                .orElse(value);
    }

    public String resolveOptional(EcrRequest request, String roleOrName) {
        if (request == null) {
            return clean(roleOrName);
        }
        String value = clean(roleOrName);
        if (value == null || value.isEmpty()) {
            return null;
        }
        Optional<UserRole> role = roleFrom(value);
        if (!role.isPresent()) {
            return findProjectMemberByRoleLabel(request, value)
                    .map(this::displayName)
                    .orElse(value);
        }
        return findProjectMemberByRole(request, role.get())
                .map(this::displayName)
                .orElse(value);
    }

    public String displayFor(EcrRequest request, String roleOrName, String fallbackName) {
        String value = clean(roleOrName);
        if (value == null || value.isEmpty()) {
            value = clean(fallbackName);
        }
        if (value == null || value.isEmpty()) {
            return null;
        }
        if (request == null) {
            return value;
        }
        Optional<UserRole> role = roleFrom(value);
        if (!role.isPresent()) {
            return findProjectMemberByRoleLabel(request, value)
                    .map(this::displayName)
                    .orElse(clean(fallbackName) == null ? value : clean(fallbackName));
        }
        return findProjectMemberByRole(request, role.get())
                .map(this::displayName)
                .orElse(value);
    }

    private Optional<AppUser> findProjectMemberByRole(EcrRequest request, UserRole role) {
        Optional<AppUser> projectRoleUser = findProjectMemberByProjectRole(request, roleLabel(role));
        if (projectRoleUser.isPresent()) {
            return projectRoleUser;
        }
        return projectRepository.findById(request.getModificationProject())
                .map(ProjectReference::getProjectTeam)
                .map(this::teamMemberNames)
                .orElse(Collections.emptyList())
                .stream()
                .map(this::findUserByTeamName)
                .filter(Optional::isPresent)
                .map(Optional::get)
                .filter(user -> hasRole(user, role))
                .findFirst();
    }

    private Optional<AppUser> findProjectMemberByRoleLabel(EcrRequest request, String roleLabel) {
        String normalizedRole = normalize(roleLabel);
        if (normalizedRole.isEmpty()) {
            return Optional.empty();
        }
        Optional<AppUser> projectRoleUser = findProjectMemberByProjectRole(request, roleLabel);
        if (projectRoleUser.isPresent()) {
            return projectRoleUser;
        }
        return projectRepository.findById(request.getModificationProject())
                .map(ProjectReference::getProjectTeam)
                .map(this::teamMemberNames)
                .orElse(Collections.emptyList())
                .stream()
                .map(this::findUserByTeamName)
                .filter(Optional::isPresent)
                .map(Optional::get)
                .filter(user -> normalize(user.getJobTitle()).equals(normalizedRole) || userRoleTokens(user).contains(normalizedRole))
                .findFirst();
    }

    private Optional<AppUser> findProjectMemberByProjectRole(EcrRequest request, String roleLabel) {
        String normalizedRole = normalize(roleLabel);
        if (request == null || normalizedRole.isEmpty()) {
            return Optional.empty();
        }
        return projectRepository.findById(request.getModificationProject())
                .map(ProjectReference::getProjectTeam)
                .map(this::teamEntries)
                .orElse(Collections.emptyList())
                .stream()
                .filter(entry -> entry.roles.stream().anyMatch(role -> normalize(role).equals(normalizedRole)))
                .map(entry -> findUserByTeamName(entry.name))
                .filter(Optional::isPresent)
                .map(Optional::get)
                .findFirst();
    }

    private boolean hasRole(AppUser user, UserRole role) {
        List<String> roleTokens = userRoleTokens(user);
        return roleTokens.contains(normalize(role.name()))
                || roleTokens.contains(normalize(roleLabel(role)))
                || normalize(user.getJobTitle()).equals(normalize(role.name()))
                || normalize(user.getJobTitle()).equals(normalize(roleLabel(role)));
    }

    private List<String> userRoleTokens(AppUser user) {
        return Arrays.stream(String.valueOf(user == null ? "" : user.getRole()).split("[,;|]"))
                .map(this::normalize)
                .filter(value -> !value.isEmpty())
                .collect(Collectors.toList());
    }

    private Optional<AppUser> findUserByTeamName(String memberName) {
        String normalized = normalize(memberName);
        return userRepository.findAll().stream()
                .filter(user -> normalize(user.getFullName()).equals(normalized)
                        || normalize(user.getUsername()).equals(normalized)
                        || normalize(user.getEmail()).equals(normalized))
                .findFirst();
    }

    private List<String> teamMemberNames(String projectTeam) {
        return teamEntries(projectTeam).stream()
                .map(entry -> entry.name)
                .collect(Collectors.toList());
    }

    private List<ProjectTeamEntry> teamEntries(String projectTeam) {
        return Arrays.stream(String.valueOf(projectTeam == null ? "" : projectTeam).split("[;\\n]+"))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .flatMap(value -> value.contains("::") ? Arrays.stream(new String[]{value}) : Arrays.stream(value.split(",")))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(value -> {
                    String[] parts = value.split("::", 2);
                    List<String> roles = parts.length > 1
                            ? Arrays.stream(parts[1].split("[,|]")).map(String::trim).filter(role -> !role.isEmpty()).collect(Collectors.toList())
                            : Collections.emptyList();
                    return new ProjectTeamEntry(parts[0].trim(), roles);
                })
                .collect(Collectors.toList());
    }

    private Optional<UserRole> roleFrom(String value) {
        String normalized = normalize(value);
        for (UserRole role : UserRole.values()) {
            if (normalize(role.name()).equals(normalized) || normalize(roleLabel(role)).equals(normalized)) {
                return Optional.of(role);
            }
        }
        return Optional.empty();
    }

    private String roleLabel(UserRole role) {
        if (role == UserRole.ADMIN) return "Admin";
        if (role == UserRole.CHEF_DE_PROJET) return "Chef de projet";
        if (role == UserRole.VALIDATEUR) return "Validateur";
        if (role == UserRole.MANAGER) return "Manager";
        return role.name();
    }

    private String displayName(AppUser user) {
        if (clean(user.getFullName()) != null) return user.getFullName().trim();
        if (clean(user.getUsername()) != null) return user.getUsername().trim();
        return user.getEmail();
    }

    private String clean(String value) {
        return value == null ? null : value.trim();
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        String ascii = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return ascii.trim().toLowerCase(Locale.ROOT).replace("_", " ");
    }

    private static class ProjectTeamEntry {
        private final String name;
        private final List<String> roles;

        private ProjectTeamEntry(String name, List<String> roles) {
            this.name = name;
            this.roles = roles;
        }
    }
}
