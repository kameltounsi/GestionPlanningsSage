import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Gauge,
  Maximize2,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  X,
  XCircle
} from "lucide-react";
import {
  addActionEvidenceLink,
  addActionPlanningRuleProofDocumentLink,
  addActionProofDocumentLink,
  actionAssetDownloadUrl,
  actionEvidenceUrl,
  actionProofDocumentDownloadUrl,
  actionProofDocumentUrl,
  ecrRequestFileDownloadUrl,
  getActions,
  getEcrRequestProgress,
  uploadActionEvidence,
  uploadActionPlanningRuleProofDocument,
  uploadActionProofDocument
} from "../../api";
import { EmptyState } from "../../components/common/EmptyState";
import { PageHeader } from "../../components/common/PageHeader";
import { emptyEcrForm } from "../../constants/forms";
import { criticalityClass, readableStatus, statusClass } from "../../utils/status";
import { getStages, safeStage, stageColorClass, stageLabel } from "../../utils/stages";
import { DossierReviewDialog } from "./DossierReviewDialog";

export function createModificationsModule(deps) {
  const {
    actionCompletionRate,
    actionCreatedTime,
    actionOrderNumber,
    actionPlanningTime,
    allWorkflowStagesApproved,
    AppSwal,
    blockingActionFor,
    blockingActionLabel,
    canCreateRequest,
    canDeleteActionForUser,
    canEditActionDurationForUser,
    canManageActionAssignmentForUser,
    canManageActionForUser,
    canRequestRejectedActionValidationForUser,
    canToggleActionForUser,
    canValidateActionForUser,
    canValidatePhases,
    compareActionDisplayOrder,
    completePhaseDossierExportExcel,
    fileNameToken,
    firstActionParticipantStage,
    formatFileSize,
    formattedDateTime,
    hasApplicationRole,
    isActionAwaitingValidation,
    isActionDone,
    isActionPilotForUser,
    isActionParticipantForUser,
    isActionPhaseApproved,
    isAdminUser,
    isCancelledRequest,
    isClosedRequest,
    isCriticalActionValue,
    isHistoricalActionDisplay,
    isImageAsset,
    isProjectLeadForProject,
    isProjectLeadForRequest,
    isRequestPilot,
    isTerminalRequest,
    modificationGanttPdfHtml,
    normalizeRoleToken,
    parseDateOnly,
    professionalDossierPdfHtml,
    requestDisplayName,
    stageActionsForUser,
    stagesForRequest,
    userRoleLabel,
    warningAlert
  } = deps;
function CreateModificationDialog({ clientOptions, currentUser, ecrForm, finishedProductReferences, pilots, productOptions, projects, saving, users, onClose, onSubmit, updateEcrForm }) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <div
        aria-labelledby="create-modification-title"
        aria-modal="true"
        className="dialog-card"
        role="dialog"
      >
        <NewModificationPage
          clientOptions={clientOptions}
          currentUser={currentUser}
          ecrForm={ecrForm}
          finishedProductReferences={finishedProductReferences}
          pilots={pilots}
          productOptions={productOptions}
          projects={projects}
          saving={saving}
          users={users}
          onCancel={onClose}
          onSubmit={onSubmit}
          submitIcon={Plus}
          submitLabel="Créer et ouvrir le suivi"
          updateEcrForm={updateEcrForm}
        />
      </div>
    </div>
  );
}

function EditModificationDialog({ clientOptions, currentUser, ecrForm, existingRequest, finishedProductReferences, pilots, productOptions, projects, saving, users, onClose, onSubmit, updateEcrForm }) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <div
        aria-labelledby="edit-modification-title"
        aria-modal="true"
        className="dialog-card"
        role="dialog"
      >
        <NewModificationPage
          clientOptions={clientOptions}
          currentUser={currentUser}
          ecrForm={ecrForm}
          existingRequest={existingRequest}
          finishedProductReferences={finishedProductReferences}
          mode="edit"
          pilots={pilots}
          productOptions={productOptions}
          projects={projects}
          saving={saving}
          users={users}
          onCancel={onClose}
          onSubmit={onSubmit}
          submitIcon={Save}
          submitLabel="Enregistrer les modifications"
          updateEcrForm={updateEcrForm}
        />
      </div>
    </div>
  );
}

