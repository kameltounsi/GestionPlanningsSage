import React from "react";
import { PageHeader } from "../../components/common/PageHeader";
import { PlanningRulesAdmin } from "../actionRules/PlanningRulesAdmin";

export function ProjectsPage({
  actionRoleOptions,
  planningRuleForm,
  planningRules,
  saving,
  onCancelPlanningRuleEdit,
  onDeletePlanningRule,
  onDeletePlanningRuleProofDocument,
  onDeletePlanningRuleProofDocumentItem,
  onEditPlanningRule,
  onSubmitPlanningRule,
  setPlanningRuleForm
}) {
  return (
    <section className="page-content">
      <PageHeader eyebrow="Administration" title="Actions standard" subtitle="Gérez les actions standard par phase et leurs durées de planning." />
      <PlanningRulesAdmin
        actionRoleOptions={actionRoleOptions}
        form={planningRuleForm}
        rules={planningRules}
        saving={saving}
        onCancelEdit={onCancelPlanningRuleEdit}
        onDelete={onDeletePlanningRule}
        onDeleteProofDocument={onDeletePlanningRuleProofDocument}
        onDeleteProofDocumentItem={onDeletePlanningRuleProofDocumentItem}
        onEdit={onEditPlanningRule}
        onSubmit={onSubmitPlanningRule}
        setForm={setPlanningRuleForm}
      />
    </section>
  );
}
