package com.gestionplanning.action;

import com.gestionplanning.ecr.EcrStage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface EcrActionRepository extends JpaRepository<EcrAction, Long> {
    List<EcrAction> findByRequest_IdOrderByDeadlineAscIdAsc(Long requestId);

    List<EcrAction> findByRequest_IdOrderByCreatedAtAscIdAsc(Long requestId);

    List<EcrAction> findByRequest_IdOrderByStartDateAscEndDateAscDeadlineAscCreatedAtAscIdAsc(Long requestId);

    List<EcrAction> findByRequest_IdAndStageOrderByDeadlineAscIdAsc(Long requestId, EcrStage stage);

    List<EcrAction> findByRequest_IdAndStageOrderByCreatedAtAscIdAsc(Long requestId, EcrStage stage);

    List<EcrAction> findByRequest_IdAndStageOrderByStartDateAscEndDateAscDeadlineAscCreatedAtAscIdAsc(Long requestId, EcrStage stage);

    boolean existsByRequest_Id(Long requestId);

    @Query("select count(action) > 0 from EcrAction action where action.request.id = :requestId and ("
            + "lower(action.responsible) in :tokens or lower(action.validator) in :tokens or lower(action.validatorRole) in :tokens"
            + ")")
    boolean existsParticipantForRequest(@Param("requestId") Long requestId, @Param("tokens") Collection<String> tokens);

    List<EcrAction> findByDeadlineBeforeAndStatusNotInOrderByDeadlineAsc(LocalDate date, List<ActionStatus> statuses);

    List<EcrAction> findByEndDateBetweenAndStatusNotInOrderByEndDateAscIdAsc(LocalDate startDate, LocalDate endDate, List<ActionStatus> statuses);

    List<EcrAction> findByDependsOnActionId(Long actionId);

    void deleteByRequest_Id(Long requestId);
}
