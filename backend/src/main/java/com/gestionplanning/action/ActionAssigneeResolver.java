package com.gestionplanning.action;

import com.gestionplanning.ecr.EcrRequest;
import com.gestionplanning.project.ProjectReference;
import com.gestionplanning.project.ProjectReferenceRepository;
import com.gestionplanning.user.AppUser;
import com.gestionplanning.user.AppUserRepository;
import com.gestionplanning.user.UserRole;
import org.springframework.stereotype.Service;

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
        return projectRepository.findById(request.getModificationProject())
                .map(ProjectReference::getProjectTeam)
                .map(this::teamMembers)
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
        return projectRepository.findById(request.getModificationProject())
                .map(ProjectReference::getProjectTeam)
                .map(this::teamMembers)
                .orElse(Collections.emptyList())
                .stream()
                .map(this::findUserByTeamName)
                .filter(Optional::isPresent)
                .map(Optional::get)
                .filter(user -> normalize(user.getJobTitle()).equals(normalizedRole) || normalize(user.getRole()).equals(normalizedRole))
                .findFirst();
    }

    private boolean hasRole(AppUser user, UserRole role) {
        String value = normalize(user.getRole());
        return value.equals(normalize(role.name()))
                || value.equals(normalize(roleLabel(role)))
                || normalize(user.getJobTitle()).equals(normalize(role.name()))
                || normalize(user.getJobTitle()).equals(normalize(roleLabel(role)));
    }

    private Optional<AppUser> findUserByTeamName(String memberName) {
        String normalized = normalize(memberName);
        return userRepository.findAll().stream()
                .filter(user -> normalize(user.getFullName()).equals(normalized)
                        || normalize(user.getUsername()).equals(normalized)
                        || normalize(user.getEmail()).equals(normalized))
                .findFirst();
    }

    private List<String> teamMembers(String projectTeam) {
        return Arrays.stream(String.valueOf(projectTeam == null ? "" : projectTeam).split("[,;]+"))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
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
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT).replace("_", " ");
    }
}
