package com.gestionplanning.user;

import com.gestionplanning.auth.AccessControlService;
import com.gestionplanning.auth.AuthTokenRepository;
import com.gestionplanning.auth.PasswordService;
import com.gestionplanning.auth.PasswordResetCodeRepository;
import com.gestionplanning.messaging.ChatGroup;
import com.gestionplanning.messaging.ChatGroupReadStateRepository;
import com.gestionplanning.messaging.ChatGroupRepository;
import com.gestionplanning.messaging.ChatMessageRepository;
import com.gestionplanning.messaging.UserPresenceRepository;
import com.gestionplanning.project.ProjectReference;
import com.gestionplanning.project.ProjectReferenceRepository;
import com.gestionplanning.storage.CloudinaryStorageService;
import com.gestionplanning.storage.StoredAsset;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.validation.Valid;
import java.net.URI;
import java.text.Normalizer;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
public class AppUserController {
    private final AppUserRepository userRepository;
    private final AppUserMapper userMapper;
    private final CloudinaryStorageService storageService;
    private final PasswordService passwordService;
    private final AccountMailService accountMailService;
    private final AccessControlService accessControlService;
    private final AuthTokenRepository authTokenRepository;
    private final PasswordResetCodeRepository passwordResetCodeRepository;
    private final UserPresenceRepository presenceRepository;
    private final ChatGroupRepository chatGroupRepository;
    private final ChatGroupReadStateRepository chatGroupReadStateRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final ProjectReferenceRepository projectRepository;

    public AppUserController(AppUserRepository userRepository, AppUserMapper userMapper, CloudinaryStorageService storageService, PasswordService passwordService,
                             AccountMailService accountMailService, AccessControlService accessControlService,
                             AuthTokenRepository authTokenRepository, PasswordResetCodeRepository passwordResetCodeRepository,
                             UserPresenceRepository presenceRepository, ChatGroupRepository chatGroupRepository,
                             ChatGroupReadStateRepository chatGroupReadStateRepository, ChatMessageRepository chatMessageRepository,
                             ProjectReferenceRepository projectRepository) {
        this.userRepository = userRepository;
        this.userMapper = userMapper;
        this.storageService = storageService;
        this.passwordService = passwordService;
        this.accountMailService = accountMailService;
        this.accessControlService = accessControlService;
        this.authTokenRepository = authTokenRepository;
        this.passwordResetCodeRepository = passwordResetCodeRepository;
        this.presenceRepository = presenceRepository;
        this.chatGroupRepository = chatGroupRepository;
        this.chatGroupReadStateRepository = chatGroupReadStateRepository;
        this.chatMessageRepository = chatMessageRepository;
        this.projectRepository = projectRepository;
    }

    @GetMapping
    public List<AppUserDto> list() {
        return userRepository.findAll().stream()
                .map(userMapper::toDto)
                .collect(Collectors.toList());
    }

