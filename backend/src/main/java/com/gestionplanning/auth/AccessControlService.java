package com.gestionplanning.auth;

import com.gestionplanning.ecr.EcrRequest;
import com.gestionplanning.ecr.PhaseValidationRequest;
import com.gestionplanning.action.EcrAction;
import com.gestionplanning.action.EcrActionRepository;
import com.gestionplanning.project.ProjectReference;
import com.gestionplanning.project.ProjectReferenceRepository;
import com.gestionplanning.user.AppUser;
import com.gestionplanning.user.AppUserRepository;
import com.gestionplanning.user.UserRole;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AccessControlService {
    private static final String DEFAULT_ADMIN_USERNAME = "fchelbi";
    private static final String DEFAULT_ADMIN_EMAIL = "f.chalbi1@sagetunisia.com";

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
                || normalize(user.getUsername()).equals(DEFAULT_ADMIN_USERNAME)
                || normalize(user.getEmail()).equals(DEFAULT_ADMIN_EMAIL);
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
        if (isProjectLeadForRequest(user, request)) {
            return true;
        }
        if (isProjectTeamMemberForRequest(user, request)) {
            return true;
        }
        return isParticipantForRequest(user, request);
    }

    public List<EcrRequest> filterAccessibleRequests(AppUser user, List<EcrRequest> requests) {
        if (isAdmin(user) || requests == null || requests.isEmpty()) {
            return requests == null ? Collections.emptyList() : requests;
        }
        if (user == null) {
            return Collections.emptyList();
        }
        Set<Long> participantRequestIds = participantRequestIdsFor(user, requests);
        Set<String> projectLeadProjects = projectRepository.findAll().stream()
                .filter(project -> isProjectTeamMember(user, project))
                .map(ProjectReference::getName)
                .collect(Collectors.toSet());
        return requests.stream()
                .filter(request -> request != null && (
                        isRequestPilot(user, request)
                                || projectLeadProjects.contains(request.getModificationProject())
                                || participantRequestIds.contains(request.getId())
                ))
                .collect(Collectors.toList());
    }

    public List<EcrRequest> filterPersonalRequests(AppUser user, List<EcrRequest> requests) {
        if (isAdmin(user) || requests == null || requests.isEmpty()) {
            return requests == null ? Collections.emptyList() : requests;
        }
        if (user == null) {
            return Collections.emptyList();
        }
        Set<Long> participantRequestIds = participantRequestIdsFor(user, requests);
        Set<String> teamProjects = projectRepository.findAll().stream()
                .filter(project -> isProjectTeamMember(user, project))
                .map(ProjectReference::getName)
                .collect(Collectors.toSet());
        return requests.stream()
                .filter(request -> request != null && (
                        isRequestPilot(user, request)
                                || teamProjects.contains(request.getModificationProject())
                                || participantRequestIds.contains(request.getId())
                ))
                .collect(Collectors.toList());
    }

    public boolean canCreateRequest(AppUser user, EcrRequest request) {
        return isAdmin(user) || isProjectLeadForRequest(user, request);
    }

    public boolean canValidateRequest(AppUser user, EcrRequest request) {
        return isAdmin(user) || hasApplicationRole(user, UserRole.MANAGER) && canAccessRequest(user, request);
    }

    public boolean canValidateAction(AppUser user, EcrAction action) {
        if (user == null || action == null || action.getRequest() == null) {
            return false;
        }
        List<String> validators = Arrays.asList(action.getValidator(), action.getValidatorRole(), action.getValidatorDisplayName()).stream()
                .map(this::normalize)
                .filter(value -> !value.isEmpty() && !isUndefinedValidator(value))
                .collect(Collectors.toList());
        if (!validators.isEmpty()) {
            return validators.stream().anyMatch(value -> matchesRequestAssignment(user, action.getRequest(), value));
        }
        return isAdmin(user);
    }

    public boolean canRequestPhaseValidation(AppUser user, EcrRequest request) {
        return isRequestPilot(user, request) || isProjectLeadForRequest(user, request);
    }

    public boolean canCancelRequest(AppUser user) {
        return isAdmin(user);
    }

    public boolean isRequestPilot(AppUser user, EcrRequest request) {
        if (user == null || request == null) {
            return false;
        }
        return matchesRequestAssignment(user, request, request.getPilot());
    }

    public boolean canSeeAllActions(AppUser user, EcrRequest request) {
        return canAccessRequest(user, request);
    }

    public boolean canViewAction(AppUser user, EcrAction action) {
        if (canSeeAllActions(user, action == null ? null : action.getRequest())) {
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
        return matchesRequestAssignment(user, action.getRequest(), responsible);
    }

    public boolean canCompleteAction(AppUser user, EcrAction action) {
        if (user == null || action == null) {
            return false;
        }
        return matchesRequestAssignment(user, action.getRequest(), action.getResponsible());
    }

    public boolean isActionParticipant(AppUser user, EcrAction action) {
        if (user == null || action == null) {
            return false;
        }
        return matchesRequestAssignment(user, action.getRequest(), action.getResponsible())
                || matchesRequestAssignment(user, action.getRequest(), action.getValidator())
                || matchesRequestAssignment(user, action.getRequest(), action.getValidatorRole())
                || matchesRequestAssignment(user, action.getRequest(), action.getValidatorDisplayName());
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
                    .filter(user -> matchesRequestAssignment(user, action.getRequest(), validator))
                    .findFirst();
        }
        return defaultAdminFor(action.getRequest());
    }

    public Optional<AppUser> actionPilotFor(EcrAction action) {
        if (action == null) {
            return Optional.empty();
        }
        String responsible = firstNonBlank(action.getResponsible());
        if (responsible.isEmpty()) {
            return Optional.empty();
        }
        return userRepository.findAll().stream()
                .filter(AppUser::isEnabled)
                .filter(user -> matchesRequestAssignment(user, action.getRequest(), responsible))
                .findFirst();
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
                    .filter(user -> matchesActionAssignment(user, pilot))
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

    public List<AppUser> adminsFor() {
        return userRepository.findAll().stream()
                .filter(AppUser::isEnabled)
                .filter(user -> hasApplicationRole(user, UserRole.ADMIN))
                .collect(Collectors.toList());
    }

    public boolean canManageProjectTeam(AppUser user, ProjectReference project) {
        return isAdmin(user) || isProjectLeadForProject(user, project);
    }

    public boolean canManageFinishedProduct(AppUser user, String projectName) {
        if (isAdmin(user)) {
            return true;
        }
        if (user == null || projectName == null || projectName.trim().isEmpty()) {
            return false;
        }
        return projectRepository.findById(projectName)
                .map(project -> isProjectLeadForProject(user, project))
                .orElse(false);
    }

    public boolean isProjectLeadForProject(AppUser user, ProjectReference project) {
        if (user == null || project == null) {
            return false;
        }
        return parseTeamEntries(project.getProjectTeam()).stream()
                .anyMatch(entry -> matchesUser(user, entry.name)
                        && (entry.roles.isEmpty() && hasApplicationRole(user, UserRole.CHEF_DE_PROJET)
                        || entry.roles.stream().anyMatch(role -> role.equals(normalize(UserRole.CHEF_DE_PROJET.name())) || role.equals(normalize(roleLabel(UserRole.CHEF_DE_PROJET))))));
    }

    public boolean isProjectLeadForRequest(AppUser user, EcrRequest request) {
        if (user == null || request == null || request.getModificationProject() == null) {
            return false;
        }
        return projectRepository.findById(request.getModificationProject())
                .map(project -> isProjectLeadForProject(user, project))
                .orElse(false);
    }

    public boolean isProjectTeamMemberForRequest(AppUser user, EcrRequest request) {
        if (user == null || request == null || request.getModificationProject() == null) {
            return false;
        }
        return projectRepository.findById(request.getModificationProject())
                .map(project -> isProjectTeamMember(user, project))
                .orElse(false);
    }

    private boolean isProjectTeamMember(AppUser user, ProjectReference project) {
        return user != null && project != null && parseTeamEntries(project.getProjectTeam()).stream()
                .anyMatch(entry -> matchesUser(user, entry.name));
    }

    public boolean hasApplicationRole(AppUser user, UserRole role) {
        if (user == null || role == null) {
            return false;
        }
        Set<String> values = userRoleTokens(user);
        return values.contains(normalize(role.name())) || values.contains(normalize(roleLabel(role)));
    }

    private String roleLabel(UserRole role) {
        if (role == UserRole.ADMIN) return "Admin";
        if (role == UserRole.ENGINEERING_MANAGER) return "Engineering Manager";
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
        return parseTeamEntries(projectTeam).stream()
                .map(entry -> entry.name)
                .filter(value -> !value.isEmpty())
                .collect(Collectors.toSet());
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
                    String name = normalize(parts[0]);
                    Set<String> roles = parts.length > 1
                            ? Arrays.stream(parts[1].split("[,|]")).map(this::normalize).filter(role -> !role.isEmpty()).collect(Collectors.toSet())
                            : Collections.emptySet();
                    return new ProjectTeamEntry(name, roles);
                })
                .collect(Collectors.toList());
    }

    private Set<String> userRoleTokens(AppUser user) {
        return Arrays.stream(String.valueOf(user == null ? "" : user.getRole()).split("[,;|]"))
                .map(this::normalize)
                .filter(value -> !value.isEmpty())
                .collect(Collectors.toSet());
    }

    private Set<Long> participantRequestIdsFor(AppUser user, List<EcrRequest> requests) {
        if (user == null || requests == null || requests.isEmpty()) {
            return Collections.emptySet();
        }
        Set<Long> requestIds = requests.stream()
                .filter(request -> request != null && request.getId() != null)
                .map(EcrRequest::getId)
                .collect(Collectors.toSet());
        if (requestIds.isEmpty()) {
            return Collections.emptySet();
        }
        Set<Long> participantRequestIds = new HashSet<>();
        actionRepository.findByRequest_IdInOrderByRequest_IdAscStartDateAscEndDateAscDeadlineAscCreatedAtAscIdAsc(requestIds).stream()
                .filter(action -> isActionParticipant(user, action))
                .map(EcrAction::getRequestId)
                .filter(id -> id != null)
                .forEach(participantRequestIds::add);
        return participantRequestIds;
    }

    private boolean isParticipantForRequest(AppUser user, EcrRequest request) {
        if (user == null || request == null || request.getId() == null) {
            return false;
        }
        return actionRepository.findByRequest_IdOrderByStartDateAscEndDateAscDeadlineAscCreatedAtAscIdAsc(request.getId()).stream()
                .anyMatch(action -> isActionParticipant(user, action));
    }

    private static class ProjectTeamEntry {
        private final String name;
        private final Set<String> roles;

        private ProjectTeamEntry(String name, Set<String> roles) {
            this.name = name;
            this.roles = roles;
        }
    }

    private boolean matchesUser(AppUser user, String token) {
        return normalize(user.getFullName()).equals(token)
                || normalize(user.getUsername()).equals(token)
                || normalize(user.getEmail()).equals(token)
                || matchesPersonalIdentity(user, token);
    }

    private boolean matchesActionAssignment(AppUser user, String assignment) {
        String token = normalize(assignment);
        if (token.isEmpty()) {
            return false;
        }
        return matchesUser(user, token)
                || normalize(user.getJobTitle()).equals(token)
                || userRoleTokens(user).contains(token);
    }

    private boolean matchesRequestAssignment(AppUser user, EcrRequest request, String assignment) {
        String token = normalize(assignment);
        if (token.isEmpty()) {
            return false;
        }
        return matchesUser(user, token) || matchesProjectRoleAssignment(user, request, token);
    }

    private boolean matchesProjectRoleAssignment(AppUser user, EcrRequest request, String assignment) {
        String token = normalize(assignment);
        if (user == null || request == null || token.isEmpty()) {
            return false;
        }
        return projectRepository.findById(request.getModificationProject())
                .map(ProjectReference::getProjectTeam)
                .map(this::parseTeamEntries)
                .orElse(Collections.emptyList())
                .stream()
                .anyMatch(entry -> matchesUser(user, entry.name) && entry.roles.contains(token));
    }

    private boolean matchesPersonalIdentity(AppUser user, String token) {
        if (user == null || token == null || token.length() < 3) {
            return false;
        }
        return Arrays.asList(
                        normalize(user.getFullName()),
                        normalize(user.getUsername()),
                        normalize(user.getEmail()).split("@", 2)[0]
                ).stream()
                .filter(value -> !value.isEmpty())
                .anyMatch(value -> Arrays.asList(value.split("\\s+")).contains(token));
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
        if (user == null) {
            return "";
        }
        if (user.getFullName() == null || user.getFullName().trim().isEmpty()) {
            return user.getEmail();
        }
        return user.getFullName();
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        String ascii = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return ascii.trim().toLowerCase(Locale.ROOT).replace("_", " ");
    }
}
