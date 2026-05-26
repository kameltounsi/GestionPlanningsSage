package com.gestionplanning.action;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ActionPlanningRuleRepository extends JpaRepository<ActionPlanningRule, Long> {
    List<ActionPlanningRule> findAllByOrderByStageAscActionTitleAsc();
}
