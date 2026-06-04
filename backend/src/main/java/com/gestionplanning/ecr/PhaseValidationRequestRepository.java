package com.gestionplanning.ecr;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PhaseValidationRequestRepository extends JpaRepository<PhaseValidationRequest, Long> {
    List<PhaseValidationRequest> findByRequest_IdOrderByRequestedAtDescIdDesc(Long requestId);

    Optional<PhaseValidationRequest> findFirstByRequest_IdAndStageOrderByRequestedAtDescIdDesc(Long requestId, EcrStage stage);
}
