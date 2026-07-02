package com.gestionplanning.auth;

import com.gestionplanning.user.AppUser;
import com.gestionplanning.user.AccountMailService;
import com.gestionplanning.user.AppUserDto;
import com.gestionplanning.user.AppUserRepository;
import com.gestionplanning.user.MailDeliveryException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Base64;
import java.util.Locale;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final Logger LOGGER = LoggerFactory.getLogger(AuthController.class);
    private static final int TOKEN_BYTES = 48;
    private static final int RESET_CODE_BOUND = 10000;
    private final AppUserRepository userRepository;
    private final AuthTokenRepository tokenRepository;
    private final PasswordResetCodeRepository resetCodeRepository;
    private final PasswordService passwordService;
    private final AccountMailService accountMailService;
    private final AuthenticatedUserService authenticatedUserService;
    private final SecureRandom secureRandom = new SecureRandom();

    public AuthController(AppUserRepository userRepository, AuthTokenRepository tokenRepository,
                          PasswordResetCodeRepository resetCodeRepository, PasswordService passwordService,
                          AccountMailService accountMailService, AuthenticatedUserService authenticatedUserService) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.resetCodeRepository = resetCodeRepository;
        this.passwordService = passwordService;
        this.accountMailService = accountMailService;
        this.authenticatedUserService = authenticatedUserService;
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
                    AuthToken authToken = new AuthToken();
                    authToken.setUser(user);
                    authToken.setToken(generateToken());
                    authToken.setExpiresAt(LocalDateTime.now(ZoneId.systemDefault()).plusHours(12));
                    AuthToken savedToken = tokenRepository.save(authToken);
                    return ResponseEntity.ok(new AuthResponse(savedToken.getToken(), savedToken.getExpiresAt(), toDto(user)));
                })
                .orElse(ResponseEntity.status(401).build());
    }

    @GetMapping("/me")
    public ResponseEntity<AppUserDto> currentUser(@RequestAttribute(value = "authenticatedUserId", required = false) Long userId) {
        return authenticatedUserService.find(userId)
                .map(user -> ResponseEntity.ok(toDto(user)))
                .orElseGet(() -> ResponseEntity.status(401).build());
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

    @PostMapping("/password-reset/request")
    @Transactional
    public ResponseEntity<PasswordResetRequestResponse> requestPasswordReset(@RequestBody PasswordResetRequest request) {
        if (request == null || isBlank(request.getEmail())) {
            return ResponseEntity.badRequest().build();
        }
        resetCodeRepository.deleteByExpiresAtBefore(LocalDateTime.now(ZoneId.systemDefault()));
        return userRepository.findByEmail(request.getEmail().trim().toLowerCase(Locale.ROOT))
                .filter(AppUser::isEnabled)
                .map(user -> {
                    PasswordResetCode resetCode = new PasswordResetCode();
                    resetCode.setUser(user);
                    resetCode.setCode(generateResetCode());
                    resetCode.setExpiresAt(LocalDateTime.now(ZoneId.systemDefault()).plusMinutes(10));
                    PasswordResetCode saved = resetCodeRepository.save(resetCode);
                    try {
                        accountMailService.sendPasswordResetCodeEmail(user, saved.getCode());
                        return ResponseEntity.ok(new PasswordResetRequestResponse(true, "Code envoyé par email."));
                    } catch (MailDeliveryException exception) {
                        LOGGER.error("Password reset code generated but email delivery failed for {}", user.getEmail(), exception);
                        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                                .body(new PasswordResetRequestResponse(false, "Code généré, mais l'envoi email a échoué. Vérifiez la configuration SMTP."));
                    }
                })
                .orElseGet(() -> ResponseEntity.ok(new PasswordResetRequestResponse(true, "Si ce compte existe, un code sera envoyé par email.")));
    }

    @PostMapping("/password-reset/verify")
    public ResponseEntity<Void> verifyPasswordResetCode(@RequestBody PasswordResetVerifyRequest request) {
        if (!isValidResetRequest(request)) {
            return ResponseEntity.badRequest().build();
        }
        return userRepository.findByEmail(request.getEmail().trim().toLowerCase(Locale.ROOT))
                .filter(AppUser::isEnabled)
                .flatMap(resetCodeRepository::findFirstByUserAndUsedFalseOrderByCreatedAtDescIdDesc)
                .filter(resetCode -> isValidResetCode(resetCode, request.getCode()))
                .map(resetCode -> ResponseEntity.noContent().<Void>build())
                .orElse(ResponseEntity.status(403).build());
    }

    @PostMapping("/password-reset/confirm")
    @Transactional
    public ResponseEntity<Void> confirmPasswordReset(@RequestBody PasswordResetConfirmRequest request) {
        if (!isValidResetRequest(request) || isBlank(request.getPassword())) {
            return ResponseEntity.badRequest().build();
        }
        return userRepository.findByEmail(request.getEmail().trim().toLowerCase(Locale.ROOT))
                .filter(AppUser::isEnabled)
                .flatMap(user -> resetCodeRepository.findFirstByUserAndUsedFalseOrderByCreatedAtDescIdDesc(user)
                        .filter(resetCode -> isValidResetCode(resetCode, request.getCode()))
                        .map(resetCode -> {
                            user.setPassword(passwordService.encode(request.getPassword()));
                            userRepository.save(user);
                            resetCode.setUsed(true);
                            resetCode.setUsedAt(LocalDateTime.now(ZoneId.systemDefault()));
                            resetCodeRepository.save(resetCode);
                            tokenRepository.deleteByUser(user);
                            return ResponseEntity.noContent().<Void>build();
                        }))
                .orElse(ResponseEntity.status(403).build());
    }

    private String generateToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String generateResetCode() {
        return String.format("%04d", secureRandom.nextInt(RESET_CODE_BOUND));
    }

    private String bearerToken(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return null;
        }
        return authorization.substring("Bearer ".length()).trim();
    }

    private boolean isValidResetRequest(PasswordResetVerifyRequest request) {
        return request != null && !isBlank(request.getEmail()) && request.getCode() != null && request.getCode().matches("\\d{4}");
    }

    private boolean isValidResetCode(PasswordResetCode resetCode, String code) {
        return resetCode != null
                && !resetCode.isUsed()
                && resetCode.getExpiresAt() != null
                && resetCode.getExpiresAt().isAfter(LocalDateTime.now(ZoneId.systemDefault()))
                && resetCode.getCode().equals(code);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private AppUserDto toDto(AppUser user) {
        AppUserDto dto = new AppUserDto();
        dto.setId(user.getId());
        dto.setFullName(user.getFullName());
        dto.setUsername(user.getUsername());
        dto.setJobTitle(user.getJobTitle());
        dto.setEmail(user.getEmail());
        dto.setPhone(user.getPhone());
        dto.setChef1(user.getChef1());
        dto.setChef2(user.getChef2());
        dto.setProfilePhotoFileName(user.getProfilePhotoFileName());
        dto.setProfilePhotoContentType(user.getProfilePhotoContentType());
        dto.setProfilePhotoFileSize(user.getProfilePhotoFileSize());
        dto.setProfilePhotoUrl(user.getProfilePhotoUrl());
        dto.setRole(user.getRole());
        dto.setEnabled(user.isEnabled());
        dto.setCreatedAt(user.getCreatedAt());
        dto.setUpdatedAt(user.getUpdatedAt());
        return dto;
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

    public static class PasswordResetRequest {
        private String email;

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }
    }

    public static class PasswordResetRequestResponse {
        private final boolean sent;
        private final String message;

        public PasswordResetRequestResponse(boolean sent, String message) {
            this.sent = sent;
            this.message = message;
        }

        public boolean isSent() {
            return sent;
        }

        public String getMessage() {
            return message;
        }
    }

    public static class PasswordResetVerifyRequest {
        private String email;
        private String code;

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }

        public String getCode() {
            return code;
        }

        public void setCode(String code) {
            this.code = code;
        }
    }

    public static class PasswordResetConfirmRequest extends PasswordResetVerifyRequest {
        private String password;

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
        private final AppUserDto user;

        public AuthResponse(String token, LocalDateTime expiresAt, AppUserDto user) {
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

        public AppUserDto getUser() {
            return user;
        }
    }
}
