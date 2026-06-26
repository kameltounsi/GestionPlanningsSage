import React, { useEffect, useMemo, useState } from "react";
import { FileText, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { actionPlanningRuleProofDocumentDownloadUrl, actionPlanningRuleProofDocumentUrl } from "../../api";
import { EmptyState } from "../../components/common/EmptyState";
import { emptyPlanningRuleForm } from "../../constants/forms";
import { stageDefinitions } from "../../constants/stages";
import { criticalityClass } from "../../utils/status";
import { stageColorClass, stageLabel } from "../../utils/stages";

export function PlanningRulesAdmin({ actionRoleOptions = [], form, rules, saving, onCancelEdit, onDelete, onDeleteProofDocument, onDeleteProofDocumentItem, onEdit, onSubmit, setForm }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showNewProjectStages, setShowNewProjectStages] = useState(false);
  const visibleStages = useMemo(
    () => stageDefinitions.filter((stage) => stage.key !== "CLOSED" && (showNewProjectStages ? stage.newProject : stage.modification)),
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
    if (rule.routineAction) return `Routiniere: chaque ${rule.recurrenceIntervalDays || 1} j`;
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
          <EmptyState title="Aucune action standard" text="Cliquez sur + dans la phase sélectionnée pour créér la premiere action standard." />
        ) : (
          filteredRules.map((rule) => (
            <article className="planning-rule-row" key={rule.id}>
              <div className="planning-rule-main">
                <span className={`stage-pill ${stageColorClass(rule.stage, showNewProjectStages)}`}>{stageLabel(rule.stage, showNewProjectStages)}</span>
                <strong>{rule.actionTitle}</strong>
                <span>{rule.topicRisk || "Topic non renseigne"}</span>
              </div>
              <div className="planning-rule-details">
                <span><em>Pilote</em><strong>{rule.responsible || "À définir"}</strong></span>
                <span><em>Validateur</em><strong>{rule.validator || "À définir"}</strong></span>
                <span><em>Criticité</em><strong className={`criticality ${criticalityClass(rule.criticality)}`}>{rule.criticality || "3-faible"}</strong></span>
                <span><em>Type</em><strong>{ruleTypes(rule)}</strong></span>
                <span><em>Durée</em><strong className="duration-pill">{rule.durationDays ?? 0} j</strong></span>
                <span><em>Depart</em><strong>{ruleDependency(rule)}</strong></span>
                <span><em>Asset</em><strong>{rule.evidenceRequired ? "Obligatoire" : "Optionnel"}</strong></span>
                <span className="planning-rule-evidence">
                  <em>Element preuve</em>
                  <strong>
                    {planningRuleProofDocuments(rule).length > 0 ? planningRuleProofDocuments(rule).map((proofDocument) => (
                      <a className="file-link" href={planningRuleProofDocumentItemUrl(rule, proofDocument)} key={proofDocument.id || proofDocument.fileName} target="_blank" rel="noreferrer">
                        {proofDocument.fileName || "Element preuve"}
                      </a>
                    )) : "Non uploade"}
                  </strong>
                </span>
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
                <button className="secondary-action compact-action icon-only-action" type="button" onClick={() => openEditDialog(rule)} aria-label="Modifier la règle" title="Modifier">
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
          onDeleteProofDocument={onDeleteProofDocument}
          onDeleteProofDocumentItem={onDeleteProofDocumentItem}
          onSubmit={submitDialog}
          setForm={setForm}
        />
      )}
    </section>
  );
}

