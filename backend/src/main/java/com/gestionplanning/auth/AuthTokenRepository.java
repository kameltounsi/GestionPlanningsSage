package com.gestionplanning.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import com.gestionplanning.user.AppUser;

import java.time.LocalDateTime;
import java.util.Optional;

public interface AuthTokenRepository extends JpaRepository<AuthToken, Long> {
    Optional<AuthToken> findByTokenAndExpiresAtAfter(String token, LocalDateTime now);

    void deleteByToken(String token);

    void deleteByUser(AppUser user);

    void deleteByExpiresAtBefore(LocalDateTime now);
}