function NewModificationPage({ clientOptions, currentUser = null, ecrForm, existingRequest = null, finishedProductReferences = [], mode = "create", pilots, productOptions, projects, saving, submitIcon: SubmitIcon = Plus, submitLabel = "Créer et ouvrir le suivi", users, onCancel, onSubmit, updateEcrForm }) {
  const availableStages = getStages(ecrForm.newVersion);
  const selectableProjects = mode === "edit" || isAdminUser(currentUser)
    ? projects
    : projects.filter((project) => isProjectLeadForProject(currentUser, project));
  const selectedProject = projects.find((project) => project.name === ecrForm.modificationProject);
  const canUseSelectedProject = mode === "edit" || isAdminUser(currentUser) || isProjectLeadForProject(currentUser, selectedProject);
  const projectTeamMembers = parseProjectTeam(selectedProject?.projectTeam);
  const projectPilotOptions = includeCurrentOption(projectLeadTeamMembers(selectedProject?.projectTeam, users), ecrForm.pilot);
  const canCreateModification = selectableProjects.length > 0 && canUseSelectedProject && projectPilotOptions.includes(ecrForm.pilot);
  const displayedClientOptions = includeCurrentOption(clientOptions, ecrForm.client);
  const selectedProducts = parseSelectedProducts(ecrForm.product);
  const displayedProductOptions = includeCurrentOptions(productOptions, selectedProducts);
  const availableFinishedProducts = finishedProductsForForm(ecrForm, finishedProductReferences);
  const selectedFinishedProducts = parseSelectedProducts(ecrForm.finishedProducts);
  const displayedFinishedProducts = includeCurrentFinishedProducts(availableFinishedProducts, selectedFinishedProducts);
  const displayedFinishedProductKeys = displayedFinishedProducts.map(finishedProductKey).filter(Boolean);
  const allDisplayedFinishedProductsSelected = displayedFinishedProductKeys.length > 0
    && displayedFinishedProductKeys.every((key) => selectedFinishedProducts.includes(key));
  const anyDisplayedFinishedProductsSelected = displayedFinishedProductKeys.some((key) => selectedFinishedProducts.includes(key));
  const coordinatesReady = Boolean(ecrForm.client && ecrForm.modificationProject && selectedProducts.length > 0);
  const finishedProductsRequired = availableFinishedProducts.length > 0;
  const requiredFieldsReady = Boolean(
    ecrForm.modificationNumber.trim()
    && ecrForm.client
    && ecrForm.modificationProject
    && selectedProducts.length > 0
    && ecrForm.pilot
    && ecrForm.receptionDate
    && (!finishedProductsRequired || selectedFinishedProducts.length > 0)
  );
  const submitBlockReason = ecrSubmitBlockReason({
    canCreateModification,
    finishedProductsRequired,
    form: ecrForm,
    projects: selectableProjects,
    projectPilotOptions,
    selectedFinishedProducts,
    selectedProducts
  });
  const titleId = mode === "edit" ? "edit-modification-title" : "create-modification-title";
  const currentBeforePhoto = existingRequest?.beforePhotoUrl;
  const currentAfterPhoto = existingRequest?.afterPhotoUrl;
  const currentBeforeDownloadUrl = existingRequest?.id ? ecrRequestFileDownloadUrl(existingRequest.id, "before") : currentBeforePhoto;
  const currentAfterDownloadUrl = existingRequest?.id ? ecrRequestFileDownloadUrl(existingRequest.id, "after") : currentAfterPhoto;
  const currentBeforeIsImage = isImageAsset(existingRequest?.beforePhotoContentType, currentBeforePhoto);
  const currentAfterIsImage = isImageAsset(existingRequest?.afterPhotoContentType, currentAfterPhoto);
  const pilotFieldLocked = mode === "edit" && !isAdminUser(currentUser);

  return (
    <section className="creation-panel">
      <form className="panel form-page" onSubmit={onSubmit}>
        <div className="form-intro">
          <div>
            <p className="eyebrow">{mode === "edit" ? "Modification ECR" : "Création ECR"}</p>
            <h2 id={titleId}>{mode === "edit" ? "Modifier la modification" : "Nouvelle modification"}</h2>
            <p>{mode === "edit" ? "Mettez à jour les informations de la demande, puis enregistrez pour continuer le suivi." : "Renseignez les informations de base, créez la demande, puis continuez directement le suivi des phases et actions sur cette même page."}</p>
          </div>
          <div className="form-intro-actions">
            <span className="stage-pill teal">{mode === "edit" ? "Édition" : "Création assistée"}</span>
            <button className="ghost-icon" type="button" onClick={onCancel} title="Fermer" aria-label="Fermer">
              <X size={18} />
            </button>
          </div>
        </div>
        <label className="project-type-toggle">
          <input
            aria-label="Basculer entre modification projet et nouveau projet"
            checked={ecrForm.newVersion}
            type="checkbox"
            onChange={(event) => updateEcrForm("newVersion", event.target.checked)}
          />
          <span className="toggle-visual" aria-hidden="true" />
          <span>
            <strong>Nouveau Projet</strong>
          </span>
        </label>
        <PhasePreview newVersion={ecrForm.newVersion} stages={availableStages} />
        <div className="field-grid">
          <label>
            <span>Numéro client externe</span>
            <input required value={ecrForm.modificationNumber} onChange={(event) => updateEcrForm("modificationNumber", event.target.value)} />
          </label>
          <label>
            <span>Client</span>
            <select required value={ecrForm.client} onChange={(event) => updateEcrForm("client", event.target.value)}>
              <option value="">Sélectionner un client</option>
              {displayedClientOptions.map((client) => <option key={client} value={client}>{client}</option>)}
            </select>
          </label>
          <label>
            <span>Projet</span>
            <select required value={ecrForm.modificationProject} onChange={(event) => updateEcrForm("modificationProject", event.target.value)}>
              <option value="">Sélectionner un projet</option>
              {selectableProjects.map((project) => (
                <option key={project.name} value={project.name}>{project.name}</option>
              ))}
            </select>
          </label>
          <fieldset className="product-picker-field">
            <legend>Produit</legend>
            <div className="product-picker-options">
              {displayedProductOptions.map((product) => {
                const checked = selectedProducts.includes(product);
                return (
                  <label className={checked ? "product-option selected" : "product-option"} key={product}>
                    <input
                      checked={checked}
                      type="checkbox"
                      onChange={(event) => updateEcrForm("product", toggleSelectedProduct(selectedProducts, product, event.target.checked).join("; "))}
                    />
                    <span>{product}</span>
                  </label>
                );
              })}
            </div>
            {displayedProductOptions.length === 0 && <span className="form-hint">Ajoutez d'abord des produits dans le referentiel.</span>}
            <span className="form-hint">{selectedProducts.length} produit{selectedProducts.length > 1 ? "s" : ""} sélectionné{selectedProducts.length > 1 ? "s" : ""}</span>
          </fieldset>
          <fieldset className="product-picker-field finished-product-picker-field">
            <div className="product-picker-heading">
              <legend>Produits finis</legend>
              {coordinatesReady && displayedFinishedProductKeys.length > 0 && (
                <div className="product-picker-heading-actions">
                  <button
                    className="secondary-action compact-action"
                    disabled={allDisplayedFinishedProductsSelected}
                    type="button"
                    onClick={() => updateEcrForm("finishedProducts", displayedFinishedProductKeys.join("; "))}
                  >
                    Tout sélectionner
                  </button>
                  <button
                    className="secondary-action compact-action"
                    disabled={!anyDisplayedFinishedProductsSelected}
                    type="button"
                    onClick={() => updateEcrForm("finishedProducts", "")}
                  >
                    Tout désélectionner
                  </button>
                </div>
              )}
            </div>
            {!coordinatesReady && <span className="form-hint">Selectionnez d'abord le client, le projet et au moins un produit.</span>}
            {coordinatesReady && displayedFinishedProducts.length === 0 && <span className="form-hint">Aucun produit fini lie a ces coordonnees.</span>}
            {coordinatesReady && displayedFinishedProducts.length > 0 && (
              <div className="product-picker-options finished-product-picker-options">
                {displayedFinishedProducts.map((finishedProduct) => {
                  const key = finishedProductKey(finishedProduct);
                  const checked = selectedFinishedProducts.includes(key);
                  return (
                    <label className={checked ? "product-option finished-product-option selected" : "product-option finished-product-option"} key={key}>
                      <input
                        aria-label={`Selectionner le produit fini ${finishedProduct.partNumber || key}`}
                        checked={checked}
                        type="checkbox"
                        onChange={(event) => updateEcrForm("finishedProducts", toggleSelectedProduct(selectedFinishedProducts, key, event.target.checked).join("; "))}
                      />
                      <span>
                        <strong>{finishedProduct.partNumber || key}</strong>
                        <small>{[finishedProduct.designation, finishedProduct.customerPn && "PN client: " + finishedProduct.customerPn, "Code reduit: " + finishedProduct.reducedCode].filter(Boolean).join(" | ")}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            <span className="form-hint">{selectedFinishedProducts.length} produit{selectedFinishedProducts.length > 1 ? "s" : ""} fini{selectedFinishedProducts.length > 1 ? "s" : ""} selectionne{selectedFinishedProducts.length > 1 ? "s" : ""}</span>
          </fieldset>
          <label>
            <span>Pilote</span>
            <select required disabled={pilotFieldLocked || !ecrForm.modificationProject || projectPilotOptions.length === 0} value={ecrForm.pilot} onChange={(event) => updateEcrForm("pilot", event.target.value)}>
              <option value="">{ecrForm.modificationProject ? "Sélectionner un chef de projet" : "Sélectionner d'abord un projet"}</option>
              {projectPilotOptions.map((member) => (
                <option key={member} value={member}>{formatUserWithRole(member, users)}</option>
              ))}
            </select>
            {pilotFieldLocked && <span className="form-hint">Le pilote de modification est bloqué. Seul un admin peut le changer.</span>}
          </label>
          <label>
            <span>Réception</span>
            <input required type="date" value={ecrForm.receptionDate} onChange={(event) => updateEcrForm("receptionDate", event.target.value)} />
          </label>
          <div className="calculated-field">
            <span>SOP</span>
            <strong>{ecrForm.sopDate || "Calculé après génération des actions"}</strong>
          </div>
          <label>
            <span>Mixabilité</span>
            <select value={ecrForm.mixability} onChange={(event) => updateEcrForm("mixability", event.target.value)}>
              <option value="">Non renseignée</option>
              <option value="MIXABLE">Oui mixable</option>
              <option value="NON_MIXABLE">Non mixable</option>
            </select>
          </label>
          <label>
            <span>Photo état</span>
            <input accept="image/*" type="file" onChange={(event) => updateEcrForm("beforePhotoFile", event.target.files?.[0] || null)} />
            <span className="form-hint">{ecrForm.beforePhotoFile?.name || (currentBeforePhoto ? "Document actuel conservé si aucun fichier n'est choisi" : "Document avant modification")}</span>
            {currentBeforePhoto && (
              <a className="form-image-preview" href={currentBeforeDownloadUrl} target="_blank" rel="noreferrer">
                {currentBeforeIsImage ? <img alt="Etat actuel" src={currentBeforeDownloadUrl} /> : <FileText size={28} />}
                Voir le fichier actuel
              </a>
            )}
          </label>
          <label>
            <span>Photo devient</span>
            <input accept="image/*" type="file" onChange={(event) => updateEcrForm("afterPhotoFile", event.target.files?.[0] || null)} />
            <span className="form-hint">{ecrForm.afterPhotoFile?.name || (currentAfterPhoto ? "Document actuel conservé si aucun fichier n'est choisi" : "Document après modification")}</span>
            {currentAfterPhoto && (
              <a className="form-image-preview" href={currentAfterDownloadUrl} target="_blank" rel="noreferrer">
                {currentAfterIsImage ? <img alt="Etat apres modification" src={currentAfterDownloadUrl} /> : <FileText size={28} />}
                Voir le fichier actuel
              </a>
            )}
          </label>
        </div>
        {!ecrForm.newVersion && (
        <fieldset className="modification-type-field">
          <legend>Type de modification</legend>
          <label className="action-asset-toggle">
            <input checked={ecrForm.digitChange} type="checkbox" onChange={(event) => updateEcrForm("digitChange", event.target.checked)} />
            <span>Digit change</span>
          </label>
          <label className="action-asset-toggle">
            <input checked={ecrForm.componentChange} type="checkbox" onChange={(event) => updateEcrForm("componentChange", event.target.checked)} />
            <span>Component change</span>
          </label>
          <label className="action-asset-toggle">
            <input checked={ecrForm.processChange} type="checkbox" onChange={(event) => updateEcrForm("processChange", event.target.checked)} />
            <span>Process change</span>
          </label>
          <label className="action-asset-toggle">
            <input checked={ecrForm.supplierChange} type="checkbox" onChange={(event) => updateEcrForm("supplierChange", event.target.checked)} />
            <span>Supplier change</span>
          </label>
        </fieldset>
        )}
        <label>
          <span>Raison de modification</span>
          <textarea value={ecrForm.modificationReason} onChange={(event) => updateEcrForm("modificationReason", event.target.value)} />
        </label>
        <label>
          <span>Détail de modification</span>
          <textarea value={ecrForm.modificationDetail} onChange={(event) => updateEcrForm("modificationDetail", event.target.value)} />
        </label>
        <label>
          <span>Revue dossier</span>
          <textarea value={ecrForm.dossierReview} onChange={(event) => updateEcrForm("dossierReview", event.target.value)} placeholder="Historique de suivi, OIL list, revues planifiées" />
        </label>
        <div className="button-row">
          <button className="primary-action" disabled={saving || !canCreateModification || !requiredFieldsReady} type="submit">
            <SubmitIcon size={16} />
            {submitLabel}
          </button>
          <button className="secondary-action" type="button" onClick={onCancel}>Annuler</button>
        </div>
        {submitBlockReason && <p className="form-hint project-team-warning">{submitBlockReason}</p>}
        {projects.length === 0 && <p className="form-hint">Ajoutez d'abord au moins un projet dans le référentiel projets.</p>}
        {ecrForm.modificationProject && projectTeamMembers.length === 0 && <p className="form-hint project-team-warning">Ce projet n'a pas encore d'Équipe projet.</p>}
        {projectTeamMembers.length > 0 && projectPilotOptions.length === 0 && <p className="form-hint project-team-warning">Ajoutez un chef de projet dans l'équipe projet pour choisir le pilote.</p>}
        {projectPilotOptions.length > 0 && !ecrForm.pilot && <p className="form-hint project-team-warning">Sélectionnez un chef de projet comme pilote.</p>}
        <p className="form-hint">Les actions standard de chaque phase sont générées automatiquement depuis la page Actions.</p>
      </form>
    </section>
  );
}

const ecrFormPropType = PropTypes.shape({
  afterPhotoFile: PropTypes.shape({
    name: PropTypes.string
  }),
  beforePhotoFile: PropTypes.shape({
    name: PropTypes.string
  }),
  client: PropTypes.string,
  componentChange: PropTypes.bool,
  digitChange: PropTypes.bool,
  dossierReview: PropTypes.string,
  finishedProducts: PropTypes.string,
  mixability: PropTypes.string,
  modificationDetail: PropTypes.string,
  modificationNumber: PropTypes.string,
  modificationProject: PropTypes.string,
  modificationReason: PropTypes.string,
  newVersion: PropTypes.bool,
  pilot: PropTypes.string,
  processChange: PropTypes.bool,
  product: PropTypes.string,
  receptionDate: PropTypes.string,
  sopDate: PropTypes.string,
  supplierChange: PropTypes.bool
});

const ecrDialogPropTypes = {
  clientOptions: PropTypes.arrayOf(PropTypes.string).isRequired,
  currentUser: PropTypes.object,
  ecrForm: ecrFormPropType.isRequired,
  finishedProductReferences: PropTypes.arrayOf(PropTypes.object).isRequired,
  pilots: PropTypes.arrayOf(PropTypes.string).isRequired,
  productOptions: PropTypes.arrayOf(PropTypes.string).isRequired,
  projects: PropTypes.arrayOf(PropTypes.object).isRequired,
  saving: PropTypes.bool.isRequired,
  users: PropTypes.arrayOf(PropTypes.object).isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  updateEcrForm: PropTypes.func.isRequired
};

CreateModificationDialog.propTypes = ecrDialogPropTypes;

EditModificationDialog.propTypes = {
  ...ecrDialogPropTypes,
  existingRequest: PropTypes.object
};

NewModificationPage.propTypes = {
  clientOptions: PropTypes.arrayOf(PropTypes.string).isRequired,
  currentUser: PropTypes.object,
  ecrForm: ecrFormPropType.isRequired,
  existingRequest: PropTypes.object,
  finishedProductReferences: PropTypes.arrayOf(PropTypes.object),
  mode: PropTypes.oneOf(["create", "edit"]),
  pilots: PropTypes.arrayOf(PropTypes.string).isRequired,
  productOptions: PropTypes.arrayOf(PropTypes.string).isRequired,
  projects: PropTypes.arrayOf(PropTypes.object).isRequired,
  saving: PropTypes.bool.isRequired,
  submitIcon: PropTypes.elementType,
  submitLabel: PropTypes.string,
  users: PropTypes.arrayOf(PropTypes.object).isRequired,
  onCancel: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  updateEcrForm: PropTypes.func.isRequired
};

function PhasePreview({ newVersion, stages }) {
  return (
    <section className="phase-preview" aria-label="Aperçu des phases">
      <div className="phase-preview-title">
        <h3>Aperçu des phases</h3>
        <span>{stages.length} phases générées automatiquement</span>
      </div>
      <div className="phase-chip-grid">
        {stages.map(([key, label], index) => (
          <span className={`phase-chip ${stageColorClass(key, newVersion)}`} key={key}>
            <strong>{index + 1}</strong>
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}

PhasePreview.propTypes = {
  newVersion: PropTypes.bool.isRequired,
  stages: PropTypes.arrayOf(PropTypes.array).isRequired
};

function useFilteredItems(items, searchTerm, getValues) {
  return useMemo(() => {
    const normalized = normalizeSearchText(searchTerm);
    if (!normalized) return items;

    return items.filter((item) => getValues(item)
      .filter(Boolean)
      .some((value) => normalizeSearchText(value).includes(normalized)));
  }, [getValues, items, searchTerm]);
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function usePaginatedItems(items, pageSize) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const boundedPage = Math.min(currentPage, pageCount);

  useEffect(() => {
    if (currentPage !== boundedPage) {
      setCurrentPage(boundedPage);
    }
  }, [boundedPage, currentPage]);

  const pagedItems = useMemo(() => {
    const start = (boundedPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [boundedPage, items, pageSize]);

  return { currentPage: boundedPage, pageCount, pagedItems, setCurrentPage };
}

function PaginationControls({ currentPage, pageCount, totalCount, onPageChange }) {
  if (pageCount <= 1) return null;

  return (
    <nav className="pagination" aria-label="Pagination">
      <span>Page {currentPage} / {pageCount} - {totalCount} éléments</span>
      <div className="pagination-actions">
        <button className="ghost-icon" disabled={currentPage <= 1} type="button" onClick={() => onPageChange(currentPage - 1)} title="Page précédente" aria-label="Page précédente">
          <ChevronLeft size={16} />
        </button>
        <button className="ghost-icon" disabled={currentPage >= pageCount} type="button" onClick={() => onPageChange(currentPage + 1)} title="Page suivante" aria-label="Page suivante">
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}

PaginationControls.propTypes = {
  currentPage: PropTypes.number.isRequired,
  pageCount: PropTypes.number.isRequired,
  totalCount: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired
};

function ProjectTeamSelector({ projectTeam, users, onChange }) {
  const [teamQuery, setTeamQuery] = useState("");
  const selectedNames = useMemo(() => parseProjectTeam(projectTeam), [projectTeam]);
  const selectedProjectLeadCount = useMemo(() => countSelectedProjectLeads(projectTeam, users), [projectTeam, users]);
  const normalizedQuery = teamQuery.trim().toLowerCase();
  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || ""))),
    [users]
  );
  const filteredUsers = sortedUsers.filter((user) => {
    if (!normalizedQuery) return true;
    return [user.fullName, user.username, user.email, user.jobTitle, userRoleLabel(user.role)]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery));
  });

  function toggleUser(user, checked) {
    const userName = user.fullName || user.username || user.email;
    const nextNames = checked
      ? [...selectedNames.filter((name) => !isProjectLead(user) || !selectedProjectLeadNames(users).includes(name)), userName]
      : selectedNames.filter((name) => name !== userName);
    onChange([...new Set(nextNames)].join(", "));
  }

  return (
    <fieldset className="project-team-field">
      <legend>Équipe projet</legend>
      <div className="search project-team-search">
        <Search size={16} />
        <input
          placeholder="Rechercher un utilisateur"
          value={teamQuery}
          onChange={(event) => setTeamQuery(event.target.value)}
        />
      </div>
      <div className="project-team-list">
        {filteredUsers.length === 0 ? (
          <p className="form-hint">Aucun utilisateur trouvé.</p>
        ) : (
          filteredUsers.map((user) => {
            const userName = user.fullName || user.username || user.email;
            const checked = selectedNames.includes(userName);
            return (
              <label className="project-team-option" key={user.id || userName}>
                <input
                  aria-label={`Selectionner ${userName}`}
                  checked={checked}
                  type="checkbox"
                  onChange={(event) => toggleUser(user, event.target.checked)}
                />
                <span>
                  <strong>{userName}</strong>
                  <small>{userDisplayRole(user)}</small>
                </span>
              </label>
            );
          })
        )}
      </div>
      <p className={selectedProjectLeadCount === 1 ? "form-hint" : "form-hint project-team-warning"}>
        {selectedNames.length} utilisateur{selectedNames.length > 1 ? "s" : ""} sélectionné{selectedNames.length > 1 ? "s" : ""}.
        {" "}Chef de projet: {selectedProjectLeadCount}/1
      </p>
    </fieldset>
  );
}

ProjectTeamSelector.propTypes = {
  projectTeam: PropTypes.string,
  users: PropTypes.arrayOf(PropTypes.object).isRequired,
  onChange: PropTypes.func.isRequired
};

function parseProjectTeam(projectTeam) {
  return parseProjectTeamEntries(projectTeam).map((entry) => entry.name);
}

function parseProjectTeamEntries(projectTeam) {
  return String(projectTeam || "")
    .split(/[;\n]+/)
    .flatMap((entry) => entry.includes("::") ? [entry] : entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, roleText = ""] = entry.split("::");
      return {
        name: name.trim(),
        roles: roleText.split(/[|,]+/).map((role) => role.trim()).filter(Boolean)
      };
    })
    .filter((entry) => entry.name);
}

function updateEcrFormState(form, field, value, projects, finishedProductReferences = []) {
  const nextForm = { ...form, [field]: value };
  if (field === "newVersion") {
    nextForm.currentStage = safeStage(form.currentStage, value);
    if (value) {
      nextForm.digitChange = false;
      nextForm.componentChange = false;
      nextForm.processChange = false;
      nextForm.supplierChange = false;
    }
  }
  if (field === "modificationProject") {
    const projectTeam = projects.find((project) => project.name === value)?.projectTeam || "";
    const teamMembers = parseProjectTeam(projectTeam);
    if (!teamMembers.includes(form.pilot)) {
      nextForm.pilot = "";
    }
  }
  if (["client", "modificationProject", "product"].includes(field)) {
    nextForm.finishedProducts = selectedFinishedProductsForForm(nextForm, finishedProductReferences).join("; ");
  }
  return nextForm;
}

function requestToEcrForm(request) {
  return {
    ...emptyEcrForm,
    accessInternalNumber: request.accessInternalNumber || "",
    modificationNumber: request.modificationNumber || "",
    client: request.client || "",
    product: request.product || "",
    finishedProducts: request.finishedProducts || "",
    modificationProject: request.modificationProject || "",
    modificationReason: request.modificationReason || "",
    modificationDetail: request.modificationDetail || "",
    mixability: request.mixability || "",
    dossierReview: request.dossierReview || "",
    receptionDate: request.receptionDate || "",
    sopDate: request.sopDate || "",
    pilot: request.pilot || "",
    digitChange: Boolean(request.digitChange),
    componentChange: Boolean(request.componentChange),
    processChange: Boolean(request.processChange),
    supplierChange: Boolean(request.supplierChange),
    newVersion: Boolean(request.newVersion),
    currentStage: safeStage(request.currentStage, Boolean(request.newVersion))
  };
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function includeCurrentOption(options, currentValue) {
  if (!currentValue || options.includes(currentValue)) {
    return options;
  }
  return uniqueSorted([...options, currentValue]);
}

function includeCurrentOptions(options, currentValues) {
  return uniqueSorted([...options, ...currentValues]);
}

function parseSelectedProducts(value) {
  return String(value || "")
    .split(/[,;\n/]+/)
    .map((product) => product.trim())
    .filter(Boolean);
}

function toggleSelectedProduct(selectedProducts, product, checked) {
  if (checked) {
    return uniqueSorted([...selectedProducts, product]);
  }
  return selectedProducts.filter((selectedProduct) => selectedProduct !== product);
}

function normalizeReferenceValue(value) {
  return String(value || "").trim().toLowerCase();
}

function finishedProductKey(finishedProduct) {
  return String(finishedProduct?.partNumber || "").trim();
}

function finishedProductDetailRows(product) {
  return [
    ["Client", product.client],
    ["Projet", product.project],
    ["PN produit fini", product.partNumber],
    ["Designation", product.designation],
    ["PN client", product.customerPn],
    ["Produit", product.product],
    ["Indice coiffe", product.coiffeIndex],
    ["Indice drawing", product.drawingIndex],
    ["Code reduit", product.reducedCode],
    ["Prix de vente", product.salePrice],
    ["Date integration production", product.productionIntegrationDate],
    ["Commentaires", product.comments]
  ];
}

function finishedProductAiSummary(product, requests = []) {
  const requestLines = requests.length === 0
    ? "Aucune modification ne contient actuellement ce produit fini."
    : requests.map((request, index) => `${index + 1}. ${requestDisplayName(request)}, motif ${request.modificationReason || "non renseigne"}, projet ${request.modificationProject || "-"}, client ${request.client || "-"}, phase ${stageLabel(request.currentStage, Boolean(request.newVersion))}, pilote ${request.pilot || "-"}, reception ${request.receptionDate || "-"}.`).join(" ");
  return [
    `Produit fini ${product.partNumber || "-"}: ${product.designation || "designation non renseignee"}.`,
    `Il est lie au client ${product.client || "-"}, au projet ${product.project || "-"} et au produit ${product.product || "-"}.`,
    `PN client: ${product.customerPn || "-"}, code reduit: ${product.reducedCode || "-"}, indice coiffe: ${product.coiffeIndex || "-"}, indice drawing: ${product.drawingIndex || "-"}.`,
    `Date d'integration production: ${product.productionIntegrationDate || "-"}, prix de vente: ${product.salePrice ? `${product.salePrice} euros` : "-"}.`,
    product.comments ? `Commentaires: ${product.comments}.` : "",
    `Modifications trouvees: ${requests.length}. ${requestLines}`
  ].filter(Boolean).join(" ");
}

function speakFinishedProductSummary(text, setSpeaking) {
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    warningAlert("Lecture sonore indisponible", "La synthese vocale n'est pas disponible dans ce navigateur.");
    return;
  }
  globalThis.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.onend = () => setSpeaking(false);
  utterance.onerror = () => setSpeaking(false);
  setSpeaking(true);
  globalThis.speechSynthesis.speak(utterance);
}

function stopFinishedProductSpeech(setSpeaking) {
  if ("speechSynthesis" in window) {
    globalThis.speechSynthesis.cancel();
  }
  setSpeaking(false);
}

function finishedProductsForForm(form, references = []) {
  const client = normalizeReferenceValue(form.client);
  const project = normalizeReferenceValue(form.modificationProject);
  const selectedProducts = parseSelectedProducts(form.product).map(normalizeReferenceValue);
  if (!client || !project || selectedProducts.length === 0) {
    return [];
  }
  return references
    .filter((reference) => normalizeReferenceValue(reference.client) === client)
    .filter((reference) => normalizeReferenceValue(reference.project) === project)
    .filter((reference) => parseSelectedProducts(reference.product)
      .map(normalizeReferenceValue)
      .some((product) => selectedProducts.includes(product)))
    .filter((reference) => finishedProductKey(reference));
}

function includeCurrentFinishedProducts(options, selectedKeys) {
  const optionKeys = new Set(options.map(finishedProductKey));
  const missingOptions = selectedKeys
    .filter((key) => key && !optionKeys.has(key))
    .map((key) => ({ partNumber: key, designation: "Produit fini deja selectionne", reducedCode: "-" }));
  return [...options, ...missingOptions].sort((a, b) => finishedProductKey(a).localeCompare(finishedProductKey(b)));
}

function selectedFinishedProductsForForm(form, references = []) {
  const availableKeys = new Set(finishedProductsForForm(form, references).map(finishedProductKey));
  return parseSelectedProducts(form.finishedProducts).filter((key) => availableKeys.has(key));
}

function validateEcrRequiredFields(form, currentRequestId, setError, requests = []) {
  const requiredChecks = [
    [form.modificationNumber?.trim(), "Numero client externe obligatoire."],
    [form.client, "Client obligatoire."],
    [form.modificationProject, "Projet obligatoire."],
    [parseSelectedProducts(form.product).length > 0, "Produit obligatoire."],
    [form.pilot, "Pilote obligatoire."],
    [form.receptionDate, "Date de reception obligatoire."]
  ];
  const missing = requiredChecks.find(([valid]) => !valid);
  if (missing) {
    const message = missing[1];
    setError(message);
    warningAlert("Champ obligatoire", message);
    return false;
  }
  const normalizedNumber = normalizeReferenceValue(form.modificationNumber);
  const duplicate = requests.some((request) => (
    request.id !== currentRequestId && normalizeReferenceValue(request.modificationNumber) === normalizedNumber
  ));
  if (duplicate) {
    const message = "Numéro client externe déjà utilisé par une autre modification.";
    setError(message);
    warningAlert("Numero unique", message);
    return false;
  }
  return true;
}

function ecrSubmitBlockReason({ canCreateModification, finishedProductsRequired, form, projects = [], projectPilotOptions = [], selectedFinishedProducts = [], selectedProducts = [] }) {
  if (!form.modificationNumber?.trim()) {
    return "Renseignez le numero client externe.";
  }
  if (!form.client) {
    return "Selectionnez un client.";
  }
  if (!form.modificationProject) {
    return "Selectionnez un projet.";
  }
  if (selectedProducts.length === 0) {
    return "Selectionnez au moins un produit.";
  }
  if (finishedProductsRequired && selectedFinishedProducts.length === 0) {
    return "Selectionnez au moins un produit fini lie a ces coordonnees.";
  }
  if (!form.pilot) {
    if (projects.length === 0) {
      return "Ajoutez d'abord au moins un projet dans le referentiel projets.";
    }
    if (projectPilotOptions.length === 0) {
      return "Ajoutez un chef de projet dans l'equipe projet pour choisir le pilote.";
    }
    return "Selectionnez un chef de projet comme pilote.";
  }
  if (!form.receptionDate) {
    return "Renseignez la date de reception.";
  }
  if (!canCreateModification) {
    return "Verifiez que le projet selectionne contient le pilote choisi.";
  }
  return "";
}

function validateFinishedProductsSelection(form, references, setError) {
  const availableFinishedProducts = finishedProductsForForm(form, references);
  if (availableFinishedProducts.length === 0) {
    return true;
  }
  const selectedFinishedProducts = selectedFinishedProductsForForm(form, references);
  if (selectedFinishedProducts.length === 0) {
    const message = "Selectionnez au moins un produit fini.";
    setError(message);
    warningAlert("Produit fini requis", message);
    return false;
  }
  return true;
}

function mixabilityLabel(value) {
  if (value === "MIXABLE") return "Oui mixable";
  if (value === "NON_MIXABLE") return "Non mixable";
  return "-";
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

function firstFileFromValue(value) {
  return filesFromValue(value)[0] || null;
}

function fileNamesLabel(value, fallback) {
  const files = filesFromValue(value);
  if (files.length === 0) return fallback;
  if (files.length === 1) return files[0].name;
  return `${files.length} fichiers sélectionnés`;
}

function uploadActionEvidenceFiles(actionId, files) {
  return files.reduce(
    (promise, file) => promise.then(() => uploadActionEvidence(actionId, file)),
    Promise.resolve(null)
  );
}

function uploadActionEvidenceLink(actionId, link) {
  if (!link?.url?.trim()) return Promise.resolve(null);
  return addActionEvidenceLink(actionId, {
    name: link.name?.trim() || link.url.trim(),
    url: link.url.trim()
  });
}

function uploadActionProofDocumentFiles(actionId, files) {
  return files.reduce(
    (promise, file) => promise.then(() => uploadActionProofDocument(actionId, file)),
    Promise.resolve(null)
  );
}

function uploadActionProofDocumentLink(actionId, link) {
  if (!link?.url?.trim()) return Promise.resolve(null);
  return addActionProofDocumentLink(actionId, {
    name: link.name?.trim() || link.url.trim(),
    url: link.url.trim()
  });
}

function uploadActionPlanningRuleProofDocumentFiles(ruleId, files) {
  return files.reduce(
    (promise, file) => promise.then(() => uploadActionPlanningRuleProofDocument(ruleId, file)),
    Promise.resolve(null)
  );
}

function uploadActionPlanningRuleProofDocumentLink(ruleId, link) {
  if (!link?.url?.trim()) return Promise.resolve(null);
  return addActionPlanningRuleProofDocumentLink(ruleId, {
    name: link.name?.trim() || link.url.trim(),
    url: link.url.trim()
  });
}

function hasPlanningRuleProofDocument(rule) {
  return filesFromValue(rule?.proofDocumentFile).length > 0
    || Boolean(String(rule?.proofDocumentFileName || rule?.proofDocumentFileUrl || "").trim())
    || (Array.isArray(rule?.proofDocuments) && rule.proofDocuments.length > 0);
}

function actionProofDocuments(action) {
  const documents = Array.isArray(action?.proofDocuments) ? action.proofDocuments : [];
  if (documents.length > 0) return documents;
  if (!action?.proofDocumentFileName && !action?.proofDocumentFileUrl) return [];
  return [{
    id: `legacy-proof-${action.id}`,
    legacy: true,
    fileName: action.proofDocumentFileName || action.proofDocument || "Element preuve",
    fileUrl: actionProofDocumentUrl(action.id)
  }];
}

function actionAssets(action) {
  const assets = Array.isArray(action?.assets) ? action.assets : [];
  if (assets.length > 0) return assets;
  if (!action?.evidenceFileName) return [];
  return [{
    id: `legacy-${action.id}`,
    legacy: true,
    fileName: action.evidenceFileName,
    fileUrl: actionEvidenceUrl(action.id)
  }];
}

function hasActionAsset(action) {
  return actionAssets(action).length > 0 || Boolean(String(action?.evidenceLinkUrl || "").trim());
}

function hasActionProofDocument(action) {
  return filesFromValue(action?.proofDocumentFile).length > 0
    || Boolean(String(action?.proofDocumentLinkUrl || "").trim())
    || actionProofDocuments(action).length > 0;
}

function isHttpUrl(value) {
  const text = String(value || "").trim();
  if (!/^https?:\/\//i.test(text)) return false;
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isWindowsLocalPath(value) {
  const text = String(value || "").trim();
  return /^[a-zA-Z]:[\\/]/.test(text) || /^\\\\[^\\/\s]+[\\/][^\\/\s]+/.test(text);
}

function sharedReferenceUrl(value, fallbackUrl) {
  if (isHttpUrl(value)) return value;
  return fallbackUrl;
}

function actionAssetUrl(action, asset) {
  if (asset?.resourceType === "link" && asset.fileUrl) {
    return sharedReferenceUrl(asset.fileUrl, actionAssetDownloadUrl(asset.id));
  }
  return asset?.legacy ? actionEvidenceUrl(action.id) : actionAssetDownloadUrl(asset.id);
}

function actionProofDocumentItemUrl(action, proofDocument) {
  if (proofDocument?.resourceType === "link" && proofDocument.fileUrl) {
    return sharedReferenceUrl(proofDocument.fileUrl, actionProofDocumentDownloadUrl(proofDocument.id));
  }
  return proofDocument?.legacy ? actionProofDocumentUrl(action.id) : actionProofDocumentDownloadUrl(proofDocument.id);
}

function SharedFileReference({ label, reference }) {
  const localPath = isWindowsLocalPath(reference.value) ? String(reference.value || "").trim() : "";
  if (localPath) {
    return (
      <button className="file-link local-file-reference" type="button" onClick={() => openLocalPathReference(localPath)} title={localPath}>
        {label}
      </button>
    );
  }
  if (reference.url) {
    return (
      <a className="file-link" href={reference.url} target="_blank" rel="noreferrer">
        {label}
      </a>
    );
  }
  return <span className="file-link shared-reference-text" title={reference.value || label}>{label}</span>;
}

function openLocalPathReference(path) {
  const text = String(path || "").trim();
  const showPathAlert = (copied) => AppSwal.fire({
    icon: copied ? "success" : "info",
    title: copied ? "Chemin copie" : "Chemin local",
    html: `<p style="margin:0 0 10px;">Le navigateur bloque l'ouverture directe des fichiers locaux depuis l'application web.</p><p style="margin:0 0 10px;">Collez ce chemin dans l'explorateur Windows :</p><code style="display:block;white-space:normal;word-break:break-all;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">${escapeHtml(text)}</code>`,
    confirmButtonText: "OK"
  });
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => showPathAlert(true)).catch(() => showPathAlert(false));
    return;
  }
  showPathAlert(false);
}

SharedFileReference.propTypes = {
  label: PropTypes.string.isRequired,
  reference: PropTypes.shape({
    url: PropTypes.string,
    value: PropTypes.string
  }).isRequired
};

function modificationTypesLabel(request) {
  const types = modificationTypesList(request);
  return types.length ? types.join(", ") : "-";
}

function modificationTypesList(request) {
  if (request?.newVersion) return ["Nouveau projet"];
  const types = [
    request?.digitChange ? "Digit change" : "",
    request?.componentChange ? "Component change" : "",
    request?.processChange ? "Process change" : "",
    request?.supplierChange ? "Supplier change" : ""
  ].filter(Boolean);
  return types;
}

function formatProjectTeamWithRoles(projectTeam, users) {
  const members = parseProjectTeamEntries(projectTeam);
  if (members.length === 0) return "Équipe non renseignée";
  return members.map((member) => formatProjectTeamEntryWithRoles(member, users)).join(", ");
}

function formatUserWithRole(userName, users) {
  const user = findUserByTeamName(userName, users);
  return user ? `${userName} (${userDisplayRole(user)})` : userName;
}

function formatProjectTeamEntryWithRoles(member, users) {
  const user = findUserByTeamName(member.name, users);
  const roles = member.roles.length > 0 ? member.roles.join(", ") : userDisplayRole(user);
  return `${member.name}${roles ? ` (${roles})` : ""}`;
}

function userDisplayRole(user) {
  return userRoleLabel(user?.role);
}

function findUserByTeamName(userName, users) {
  return users.find((user) => [user.fullName, user.username, user.email].filter(Boolean).includes(userName));
}

function projectRoleAssigneeDisplay(value, request, projects = [], users = []) {
  const text = String(value || "").trim();
  if (!text) return "";
  const normalized = normalizeRoleToken(text).replaceAll("_", " ");
  const project = projects.find((item) => item.name === request?.modificationProject);
  const entries = parseProjectTeamEntries(project?.projectTeam);
  const directEntry = entries.find((entry) => normalizeRoleToken(entry.name).replaceAll("_", " ") === normalized);
  if (directEntry) return directEntry.name;
  const directUser = users.find((user) => [user.fullName, user.username, user.email]
    .filter(Boolean)
    .some((candidate) => normalizeRoleToken(candidate).replaceAll("_", " ") === normalized));
  if (directUser) return directUser.fullName || directUser.username || directUser.email || text;
  const roleEntry = entries.find((entry) => entry.roles.some((role) => normalizeRoleToken(role).replaceAll("_", " ") === normalized));
  return roleEntry?.name || text;
}

function projectTeamUserIds(projectTeam, users, currentUser) {
  return parseProjectTeam(projectTeam)
    .map((member) => findUserByTeamName(member, users))
    .filter(Boolean)
    .map((user) => user.id)
    .filter((id) => Number(id) !== Number(currentUser?.id));
}

function projectLeadTeamMembers(projectTeam, users) {
  return parseProjectTeamEntries(projectTeam)
    .filter((member) => {
      if (member.roles.length > 0) {
        return member.roles.some((role) => normalizeRoleToken(role) === "chef de projet" || normalizeRoleToken(role).replaceAll("_", " ") === "chef de projet");
      }
      const user = findUserByTeamName(member.name, users);
      return isProjectLead(user);
    })
    .map((member) => member.name);
}

function selectedProjectLeadNames(users) {
  return users
    .filter(isProjectLead)
    .map((user) => user.fullName || user.username || user.email)
    .filter(Boolean);
}

function countSelectedProjectLeads(projectTeam, users) {
  return projectLeadTeamMembers(projectTeam, users).length;
}

function duplicatedProjectTeamRole(projectTeam) {
  const usedRoles = new Set();
  for (const entry of parseProjectTeamEntries(projectTeam)) {
    for (const role of entry.roles) {
      const key = normalizeRoleToken(role).replaceAll("_", " ");
      if (!key) continue;
      if (usedRoles.has(key)) return role;
      usedRoles.add(key);
    }
  }
  return "";
}

function isProjectLead(user) {
  return hasApplicationRole(user, "CHEF_DE_PROJET", "Chef de projet");
}

function RequestDocumentCard({ contentType, onPreview, sourceUrl, title, url }) {
  const isImage = isImageAsset(contentType, sourceUrl || url);
  if (isImage) {
    return (
      <button
        type="button"
        onClick={() => onPreview({ title, url })}
        title={`Agrandir ${title.toLowerCase()}`}
      >
        <span>{title}</span>
        <img alt={title} src={url} />
      </button>
    );
  }
  return (
    <a className="request-document-card" href={url} target="_blank" rel="noreferrer" title={`Ouvrir ${title.toLowerCase()}`}>
      <span>{title}</span>
      <FileText size={34} />
      <strong>Voir le document</strong>
    </a>
  );
}

RequestDocumentCard.propTypes = {
  contentType: PropTypes.string,
  onPreview: PropTypes.func.isRequired,
  sourceUrl: PropTypes.string,
  title: PropTypes.string.isRequired,
  url: PropTypes.string.isRequired
};

function ModificationsPage(props) {
  const [listOpen, setListOpen] = useState(false);
  const [userSidebarOpen, setUserSidebarOpen] = useState(true);
  const [previewImage, setPreviewImage] = useState(null);
  const [referenceDialog, setReferenceDialog] = useState(null);
  const [dossierDialogOpen, setDossierDialogOpen] = useState(false);
  const [detailsCollapsed, setDetailsCollapsed] = useState(false);
  const {
    actionForm,
    actionRoleOptions,
    actions,
    actionsByRequestId = {},
    checklist,
    completion,
    currentUser,
    downloadBlobFile,
    downloadHtmlAsPdf,
    downloadTextFile,
    errorAlert,
    filteredRequests,
    handleArchiveEcr,
    handleCancelEcr,
    handleCreateAction,
    handleDeleteAction,
    handleStageChange,
    handleToggleAction,
    handleUpdateActionDuration,
    handleDeleteActionAsset,
    handleUploadEvidence,
    handleAddEvidenceLink,
    removeActionProofDocumentFile,
    handleApprovePhase,
    handleApproveActionValidation,
    handleCloseRequest,
    handleRejectActionValidation,
    handleRequestActionValidation,
    handleRejectPhase,
    handleReopenPhase,
    handleRequestClosure,
    handleRequestPhaseValidation,
    isCriticalAction,
    phaseValidations,
    projects = [],
    projectFilter,
    projectOptions,
    query,
    requests = [],
    requestSearchSuggestions,
    requestArchiveView,
    requestTypeFilter,
    onEditRequest,
    onRequestArchiveViewChange,
    onUpdateDossierReview,
    saving,
    selectedId,
    selectedRequest,
    selectedStages,
    selectedStage,
    setSaving,
    setProjectFilter,
    setQuery,
    setSelectedId,
    setSelectedStage,
    setShowCreateForm,
    setRequestTypeFilter,
    successToast,
    requiresEvidence,
    updateActionForm,
    users = []
  } = props;
  const canAdmin = isAdminUser(currentUser);
  const canValidate = canValidatePhases(currentUser);
  const canRequestValidation = isRequestPilot(currentUser, selectedRequest, projects)
    || isProjectLeadForRequest(currentUser, selectedRequest, projects);
  const requestTerminal = isTerminalRequest(selectedRequest);
  const canManageDossierReview = !requestTerminal && (canAdmin || canRequestValidation);
  const canExportDossierReview = canAdmin || canRequestValidation;
  const canExportGantt = Boolean(selectedRequest);
  const canCancelRequest = !requestTerminal && canAdmin && selectedRequest?.currentStage !== "CANCELLED";
  const canEditRequest = !requestTerminal && (canAdmin || isRequestPilot(currentUser, selectedRequest, projects));
  const workflowApproved = allWorkflowStagesApproved(selectedRequest, phaseValidations);
  const canRequestClosure = !requestTerminal && canRequestValidation && workflowApproved && !selectedRequest?.closureRequested;
  const canCloseRequest = !requestTerminal && canAdmin && workflowApproved && selectedRequest?.closureRequested;
  const currentValidation = phaseValidations.find((validation) => validation.stage === selectedStage && validation.status === "PENDING");
  const latestStageValidation = phaseValidations.find((validation) => validation.stage === selectedStage);
  const visibleActions = canAdmin ? actions : stageActionsForUser(currentUser, selectedRequest, actions, selectedStage, projects);
  const stageActionsDone = actions.every(isActionDone);
  const isCurrentStage = selectedRequest && selectedStage === selectedRequest.currentStage;
  const authenticatedUserRequests = useMemo(() => {
    const userRequests = [...requests];
    return userRequests.sort((first, second) => {
      const firstDate = parseDateOnly(first.receptionDate)?.getTime() || 0;
      const secondDate = parseDateOnly(second.receptionDate)?.getTime() || 0;
      return secondDate - firstDate || String(requestDisplayName(first)).localeCompare(String(requestDisplayName(second)), "fr", { sensitivity: "base" });
    });
  }, [requests]);
  const requestStatusOptions = [
    ["all", "Toutes"],
    ["active", "Actives"],
    ["closed", "Clôturées"],
    ["cancelled", "Annulées"],
    ...(canAdmin ? [["archived", "Archivées"]] : [])
  ];

  function selectRequest(request) {
    if (isClosedRequest(request)) {
      warningAlert("Modification cloturée", "C'est une modification cloturée et vous ne pouvez plus la modifier.");
    }
    setShowCreateForm(false);
    setSelectedId(request.id);
    const participantStage = canAdmin ? firstActionParticipantStage(currentUser, actionsByRequestId[request.id] || []) : null;
    setSelectedStage(safeStage(participantStage || request.currentStage, Boolean(request.newVersion)));
    setDetailsCollapsed(false);
    setListOpen(false);
    setUserSidebarOpen(false);
  }

  function exportModificationGanttPdf() {
    if (!selectedRequest) return;
    setSaving(true);
    Promise.all([
      getActions(selectedRequest.id),
      getEcrRequestProgress(selectedRequest.id).catch(() => null)
    ])
      .then(async ([requestActions, progressSummary]) => {
        await downloadHtmlAsPdf(
          `diagramme-gantt-${fileNameToken(requestDisplayName(selectedRequest))}.pdf`,
          modificationGanttPdfHtml(selectedRequest, requestActions, stagesForRequest(selectedRequest), progressSummary),
          { orientation: "landscape", width: "1280px", backgroundColor: "#f7f9f1", scale: 1 }
        );
        successToast("Diagramme de Gantt PDF telecharge");
      })
      .catch(() => {
        errorAlert("Generation du diagramme de Gantt impossible.");
      })
      .finally(() => setSaving(false));
  }

  function exportModificationDossierExcel() {
    if (!selectedRequest) return;
    getActions(selectedRequest.id)
      .then((requestActions) => {
        downloadBlobFile(
          `dossier-modification-${fileNameToken(requestDisplayName(selectedRequest))}.xls`,
          completePhaseDossierExportExcel(selectedRequest, requestActions),
          "application/vnd.ms-excel;charset=utf-8"
        );
        successToast("Dossier de modification Excel généré");
      })
      .catch(() => {
        errorAlert("Extraction du dossier de modification impossible.");
      });
  }

  function exportProfessionalDossierPdf() {
    if (!selectedRequest) return;
    getActions(selectedRequest.id)
      .then(async (requestActions) => {
        await downloadHtmlAsPdf(
          `dossier-ecr-${fileNameToken(requestDisplayName(selectedRequest))}.pdf`,
          professionalDossierPdfHtml(selectedRequest, requestActions, phaseValidations),
          { orientation: "portrait", width: "820px", backgroundColor: "#eef2e8" }
        );
        successToast("Dossier ECR PDF genere");
      })
      .catch(() => {
        errorAlert("Generation du dossier ECR PDF impossible.");
      });
  }

  return (
    <section className="page-content modifications-content">
      <PageHeader eyebrow="Suivi ECR" title="Modifications" subtitle="Créez une demande, sélectionnez-la, puis pilotez ses phases et actions sans quitter cette page." />
      <div className="modifications-toolbar">
        <div className="search request-search">
          <Search size={16} />
          <input
            aria-label="Rechercher une modification"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher"
          />
          {requestSearchSuggestions.length > 0 && (
            <div className="request-search-suggestions" role="listbox">
              {requestSearchSuggestions.map(({ request, label }) => (
                <button
                  key={request.id}
                  type="button"
                  role="option"
                  aria-selected={selectedId === request.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    selectRequest(request);
                    setQuery(label);
                  }}
                >
                  <strong>{label}</strong>
                  <span>{request.modificationProject || request.client || request.product || "-"}</span>
                  <small className={`stage-pill ${stageColorClass(request.currentStage, Boolean(request.newVersion))}`}>{stageLabel(request.currentStage, Boolean(request.newVersion))}</small>
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="project-filter">
          <FolderKanban size={12} />
          <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
            <option value="">Tous les projets</option>
            {projectOptions.map((projectName) => (
              <option key={projectName} value={projectName}>{projectName}</option>
            ))}
          </select>
        </label>
        <label className="project-filter request-type-filter">
          <ClipboardList size={16} />
          <select
            aria-label="Filtrer par type de modification"
            value={requestTypeFilter}
            onChange={(event) => setRequestTypeFilter(event.target.value)}
          >
            <option value="">Tous les types</option>
            <option value="normal">Modifications normales</option>
            <option value="new-project">Nouveaux projets</option>
          </select>
        </label>
        <button className="secondary-action request-list-action" type="button" onClick={() => setListOpen(true)}>
          <ClipboardList size={16} />
          Liste modifications
        </button>
        <label className="project-filter request-status-filter">
          <ClipboardList size={16} />
          <select
            aria-label="Filtrer les modifications"
            disabled={saving}
            value={requestArchiveView}
            onChange={(event) => onRequestArchiveViewChange(event.target.value)}
          >
            {requestStatusOptions.map(([view, label]) => (
              <option key={view} value={view}>{label}</option>
            ))}
          </select>
        </label>
        <button className="primary-action request-create-action" type="button" onClick={() => {
          setShowCreateForm(true);
        }} disabled={!canCreateRequest(currentUser, projects)}>
          <Plus size={16} />
          Nouvelle ECR
        </button>
      </div>
      <div className={userSidebarOpen ? "work-layout with-user-sidebar" : "work-layout"}>
        <section className="detail-panel">
          {selectedRequest ? (
            <>
              <div className="details-toggle-row">
                {detailsCollapsed && (
                  <div className="details-collapsed-summary">
                    <strong>{requestDisplayName(selectedRequest)}</strong>
                    <span>Projet: {selectedRequest.modificationProject || "-"}</span>
                    <span>Client: {selectedRequest.client || "-"}</span>
                    <span>Pilote: {selectedRequest.pilot || "-"}</span>
                  </div>
                )}
                <button
                  className="ghost-icon details-edit-button"
                  disabled={!canEditRequest || saving}
                  type="button"
                  onClick={() => onEditRequest(selectedRequest)}
                  title="Modifier la modification"
                  aria-label="Modifier la modification"
                >
                  <Pencil size={18} />
                </button>
                {canCancelRequest && (
                  <button
                    className="details-cancel-button"
                    disabled={saving}
                    type="button"
                    onClick={() => handleCancelEcr(selectedRequest)}
                    title="Annuler la modification"
                    aria-label="Annuler la modification"
                  >
                    <XCircle size={18} />
                    <span>Annuler la modification</span>
                  </button>
                )}
                {canRequestClosure && (
                  <button
                    className="primary-action compact-action"
                    disabled={saving}
                    type="button"
                    onClick={handleRequestClosure}
                    title="Demander la cloture"
                  >
                    <CheckCircle2 size={18} />
                    <span>Demander cloture</span>
                  </button>
                )}
                {selectedRequest.closureRequested && !requestTerminal && !canCloseRequest && (
                  <span className="stage-pill stage-closed">Cloture demandee</span>
                )}
                {canCloseRequest && (
                  <button
                    className="primary-action compact-action"
                    disabled={saving}
                    type="button"
                    onClick={handleCloseRequest}
                    title="Marquer terminée ou cloturée"
                  >
                    <CheckCircle2 size={18} />
                    <span>Marquer cloturée</span>
                  </button>
                )}
                <button
                  className="ghost-icon details-toggle-button"
                  type="button"
                  onClick={() => setDetailsCollapsed((value) => !value)}
                  title={detailsCollapsed ? "Afficher les details" : "Masquer les details"}
                  aria-label={detailsCollapsed ? "Afficher les details" : "Masquer les details"}
                >
                  {detailsCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                </button>
              </div>
              {requestTerminal && (
                <div className={`readonly-banner ${isCancelledRequest(selectedRequest) ? "cancelled" : "closed"}`}>
                  <CircleAlert size={20} />
                  <div>
                    <strong>{isCancelledRequest(selectedRequest) ? "Modification annulee - consultation uniquement" : "Modification cloturee - consultation uniquement"}</strong>
                    <span>Ce dossier est en lecture seule. Les informations, actions, preuves et phases ne peuvent plus etre modifiees.</span>
                  </div>
                </div>
              )}
              {!detailsCollapsed && (
              <header className="details-header">
                <div>
                  <p className="eyebrow">Demande ECR</p>
                  <h2>{requestDisplayName(selectedRequest)}</h2>
                  <p>{selectedRequest.modificationReason || "Aucune description renseignée pour le moment."}</p>
                  {selectedRequest.modificationDetail && <p>{selectedRequest.modificationDetail}</p>}
                </div>
                <div className="meta-grid">
                  <div><ClipboardList size={16} /><span>Projet</span><strong>{selectedRequest.modificationProject || "À définir"}</strong></div>
                  <div><ClipboardList size={16} /><span>Client</span><strong>{selectedRequest.client || "-"}</strong></div>
                  <div>
                    <ClipboardList size={16} />
                    <span>Produit</span>
                    <span className="meta-reference-summary">
                      <strong>{parseSelectedProducts(selectedRequest.product)[0] || "-"}</strong>
                      {parseSelectedProducts(selectedRequest.product).length > 1 && (
                        <button
                          className="ghost-icon meta-reference-expand"
                          type="button"
                          onClick={() => setReferenceDialog({ title: "Produits", items: parseSelectedProducts(selectedRequest.product) })}
                          title="Afficher tous les produits"
                          aria-label="Afficher tous les produits"
                        >
                          <Maximize2 size={14} />
                        </button>
                      )}
                    </span>
                  </div>
                  <div>
                    <ClipboardList size={16} />
                    <span>Produits finis</span>
                    <span className="meta-reference-summary">
                      <strong>{parseSelectedProducts(selectedRequest.finishedProducts)[0] || "-"}</strong>
                      {parseSelectedProducts(selectedRequest.finishedProducts).length > 1 && (
                        <button
                          className="ghost-icon meta-reference-expand"
                          type="button"
                          onClick={() => setReferenceDialog({ title: "Produits finis", items: parseSelectedProducts(selectedRequest.finishedProducts) })}
                          title="Afficher tous les produits finis"
                          aria-label="Afficher tous les produits finis"
                        >
                          <Maximize2 size={14} />
                        </button>
                      )}
                    </span>
                  </div>
                  <div><Gauge size={16} /><span>Pilote</span><strong>{selectedRequest.pilot || "À définir"}</strong></div>
                  <div><CalendarDays size={16} /><span>Réception</span><strong>{selectedRequest.receptionDate || "-"}</strong></div>
                  <div><CalendarDays size={16} /><span>SOP</span><strong>{selectedRequest.sopDate || "-"}</strong></div>
                  <div><ClipboardList size={16} /><span>Mixabilité</span><strong>{mixabilityLabel(selectedRequest.mixability)}</strong></div>
                  <div className="meta-grid-type">
                    <ClipboardList size={16} />
                    <span>Type</span>
                    <ul>
                      {modificationTypesList(selectedRequest).length === 0 ? (
                        <li>-</li>
                      ) : modificationTypesList(selectedRequest).map((type) => (
                        <li key={type}>{type}</li>
                      ))}
                    </ul>
                  </div>
                  {selectedRequest.previousPilot && normalizeRoleToken(selectedRequest.previousPilot) !== normalizeRoleToken(selectedRequest.pilot) && (
                    <div><Gauge size={16} /><span>Ancien pilote</span><strong>{selectedRequest.previousPilot}</strong></div>
                  )}
                </div>
                <button className="dossier-review-card" type="button" onClick={() => setDossierDialogOpen(true)} title="Ouvrir la revue dossier">
                  <FileText size={24} />
                  <span>Revue dossier</span>
                </button>
                {canExportGantt && (
                  <>
                    <button className="dossier-review-card" type="button" onClick={exportModificationDossierExcel} title="Extraire le dossier de modification Excel">
                      <FileSpreadsheet size={24} />
                      <span>Dossier Excel</span>
                    </button>
                    <button className="dossier-review-card" type="button" onClick={exportProfessionalDossierPdf} title="Generer le dossier ECR PDF professionnel">
                      <FileText size={24} />
                      <span>Dossier PDF</span>
                    </button>
                    <button className="dossier-review-card" type="button" onClick={exportModificationGanttPdf} title="Telecharger le diagramme de Gantt imprimable">
                      <CalendarDays size={24} />
                      <span>Gantt</span>
                    </button>
                  </>
                )}
                {(selectedRequest.beforePhotoUrl || selectedRequest.afterPhotoUrl) && (
                  <div className="request-image-grid">
                    {selectedRequest.beforePhotoUrl && (
                      <RequestDocumentCard
                        contentType={selectedRequest.beforePhotoContentType}
                        onPreview={setPreviewImage}
                        sourceUrl={selectedRequest.beforePhotoUrl}
                        title="Photo était"
                        url={ecrRequestFileDownloadUrl(selectedRequest.id, "before")}
                      />
                    )}
                    {selectedRequest.afterPhotoUrl && (
                      <RequestDocumentCard
                        contentType={selectedRequest.afterPhotoContentType}
                        onPreview={setPreviewImage}
                        sourceUrl={selectedRequest.afterPhotoUrl}
                        title="Photo devient"
                        url={ecrRequestFileDownloadUrl(selectedRequest.id, "after")}
                      />
                    )}
                  </div>
                )}
              </header>
              )}
              <section className="request-workspace">
                <nav className="stage-tabs">
                  {selectedStages.map(([key, label]) => {
                    const closedByCancellation = selectedRequest.currentStage === "CANCELLED" && key !== "CANCELLED";
                    return (
                      <button
                        key={key}
                        className={`tab ${stageColorClass(key, Boolean(selectedRequest.newVersion))}${selectedStage === key ? " active" : ""}${closedByCancellation ? " closed" : ""}`}
                        onClick={() => (canAdmin ? handleStageChange(key) : setSelectedStage(key))}
                      >
                        {label}
                      </button>
                    );
                  })}
                </nav>
                <section className="progress-row">
                  <div><span>Avancement checklist</span><strong>{completion}%</strong></div>
                  <div className="progress-track"><span style={{ width: `${completion}%` }} /></div>
                </section>
                <PhaseValidationPanel
                  canAdmin={canAdmin}
                  canRequestValidation={canRequestValidation}
                  canValidate={canValidate}
                  isCurrentStage={isCurrentStage}
                  latestValidation={latestStageValidation}
                  readOnly={requestTerminal}
                  saving={saving}
                  stageActionsDone={stageActionsDone}
                  validationRate={latestStageValidation?.validationRate ?? 0}
                  validation={currentValidation}
                  onApprove={handleApprovePhase}
                  onReject={(validation) => handleRejectPhase(validation, actions)}
                  onReopen={handleReopenPhase}
                  onRequest={handleRequestPhaseValidation}
                />
                <ActionsPanel
                  actionForm={actionForm}
                  actionRoleOptions={actionRoleOptions}
                  actions={visibleActions}
                  currentUser={currentUser}
                  doneCount={visibleActions.filter(isActionDone).length}
                  handleCreateAction={handleCreateAction}
                  handleDeleteAction={handleDeleteAction}
                  handleToggleAction={handleToggleAction}
                  handleUpdateActionDuration={handleUpdateActionDuration}

                  handleApproveActionValidation={handleApproveActionValidation}
                  handleRejectActionValidation={handleRejectActionValidation}
                  handleRequestActionValidation={handleRequestActionValidation}
                  handleDeleteActionAsset={handleDeleteActionAsset}
                  handleUploadEvidence={handleUploadEvidence}
                  handleAddEvidenceLink={handleAddEvidenceLink}
                  isCriticalAction={isCriticalAction}
                  canAdmin={canAdmin}
                  lateActions={visibleActions.filter((action) => action.late).length}
                  requiresEvidence={requiresEvidence}
                  saving={saving}
                  selectedRequest={selectedRequest}
                  phaseValidation={currentValidation}
                  phaseValidations={phaseValidations}
                  projects={projects}
                  readOnly={requestTerminal}
                  stageNewProject={Boolean(selectedRequest.newVersion)}
                  selectedStages={selectedStages}
                  selectedStage={selectedStage}
                  updateActionForm={updateActionForm}
                  removeActionProofDocumentFile={removeActionProofDocumentFile}
                  users={users}
                />
                <ChecklistPanel checklist={checklist} />
              </section>
            </>
          ) : (
            <EmptyState title="Aucune demande sélectionnée" text="Sélectionnez une demande dans la liste ou créez une nouvelle modification." />
          )}
        </section>
        {userSidebarOpen && (
          <aside className="user-modifications-sidebar" aria-label="Mes modifications">
            <header>
              <div>
                <p className="eyebrow">Utilisateur</p>
                <h2>Mes modifications</h2>
                <span>{authenticatedUserRequests.length} dossier{authenticatedUserRequests.length > 1 ? "s" : ""}</span>
              </div>
              <button className="ghost-icon" type="button" onClick={() => setUserSidebarOpen(false)} title="Fermer le panneau">
                <X size={18} />
              </button>
            </header>
            <div className="user-modifications-list">
              {authenticatedUserRequests.length === 0 ? (
                <EmptyState title="Aucun dossier" text="Aucune modification n'est affectee a votre nom." compact />
              ) : authenticatedUserRequests.map((request) => (
                <button
                  className={request.id === selectedId ? "user-modification-item active" : "user-modification-item"}
                  key={request.id}
                  type="button"
                  onClick={() => selectRequest(request)}
                >
                  <strong>{requestDisplayName(request)}</strong>
                  <span>{request.modificationProject || request.client || "-"}</span>
                  <small className={`stage-pill ${stageColorClass(request.currentStage, Boolean(request.newVersion))}`}>{stageLabel(request.currentStage, Boolean(request.newVersion))}</small>
                </button>
              ))}
            </div>
          </aside>
        )}
      </div>
      {!userSidebarOpen && (
        <button className="user-sidebar-open-tab" type="button" onClick={() => setUserSidebarOpen(true)}>
          <ClipboardList size={16} />
        </button>
      )}
      {listOpen && (
        <div className="dialog-backdrop" role="presentation">
          <section
            aria-labelledby="request-dialog-title"
            aria-modal="true"
            className="request-dialog"
            role="dialog"
          >
            <header className="actions-dialog-header">
              <div>
                <p className="eyebrow">Sélection</p>
                <h2 id="request-dialog-title">Liste des modifications</h2>
                <span>{filteredRequests.length} résultat{filteredRequests.length > 1 ? "s" : ""}</span>
              </div>
              <button className="ghost-icon" type="button" onClick={() => setListOpen(false)} title="Fermer">
                <X size={18} />
              </button>
            </header>
            <div className="request-list">
              {filteredRequests.length === 0 ? (
                <EmptyState title="Aucun résultat" text="Essayez un client, un projet, un produit ou un pilote." compact />
              ) : filteredRequests.map((request) => (
                <article className="request-card-row" key={request.id}>
                <button
                  className={request.id === selectedId ? "request-card active" : "request-card"}
                  onClick={() => selectRequest(request)}
                  type="button"
                >
                  <span className="request-title">{request.modificationNumber || request.client}</span>
                  <span>{request.modificationProject || request.product || "Projet non renseigné"}</span>
                  <div className="request-card-status">
                    <strong className={`stage-pill ${stageColorClass(request.currentStage, Boolean(request.newVersion))}`}>{stageLabel(request.currentStage, Boolean(request.newVersion))}</strong>
                    {request.archived && <span className="archive-badge">Archivée</span>}
                  </div>
                </button>
                  {canAdmin && (
                    <button
                      className="ghost-icon archive-request-action"
                      disabled={saving}
                      type="button"
                      onClick={() => handleArchiveEcr(request, !request.archived)}
                      title={request.archived ? "Desarchiver la modification" : "Archiver la modification"}
                    >
                      {request.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
      {previewImage && (
        <div className="dialog-backdrop" role="presentation">
          <section
            aria-labelledby="image-preview-title"
            aria-modal="true"
            className="image-preview-dialog"
            role="dialog"
          >
            <header className="actions-dialog-header">
              <div>
                <p className="eyebrow">Aperçu</p>
                <h2 id="image-preview-title">{previewImage.title}</h2>
              </div>
              <button className="ghost-icon" type="button" onClick={() => setPreviewImage(null)} title="Fermer">
                <X size={18} />
              </button>
            </header>
            <div className="image-preview-frame">
              <img alt={previewImage.title} src={previewImage.url} />
            </div>
          </section>
        </div>
      )}
      {referenceDialog && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setReferenceDialog(null)}>
          <section
            aria-labelledby="reference-list-dialog-title"
            aria-modal="true"
            className="reference-list-dialog"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="actions-dialog-header">
              <div>
                <p className="eyebrow">Liste complète</p>
                <h2 id="reference-list-dialog-title">{referenceDialog.title}</h2>
                <span>{referenceDialog.items.length} élément{referenceDialog.items.length > 1 ? "s" : ""}</span>
              </div>
              <button className="ghost-icon" type="button" onClick={() => setReferenceDialog(null)} title="Fermer">
                <X size={18} />
              </button>
            </header>
            <ol className="reference-dialog-list">
              {referenceDialog.items.map((item) => <li key={item}>{item}</li>)}
            </ol>
          </section>
        </div>
      )}
      {dossierDialogOpen && selectedRequest && (
        <DossierReviewDialog
          canExport={canExportDossierReview}
          canManage={canManageDossierReview}
          downloadBlobFile={downloadBlobFile}
          downloadHtmlAsPdf={downloadHtmlAsPdf}
          downloadTextFile={downloadTextFile}
          errorAlert={errorAlert}
          formatFileSize={formatFileSize}
          request={selectedRequest}
          saving={saving}
          successToast={successToast}
          onClose={() => setDossierDialogOpen(false)}
          onSubmit={(value) => onUpdateDossierReview(selectedRequest, value)}
        />
      )}
    </section>
  );
}

ModificationsPage.propTypes = {
  actionForm: PropTypes.object.isRequired,
  actionRoleOptions: PropTypes.array.isRequired,
  actions: PropTypes.array.isRequired,
  actionsByRequestId: PropTypes.object,
  checklist: PropTypes.array.isRequired,
  completion: PropTypes.number.isRequired,
  currentUser: PropTypes.object,
  filteredRequests: PropTypes.array.isRequired,
  handleArchiveEcr: PropTypes.func.isRequired,
  handleCancelEcr: PropTypes.func.isRequired,
  handleCreateAction: PropTypes.func.isRequired,
  handleDeleteAction: PropTypes.func.isRequired,
  handleStageChange: PropTypes.func.isRequired,
  handleToggleAction: PropTypes.func.isRequired,
  handleUpdateActionDuration: PropTypes.func.isRequired,
  handleDeleteActionAsset: PropTypes.func.isRequired,
  handleUploadEvidence: PropTypes.func.isRequired,
  handleAddEvidenceLink: PropTypes.func.isRequired,
  removeActionProofDocumentFile: PropTypes.func.isRequired,
  handleApprovePhase: PropTypes.func.isRequired,
  handleApproveActionValidation: PropTypes.func.isRequired,
  handleCloseRequest: PropTypes.func.isRequired,
  handleRejectActionValidation: PropTypes.func.isRequired,
  handleRequestActionValidation: PropTypes.func.isRequired,
  handleRejectPhase: PropTypes.func.isRequired,
  handleReopenPhase: PropTypes.func.isRequired,
  handleRequestClosure: PropTypes.func.isRequired,
  handleRequestPhaseValidation: PropTypes.func.isRequired,
  isCriticalAction: PropTypes.func.isRequired,
  phaseValidations: PropTypes.array.isRequired,
  projects: PropTypes.array,
  projectFilter: PropTypes.string.isRequired,
  projectOptions: PropTypes.array.isRequired,
  query: PropTypes.string.isRequired,
  requests: PropTypes.array,
  requestSearchSuggestions: PropTypes.array.isRequired,
  requestArchiveView: PropTypes.string.isRequired,
  requestTypeFilter: PropTypes.string.isRequired,
  onEditRequest: PropTypes.func.isRequired,
  onRequestArchiveViewChange: PropTypes.func.isRequired,
  onUpdateDossierReview: PropTypes.func.isRequired,
  saving: PropTypes.bool.isRequired,
  selectedId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  selectedRequest: PropTypes.object,
  selectedStages: PropTypes.array.isRequired,
  selectedStage: PropTypes.string.isRequired,
  setSaving: PropTypes.func.isRequired,
  setProjectFilter: PropTypes.func.isRequired,
  setQuery: PropTypes.func.isRequired,
  setSelectedId: PropTypes.func.isRequired,
  setSelectedStage: PropTypes.func.isRequired,
  setShowCreateForm: PropTypes.func.isRequired,
  setRequestTypeFilter: PropTypes.func.isRequired,
  requiresEvidence: PropTypes.func.isRequired,
  updateActionForm: PropTypes.func.isRequired,
  users: PropTypes.array
};

function phaseValidationStatusText({ canRequestValidation, isCurrentStage, phaseApproved, phaseReopened, stageActionsDone, validation }) {
  if (!isCurrentStage) return "Cette phase est consultable, mais seule la phase courante peut être envoyée en validation";
  if (phaseApproved) return "Phase déjà validée";
  if (phaseReopened) return "Phase rouverte, en attente de reprise";
  if (validation) return "Demande en attente de validation";
  if (!canRequestValidation) return "Seul le pilote ou le chef de projet de la modification peut demander la validation";
  if (stageActionsDone) return "Phase prête a envoyér en validation";
  return "Toutes les actions doivent être terminées";
}

function PhaseValidationPanel({ canAdmin, canRequestValidation, canValidate, isCurrentStage, latestValidation, readOnly = false, saving, stageActionsDone, validation, validationRate, onApprove, onReject, onReopen, onRequest }) {
  const phaseApproved = latestValidation?.status === "APPROVED";
  const phaseReopened = latestValidation?.status === "REOPENED";
  const displayedRate = latestValidation?.validationRate ?? validationRate ?? 0;
  const allActionsValidated = validation && ((validation.totalActions || 0) === 0 || (validation.approvedActions || 0) >= (validation.totalActions || 0));
  const statusText = phaseValidationStatusText({
    canRequestValidation,
    isCurrentStage,
    phaseApproved,
    phaseReopened,
    stageActionsDone,
    validation
  });
  return (
    <section className="panel phase-validation-panel">
      <div>
        <strong>Validation de phase</strong>
        <span>{statusText}</span>
        {latestValidation && latestValidation.status !== "PENDING" && (
          <div className={`phase-validation-result ${String(latestValidation.status).toLowerCase()}`}>
            <b>{phaseValidationStatusLabel(latestValidation.status)}</b>
            {latestValidation.reviewedBy && <span>Par {latestValidation.reviewedBy}</span>}
            {latestValidation.refusalReason && <p>Raison: {latestValidation.refusalReason}</p>}
            {latestValidation.actionsToRevisit && <p>Actions à revisiter: {latestValidation.actionsToRevisit}</p>}
          </div>
        )}
        {latestValidation && latestValidation.status === "PENDING" && (
          <div className="phase-validation-rate">
            <span>{latestValidation.approvedActions || 0}/{latestValidation.totalActions || 0} actions validées</span>
            <strong>{displayedRate}%</strong>
            <div className="progress-track"><span style={{ width: `${displayedRate}%` }} /></div>
          </div>
        )}
      </div>
      <div className="row-actions">
        {!validation && !phaseApproved && (
          <button className="secondary-action compact-action" disabled={readOnly || !canRequestValidation || !isCurrentStage || !stageActionsDone || saving} type="button" onClick={onRequest}>
            Demander validation
          </button>
        )}
        {validation && canValidate && (
          <>
            <button className="secondary-action compact-action" disabled={readOnly || !isCurrentStage || saving} type="button" onClick={() => onReject(validation)}>
              Refuser
            </button>
            <button className="primary-action compact-action" disabled={readOnly || !isCurrentStage || !allActionsValidated || saving} type="button" onClick={() => onApprove(validation)}>
              Valider phase
            </button>
          </>
        )}
        {canAdmin && phaseApproved && !isCurrentStage && (
          <button className="primary-action compact-action" disabled={readOnly || saving} type="button" onClick={() => onReopen(latestValidation)}>
            Rouvrir la phase
          </button>
        )}
      </div>
    </section>
  );
}

PhaseValidationPanel.propTypes = {
  canAdmin: PropTypes.bool.isRequired,
  canRequestValidation: PropTypes.bool.isRequired,
  canValidate: PropTypes.bool.isRequired,
  isCurrentStage: PropTypes.bool,
  latestValidation: PropTypes.shape({
    actionsToRevisit: PropTypes.string,
    approvedActions: PropTypes.number,
    refusalReason: PropTypes.string,
    reviewedBy: PropTypes.string,
    status: PropTypes.string,
    totalActions: PropTypes.number,
    validationRate: PropTypes.number
  }),
  readOnly: PropTypes.bool,
  saving: PropTypes.bool.isRequired,
  stageActionsDone: PropTypes.bool.isRequired,
  validation: PropTypes.shape({
    approvedActions: PropTypes.number,
    totalActions: PropTypes.number
  }),
  validationRate: PropTypes.number,
  onApprove: PropTypes.func.isRequired,
  onReject: PropTypes.func.isRequired,
  onReopen: PropTypes.func.isRequired,
  onRequest: PropTypes.func.isRequired
};

function phaseValidationStatusLabel(status) {
  if (status === "APPROVED") return "Phase validée";
  if (status === "REOPENED") return "Phase rouverte";
  return "Phase refusée";
}

function actionParticipantDisplay({ historical, value, fallback, selectedRequest, projects, users }) {
  if (historical) return value || fallback;
  return projectRoleAssigneeDisplay(value, selectedRequest, projects, users) || fallback;
}

function blockingActionStatusClass(action, isBlocked) {
  if (isBlocked) return "status late";
  if (action.dependsOnActionId) return "status done";
  return "";
}

function actionValidationDisplay(status) {
  if (status === "APPROVED") return { className: "done", label: "Validee" };
  if (status === "REJECTED") return { className: "late", label: "Refusee" };
  return { className: "in_progress", label: "En attente" };
}

function ActionsPanel({ actionForm, actionRoleOptions, actions, canAdmin, currentUser, doneCount, handleCreateAction, handleDeleteAction, handleToggleAction, handleUpdateActionDuration, handleApproveActionValidation, handleRejectActionValidation, handleRequestActionValidation, handleDeleteActionAsset, handleUploadEvidence, handleAddEvidenceLink, isCriticalAction, lateActions, phaseValidation, phaseValidations = [], projects = [], readOnly = false, requiresEvidence, saving, selectedRequest, selectedStages, selectedStage, stageNewProject, updateActionForm, removeActionProofDocumentFile, users = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const stageTitle = stageLabel(selectedStage, stageNewProject);
  const canCreateAction = !readOnly && (canAdmin || isRequestPilot(currentUser, selectedRequest, projects));

  function openCreateAction() {
    updateActionForm("stage", selectedRequest?.currentStage || selectedStage);
    setCreateOpen(true);
  }

  function submitCreateAction(event) {
    handleCreateAction(event).then(() => setCreateOpen(false)).catch(() => {});
  }

  return (
    <section className="data-section">
      <div className="section-title">
        <div>
          <h2>Actions - {stageTitle}</h2>
          <span>{doneCount}/{actions.length} terminées / {lateActions} retards</span>
        </div>
        <div className="row-actions">
          <button className="primary-action compact-action" disabled={!canCreateAction} type="button" onClick={openCreateAction} title="Ajouter une action">
            <Plus size={15} />
            Ajouter action
          </button>
          <button className="secondary-action compact-action" type="button" onClick={() => setExpanded(true)} title="Agrandir les actions">
            <Maximize2 size={15} />
            Agrandir
          </button>
        </div>
      </div>
      <ActionList
        actionRoleOptions={actionRoleOptions}
        actions={actions}
        currentUser={currentUser}
        phaseValidation={phaseValidation}
        handleApproveActionValidation={handleApproveActionValidation}
        handleRejectActionValidation={handleRejectActionValidation}
        handleRequestActionValidation={handleRequestActionValidation}
        handleDeleteAction={handleDeleteAction}
        handleToggleAction={handleToggleAction}
        handleUpdateActionDuration={handleUpdateActionDuration}
        handleDeleteActionAsset={handleDeleteActionAsset}
        handleUploadEvidence={handleUploadEvidence}
        handleAddEvidenceLink={handleAddEvidenceLink}
        canAdmin={canAdmin}
        isCriticalAction={isCriticalAction}
        requiresEvidence={requiresEvidence}
        phaseValidations={phaseValidations}
        projects={projects}
        readOnly={readOnly}
        saving={saving}
        selectedRequest={selectedRequest}
        users={users}
      />
      {expanded && (
        <div className="dialog-backdrop" role="presentation">
          <section
            aria-labelledby="expanded-actions-title"
            aria-modal="true"
            className="actions-dialog"
            role="dialog"
          >
            <header className="actions-dialog-header">
              <div>
                <p className="eyebrow">Phase</p>
                <h2 id="expanded-actions-title">Actions - {stageTitle}</h2>
                <span>{doneCount}/{actions.length} terminées / {lateActions} retards</span>
              </div>
              <button className="ghost-icon" type="button" onClick={() => setExpanded(false)} title="Fermer">
                <X size={18} />
              </button>
            </header>
            <ActionList
              actionRoleOptions={actionRoleOptions}
              actions={actions}
              currentUser={currentUser}
              phaseValidation={phaseValidation}
              handleApproveActionValidation={handleApproveActionValidation}
              handleRejectActionValidation={handleRejectActionValidation}
              handleRequestActionValidation={handleRequestActionValidation}
              handleDeleteAction={handleDeleteAction}
              expanded
              handleToggleAction={handleToggleAction}
              handleUpdateActionDuration={handleUpdateActionDuration}
              handleDeleteActionAsset={handleDeleteActionAsset}
              handleUploadEvidence={handleUploadEvidence}
              handleAddEvidenceLink={handleAddEvidenceLink}
              canAdmin={canAdmin}
              isCriticalAction={isCriticalAction}
              requiresEvidence={requiresEvidence}
              phaseValidations={phaseValidations}
              projects={projects}
              readOnly={readOnly}
              saving={saving}
              selectedRequest={selectedRequest}
              users={users}
            />
          </section>
        </div>
      )}
      {createOpen && (
        <ActionCreateDialog
          actionForm={actionForm}
          actionRoleOptions={actionRoleOptions}
          actions={actions}
          isCriticalAction={isCriticalAction}
          saving={saving}
          selectedStages={selectedStages}
          stageNewProject={stageNewProject}
          onClose={() => setCreateOpen(false)}
          onSubmit={submitCreateAction}
          updateActionForm={updateActionForm}
          removeActionProofDocumentFile={removeActionProofDocumentFile}
        />
      )}
    </section>
  );
}

ActionsPanel.propTypes = {
  actionForm: PropTypes.object.isRequired,
  actionRoleOptions: PropTypes.array.isRequired,
  actions: PropTypes.array.isRequired,
  canAdmin: PropTypes.bool.isRequired,
  currentUser: PropTypes.object,
  doneCount: PropTypes.number.isRequired,
  handleCreateAction: PropTypes.func.isRequired,
  handleDeleteAction: PropTypes.func.isRequired,
  handleToggleAction: PropTypes.func.isRequired,
  handleUpdateActionDuration: PropTypes.func.isRequired,
  handleApproveActionValidation: PropTypes.func.isRequired,
  handleRejectActionValidation: PropTypes.func.isRequired,
  handleRequestActionValidation: PropTypes.func.isRequired,
  handleDeleteActionAsset: PropTypes.func.isRequired,
  handleUploadEvidence: PropTypes.func.isRequired,
  handleAddEvidenceLink: PropTypes.func.isRequired,
  isCriticalAction: PropTypes.func.isRequired,
  lateActions: PropTypes.number.isRequired,
  phaseValidation: PropTypes.object,
  phaseValidations: PropTypes.array,
  projects: PropTypes.array,
  readOnly: PropTypes.bool,
  requiresEvidence: PropTypes.func.isRequired,
  saving: PropTypes.bool.isRequired,
  selectedRequest: PropTypes.object,
  selectedStages: PropTypes.array.isRequired,
  selectedStage: PropTypes.string.isRequired,
  stageNewProject: PropTypes.bool.isRequired,
  updateActionForm: PropTypes.func.isRequired,
  removeActionProofDocumentFile: PropTypes.func.isRequired,
  users: PropTypes.array
};

function ActionList({ actions, canAdmin = false, currentUser, expanded = false, phaseValidation, phaseValidations = [], projects = [], readOnly = false, handleToggleAction, handleUpdateActionDuration, handleApproveActionValidation, handleRejectActionValidation, handleRequestActionValidation, handleDeleteAction, handleDeleteActionAsset, handleUploadEvidence, handleAddEvidenceLink, requiresEvidence, saving, selectedRequest, users = [] }) {
  const [durationValues, setDurationValues] = useState({});
  const [assetLinks, setAssetLinks] = useState({});

  useEffect(() => {
    setDurationValues((current) => {
      const nextValues = {};
      actions.forEach((action) => {
        nextValues[action.id] = String(action.workDurationDays ?? 1);
      });
      return nextValues;
    });
  }, [actions]);

  function updateAssetLink(actionId, field, value) {
    setAssetLinks((current) => ({
      ...current,
      [actionId]: {
        ...(current[actionId] || {}),
        [field]: value
      }
    }));
  }

  function submitAssetLink(action) {
    const link = assetLinks[action.id] || {};
    if (!link.url?.trim()) return;
    handleAddEvidenceLink?.(action, link);
    setAssetLinks((current) => ({
      ...current,
      [action.id]: { name: "", url: "" }
    }));
  }

  return (
    <>
      <div className={expanded ? "action-list expanded" : "action-list"}>
        {actions.length === 0 ? (
          <EmptyState
            title="Aucune action pour cette phase"
            text={canAdmin ? "Ajoutez une action ou utilisez les actions generees lors de la creation ECR." : "Vous n'avez aucune action affectee dans la phase active."}
          />
        ) : (
          [...actions].sort(compareActionDisplayOrder).map((action, index) => {
            const blockingAction = blockingActionFor(action, actions);
            const isBlocked = Boolean(action.dependsOnActionId && (!blockingAction || !isActionDone(blockingAction)));
            const canDeleteAction = !readOnly && canDeleteActionForUser(currentUser, action, selectedRequest, phaseValidations, projects);
            const canEditDuration = !readOnly && canEditActionDurationForUser(currentUser, action, selectedRequest, phaseValidations, projects);
            const canManageAction = !readOnly && canManageActionForUser(currentUser, action, phaseValidations, selectedRequest);
            const canAddAsset = !readOnly && !isActionPhaseApproved(action, phaseValidations) && isActionPilotForUser(currentUser, action, selectedRequest, projects);
            const canToggleAction = !readOnly && canToggleActionForUser(currentUser, action, selectedRequest, phaseValidations, projects);
            const historical = isHistoricalActionDisplay(action);
            const responsibleDisplay = actionParticipantDisplay({
              historical,
              value: action.responsible,
              fallback: "À définir",
              selectedRequest,
              projects,
              users
            });
            const validatorDisplay = actionParticipantDisplay({
              historical,
              value: action.validatorDisplayName || action.validator,
              fallback: "à définir",
              selectedRequest,
              projects,
              users
            });
            const validationDisplay = actionValidationDisplay(action.validationStatus);

            return (
            <article className={action.late ? "action-row late" : "action-row"} key={action.id}>
              <label className="action-check" title={isActionDone(action) ? "Marquer non terminée" : "Marquer terminée"}>
                <input aria-label={`Changer le statut de ${action.title || "l'action"}`} checked={isActionDone(action)} disabled={saving || !canToggleAction} onChange={(event) => handleToggleAction(action, event.target.checked)} type="checkbox" />
              </label>
              <div className="action-main">
                <h3>{action.title}</h3>
                <p>{action.topicRisk || "-"}</p>
                {action.routineAction && (
                  <span className="routine-action-badge">
                    Routiniere - chaque {action.recurrenceIntervalDays || 1} jour{Number(action.recurrenceIntervalDays || 1) > 1 ? "s" : ""}{action.routineOccurrenceIndex ? ` - #${action.routineOccurrenceIndex}` : ""}
                  </span>
                )}
              </div>
              <div className="action-meta">
                <span><em>Ordre</em><strong>Action {index + 1}</strong></span>
                <span><em>Pilote</em><strong>{responsibleDisplay}</strong></span>
                <span><em>Validateur</em><strong>{validatorDisplay}</strong></span>
                <span><em>Criticité</em><strong className={`criticality ${criticalityClass(action.criticality)}`}>{action.criticality || "3-faible"}</strong></span>
                <span className="blocking-action-meta"><em>Blocage</em><strong className={blockingActionStatusClass(action, isBlocked)}>{action.dependsOnActionId ? `Par: ${blockingActionLabel(action, actions)}` : "Aucune"}</strong></span>
                <span><em>Début</em><strong>{action.startDate || "-"}</strong></span>
                <span><em>Fin</em><strong>{action.endDate || "-"}</strong></span>
                <span><em>Finalisation</em><strong>{formattedDateTime(action.finalizationDate)}</strong></span>
                <span>
                  <em>Jours</em>
                  {canEditDuration ? (
                    <div className="action-duration-control">
                      <input
                        className="action-duration-input"
                        disabled={saving}
                        min="0"
                        type="number"
                        value={durationValues[action.id] ?? String(action.workDurationDays ?? 1)}
                        onChange={(event) => setDurationValues((current) => ({ ...current, [action.id]: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleUpdateActionDuration(action, event.currentTarget.value);
                          }
                        }}
                      />
                      <button
                        className="primary-action compact-action action-duration-update"
                        disabled={saving || Number(durationValues[action.id] ?? action.workDurationDays ?? 0) === Number(action.workDurationDays ?? 0)}
                        type="button"
                        onClick={() => handleUpdateActionDuration(action, durationValues[action.id] ?? action.workDurationDays)}
                      >
                        Mettre à jour
                      </button>
                    </div>
                  ) : (
                    <strong>{action.workDurationDays ?? "-"}</strong>
                  )}
                </span>
                <span><em>Asset</em><strong>{requiresEvidence(action) ? "Obligatoire" : "Optionnel"}</strong></span>
                <span className="evidence-meta">
                  <em>Element preuve</em>
                  <strong className="asset-link-list">
                    {actionProofDocuments(action).length > 0 ? actionProofDocuments(action).map((proofDocument) => (
                      <span className="asset-link-item" key={proofDocument.id || proofDocument.fileName}>
                        <SharedFileReference
                          label={proofDocument.fileName || "Element preuve"}
                          reference={{ url: actionProofDocumentItemUrl(action, proofDocument), value: proofDocument.fileUrl }}
                        />
                      </span>
                    )) : "-"}
                  </strong>
                </span>
                <span className="evidence-meta">
                  <em>Assets</em>
                  <strong className="asset-link-list">
                    {actionAssets(action).length > 0 ? actionAssets(action).map((asset) => (
                      <span className="asset-link-item" key={asset.id || asset.fileName}>
                        <SharedFileReference
                          label={asset.fileName || "Asset"}
                          reference={{ url: actionAssetUrl(action, asset), value: asset.fileUrl }}
                        />
                        {!asset.legacy && (
                          <button className="ghost-icon asset-delete-action" disabled={saving || !canManageAction} type="button" onClick={() => handleDeleteActionAsset(action, asset)} title="Supprimer l'asset">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </span>
                    )) : "-"}
                  </strong>
                  <label className={canAddAsset ? "row-upload asset-upload-action" : "row-upload asset-upload-action disabled"} title="Affecter un asset">
                    <Upload size={15} />
                    <input disabled={saving || !canAddAsset} multiple type="file" onChange={(event) => {
                      const selectedFiles = Array.from(event.currentTarget.files || []);
                      handleUploadEvidence(action, selectedFiles);
                      event.currentTarget.value = "";
                    }} />
                  </label>
                  {canAddAsset && (
                    <span className="asset-link-inputs compact-asset-link-inputs">
                      <input
                        disabled={saving}
                        placeholder="Nom du lien"
                        value={assetLinks[action.id]?.name || ""}
                        onChange={(event) => updateAssetLink(action.id, "name", event.target.value)}
                      />
                      <input
                        disabled={saving}
                        placeholder="Lien fichier partagé"
                        value={assetLinks[action.id]?.url || ""}
                        onChange={(event) => updateAssetLink(action.id, "url", event.target.value)}
                      />
                      <button
                        className="secondary-action compact-action"
                        disabled={saving || !assetLinks[action.id]?.url?.trim()}
                        type="button"
                        onClick={() => submitAssetLink(action)}
                      >
                        Ajouter lien
                      </button>
                    </span>
                  )}
                </span>
                <span><em>Status</em><small className={`status ${statusClass(action.status)}`}>{readableStatus(action.status)}</small></span>
                {canDeleteAction && (
                  <span className="action-row-actions">
                    <em>Action</em>
                    <button className="ghost-icon action-delete-action" disabled={saving} type="button" onClick={() => handleDeleteAction(action)} title="Supprimer l'action">
                      <Trash2 size={14} />
                    </button>
                  </span>
                )}
                {phaseValidation && (
                  <span className="action-validation-cell">
                    <em>Validation</em>
                    <small className={`status ${validationDisplay.className}`}>
                      {validationDisplay.label}
                    </small>
                    {!readOnly && isActionAwaitingValidation(action, phaseValidation) && canValidateActionForUser(currentUser, action) && (
                      <span className="action-validation-actions">
                        <button className="secondary-action compact-action action-validation-button reject" disabled={saving} type="button" onClick={() => handleRejectActionValidation(phaseValidation, action)}>
                          <XCircle size={14} />
                          Refuser
                        </button>
                        <button className="primary-action compact-action action-validation-button" disabled={saving} type="button" onClick={() => handleApproveActionValidation(phaseValidation, action)}>
                          <CheckCircle2 size={14} />
                          Valider
                        </button>
                      </span>
                    )}
                    {!readOnly && canRequestRejectedActionValidationForUser(currentUser, action, selectedRequest, projects) && phaseValidation?.status === "PENDING" && (
                      <button className="primary-action compact-action action-validation-button" disabled={saving} type="button" onClick={() => handleRequestActionValidation(phaseValidation, action)}>
                        <CheckCircle2 size={14} />
                        Redemander validation
                      </button>
                    )}
                    {action.validationReviewedBy && <strong>{action.validationReviewedBy}</strong>}
                    {action.validationRefusalReason && <strong className="action-refusal-reason">Motif: {action.validationRefusalReason}</strong>}
                  </span>
                )}
              </div>
            </article>
            );
          })
        )}
      </div>
    </>
  );
}

ActionList.propTypes = {
  actions: PropTypes.array.isRequired,
  canAdmin: PropTypes.bool,
  currentUser: PropTypes.object,
  expanded: PropTypes.bool,
  phaseValidation: PropTypes.object,
  phaseValidations: PropTypes.array,
  projects: PropTypes.array,
  readOnly: PropTypes.bool,
  handleToggleAction: PropTypes.func.isRequired,
  handleUpdateActionDuration: PropTypes.func.isRequired,
  handleApproveActionValidation: PropTypes.func.isRequired,
  handleRejectActionValidation: PropTypes.func.isRequired,
  handleRequestActionValidation: PropTypes.func.isRequired,
  handleDeleteAction: PropTypes.func.isRequired,
  handleDeleteActionAsset: PropTypes.func.isRequired,
  handleUploadEvidence: PropTypes.func.isRequired,
  handleAddEvidenceLink: PropTypes.func.isRequired,
  requiresEvidence: PropTypes.func.isRequired,
  saving: PropTypes.bool.isRequired,
  selectedRequest: PropTypes.object,
  users: PropTypes.array
};

function ActionSuggestionDialog({ saving, suggestions, onAdd, onClose, onIgnore }) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        aria-labelledby="action-suggestion-title"
        aria-modal="true"
        className="dialog-card action-suggestion-dialog panel"
        role="dialog"
      >
        <div className="form-intro">
          <div>
            <p className="eyebrow">Notification admin</p>
            <h2 id="action-suggestion-title">Actions créées par les pilotes</h2>
            <p>Decidez si chaque action locale doit aussi devenir une action standard.</p>
          </div>
          <button className="ghost-icon" type="button" onClick={onClose} title="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="suggestion-list">
          {suggestions.map((suggestion) => (
            <article className="suggestion-card" key={suggestion.id}>
              <div className="suggestion-main">
                <span className={`stage-pill ${stageColorClass(suggestion.stage, suggestion.newProject)}`}>{stageLabel(suggestion.stage, suggestion.newProject)}</span>
                <strong>{suggestion.actionTitle}</strong>
                <span>Modification: {suggestion.requestLabel || `#${suggestion.requestId}`}</span>
                <span>Creee par: {suggestion.createdBy || "-"}</span>
              </div>
              <div className="suggestion-details">
                <span><em>Topic / risque</em><strong>{suggestion.topicRisk || "-"}</strong></span>
                <span><em>Pilote</em><strong>{suggestion.responsible || "À définir"}</strong></span>
                <span><em>Validateur</em><strong>{suggestion.validator || "À définir"}</strong></span>
                <span><em>Criticité</em><strong className={`criticality ${criticalityClass(suggestion.criticality)}`}>{suggestion.criticality || "3-faible"}</strong></span>
                <span><em>Asset</em><strong>{suggestion.evidenceRequired ? "Obligatoire" : "Optionnel"}</strong></span>
                <span><em>Element preuve</em><strong>{suggestion.proofDocumentFileName || suggestion.proofDocument || "-"}</strong></span>
                <span><em>Durée</em><strong>{suggestion.durationDays ?? 1} j</strong></span>
                <span><em>Type standard cible</em><strong>{suggestion.newProject ? "Nouveau projet" : "Modification"}</strong></span>
              </div>
              <div className="row-actions">
                <button className="primary-action compact-action" disabled={saving} type="button" onClick={() => onAdd(suggestion)}>
                  Ajouter aux actions par defaut
                </button>
                <button className="secondary-action compact-action" disabled={saving} type="button" onClick={() => onIgnore(suggestion)}>
                  Ignorer l'action
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ActionRoleSelect({ options = [], placeholder = "Selectionner un role", required = false, value, onChange }) {
  const availableOptions = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <select required={required} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{placeholder}</option>
      {availableOptions.map((role) => (
        <option key={role} value={role}>{role}</option>
      ))}
    </select>
  );
}

ActionRoleSelect.propTypes = {
  options: PropTypes.arrayOf(PropTypes.string),
  placeholder: PropTypes.string,
  required: PropTypes.bool,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired
};

ActionSuggestionDialog.propTypes = {
  saving: PropTypes.bool.isRequired,
  suggestions: PropTypes.array.isRequired,
  onAdd: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onIgnore: PropTypes.func.isRequired
};

function ActionCreateDialog({ actionForm, actionRoleOptions, actions = [], isCriticalAction, saving, selectedStages = [], stageNewProject, onClose, onSubmit, updateActionForm, removeActionProofDocumentFile }) {
  const selectedActionStage = actionForm.stage || selectedStages[0]?.[0] || "";
  const selectedProofDocumentFiles = filesFromValue(actionForm.proofDocumentFile);
  const hasProofDocumentLink = Boolean(String(actionForm.proofDocumentLinkUrl || "").trim());
  const dependencyOptions = actions
    .filter((action) => action.stage === selectedActionStage)
    .filter((action) => action.id);

  function addProofDocumentFiles(event) {
    const selectedFiles = Array.from(event.currentTarget.files || []);
    if (selectedFiles.length > 0) {
      updateActionForm("proofDocumentFile", selectedFiles);
    }
    event.currentTarget.value = "";
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <form
        aria-labelledby="create-action-title"
        aria-modal="true"
        className="dialog-card action-rule-dialog action-create-dialog panel form-page"
        noValidate
        onSubmit={onSubmit}
        role="dialog"
      >
        <div className="form-intro">
          <div>
            <p className="eyebrow">Action</p>
            <h2 id="create-action-title">Ajouter une action</h2>
          </div>
          <button className="ghost-icon" type="button" onClick={onClose} title="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="planning-rule-form dialog-rule-form action-create-form">
          <label>
            <span>Phase</span>
            <select value={selectedActionStage} onChange={(event) => updateActionForm("stage", event.target.value)}>
              {selectedStages.map(([stage, label]) => (
                <option key={stage} value={stage}>{label || stageLabel(stage, stageNewProject)}</option>
              ))}
            </select>
          </label>
          <label className="planning-action-title-field">
            <span>Action</span>
            <input required value={actionForm.title} onChange={(event) => updateActionForm("title", event.target.value)} placeholder="Ex: Action 7 - Validation input" />
          </label>
          <label>
            <span>Topic / risque</span>
            <input value={actionForm.topicRisk} onChange={(event) => updateActionForm("topicRisk", event.target.value)} placeholder="Risque ou sujet" />
          </label>
          <label>
            <span>Pilote d'action</span>
            <ActionRoleSelect required options={actionRoleOptions} value={actionForm.responsible} onChange={(value) => updateActionForm("responsible", value)} />
          </label>
          <label>
            <span>Validateur</span>
            <ActionRoleSelect required options={actionRoleOptions} value={actionForm.validator} onChange={(value) => updateActionForm("validator", value)} placeholder="Selectionner un role" />
          </label>
          <label>
            <span>Criticité</span>
            <select value={actionForm.criticality} onChange={(event) => updateActionForm("criticality", event.target.value)}>
              <option value="1-critique">1-critique</option>
              <option value="2-moyenne">2-moyenne</option>
              <option value="3-faible">3-faible</option>
            </select>
          </label>
          <label>
            <span>Bloquee par</span>
            <select value={actionForm.dependsOnActionId || ""} onChange={(event) => updateActionForm("dependsOnActionId", event.target.value)}>
              <option value="">Aucune action</option>
              {dependencyOptions.map((action) => (
                <option key={action.id} value={action.id}>{action.title}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Jours de travail</span>
            <input min="0" type="number" value={actionForm.workDurationDays} onChange={(event) => updateActionForm("workDurationDays", event.target.value)} />
          </label>
          <div className="proof-document-picker-field">
            <label className="file-picker proof-document-picker">
              <FileText size={15} />
              <span>{selectedProofDocumentFiles.length > 0 ? "Ajouter un autre élément preuve" : "Element preuve"}</span>
              <input multiple type="file" onChange={addProofDocumentFiles} />
            </label>
            {selectedProofDocumentFiles.length > 0 && (
              <div className="selected-file-list">
                {selectedProofDocumentFiles.map((file, index) => (
                  <span className="selected-file-item" key={`${file.name}-${file.size}-${file.lastModified}-${index}`}>
                    <FileText size={14} />
                    <strong>{file.name}</strong>
                    <button className="ghost-icon" type="button" onClick={() => removeActionProofDocumentFile(index)} title="Retirer ce fichier">
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="asset-link-inputs proof-document-link-inputs">
              <input
                aria-label="Nom du lien preuve"
                placeholder="Nom du lien preuve"
                value={actionForm.proofDocumentLinkName || ""}
                onChange={(event) => updateActionForm("proofDocumentLinkName", event.target.value)}
              />
              <input
                aria-label="Lien fichier partage"
                placeholder="Lien fichier partagé"
                value={actionForm.proofDocumentLinkUrl || ""}
                onChange={(event) => updateActionForm("proofDocumentLinkUrl", event.target.value)}
              />
            </div>
          </div>
          <label className="asset-required-field user-enabled-field">
            <input
              aria-label="Asset obligatoire"
              checked={actionForm.evidenceRequired || selectedProofDocumentFiles.length > 0 || hasProofDocumentLink || isCriticalAction(actionForm)}
              disabled={selectedProofDocumentFiles.length > 0 || hasProofDocumentLink || isCriticalAction(actionForm)}
              type="checkbox"
              onChange={(event) => updateActionForm("evidenceRequired", event.target.checked)}
            />
            <span>Asset obligatoire</span>
          </label>
        </div>
        <div className="button-row">
          <button className="primary-action" disabled={saving} type="submit">
            <Save size={16} />
            Enregistrer
          </button>
          <button className="secondary-action" type="button" onClick={onClose}>Annuler</button>
        </div>
      </form>
    </div>
  );
}

ActionCreateDialog.propTypes = {
  actionForm: PropTypes.object.isRequired,
  actionRoleOptions: PropTypes.array.isRequired,
  actions: PropTypes.array,
  isCriticalAction: PropTypes.func.isRequired,
  saving: PropTypes.bool.isRequired,
  selectedStages: PropTypes.array,
  stageNewProject: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  updateActionForm: PropTypes.func.isRequired,
  removeActionProofDocumentFile: PropTypes.func.isRequired
};

function ChecklistPanel({ checklist }) {
  const visibleChecklist = checklist.filter((item) => {
    const topic = normalizeSearchText(item.topicRisk);
    const evidence = normalizeSearchText(item.expectedEvidence);
    return !(topic === "phase ecr" && evidence.startsWith("validation de la phase"));
  });
  if (visibleChecklist.length === 0) {
    return null;
  }
  return (
    <section className="checklist">
      {visibleChecklist.map((item) => (
          <article className="check-row" key={item.id}>
            <CheckCircle2 className={item.status === "OK" ? "ok" : ""} size={20} />
            <div><h3>{item.verificationPoint}</h3><p>{item.topicRisk || "Risque non classé"} / {item.expectedEvidence || "Preuve non renseignée"}</p></div>
            <span>{item.pilot || "A définir"}</span>
            <strong className={`status ${statusClass(item.status)}`}>{readableStatus(item.status)}</strong>
          </article>
        ))}
    </section>
  );
}

ChecklistPanel.propTypes = {
  checklist: PropTypes.arrayOf(PropTypes.object).isRequired
};
  return {
    ActionSuggestionDialog,
    CreateModificationDialog,
    EditModificationDialog,
    ModificationsPage
  };
}
