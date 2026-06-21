package com.gestionplanning.messaging;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ChatGroupRepository extends JpaRepository<ChatGroup, Long> {
    @Query("select distinct g from ChatGroup g join g.members m where m.id = ?1 order by g.createdAt desc, g.id desc")
    List<ChatGroup> findForUser(Long userId);
}
