package com.gestionplanning.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Optional;

public interface AuthTokenRepository extends JpaRepository<AuthToken, Long> {
    Optional<AuthToken> findByTokenAndExpiresAtAfter(String token, LocalDateTime now);

    void deleteByToken(String token);

    void deleteByExpiresAtBefore(LocalDateTime now);
}
