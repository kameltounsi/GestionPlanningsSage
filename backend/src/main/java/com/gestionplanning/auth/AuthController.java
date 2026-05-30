package com.gestionplanning.auth;

import com.gestionplanning.user.AppUser;
import com.gestionplanning.user.AppUserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Locale;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final int TOKEN_BYTES = 48;
    private final AppUserRepository userRepository;
    private final AuthTokenRepository tokenRepository;
    private final PasswordService passwordService;
    private final SecureRandom secureRandom = new SecureRandom();

    public AuthController(AppUserRepository userRepository, AuthTokenRepository tokenRepository, PasswordService passwordService) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.passwordService = passwordService;
    }

    @PostMapping("/login")
    @Transactional
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request) {
        if (request == null || request.getEmail() == null || request.getPassword() == null) {
            return ResponseEntity.badRequest().build();
        }
        return userRepository.findByEmail(request.getEmail().trim().toLowerCase(Locale.ROOT))
                .filter(AppUser::isEnabled)
                .filter(user -> passwordService.matches(request.getPassword(), user.getPassword()))
                .map(user -> {
                    if (!passwordService.isEncoded(user.getPassword())) {
                        user.setPassword(passwordService.encode(request.getPassword()));
                        userRepository.save(user);
                    }
                    tokenRepository.deleteByExpiresAtBefore(LocalDateTime.now());
                    AuthToken authToken = new AuthToken();
                    authToken.setUser(user);
                    authToken.setToken(generateToken());
                    authToken.setExpiresAt(LocalDateTime.now().plusHours(12));
                    AuthToken savedToken = tokenRepository.save(authToken);
                    return ResponseEntity.ok(new AuthResponse(savedToken.getToken(), savedToken.getExpiresAt(), user));
                })
                .orElse(ResponseEntity.status(401).build());
    }

    @GetMapping("/me")
    public ResponseEntity<AppUser> currentUser(@RequestAttribute(value = "authenticatedUser", required = false) AppUser user) {
        return user == null ? ResponseEntity.status(401).build() : ResponseEntity.ok(user);
    }

    @PostMapping("/logout")
    @Transactional
    public ResponseEntity<Void> logout(@RequestHeader(value = "Authorization", required = false) String authorization) {
        String token = bearerToken(authorization);
        if (token != null) {
            tokenRepository.deleteByToken(token);
        }
        return ResponseEntity.noContent().build();
    }

    private String generateToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String bearerToken(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return null;
        }
        return authorization.substring("Bearer ".length()).trim();
    }

    public static class LoginRequest {
        private String email;
        private String password;

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }
    }

    public static class AuthResponse {
        private final String token;
        private final LocalDateTime expiresAt;
        private final AppUser user;

        public AuthResponse(String token, LocalDateTime expiresAt, AppUser user) {
            this.token = token;
            this.expiresAt = expiresAt;
            this.user = user;
        }

        public String getToken() {
            return token;
        }

        public LocalDateTime getExpiresAt() {
            return expiresAt;
        }

        public AppUser getUser() {
            return user;
        }
    }
}
