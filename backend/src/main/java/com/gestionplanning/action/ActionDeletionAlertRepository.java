package com.gestionplanning.action;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import javax.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ActionDeletionAlertRepository extends JpaRepository<ActionDeletionAlert, Long> {
    List<ActionDeletionAlert> findTop50ByMailSentAtIsNullAndMailAttemptedAtBeforeOrderByCreatedAtAsc(LocalDateTime cutoff);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from ActionDeletionAlert a where a.id = :id")
    Optional<ActionDeletionAlert> findLockedById(@Param("id") Long id);
}
