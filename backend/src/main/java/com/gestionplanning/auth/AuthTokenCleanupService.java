package com.gestionplanning.auth;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;

@Service
public class AuthTokenCleanupService {
    private final AuthTokenRepository tokenRepository;
    private final PasswordResetCodeRepository resetCodeRepository;

    public AuthTokenCleanupService(AuthTokenRepository tokenRepository, PasswordResetCodeRepository resetCodeRepository) {
        this.tokenRepository = tokenRepository;
        this.resetCodeRepository = resetCodeRepository;
    }

    @Scheduled(fixedDelayString = "${app.auth.cleanup-delay-ms:3600000}", initialDelayString = "${app.auth.cleanup-initial-delay-ms:120000}")
    @Transactional
    public void cleanupExpiredCredentials() {
        LocalDateTime now = LocalDateTime.now(ZoneId.systemDefault());
        tokenRepository.deleteByExpiresAtBefore(now);
        resetCodeRepository.deleteByExpiresAtBefore(now);
    }
}
