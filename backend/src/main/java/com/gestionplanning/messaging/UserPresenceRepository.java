package com.gestionplanning.messaging;

import com.gestionplanning.user.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserPresenceRepository extends JpaRepository<UserPresence, Long> {
    Optional<UserPresence> findByUser(AppUser user);
    Optional<UserPresence> findByUser_Id(Long userId);
    void deleteByUser(AppUser user);
}
