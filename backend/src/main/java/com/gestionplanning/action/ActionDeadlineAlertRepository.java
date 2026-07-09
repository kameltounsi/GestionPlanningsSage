package com.gestionplanning.action;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ActionDeadlineAlertRepository extends JpaRepository<ActionDeadlineAlert, Long> {
    Optional<ActionDeadlineAlert> findByAction_IdAndRecipientEmailAndAlertType(Long actionId, String recipientEmail, ActionDeadlineAlertType alertType);

    List<ActionDeadlineAlert> findByRecipientEmailAndSoundAcknowledgedAtIsNullOrderByCreatedAtAscIdAsc(String recipientEmail);

    void deleteByAction_Id(Long actionId);
}
