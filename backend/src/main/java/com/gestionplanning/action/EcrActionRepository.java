package com.gestionplanning.action;

import com.gestionplanning.ecr.EcrStage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface EcrActionRepository extends JpaRepository<EcrAction, Long> {
    List<EcrAction> findByRequest_IdOrderByDeadlineAscIdAsc(Long requestId);

    List<EcrAction> findByRequest_IdOrderByCreatedAtAscIdAsc(Long requestId);

    List<EcrAction> findByRequest_IdOrderByStartDateAscEndDateAscDeadlineAscCreatedAtAscIdAsc(Long requestId);

    List<EcrAction> findByRequest_IdAndStageOrderByDeadlineAscIdAsc(Long requestId, EcrStage stage);

    List<EcrAction> findByRequest_IdAndStageOrderByCreatedAtAscIdAsc(Long requestId, EcrStage stage);

    List<EcrAction> findByDeadlineBeforeAndStatusNotInOrderByDeadlineAsc(LocalDate date, List<ActionStatus> statuses);

    List<EcrAction> findByEndDateBetweenAndStatusNotInOrderByEndDateAscIdAsc(LocalDate startDate, LocalDate endDate, List<ActionStatus> statuses);

    List<EcrAction> findByDependsOnActionId(Long actionId);

    void deleteByRequest_Id(Long requestId);
}
