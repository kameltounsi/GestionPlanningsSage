package com.gestionplanning.action;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import javax.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ActionDurationAlertRepository extends JpaRepository<ActionDurationAlert, Long> {
    List<ActionDurationAlert> findByRecipientEmailAndAcknowledgedAtIsNullOrderByCreatedAtAscIdAsc(String email);
    List<ActionDurationAlert> findTop50ByMailSentAtIsNullAndMailAttemptedAtBeforeOrderByCreatedAtAsc(LocalDateTime cutoff);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from ActionDurationAlert a where a.id = :id")
    Optional<ActionDurationAlert> findLockedById(@Param("id") Long id);
}