function PhaseActionGrid({ label, newProject = false, rules, selectedStage, type, onCreate, onSelect }) {
  const stages = stageDefinitions.filter((stage) => stage.key !== "CLOSED" && (newProject ? stage.newProject : stage.modification));

  return (
    <section className="admin-phase-section">
      <div className="phase-preview-title">
        <h3>{label}</h3>
        <span>{stages.length} phases</span>
      </div>
      <div className="admin-phase-grid">
        {stages.map((stage) => {
          const actionCount = rules
            .filter((rule) => rule.stage === stage.key)
            .filter((rule) => (newProject ? rule.appliesToNewProject : rule.appliesToModification))
            .length;
          return (
            <article className={`admin-phase-card ${stageColorClass(stage.key, newProject)} ${selectedStage === stage.key ? "selected" : ""}`} key={`${type}-${stage.key}`}>
              <button className="phase-select-action" type="button" onClick={() => onSelect(stage.key)}>
                <strong>{newProject ? stage.newProjectLabel : stage.modificationLabel}</strong>
                <span className="phase-action-count">{actionCount} action{actionCount > 1 ? "s" : ""} déjà créée{actionCount > 1 ? "s" : ""}</span>
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

function ActionRuleDialog({ actionRoleOptions = [], form, rules, saving, stageNewProject, onClose, onDeleteProofDocument, onDeleteProofDocumentItem, onSubmit, setForm }) {
  const phaseActions = rules
    .filter((rule) => rule.stage === form.stage)
    .filter((rule) => (
      (form.appliesToModification && rule.appliesToModification) ||
      (form.appliesToNewProject && rule.appliesToNewProject)
    ))
    .sort(sortActionRules);
  const dependencyOptions = previousDependencyOptions(rules, form);
  const selectedProofDocumentFiles = filesFromValue(form.proofDocumentFile);
  const savedProofDocuments = planningRuleProofDocuments(form);
  const hasProofDocumentLink = Boolean(String(form.proofDocumentLinkUrl || "").trim());
  const routineAction = Boolean(form.routineAction);

  function addProofDocumentFiles(event) {
    const selectedFiles = Array.from(event.currentTarget.files || []);
    if (selectedFiles.length > 0) {
      setForm((current) => ({ ...current, proofDocumentFile: mergeSelectedFiles(current.proofDocumentFile, selectedFiles) }));
    }
    event.currentTarget.value = "";
  }

  function removeSelectedProofDocumentFile(index) {
    setForm((current) => ({
      ...current,
      proofDocumentFile: filesFromValue(current.proofDocumentFile).filter((_, fileIndex) => fileIndex !== index)
    }));
  }

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
            <p className="form-hint">Aucune action standard n'est encore définie pour cette phase.</p>
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
            Validateur
            <select value={form.validator} onChange={(event) => setForm((current) => ({ ...current, validator: event.target.value }))}>
              <option value="">Selectionner un role</option>
              {(form.validator && !actionRoleOptions.includes(form.validator) ? [form.validator, ...actionRoleOptions] : actionRoleOptions).map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </label>
          <label>
            Criticité
            <select value={form.criticality} onChange={(event) => setForm((current) => ({ ...current, criticality: event.target.value }))}>
              <option value="1-critique">1-critique</option>
              <option value="2-moyenne">2-moyenne</option>
              <option value="3-faible">3-faible</option>
            </select>
          </label>
          <label>
            Bloquée par
            <select disabled={routineAction} value={routineAction ? "" : form.dependencyActionTitle} onChange={(event) => setForm((current) => ({ ...current, dependencyActionTitle: event.target.value }))}>
              <option value="">Aucune action</option>
              {dependencyOptions.map((rule) => (
                <option key={rule.id || rule.actionTitle} value={rule.actionTitle}>{rule.actionTitle}</option>
              ))}
            </select>
          </label>
          <label className="asset-required-field user-enabled-field routine-action-toggle">
            <input
              checked={routineAction}
              type="checkbox"
              onChange={(event) => setForm((current) => ({
                ...current,
                routineAction: event.target.checked,
                dependencyActionTitle: event.target.checked ? "" : current.dependencyActionTitle,
                recurrenceIntervalDays: event.target.checked ? current.recurrenceIntervalDays || 7 : current.recurrenceIntervalDays
              }))}
            />
            Action routiniere
          </label>
          {routineAction && (
            <label>
              Repetition
              <select value={form.recurrenceIntervalDays || 7} onChange={(event) => setForm((current) => ({ ...current, recurrenceIntervalDays: event.target.value }))}>
                <option value="1">Chaque jour</option>
                <option value="3">Chaque 3 jours</option>
                <option value="7">Chaque semaine</option>
                <option value="14">Chaque 2 semaines</option>
                <option value="30">Chaque mois</option>
              </select>
            </label>
          )}
          <label>
            Jours de travail
            <input min="0" type="number" value={form.durationDays} onChange={(event) => setForm((current) => ({ ...current, durationDays: event.target.value }))} />
          </label>
          <div className="proof-document-picker-field">
            <label className="file-picker proof-document-picker">
              <FileText size={15} />
              <span>{selectedProofDocumentFiles.length > 0 || savedProofDocuments.length > 0 ? "Ajouter un autre élément preuve" : "Element preuve"}</span>
              <input multiple type="file" onChange={addProofDocumentFiles} />
            </label>
            {selectedProofDocumentFiles.length > 0 && (
              <div className="selected-file-list">
                {selectedProofDocumentFiles.map((file, index) => (
                  <span className="selected-file-item" key={`${file.name}-${file.size}-${file.lastModified}-${index}`}>
                    <FileText size={14} />
                    <strong>{file.name}</strong>
                    <button className="ghost-icon" type="button" onClick={() => removeSelectedProofDocumentFile(index)} title="Retirer ce fichier">
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {savedProofDocuments.length > 0 && (
              <div className="selected-file-list saved-file-list">
                {savedProofDocuments.map((proofDocument) => (
                  <span className="selected-file-item" key={proofDocument.id || proofDocument.fileName}>
                    <FileText size={14} />
                    <a className="file-link" href={planningRuleProofDocumentItemUrl(form, proofDocument)} target="_blank" rel="noreferrer">
                      {proofDocument.fileName || "Element preuve"}
                    </a>
                    <button
                      className="ghost-icon"
                      disabled={saving}
                      type="button"
                      onClick={() => (proofDocument.legacy ? onDeleteProofDocument(form.id) : onDeleteProofDocumentItem(proofDocument.id))}
                      title="Supprimer l'élément preuve"
                    >
                      <Trash2 size={15} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="asset-link-inputs proof-document-link-inputs">
              <input
                placeholder="Nom du lien preuve"
                value={form.proofDocumentLinkName || ""}
                onChange={(event) => setForm((current) => ({ ...current, proofDocumentLinkName: event.target.value }))}
              />
              <input
                placeholder="Lien fichier partagé"
                value={form.proofDocumentLinkUrl || ""}
                onChange={(event) => setForm((current) => ({ ...current, proofDocumentLinkUrl: event.target.value }))}
              />
            </div>
          </div>
          <label className="asset-required-field user-enabled-field">
            <input checked={form.evidenceRequired || selectedProofDocumentFiles.length > 0 || savedProofDocuments.length > 0 || hasProofDocumentLink} disabled={selectedProofDocumentFiles.length > 0 || savedProofDocuments.length > 0 || hasProofDocumentLink} type="checkbox" onChange={(event) => setForm((current) => ({ ...current, evidenceRequired: event.target.checked }))} />
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

function filesFromValue(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof FileList !== "undefined" && value instanceof FileList) return Array.from(value);
  return [value].filter(Boolean);
}

function fileIdentity(file) {
  return [file?.name, file?.size, file?.lastModified].join("::");
}

function mergeSelectedFiles(currentValue, nextValue) {
  const files = [...filesFromValue(currentValue), ...filesFromValue(nextValue)];
  const seen = new Set();
  return files.filter((file) => {
    const key = fileIdentity(file);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function planningRuleProofDocuments(rule) {
  const documents = Array.isArray(rule?.proofDocuments) ? rule.proofDocuments : [];
  if (documents.length > 0) return documents;
  if (!rule?.proofDocumentFileName && !rule?.proofDocumentFileUrl) return [];
  return [{
    id: `legacy-proof-${rule.id}`,
    legacy: true,
    fileName: rule.proofDocumentFileName || rule.proofDocument || "Element preuve",
    fileUrl: rule.proofDocumentFileUrl,
    resourceType: rule.proofDocumentResourceType
  }];
}

function planningRuleProofDocumentItemUrl(rule, proofDocument) {
  if (proofDocument?.resourceType === "link" && proofDocument.fileUrl) return proofDocument.fileUrl;
  return proofDocument?.legacy ? actionPlanningRuleProofDocumentUrl(rule.id) : actionPlanningRuleProofDocumentDownloadUrl(proofDocument.id);
}

function fileNamesLabel(value, fallback) {
  const files = filesFromValue(value);
  if (files.length === 0) return fallback;
  return files[0].name;
}
