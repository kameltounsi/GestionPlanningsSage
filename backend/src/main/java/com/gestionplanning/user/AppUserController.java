package com.gestionplanning.user;

import com.gestionplanning.auth.PasswordService;
import com.gestionplanning.storage.CloudinaryStorageService;
import com.gestionplanning.storage.StoredAsset;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/users")
public class AppUserController {
    private final AppUserRepository userRepository;
    private final CloudinaryStorageService storageService;
    private final PasswordService passwordService;

    public AppUserController(AppUserRepository userRepository, CloudinaryStorageService storageService, PasswordService passwordService) {
        this.userRepository = userRepository;
        this.storageService = storageService;
        this.passwordService = passwordService;
    }

    @GetMapping
    public List<AppUser> list() {
        return userRepository.findAll();
    }

    @PostMapping
    public ResponseEntity<AppUser> create(@Valid @RequestBody AppUser user) {
        normalize(user);
        if (user.getUsername() == null || user.getUsername().trim().isEmpty() || userRepository.existsByUsername(user.getUsername()) || userRepository.existsByEmail(user.getEmail())) {
            return ResponseEntity.badRequest().build();
        }
        user.setPassword(passwordService.encode(user.getPassword()));
        AppUser saved = userRepository.save(user);
        return ResponseEntity.created(URI.create("/api/users/" + saved.getId())).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<AppUser> update(@PathVariable Long id, @RequestBody AppUser updatedUser) {
        return userRepository.findById(id)
                .map(user -> {
                    normalize(updatedUser);
                    if (updatedUser.getFullName() == null || updatedUser.getFullName().trim().isEmpty()
                            || updatedUser.getUsername() == null || updatedUser.getUsername().trim().isEmpty()
                            || updatedUser.getEmail() == null || updatedUser.getEmail().trim().isEmpty()
                            || hasDuplicateUsername(id, updatedUser.getUsername()) || hasDuplicateEmail(id, updatedUser.getEmail())) {
                        return ResponseEntity.badRequest().<AppUser>build();
                    }
                    user.setFullName(updatedUser.getFullName());
                    user.setUsername(updatedUser.getUsername());
                    user.setJobTitle(updatedUser.getJobTitle());
                    user.setEmail(updatedUser.getEmail());
                    if (updatedUser.getPassword() != null && !updatedUser.getPassword().trim().isEmpty()) {
                        user.setPassword(passwordService.encode(updatedUser.getPassword()));
                    }
                    user.setPhone(updatedUser.getPhone());
                    user.setRole(updatedUser.getRole());
                    user.setEnabled(updatedUser.isEnabled());
                    return ResponseEntity.ok(userRepository.save(user));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/me")
    public ResponseEntity<AppUser> currentUser(@RequestAttribute(value = "authenticatedUser", required = false) AppUser user) {
        return user == null ? ResponseEntity.status(401).build() : ResponseEntity.ok(user);
    }

    @PutMapping("/{id}/profile")
    public ResponseEntity<AppUser> updateProfile(@PathVariable Long id, @RequestBody AppUser updatedUser) {
        return userRepository.findById(id)
                .map(user -> {
                    updatedUser.setUsername(updatedUser.getUsername() == null ? user.getUsername() : normalizedText(updatedUser.getUsername()));
                    updatedUser.setEmail(updatedUser.getEmail() == null ? user.getEmail() : normalizedText(updatedUser.getEmail()));
                    if (hasDuplicateUsername(id, updatedUser.getUsername()) || hasDuplicateEmail(id, updatedUser.getEmail())) {
                        return ResponseEntity.badRequest().<AppUser>build();
                    }
                    user.setFullName(requiredOrExisting(updatedUser.getFullName(), user.getFullName()));
                    user.setUsername(updatedUser.getUsername());
                    user.setJobTitle(updatedUser.getJobTitle());
                    user.setEmail(updatedUser.getEmail());
                    user.setPhone(updatedUser.getPhone());
                    return ResponseEntity.ok(userRepository.save(user));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/password")
    public ResponseEntity<AppUser> changePassword(@PathVariable Long id, @RequestBody PasswordChangeRequest request) {
        if (request == null || request.getPassword() == null || request.getPassword().trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return userRepository.findById(id)
                .map(user -> {
                    user.setPassword(passwordService.encode(request.getPassword()));
                    return ResponseEntity.ok(userRepository.save(user));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/photo")
    public ResponseEntity<AppUser> uploadPhoto(@PathVariable Long id, @RequestParam("file") MultipartFile file) {
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
                    return ResponseEntity.ok(userRepository.save(user));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!userRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        userRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private void normalize(AppUser user) {
        user.setUsername(normalizedText(user.getUsername()));
        user.setEmail(normalizedText(user.getEmail()));
    }

    private String normalizedText(String value) {
        return value == null ? null : value.trim().toLowerCase(Locale.ROOT);
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
