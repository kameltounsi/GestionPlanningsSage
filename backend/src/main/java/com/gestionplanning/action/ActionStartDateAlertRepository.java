package com.gestionplanning.action;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import javax.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ActionStartDateAlertRepository extends JpaRepository<ActionStartDateAlert, Long> {
    List<ActionStartDateAlert> findTop50ByMailSentAtIsNullAndMailAttemptedAtBeforeOrderByCreatedAtAsc(LocalDateTime cutoff);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from ActionStartDateAlert a where a.id = :id")
    Optional<ActionStartDateAlert> findLockedById(@Param("id") Long id);
}
