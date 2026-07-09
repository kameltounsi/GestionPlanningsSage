package com.gestionplanning.messaging;

import com.gestionplanning.user.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.Optional;

public interface ChatGroupReadStateRepository extends JpaRepository<ChatGroupReadState, Long> {
    Optional<ChatGroupReadState> findByGroupAndUser(ChatGroup group, AppUser user);
    void deleteByUser(AppUser user);
    void deleteByGroup_IdIn(Collection<Long> groupIds);
}
