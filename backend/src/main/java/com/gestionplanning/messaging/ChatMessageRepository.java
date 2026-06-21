package com.gestionplanning.messaging;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    @Query("select m from ChatMessage m where (m.sender.id = ?1 and m.recipient.id = ?2) or (m.sender.id = ?2 and m.recipient.id = ?1) order by m.createdAt asc, m.id asc")
    List<ChatMessage> conversation(Long firstUserId, Long secondUserId);

    @Query("select m from ChatMessage m where m.group is null and (m.sender.id = ?1 or m.recipient.id = ?1) order by m.createdAt desc, m.id desc")
    List<ChatMessage> recentDirectForUser(Long userId);

    @Query("select m from ChatMessage m where m.group.id = ?1 order by m.createdAt asc, m.id asc")
    List<ChatMessage> groupConversation(Long groupId);

    @Query("select m from ChatMessage m where m.group.id = ?1 order by m.createdAt desc, m.id desc")
    List<ChatMessage> recentForGroup(Long groupId);

    Optional<ChatMessage> findByIdAndAttachmentUrlIsNotNull(Long id);
}
