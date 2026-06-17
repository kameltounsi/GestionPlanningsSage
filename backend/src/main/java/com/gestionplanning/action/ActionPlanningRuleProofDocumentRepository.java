package com.gestionplanning.action;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ActionPlanningRuleProofDocumentRepository extends JpaRepository<ActionPlanningRuleProofDocument, Long> {
    List<ActionPlanningRuleProofDocument> findByRule_IdOrderByUploadedAtDescIdDesc(Long ruleId);

    void deleteByRule_Id(Long ruleId);
}
