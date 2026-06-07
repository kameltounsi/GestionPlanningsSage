import React, { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { EmptyState } from "../../components/common/EmptyState";
import { emptyPlanningRuleForm } from "../../constants/forms";
import { stageDefinitions } from "../../constants/stages";
import { criticalityClass } from "../../utils/status";
import { stageColorClass, stageLabel } from "../../utils/stages";

export function PlanningRulesAdmin({ actionRoleOptions = [], form, rules, saving, onCancelEdit, onDelete, onEdit, onSubmit, setForm }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showNewProjectStages, setShowNewProjectStages] = useState(false);
  const visibleStages = useMemo(
    () => stageDefinitions.filter((stage) => (showNewProjectStages ? stage.newProject : stage.modification)),
    [showNewProjectStages]
  );
  const [selectedStage, setSelectedStage] = useState(visibleStages[0]?.key || "FEASIBILITY_VALIDATION");
  const activeType = showNewProjectStages ? "newProject" : "modification";
  const filteredRules = useMemo(
    () => rules
      .filter((rule) => rule.stage === selectedStage)
      .filter((rule) => (showNewProjectStages ? rule.appliesToNewProject : rule.appliesToModification)),
    [rules, selectedStage, showNewProjectStages]
  );

  useEffect(() => {
    if (!visibleStages.some((stage) => stage.key === selectedStage)) {
      setSelectedStage(visibleStages[0]?.key || "FEASIBILITY_VALIDATION");
    }
  }, [selectedStage, visibleStages]);

  function openCreateDialog(stage, type) {
    setForm({
      ...emptyPlanningRuleForm,
      stage,
      appliesToModification: type !== "newProject",
      appliesToNewProject: type !== "modification"
    });
    setDialogOpen(true);
  }

  function openEditDialog(rule) {
    onEdit(rule);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    onCancelEdit();
  }

  function submitDialog(event) {
    onSubmit(event);
    setDialogOpen(false);
  }

  function ruleTypes(rule) {
    return [rule.appliesToModification ? "Modification" : "", rule.appliesToNewProject ? "Nouveau projet" : ""].filter(Boolean).join(" + ") || "-";
  }

  function ruleDependency(rule) {
    if (!rule.dependencyActionTitle) return "Depart reception ECR";
    return `Apres ${rule.dependencyAnchor === "INPUT" ? "entree" : "sortie"}: ${rule.dependencyActionTitle}`;
  }

  return (
    <section className="panel planning-admin">
      <div className="section-title">
        <div>
          <h2>Actions standard par phase</h2>
          <span>L'admin définit les actions, criticités, preuves et liaisons qui seront générées dans chaque nouvelle ECR.</span>
        </div>
        <span>{filteredRules.length} action{filteredRules.length > 1 ? "s" : ""}</span>
      </div>
      <label className="project-type-toggle admin-project-toggle">
        <input
          aria-label="Afficher les phases nouveau projet"
          checked={showNewProjectStages}
          type="checkbox"
          onChange={(event) => setShowNewProjectStages(event.target.checked)}
        />
        <span className="toggle-visual" aria-hidden="true" />
        <span>
          <strong>Nouveau Projet</strong>
        </span>
      </label>
      <PhaseActionGrid
        label={showNewProjectStages ? "Phases nouveau projet" : "Phases modification"}
        newProject={showNewProjectStages}
        rules={rules}
        selectedStage={selectedStage}
        type={activeType}
        onCreate={openCreateDialog}
        onSelect={setSelectedStage}
      />
      <div className="planning-rule-list">
        {filteredRules.length === 0 ? (
          <EmptyState title="Aucune action standard" text="Cliquez sur + dans la phase selectionnee pour creer la premiere action standard." />
        ) : (
          filteredRules.map((rule) => (
            <article className="planning-rule-row" key={rule.id}>
              <div className="planning-rule-main">
                <span className={`stage-pill ${stageColorClass(rule.stage, showNewProjectStages)}`}>{stageLabel(rule.stage, showNewProjectStages)}</span>
                <strong>{rule.actionTitle}</strong>
                <span>{rule.topicRisk || "Topic non renseigne"}</span>
              </div>
              <div className="planning-rule-details">
                <span><em>Pilote</em><strong>{rule.responsible || "A definir"}</strong></span>
                <span><em>Criticite</em><strong className={`criticality ${criticalityClass(rule.criticality)}`}>{rule.criticality || "3-faible"}</strong></span>
                <span><em>Type</em><strong>{ruleTypes(rule)}</strong></span>
                <span><em>Duree</em><strong className="duration-pill">{rule.durationDays ?? 0} j</strong></span>
                <span><em>Depart</em><strong>{ruleDependency(rule)}</strong></span>
                <span><em>Asset</em><strong>{rule.evidenceRequired ? "Obligatoire" : "Optionnel"}</strong></span>
                <span className="planning-rule-evidence"><em>Preuve attendue</em><strong>{rule.expectedEvidence || "Element preuve non renseigne"}</strong></span>
              </div>
              <span className={`stage-pill ${stageColorClass(rule.stage, showNewProjectStages)}`}>{stageLabel(rule.stage, showNewProjectStages)}</span>
              <div>
                <strong>{rule.actionTitle}</strong>
                <span>{rule.topicRisk || "Topic non renseigné"}</span>
              </div>
              <strong className={`criticality ${criticalityClass(rule.criticality)}`}>{rule.criticality || "3-faible"}</strong>
              <span>{[rule.appliesToModification ? "Modification" : "", rule.appliesToNewProject ? "Nouveau projet" : ""].filter(Boolean).join(" + ")}</span>
              <span>{rule.dependencyActionTitle ? `Après ${rule.dependencyAnchor === "INPUT" ? "entrée" : "sortie"}: ${rule.dependencyActionTitle}` : "Départ réception ECR"}</span>
              <strong className="duration-pill">{rule.durationDays} j</strong>
              <div className="row-actions">
                <button className="secondary-action compact-action icon-only-action" type="button" onClick={() => openEditDialog(rule)} aria-label="Modifier la regle" title="Modifier">
                  <Pencil size={15} />
                </button>
                <button className="ghost-icon" type="button" onClick={() => onDelete(rule.id)} title="Supprimer">
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))
        )}
      </div>
      {dialogOpen && (
        <ActionRuleDialog
          actionRoleOptions={actionRoleOptions}
          form={form}
          rules={rules}
          saving={saving}
          stageNewProject={showNewProjectStages}
          onClose={closeDialog}
          onSubmit={submitDialog}
          setForm={setForm}
        />
      )}
    </section>
  );
}

