package com.gestionplanning.ecr;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PhaseSoundAlertRepository extends JpaRepository<PhaseSoundAlert, Long> {
    List<PhaseSoundAlert> findByRecipientEmailAndSoundAcknowledgedAtIsNullOrderByCreatedAtAscIdAsc(String recipientEmail);
}
