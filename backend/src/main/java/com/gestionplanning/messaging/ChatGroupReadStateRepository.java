package com.gestionplanning.messaging;

import com.gestionplanning.user.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ChatGroupReadStateRepository extends JpaRepository<ChatGroupReadState, Long> {
    Optional<ChatGroupReadState> findByGroupAndUser(ChatGroup group, AppUser user);
}
