package com.gestionplanning.ecr;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChecklistItemRepository extends JpaRepository<ChecklistItem, Long> {
    List<ChecklistItem> findByRequestIdAndStageOrderById(Long requestId, EcrStage stage);
}
