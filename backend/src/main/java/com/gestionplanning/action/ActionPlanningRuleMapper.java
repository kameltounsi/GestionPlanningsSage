package com.gestionplanning.action;

import org.springframework.stereotype.Component;

@Component
public class ActionPlanningRuleMapper {
    public ActionPlanningRule toEntity(ActionPlanningRuleDto dto) {
        ActionPlanningRule rule = new ActionPlanningRule();
        rule.setStage(dto.getStage());
        rule.setAppliesToModification(dto.isAppliesToModification());
        rule.setAppliesToNewProject(dto.isAppliesToNewProject());
        rule.setActionTitle(dto.getActionTitle());
        rule.setTopicRisk(dto.getTopicRisk());
        rule.setResponsible(dto.getResponsible());
        rule.setValidator(dto.getValidator());
        rule.setCriticality(dto.getCriticality());
        rule.setExpectedEvidence(dto.getExpectedEvidence());
        rule.setProofDocument(dto.getProofDocument());
        rule.setProofDocumentFileName(dto.getProofDocumentFileName());
        rule.setProofDocumentContentType(dto.getProofDocumentContentType());
        rule.setProofDocumentFileSize(dto.getProofDocumentFileSize());
        rule.setProofDocumentFileUrl(dto.getProofDocumentFileUrl());
        rule.setProofDocumentPublicId(dto.getProofDocumentPublicId());
        rule.setProofDocumentResourceType(dto.getProofDocumentResourceType());
        rule.setEvidenceRequired(dto.isEvidenceRequired());
        rule.setDependencyActionTitle(dto.getDependencyActionTitle());
        rule.setDependencyAnchor(dto.getDependencyAnchor());
        rule.setDurationDays(dto.getDurationDays());
        rule.setRoutineAction(dto.isRoutineAction());
        rule.setRecurrenceIntervalDays(dto.getRecurrenceIntervalDays());
        return rule;
    }

    public ActionPlanningRuleDto toDto(ActionPlanningRule rule) {
        return ActionPlanningRuleDto.from(rule);
    }
}
