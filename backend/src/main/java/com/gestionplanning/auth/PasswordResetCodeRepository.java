package com.gestionplanning.auth;

import com.gestionplanning.user.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Optional;

public interface PasswordResetCodeRepository extends JpaRepository<PasswordResetCode, Long> {
    Optional<PasswordResetCode> findFirstByUserAndUsedFalseOrderByCreatedAtDescIdDesc(AppUser user);

    void deleteByExpiresAtBefore(LocalDateTime dateTime);
}