    @PostMapping
    @Transactional
    public ResponseEntity<Object> create(@Valid @RequestBody AppUserDto userDto) {
        AppUser user = userMapper.toEntity(userDto);
        normalize(user);
        String validationError = validateUser(user, null);
        if (validationError != null) {
            return userValidationError(validationError);
        }
        String initialPassword = user.getPassword();
        user.setPassword(passwordService.encode(user.getPassword()));
        AppUser saved = userRepository.save(user);
        accountMailService.sendAccountCreatedEmail(saved, initialPassword);
        return ResponseEntity.created(URI.create("/api/users/" + saved.getId())).body(userMapper.toDto(saved));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Object> update(@PathVariable Long id, @RequestBody AppUserDto updatedUserDto,
                                             @RequestAttribute("authenticatedUser") Object authenticatedUserAttribute) {
                                                 AppUser authenticatedUser = (AppUser) authenticatedUserAttribute;
        AppUser updatedUser = userMapper.toEntity(updatedUserDto);
        return userRepository.findById(id)
                .map(user -> {
                    normalize(updatedUser);
                    String validationError = validateUser(updatedUser, id);
                    if (validationError != null) {
                        return userValidationError(validationError);
                    }
                    if (hasRequestedPassword(updatedUser) && !canChangePassword(authenticatedUser, id)) {
                        return ResponseEntity.status(403).<Object>build();
                    }
                    userMapper.copyAccountFields(updatedUser, user);
                    if (hasRequestedPassword(updatedUser)) {
                        user.setPassword(passwordService.encode(updatedUser.getPassword()));
                    }
                    return ResponseEntity.ok((Object) userMapper.toDto(userRepository.save(user)));
                })
                .orElse(ResponseEntity.status(404).<Object>build());
    }

    @GetMapping("/me")
    public ResponseEntity<AppUserDto> currentUser(@RequestAttribute(value = "authenticatedUser", required = false) Object userAttribute) {
        AppUser user = (AppUser) userAttribute;
        return user == null ? ResponseEntity.status(401).build() : ResponseEntity.ok(userMapper.toDto(user));
    }

    @PutMapping("/{id}/profile")
    public ResponseEntity<AppUserDto> updateProfile(@PathVariable Long id, @RequestBody AppUserDto updatedUserDto,
                                                    @RequestAttribute("authenticatedUser") Object authenticatedUserAttribute) {
                                                        AppUser authenticatedUser = (AppUser) authenticatedUserAttribute;
        AppUser updatedUser = userMapper.toEntity(updatedUserDto);
        if (!canUpdateProfile(authenticatedUser, id)) {
            return ResponseEntity.status(403).build();
        }
        return userRepository.findById(id)
                .map(user -> {
                    updatedUser.setUsername(updatedUser.getUsername() == null ? user.getUsername() : normalizedText(updatedUser.getUsername()));
                    updatedUser.setEmail(updatedUser.getEmail() == null ? user.getEmail() : normalizedText(updatedUser.getEmail()));
                    updatedUser.setPhone(updatedUser.getPhone() == null ? user.getPhone() : updatedUser.getPhone().trim());
                    if (invalidPhone(updatedUser.getPhone()) || hasDuplicateUsername(id, updatedUser.getUsername()) || hasDuplicateEmail(id, updatedUser.getEmail()) || hasDuplicatePhone(id, updatedUser.getPhone())) {
                        return ResponseEntity.badRequest().<AppUserDto>build();
                    }
                    user.setFullName(requiredOrExisting(updatedUser.getFullName(), user.getFullName()));
                    user.setUsername(updatedUser.getUsername());
                    user.setJobTitle(updatedUser.getJobTitle());
                    user.setEmail(updatedUser.getEmail());
                    user.setPhone(updatedUser.getPhone());
                    return ResponseEntity.ok(userMapper.toDto(userRepository.save(user)));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/password")
    public ResponseEntity<AppUserDto> changePassword(@PathVariable Long id, @RequestBody PasswordChangeRequest request,
                                                     @RequestAttribute("authenticatedUser") Object authenticatedUserAttribute) {
                                                         AppUser authenticatedUser = (AppUser) authenticatedUserAttribute;
        if (!canChangePassword(authenticatedUser, id)) {
            return ResponseEntity.status(403).build();
        }
        if (request == null || request.getPassword() == null || request.getPassword().trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return userRepository.findById(id)
                .map(user -> {
                    user.setPassword(passwordService.encode(request.getPassword()));
                    return ResponseEntity.ok(userMapper.toDto(userRepository.save(user)));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/photo")
    public ResponseEntity<AppUserDto> uploadPhoto(@PathVariable Long id, @RequestParam("file") MultipartFile file,
                                                  @RequestAttribute("authenticatedUser") Object authenticatedUserAttribute) {
                                                      AppUser authenticatedUser = (AppUser) authenticatedUserAttribute;
        if (!canUpdateProfile(authenticatedUser, id)) {
            return ResponseEntity.status(403).build();
        }
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return userRepository.findById(id)
                .map(user -> {
                    if (user.getProfilePhotoPublicId() != null) {
                        storageService.deleteQuietly(user.getProfilePhotoPublicId(), user.getProfilePhotoResourceType());
                    }
                    StoredAsset asset = storageService.upload(file, "gestion-planning/users/" + id);
                    user.setProfilePhotoFileName(asset.getFileName());
                    user.setProfilePhotoContentType(asset.getContentType());
                    user.setProfilePhotoFileSize(asset.getSize());
                    user.setProfilePhotoUrl(asset.getUrl());
                    user.setProfilePhotoPublicId(asset.getPublicId());
                    user.setProfilePhotoResourceType(asset.getResourceType());
                    return ResponseEntity.ok(userMapper.toDto(userRepository.save(user)));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id,
                                       @RequestAttribute("authenticatedUser") Object authenticatedUserAttribute) {
        AppUser authenticatedUser = (AppUser) authenticatedUserAttribute;
        if (!accessControlService.isAdmin(authenticatedUser)) {
            return ResponseEntity.status(403).build();
        }
        if (authenticatedUser != null && authenticatedUser.getId() != null && authenticatedUser.getId().equals(id)) {
            return ResponseEntity.status(403).build();
        }
        return userRepository.findById(id)
                .map(user -> {
                    deleteUserDependencies(user, authenticatedUser);
                    storageService.deleteQuietly(user.getProfilePhotoPublicId(), user.getProfilePhotoResourceType());
                    userRepository.delete(user);
                    return ResponseEntity.noContent().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    private void deleteUserDependencies(AppUser user, AppUser authenticatedUser) {
        removeUserFromProjectTeams(user);
        authTokenRepository.deleteByUser(user);
        passwordResetCodeRepository.deleteByUser(user);
        presenceRepository.deleteByUser(user);
        chatGroupReadStateRepository.deleteByUser(user);
        chatMessageRepository.deleteBySenderOrRecipient(user, user);

        chatGroupRepository.findForUser(user.getId()).stream()
                .forEach(group -> {
                    group.getMembers().removeIf(member -> isSameUser(member, user));
                    chatGroupRepository.save(group);
                });

        List<ChatGroup> createdGroups = chatGroupRepository.findByCreatedBy(user);
        if (createdGroups.isEmpty()) {
            return;
        }
        createdGroups.forEach(group -> group.setCreatedBy(authenticatedUser));
        chatGroupRepository.saveAll(createdGroups);
    }

    private void removeUserFromProjectTeams(AppUser user) {
        Set<String> identities = userIdentities(user);
        if (identities.isEmpty()) {
            return;
        }
        List<ProjectReference> projectsToUpdate = projectRepository.findAll().stream()
                .filter(project -> removeUserFromProjectTeam(project, identities))
                .collect(Collectors.toList());
        if (!projectsToUpdate.isEmpty()) {
            projectRepository.saveAll(projectsToUpdate);
        }
    }

    private boolean removeUserFromProjectTeam(ProjectReference project, Set<String> userIdentities) {
        if (project == null || project.getProjectTeam() == null || project.getProjectTeam().trim().isEmpty()) {
            return false;
        }
        List<String> remainingEntries = Arrays.stream(project.getProjectTeam().split("[;\\n]"))
                .map(String::trim)
                .filter(entry -> !entry.isEmpty())
                .flatMap(entry -> entry.contains("::") ? Arrays.stream(new String[]{entry}) : Arrays.stream(entry.split(",")))
                .map(String::trim)
                .filter(entry -> !entry.isEmpty())
                .filter(entry -> !projectTeamEntryMatchesUser(entry, userIdentities))
                .collect(Collectors.toList());
        String updatedProjectTeam = String.join("; ", remainingEntries);
        if (updatedProjectTeam.equals(project.getProjectTeam())) {
            return false;
        }
        project.setProjectTeam(updatedProjectTeam.isEmpty() ? null : updatedProjectTeam);
        return true;
    }

    private boolean projectTeamEntryMatchesUser(String entry, Set<String> userIdentities) {
        String[] parts = entry.split("::", 2);
        return userIdentities.contains(normalizeIdentity(parts[0]));
    }

    private Set<String> userIdentities(AppUser user) {
        return Arrays.asList(user.getFullName(), user.getUsername(), user.getEmail())
                .stream()
                .map(this::normalizeIdentity)
                .filter(value -> !value.isEmpty())
                .collect(Collectors.toSet());
    }

    private String normalizeIdentity(String value) {
        String text = Normalizer.normalize(String.valueOf(value == null ? "" : value), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return text.trim().toLowerCase(Locale.ROOT).replace('_', ' ');
    }

    private boolean isSameUser(AppUser first, AppUser second) {
        return first != null && second != null && first.getId() != null && first.getId().equals(second.getId());
    }

    private void normalize(AppUser user) {
        user.setUsername(normalizedText(user.getUsername()));
        user.setEmail(normalizedText(user.getEmail()));
        user.setMatricule(normalizedOptionalDigits(user.getMatricule()));
        user.setPhone(user.getPhone() == null ? null : user.getPhone().trim());
        user.setChef1(normalizedText(user.getChef1()));
        user.setChef2(normalizedText(user.getChef2()));
        user.setRole(user.getRole() == null || user.getRole().trim().isEmpty() ? UserRole.CHEF_DE_PROJET.name() : user.getRole().trim());
    }

    private String normalizedText(String value) {
        return value == null ? null : value.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizedOptionalDigits(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

    private String requiredOrExisting(String requestedValue, String existingValue) {
        return requestedValue == null || requestedValue.trim().isEmpty() ? existingValue : requestedValue.trim();
    }

    private boolean hasDuplicateUsername(Long id, String username) {
        return username != null && userRepository.findByUsername(username).map(user -> !user.getId().equals(id)).orElse(false);
    }

    private boolean hasDuplicateEmail(Long id, String email) {
        return email != null && userRepository.findByEmail(email).map(user -> !user.getId().equals(id)).orElse(false);
    }

    private boolean hasDuplicateMatricule(Long id, String matricule) {
        return matricule != null && userRepository.findByMatricule(matricule).map(user -> !user.getId().equals(id)).orElse(false);
    }

    private boolean hasDuplicatePhone(Long id, String phone) {
        return phone != null && userRepository.findByPhone(phone).map(user -> !user.getId().equals(id)).orElse(false);
    }

    private ResponseEntity<Object> userValidationError(String message) {
        return ResponseEntity.badRequest()
                .header("Content-Type", "text/plain; charset=UTF-8")
                .body(message);
    }

    private String validateUser(AppUser user, Long id) {
        if (user.getFullName() == null || user.getFullName().trim().isEmpty()) {
            return "Le nom complet est obligatoire.";
        }
        if (user.getUsername() == null || user.getUsername().trim().isEmpty()) {
            return "Le username est obligatoire.";
        }
        if (user.getEmail() == null || user.getEmail().trim().isEmpty()) {
            return "L'email est obligatoire.";
        }
        if (invalidPhone(user.getPhone())) {
            return "Le numero de telephone est invalide ou manquant.";
        }
        if (invalidMatricule(user.getMatricule())) {
            return "Le matricule doit contenir uniquement des chiffres.";
        }
        if (hasDuplicateUsername(id, user.getUsername())) {
            return "Ce username existe deja. Choisissez un autre username.";
        }
        if (hasDuplicateEmail(id, user.getEmail())) {
            return "Cet email existe deja. Choisissez une autre adresse email.";
        }
        if (hasDuplicateMatricule(id, user.getMatricule())) {
            return "Ce matricule existe deja. Choisissez un autre matricule.";
        }
        if (hasDuplicatePhone(id, user.getPhone())) {
            return "Ce numero de telephone existe deja. Choisissez un autre numero.";
        }
        if (invalidChefAssignment(user, id)) {
            return "Chef 1 ou Chef 2 est invalide. Selectionnez des chefs existants, ou le nouvel utilisateur lui-meme si necessaire.";
        }
        return null;
    }

    private boolean invalidPhone(String phone) {
        return phone == null || phone.trim().isEmpty() || !phone.trim().matches("\\+?[0-9\\s().-]{8,20}");
    }

    private boolean invalidMatricule(String matricule) {
        return matricule != null && !matricule.matches("\\d+");
    }

    private boolean invalidChefAssignment(AppUser user, Long userId) {
        return !validChefAssignment(user, user.getChef1(), userId) || !validChefAssignment(user, user.getChef2(), userId);
    }

    private boolean validChefAssignment(AppUser user, String chef, Long userId) {
        if (chef == null || chef.trim().isEmpty()) {
            return false;
        }
        String value = normalizedText(chef);
        if (matchesUserIdentity(user, value)) {
            return true;
        }
        return userRepository.findAll().stream()
                .filter(existing -> userId == null || !existing.getId().equals(userId))
                .anyMatch(existing -> matchesUserIdentity(existing, value));
    }

    private boolean matchesUserIdentity(AppUser user, String value) {
        if (user == null || value == null || value.trim().isEmpty()) {
            return false;
        }
        return value.equals(normalizedText(user.getUsername()))
                || value.equals(normalizedText(user.getEmail()))
                || value.equals(normalizedText(user.getFullName()));
    }

    private boolean canUpdateProfile(AppUser authenticatedUser, Long userId) {
        return authenticatedUser != null && (accessControlService.isAdmin(authenticatedUser) || authenticatedUser.getId().equals(userId));
    }

    private boolean canChangeOwnPassword(AppUser authenticatedUser, Long userId) {
        return authenticatedUser != null && authenticatedUser.getId().equals(userId);
    }

    private boolean canChangePassword(AppUser authenticatedUser, Long userId) {
        return authenticatedUser != null && (accessControlService.isAdmin(authenticatedUser) || canChangeOwnPassword(authenticatedUser, userId));
    }

    private boolean hasRequestedPassword(AppUser user) {
        return user != null && user.getPassword() != null && !user.getPassword().trim().isEmpty();
    }

    public static class PasswordChangeRequest {
        private String password;

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }
    }
}