function PhaseActionGrid({ label, newProject = false, rules, selectedStage, type, onCreate, onSelect }) {
  const stages = stageDefinitions.filter((stage) => (newProject ? stage.newProject : stage.modification));

  return (
    <section className="admin-phase-section">
      <div className="phase-preview-title">
        <h3>{label}</h3>
        <span>{stages.length} phases</span>
      </div>
      <div className="admin-phase-grid">
        {stages.map((stage) => {
          const count = rules.filter((rule) => (
            rule.stage === stage.key && (newProject ? rule.appliesToNewProject : rule.appliesToModification)
          )).length;
          return (
            <article className={`admin-phase-card ${stageColorClass(stage.key, newProject)} ${selectedStage === stage.key ? "selected" : ""}`} key={`${type}-${stage.key}`}>
              <button className="phase-select-action" type="button" onClick={() => onSelect(stage.key)}>
                <strong>{newProject ? stage.newProjectLabel : stage.modificationLabel}</strong>
                <span>{count} action{count > 1 ? "s" : ""}</span>
              </button>
              <button className="phase-add-action" type="button" onClick={(event) => {
                event.stopPropagation();
                onCreate(stage.key, type);
              }} aria-label="Ajouter une action standard" title="Ajouter">
                <Plus size={18} />
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function actionSequenceNumber(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function sortActionRules(first, second) {
  const firstNumber = actionSequenceNumber(first.actionTitle);
  const secondNumber = actionSequenceNumber(second.actionTitle);
  if (firstNumber !== null && secondNumber !== null && firstNumber !== secondNumber) {
    return firstNumber - secondNumber;
  }
  if (firstNumber !== null && secondNumber === null) return -1;
  if (firstNumber === null && secondNumber !== null) return 1;
  return String(first.actionTitle || "").localeCompare(String(second.actionTitle || ""));
}

function previousDependencyOptions(rules, form) {
  const candidates = rules
    .filter((rule) => rule.stage === form.stage)
    .filter((rule) => rule.actionTitle !== form.actionTitle)
    .filter((rule) => (
      (form.appliesToModification && rule.appliesToModification) ||
      (form.appliesToNewProject && rule.appliesToNewProject)
    ))
    .sort(sortActionRules);

  const currentNumber = actionSequenceNumber(form.actionTitle);
  if (currentNumber !== null) {
    return candidates.filter((rule) => {
      const ruleNumber = actionSequenceNumber(rule.actionTitle);
      return ruleNumber === null || ruleNumber < currentNumber;
    });
  }
  return candidates;
}

function ActionRuleDialog({ actionRoleOptions = [], form, rules, saving, stageNewProject, onClose, onSubmit, setForm }) {
  const phaseActions = rules
    .filter((rule) => rule.stage === form.stage)
    .filter((rule) => (
      (form.appliesToModification && rule.appliesToModification) ||
      (form.appliesToNewProject && rule.appliesToNewProject)
    ))
    .sort(sortActionRules);
  const dependencyOptions = previousDependencyOptions(rules, form);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        aria-labelledby="action-rule-dialog-title"
        aria-modal="true"
        className="dialog-card action-rule-dialog panel form-page"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
        role="dialog"
      >
        <div className="form-intro">
          <div>
            <p className="eyebrow">Action standard</p>
            <h2 id="action-rule-dialog-title">{stageLabel(form.stage, stageNewProject)}</h2>
            <p>Definissez l'action, sa criticite et ses dependances pour cette phase.</p>
          </div>
          <button className="ghost-icon" type="button" onClick={onClose} title="Fermer">
            <X size={18} />
          </button>
        </div>
        <section className="phase-existing-actions">
          <div className="phase-preview-title">
            <h3>Actions déjà créées dans cette phase</h3>
            <span>{phaseActions.length} action{phaseActions.length > 1 ? "s" : ""}</span>
          </div>
          {phaseActions.length === 0 ? (
            <p className="form-hint">Aucune action standard n'est encore definie pour cette phase.</p>
          ) : (
            <div className="phase-action-table">
              {phaseActions.map((rule) => (
                <article className="phase-action-table-row" key={rule.id || rule.actionTitle}>
                  <strong>{rule.actionTitle}</strong>
                  <span>{rule.topicRisk || "Topic non renseigné"}</span>
                  <small className={`criticality ${criticalityClass(rule.criticality)}`}>{rule.criticality || "3-faible"}</small>
                  <em>{rule.dependencyActionTitle ? `Bloquée par: ${rule.dependencyActionTitle}` : "Sans blocage"}</em>
                </article>
              ))}
            </div>
          )}
        </section>
        <div className="planning-rule-form dialog-rule-form">
          <label>
            Phase
            <input disabled value={stageLabel(form.stage, form.appliesToNewProject && !form.appliesToModification)} />
          </label>
          <label className="planning-action-title-field">
            Action
            <input required value={form.actionTitle} onChange={(event) => setForm((current) => ({ ...current, actionTitle: event.target.value, dependencyActionTitle: "" }))} placeholder="Ex: Action 7 - Validation input" />
          </label>
          <label>
            Topic / risque
            <input value={form.topicRisk} onChange={(event) => setForm((current) => ({ ...current, topicRisk: event.target.value }))} placeholder="Risque ou sujet" />
          </label>
          <label>
            Responsable
            <select value={form.responsible} onChange={(event) => setForm((current) => ({ ...current, responsible: event.target.value }))}>
              <option value="">Selectionner un role</option>
              {(form.responsible && !actionRoleOptions.includes(form.responsible) ? [form.responsible, ...actionRoleOptions] : actionRoleOptions).map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </label>
          <label>
            Criticite
            <select value={form.criticality} onChange={(event) => setForm((current) => ({ ...current, criticality: event.target.value }))}>
              <option value="1-critique">1-critique</option>
              <option value="2-moyenne">2-moyenne</option>
              <option value="3-faible">3-faible</option>
            </select>
          </label>
          <label>
            Bloquée par
            <select value={form.dependencyActionTitle} onChange={(event) => setForm((current) => ({ ...current, dependencyActionTitle: event.target.value }))}>
              <option value="">Aucune action</option>
              {dependencyOptions.map((rule) => (
                <option key={rule.id || rule.actionTitle} value={rule.actionTitle}>{rule.actionTitle}</option>
              ))}
            </select>
          </label>
          <label>
            Jours de travail
            <input min="0" type="number" value={form.durationDays} onChange={(event) => setForm((current) => ({ ...current, durationDays: event.target.value }))} />
          </label>
          <label className="asset-required-field user-enabled-field">
            <input checked={form.evidenceRequired} type="checkbox" onChange={(event) => setForm((current) => ({ ...current, evidenceRequired: event.target.checked }))} />
            Asset obligatoire
          </label>
        </div>
        <div className="button-row">
          <button className="primary-action" disabled={saving} type="submit">
            <Save size={16} />
            Enregistrer action
          </button>
          <button className="secondary-action" type="button" onClick={onClose}>Annuler</button>
        </div>
      </form>
    </div>
  );
}
