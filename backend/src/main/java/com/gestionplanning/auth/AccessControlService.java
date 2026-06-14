package com.gestionplanning.auth;

import com.gestionplanning.ecr.EcrRequest;
import com.gestionplanning.ecr.PhaseValidationRequest;
import com.gestionplanning.action.EcrAction;
import com.gestionplanning.action.EcrActionRepository;
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
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AccessControlService {
    private final ProjectReferenceRepository projectRepository;
    private final AppUserRepository userRepository;
    private final EcrActionRepository actionRepository;

    public AccessControlService(ProjectReferenceRepository projectRepository, AppUserRepository userRepository,
                                EcrActionRepository actionRepository) {
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
        this.actionRepository = actionRepository;
    }

    public boolean isAdmin(AppUser user) {
        if (user == null) {
            return false;
        }
        String role = normalize(user.getRole());
        return hasApplicationRole(user, UserRole.ADMIN)
                || role.equals("administrateur")
                || normalize(user.getUsername()).equals("fchelbi")
                || normalize(user.getEmail()).equals("f.chalbi@sagetunisia.com");
    }

    public boolean isValidatorOrManager(AppUser user) {
        return hasApplicationRole(user, UserRole.VALIDATEUR) || hasApplicationRole(user, UserRole.MANAGER);
    }

    public boolean canAccessRequest(AppUser user, EcrRequest request) {
        if (isAdmin(user)) {
            return true;
        }
        if (user == null || request == null) {
            return false;
        }
        if (isRequestPilot(user, request)) {
            return true;
        }
        if (projectTeamTokens(request).stream().anyMatch(token -> matchesUser(user, token))) {
            return true;
        }
        return request.getId() != null
                && actionRepository.findByRequest_IdOrderByDeadlineAscIdAsc(request.getId()).stream()
                .anyMatch(action -> isActionParticipant(user, action));
    }

    public boolean canValidateRequest(AppUser user, EcrRequest request) {
        return isAdmin(user) || hasApplicationRole(user, UserRole.MANAGER) && canAccessRequest(user, request);
    }

    public boolean canValidateAction(AppUser user, EcrAction action) {
        if (user == null || action == null || action.getRequest() == null) {
            return false;
        }
        String validator = normalize(action.getValidator());
        String validatorRole = normalize(action.getValidatorRole());
        String validatorDisplayName = normalize(action.getValidatorDisplayName());
        if (isUndefinedValidator(validator) || isUndefinedValidator(validatorRole) || isUndefinedValidator(validatorDisplayName)) {
            return isAdmin(user);
        }
        if (!validator.isEmpty() || !validatorRole.isEmpty() || !validatorDisplayName.isEmpty()) {
            return matchesActionAssignment(user, action.getValidator())
                    || matchesActionAssignment(user, action.getValidatorRole())
                    || matchesActionAssignment(user, action.getValidatorDisplayName());
        }
        return isAdmin(user);
    }

    public boolean canRequestPhaseValidation(AppUser user, EcrRequest request) {
        return isRequestPilot(user, request);
    }

    public boolean isRequestPilot(AppUser user, EcrRequest request) {
        if (user == null || request == null) {
            return false;
        }
        String pilot = normalize(request.getPilot());
        return !pilot.isEmpty() && matchesUser(user, pilot);
    }

    public boolean canSeeAllActions(AppUser user, EcrRequest request) {
        return isAdmin(user);
    }

    public boolean canViewAction(AppUser user, EcrAction action) {
        if (canSeeAllActions(user, action == null ? null : action.getRequest())) {
            return true;
        }
        if (action != null && action.getRequest() != null && isRequestPilot(user, action.getRequest())
                && action.getStage() == action.getRequest().getCurrentStage()) {
            return true;
        }
        return isActionParticipant(user, action);
    }

    public boolean wasPhaseValidationRequestedByPilot(PhaseValidationRequest validation) {
        if (validation == null || validation.getRequest() == null) {
            return false;
        }
        String pilot = normalize(validation.getRequest().getPilot());
        String requestedBy = normalize(validation.getRequestedBy());
        if (pilot.isEmpty() || requestedBy.isEmpty()) {
            return false;
        }
        if (pilot.equals(requestedBy)) {
            return true;
        }
        return userRepository.findAll().stream()
                .filter(AppUser::isEnabled)
                .filter(user -> matchesUser(user, pilot))
                .anyMatch(user -> normalize(displayName(user)).equals(requestedBy));
    }

    public boolean canManageAction(AppUser user, EcrAction action) {
        if (isAdmin(user)) {
            return true;
        }
        if (user == null || action == null) {
            return false;
        }
        String responsible = normalize(action.getResponsible());
        if (responsible.isEmpty()) {
            return canAccessRequest(user, action.getRequest());
        }
        return matchesUser(user, responsible) || normalize(user.getJobTitle()).equals(responsible) || normalize(user.getRole()).equals(responsible);
    }

    public boolean canCompleteAction(AppUser user, EcrAction action) {
        if (user == null || action == null) {
            return false;
        }
        return matchesActionAssignment(user, action.getResponsible());
    }

    public boolean isActionParticipant(AppUser user, EcrAction action) {
        if (user == null || action == null) {
            return false;
        }
        return matchesActionAssignment(user, action.getResponsible())
                || matchesActionAssignment(user, action.getValidator())
                || matchesActionAssignment(user, action.getValidatorRole())
                || matchesActionAssignment(user, action.getValidatorDisplayName());
    }

    public List<AppUser> validatorsAndManagersFor(EcrRequest request) {
        Set<String> team = projectTeamTokens(request);
        if (team.isEmpty()) {
            return Collections.emptyList();
        }
        return userRepository.findAll().stream()
                .filter(user -> user.isEnabled() && isValidatorOrManager(user))
                .filter(user -> team.stream().anyMatch(token -> matchesUser(user, token)))
                .collect(Collectors.toList());
    }

    public Optional<AppUser> validationRecipientFor(EcrAction action) {
        if (action == null || action.getRequest() == null) {
            return Optional.empty();
        }
        String validator = firstNonBlank(action.getValidator(), action.getValidatorRole(), action.getValidatorDisplayName());
        if (isUndefinedValidator(validator)) {
            return defaultAdminFor(action.getRequest());
        }
        if (!validator.isEmpty()) {
            return userRepository.findAll().stream()
                    .filter(AppUser::isEnabled)
                    .filter(user -> matchesActionAssignment(user, validator))
                    .findFirst();
        }
        return defaultAdminFor(action.getRequest());
    }

    private Optional<AppUser> defaultAdminFor(EcrRequest request) {
        Set<String> team = projectTeamTokens(request);
        Optional<AppUser> teamAdmin = userRepository.findAll().stream()
                .filter(AppUser::isEnabled)
                .filter(user -> hasApplicationRole(user, UserRole.ADMIN))
                .filter(user -> team.stream().anyMatch(token -> matchesUser(user, token)))
                .findFirst();
        if (teamAdmin.isPresent()) {
            return teamAdmin;
        }
        return userRepository.findAll().stream()
                .filter(AppUser::isEnabled)
                .filter(user -> hasApplicationRole(user, UserRole.ADMIN))
                .findFirst();
    }

    private boolean isUndefinedValidator(String value) {
        String token = normalize(value);
        return token.equals("validateur a definir") || token.equals("a definir");
    }

    public Optional<AppUser> projectLeadFor(EcrRequest request) {
        if (request == null) {
            return Optional.empty();
        }
        String pilot = normalize(request.getPilot());
        if (!pilot.isEmpty()) {
            Optional<AppUser> pilotUser = userRepository.findAll().stream()
                    .filter(AppUser::isEnabled)
                    .filter(user -> matchesUser(user, pilot))
                    .findFirst();
            if (pilotUser.isPresent()) {
                return pilotUser;
            }
        }
        Set<String> team = projectTeamTokens(request);
        return userRepository.findAll().stream()
                .filter(user -> user.isEnabled() && hasApplicationRole(user, UserRole.CHEF_DE_PROJET))
                .filter(user -> team.stream().anyMatch(token -> matchesUser(user, token)))
                .findFirst();
    }

    private boolean hasApplicationRole(AppUser user, UserRole role) {
        if (user == null || role == null) {
            return false;
        }
        String value = normalize(user.getRole());
        return value.equals(normalize(role.name())) || value.equals(normalize(roleLabel(role)));
    }

    private String roleLabel(UserRole role) {
        if (role == UserRole.ADMIN) return "Admin";
        if (role == UserRole.CHEF_DE_PROJET) return "Chef de projet";
        if (role == UserRole.VALIDATEUR) return "Validateur";
        if (role == UserRole.MANAGER) return "Manager";
        return role.name();
    }

    private Set<String> projectTeamTokens(EcrRequest request) {
        if (request == null || request.getModificationProject() == null) {
            return Collections.emptySet();
        }
        return projectRepository.findById(request.getModificationProject())
                .map(project -> parseTeam(project.getProjectTeam()))
                .orElseGet(Collections::emptySet);
    }

    private Set<String> parseTeam(String projectTeam) {
        return Arrays.stream(String.valueOf(projectTeam == null ? "" : projectTeam).split("[,;\\n]"))
                .map(this::normalize)
                .filter(value -> !value.isEmpty())
                .collect(Collectors.toSet());
    }

    private boolean matchesUser(AppUser user, String token) {
        return normalize(user.getFullName()).equals(token)
                || normalize(user.getUsername()).equals(token)
                || normalize(user.getEmail()).equals(token);
    }

    private boolean matchesActionAssignment(AppUser user, String assignment) {
        String token = normalize(assignment);
        if (token.isEmpty()) {
            return false;
        }
        return matchesUser(user, token)
                || normalize(user.getJobTitle()).equals(token)
                || normalize(user.getRole()).equals(token);
    }

    private boolean isProjectTeamMember(AppUser user, EcrRequest request) {
        Set<String> team = projectTeamTokens(request);
        return !team.isEmpty() && team.stream().anyMatch(token -> matchesUser(user, token));
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            String normalized = normalize(value);
            if (!normalized.isEmpty()) {
                return normalized;
            }
        }
        return "";
    }

    private String displayName(AppUser user) {
        return user == null || user.getFullName() == null || user.getFullName().trim().isEmpty() ? user == null ? "" : user.getEmail() : user.getFullName();
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        String ascii = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return ascii.trim().toLowerCase(Locale.ROOT).replace("_", " ");
    }
}

