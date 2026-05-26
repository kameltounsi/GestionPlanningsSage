import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  ListChecks,
  Paperclip,
  Plus,
  Save,
  Search,
  Trash2,
  Upload
} from "lucide-react";
import {
  createAction,
  createActionPlanningRule,
  createEcrRequest,
  createProject,
  deleteActionPlanningRule,
  deleteProject,
  getActionPlanningRules,
  getActions,
  getChecklist,
  getEcrRequests,
  getPilots,
  getProjects,
  updateAction,
  updateActionPlanningRule,
  updateEcrStage,
  updateProject,
  uploadActionEvidence,
  actionEvidenceUrl
} from "./api";
import "./styles.css";

const stageDefinitions = [
  { key: "FEASIBILITY_VALIDATION", modificationLabel: "Feasability Validation", newProjectLabel: "Projet Time line", modification: true, newProject: true },
  { key: "PROJECT_MANAGEMENT", modificationLabel: "Validation interne status", newProjectLabel: "Project Management", modification: true, newProject: true },
  { key: "PRODUCT_DEVELOPMENT", modificationLabel: "VP interne valid", newProjectLabel: "Product Development", modification: true, newProject: true },
  { key: "PROCESS_DEVELOPMENT", modificationLabel: "Process Development", newProjectLabel: "Process Development", modification: false, newProject: true },
  { key: "CUSTOMER_VALIDATION", modificationLabel: "Customer validation", newProjectLabel: "Customer validation", modification: true, newProject: false },
  { key: "PPAP_SOP_PREPARATION", modificationLabel: "PPAP validation Preparation SOP", newProjectLabel: "Production Set-up & Pre-Series", modification: true, newProject: true },
  { key: "LAUNCH", modificationLabel: "Launch", newProjectLabel: "Launch", modification: false, newProject: true },
  { key: "CLOSED", modificationLabel: "Cloture Status", newProjectLabel: "Cloture Status", modification: true, newProject: false },
  { key: "CANCELLED", modificationLabel: "Cancelled", newProjectLabel: "Project Cancelled", modification: true, newProject: true }
];

const stageColors = [
  "teal",
  "blue",
  "indigo",
  "violet",
  "amber",
  "orange",
  "green",
  "slate",
  "red"
];

const navItems = [
  ["dashboard", "Tableau", LayoutDashboard],
  ["modifications", "Modifications", ListChecks],
  ["projects", "Projets", FolderKanban]
];

const emptyEcrForm = {
  accessInternalNumber: "",
  modificationNumber: "",
  client: "",
  product: "",
  modificationProject: "",
  modificationReason: "",
  receptionDate: "",
  sopDate: "",
  pilot: "",
  newVersion: false,
  currentStage: "FEASIBILITY_VALIDATION"
};

const emptyActionForm = {
  topicRisk: "",
  title: "",
  responsible: "",
  criticality: "3-faible",
  expectedEvidence: "",
  evidence: "",
  evidenceFile: null,
  deadline: "",
  date1: "",
  date2: "",
  date3: "",
  startDate: "",
  endDate: "",
  workDurationDays: 1,
  status: "TODO",
  comment: ""
};

const emptyPlanningRuleForm = {
  stage: "FEASIBILITY_VALIDATION",
  actionTitle: "",
  dependencyActionTitle: "",
  dependencyAnchor: "OUTPUT",
  durationDays: 1
};

const statusLabels = {
  TODO: "A faire",
  IN_PROGRESS: "En cours",
  DONE: "Termine",
  LATE: "En retard",
  CANCELLED: "Annule",
  OK: "OK",
  NOK: "NOK"
};

function readableStatus(status) {
  return statusLabels[status] || status || "-";
}

function statusClass(status) {
  return String(status || "").toLowerCase();
}

function criticalityClass(value) {
  if (String(value).startsWith("1")) return "critical";
  if (String(value).startsWith("2")) return "medium";
  return "low";
}

function comparePlanningRules(a, b) {
  const stageCompare = String(a.stage).localeCompare(String(b.stage));
  if (stageCompare !== 0) return stageCompare;
  return String(a.actionTitle || "").localeCompare(String(b.actionTitle || ""));
}

function getStages(newProject) {
  return stageDefinitions
    .filter((stage) => (newProject ? stage.newProject : stage.modification))
    .map((stage) => [stage.key, newProject ? stage.newProjectLabel : stage.modificationLabel]);
}

function firstStage(newProject) {
  return getStages(newProject)[0][0];
}

function isStageAllowed(stage, newProject) {
  return getStages(newProject).some(([key]) => key === stage);
}

function safeStage(stage, newProject) {
  return isStageAllowed(stage, newProject) ? stage : firstStage(newProject);
}

function stageLabel(stage, newProject = false) {
  const definition = stageDefinitions.find(({ key }) => key === stage);
  if (!definition) return stage;
  return newProject ? definition.newProjectLabel : definition.modificationLabel;
}

function App() {
  const [page, setPage] = useState("dashboard");
  const [requests, setRequests] = useState([]);
  const [pilots, setPilots] = useState([]);
  const [projects, setProjects] = useState([]);
  const [planningRules, setPlanningRules] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedStage, setSelectedStage] = useState("FEASIBILITY_VALIDATION");
  const [checklist, setChecklist] = useState([]);
  const [actions, setActions] = useState([]);
  const [ecrForm, setEcrForm] = useState(emptyEcrForm);
  const [actionForm, setActionForm] = useState(emptyActionForm);
  const [projectForm, setProjectForm] = useState({ name: "", projectTeam: "" });
  const [planningRuleForm, setPlanningRuleForm] = useState(emptyPlanningRuleForm);
  const [editingPlanningRule, setEditingPlanningRule] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedRequest = requests.find((request) => request.id === selectedId);
  const selectedStages = getStages(Boolean(selectedRequest?.newVersion));
  const doneCount = actions.filter((action) => action.checked || action.status === "DONE").length;
  const completion = actions.length ? Math.round((doneCount / actions.length) * 100) : 0;
  const lateActions = actions.filter((action) => action.late).length;

  const filteredRequests = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return requests.filter((request) => {
      const matchesProject = !projectFilter || request.modificationProject === projectFilter;
      const matchesSearch = !normalized || [request.client, request.product, request.modificationProject, request.modificationNumber, request.modificationReason, request.pilot]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalized));
      return matchesProject && matchesSearch;
    });
  }, [requests, query, projectFilter]);

  const projectOptions = useMemo(() => {
    const names = [
      ...projects.map((project) => project.name),
      ...requests.map((request) => request.modificationProject)
    ].filter(Boolean);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [projects, requests]);

  const dashboardStats = useMemo(() => {
    const active = requests.filter((request) => request.currentStage !== "CLOSED" && request.currentStage !== "CANCELLED").length;
    const closed = requests.filter((request) => request.currentStage === "CLOSED").length;
    return { active, closed, projects: projects.length, requests: requests.length };
  }, [requests, projects]);

  function loadInitialData() {
    return Promise.all([getEcrRequests(), getPilots(), getProjects(), getActionPlanningRules()])
      .then(([requestData, pilotData, projectData, planningRuleData]) => {
        setRequests(requestData);
        setPilots(pilotData);
        setProjects(projectData);
        setPlanningRules(planningRuleData);
        setSelectedId((currentId) => currentId ?? requestData[0]?.id ?? null);
      });
  }

  useEffect(() => {
    loadInitialData()
      .catch(() => setError("Impossible de joindre l'API Spring Boot. Verifiez PostgreSQL et le backend."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setChecklist([]);
      setActions([]);
      return;
    }
    Promise.all([getChecklist(selectedId, selectedStage), getActions(selectedId, selectedStage)])
      .then(([checklistData, actionData]) => {
        setChecklist(checklistData);
        setActions(actionData);
      })
      .catch(() => {
        setChecklist([]);
        setActions([]);
      });
  }, [selectedId, selectedStage]);

  useEffect(() => {
    if (!selectedRequest) return;
    const nextStage = safeStage(selectedStage, Boolean(selectedRequest.newVersion));
    if (nextStage !== selectedStage) {
      setSelectedStage(nextStage);
    }
  }, [selectedRequest, selectedStage]);

  useEffect(() => {
    if (!showCreateForm) return undefined;

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setShowCreateForm(false);
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [showCreateForm]);

  function updateEcrForm(field, value) {
    setEcrForm((form) => {
      const nextForm = { ...form, [field]: value };
      if (field === "newVersion") {
        nextForm.currentStage = safeStage(form.currentStage, value);
      }
      return nextForm;
    });
  }

  function updateActionForm(field, value) {
    setActionForm((form) => ({ ...form, [field]: value }));
  }

  function buildEcrPayload() {
    return {
      ...ecrForm,
      accessInternalNumber: ecrForm.accessInternalNumber ? Number(ecrForm.accessInternalNumber) : null,
      currentStage: safeStage(ecrForm.currentStage, ecrForm.newVersion),
      receptionDate: ecrForm.receptionDate || null,
      sopDate: ecrForm.sopDate || null
    };
  }

  function handleCreateEcr(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    createEcrRequest(buildEcrPayload())
      .then((savedRequest) => {
        setEcrForm(emptyEcrForm);
        setSelectedId(savedRequest.id);
        setSelectedStage(savedRequest.currentStage);
        setShowCreateForm(false);
        setPage("modifications");
        return loadInitialData();
      })
      .catch(() => setError("Creation ECR impossible. Creez d'abord le projet, puis verifiez les champs obligatoires."))
      .finally(() => setSaving(false));
  }

  function handleStageChange(stage) {
    if (!selectedRequest) return;
    setSelectedStage(stage);
    updateEcrStage(selectedRequest.id, stage)
      .then((updatedRequest) => setRequests((items) => items.map((item) => (item.id === updatedRequest.id ? updatedRequest : item))))
      .catch(() => setError("Impossible de sauvegarder l'etape ECR."));
  }

  function handleCreateAction(event) {
    event.preventDefault();
    if (!selectedRequest) return;
    setSaving(true);
    createAction(selectedRequest.id, {
      ...actionForm,
      evidenceFile: undefined,
      deadline: actionForm.deadline || null,
      date1: actionForm.date1 || null,
      date2: actionForm.date2 || null,
      date3: actionForm.date3 || null,
      startDate: actionForm.startDate || null,
      endDate: actionForm.endDate || null,
      workDurationDays: Number(actionForm.workDurationDays) || 1,
      stage: selectedStage
    })
      .then((savedAction) => {
        if (actionForm.evidenceFile) {
          return uploadActionEvidence(savedAction.id, actionForm.evidenceFile);
        }
        return savedAction;
      })
      .then(() => getActions(selectedRequest.id, selectedStage))
      .then((actionData) => {
        setActions(actionData);
        setActionForm(emptyActionForm);
      })
      .catch(() => setError("Creation action impossible."))
      .finally(() => setSaving(false));
  }

  function handleToggleAction(action, completed) {
    const updatedAction = {
      ...action,
      late: completed ? false : action.late,
      checked: completed,
      status: completed ? "DONE" : "TODO",
      closedDate: completed ? new Date().toISOString().slice(0, 10) : null
    };

    setActions((items) => items.map((item) => (item.id === action.id ? updatedAction : item)));
    updateAction(action.id, updatedAction)
      .then((savedAction) => setActions((items) => items.map((item) => (item.id === savedAction.id ? savedAction : item))))
      .catch(() => {
        setActions((items) => items.map((item) => (item.id === action.id ? action : item)));
        setError("Impossible de mettre a jour l'action.");
      });
  }

  function handleUploadEvidence(action, file) {
    if (!file) return;
    setError("");
    uploadActionEvidence(action.id, file)
      .then((savedAction) => setActions((items) => items.map((item) => (item.id === savedAction.id ? savedAction : item))))
      .catch(() => setError("Ajout du fichier evidence impossible."));
  }

  function handleSaveProject(event) {
    event.preventDefault();
    const name = projectForm.name.trim();
    if (!name) return;
    setSaving(true);
    setError("");
    const payload = { name, projectTeam: projectForm.projectTeam.trim() || null };
    const request = editingProject ? updateProject(editingProject, payload) : createProject(payload);
    request
      .then((savedProject) => {
        setProjects((items) => [...items.filter((item) => item.name !== editingProject && item.name !== savedProject.name), savedProject].sort((a, b) => a.name.localeCompare(b.name)));
        setProjectForm({ name: "", projectTeam: "" });
        setEditingProject(null);
      })
      .catch(() => setError("Sauvegarde projet impossible. Verifiez le nom du projet."))
      .finally(() => setSaving(false));
  }

  function startProjectEdit(project) {
    setEditingProject(project.name);
    setProjectForm({ name: project.name, projectTeam: project.projectTeam || "" });
  }

  function handleDeleteProject(name) {
    setError("");
    deleteProject(name)
      .then(() => {
        setProjects((items) => items.filter((item) => item.name !== name));
        if (editingProject === name) {
          setEditingProject(null);
          setProjectForm({ name: "", projectTeam: "" });
        }
      })
      .catch(() => setError("Suppression projet impossible."));
  }

  function handleSavePlanningRule(event) {
    event.preventDefault();
    if (!planningRuleForm.actionTitle.trim()) return;
    setSaving(true);
    setError("");
    const payload = {
      ...planningRuleForm,
      actionTitle: planningRuleForm.actionTitle.trim(),
      dependencyActionTitle: planningRuleForm.dependencyActionTitle.trim() || null,
      durationDays: Number(planningRuleForm.durationDays) || 0
    };
    const request = editingPlanningRule ? updateActionPlanningRule(editingPlanningRule, payload) : createActionPlanningRule(payload);
    request
      .then((savedRule) => {
        setPlanningRules((items) => [...items.filter((item) => item.id !== savedRule.id), savedRule].sort(comparePlanningRules));
        setPlanningRuleForm(emptyPlanningRuleForm);
        setEditingPlanningRule(null);
        return selectedId ? Promise.all([getActions(selectedId, selectedStage), getEcrRequests()]) : Promise.resolve([actions, requests]);
      })
      .then(([actionData, requestData]) => {
        if (Array.isArray(actionData)) setActions(actionData);
        if (Array.isArray(requestData)) setRequests(requestData);
      })
      .catch(() => setError("Sauvegarde regle planning impossible. Verifiez l'action et la duree."))
      .finally(() => setSaving(false));
  }

  function startPlanningRuleEdit(rule) {
    setEditingPlanningRule(rule.id);
    setPlanningRuleForm({
      stage: rule.stage,
      actionTitle: rule.actionTitle || "",
      dependencyActionTitle: rule.dependencyActionTitle || "",
      dependencyAnchor: rule.dependencyAnchor || "OUTPUT",
      durationDays: rule.durationDays ?? 1
    });
  }

  function handleDeletePlanningRule(id) {
    setError("");
    deleteActionPlanningRule(id)
      .then(() => {
        setPlanningRules((items) => items.filter((item) => item.id !== id));
        if (editingPlanningRule === id) {
          setEditingPlanningRule(null);
          setPlanningRuleForm(emptyPlanningRuleForm);
        }
      })
      .catch(() => setError("Suppression regle planning impossible."));
  }

  function openCreateFlow() {
    setPage("modifications");
    setShowCreateForm(true);
  }

  if (loading) {
    return <main className="centered">Chargement...</main>;
  }

  return (
    <main className="app-frame">
      <aside className="app-nav">
        <div className="brand">
          <ClipboardList size={24} />
          <div>
            <h1>Gestion Planning</h1>
            <span>Application ECR</span>
          </div>
        </div>
        <nav className="main-menu">
          {navItems.map(([key, label, Icon]) => (
            <button
              key={key}
              className={page === key ? "menu-item active" : "menu-item"}
              onClick={() => {
                setPage(key);
                setShowCreateForm(false);
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="page-shell">
        {error && (
          <div className="banner">
            <CircleAlert size={18} />
            {error}
          </div>
        )}

        {page === "dashboard" && (
          <DashboardPage stats={dashboardStats} requests={requests} onCreateRequest={openCreateFlow} />
        )}

        {page === "projects" && (
          <ProjectsPage
            editingProject={editingProject}
            projectForm={projectForm}
            projects={projects}
            planningRuleForm={planningRuleForm}
            planningRules={planningRules}
            saving={saving}
            onCancelEdit={() => {
              setEditingProject(null);
              setProjectForm({ name: "", projectTeam: "" });
            }}
            onCancelPlanningRuleEdit={() => {
              setEditingPlanningRule(null);
              setPlanningRuleForm(emptyPlanningRuleForm);
            }}
            onDelete={handleDeleteProject}
            onDeletePlanningRule={handleDeletePlanningRule}
            onEdit={startProjectEdit}
            onEditPlanningRule={startPlanningRuleEdit}
            onSubmit={handleSaveProject}
            onSubmitPlanningRule={handleSavePlanningRule}
            setProjectForm={setProjectForm}
            setPlanningRuleForm={setPlanningRuleForm}
          />
        )}

        {page === "modifications" && (
          <ModificationsPage
            actionForm={actionForm}
            actions={actions}
            checklist={checklist}
            completion={completion}
            doneCount={doneCount}
            filteredRequests={filteredRequests}
            lateActions={lateActions}
            projectFilter={projectFilter}
            projectOptions={projectOptions}
            query={query}
            saving={saving}
            selectedId={selectedId}
            selectedRequest={selectedRequest}
            selectedStages={selectedStages}
            selectedStage={selectedStage}
            setQuery={setQuery}
            setProjectFilter={setProjectFilter}
            setSelectedId={setSelectedId}
            setSelectedStage={setSelectedStage}
            setShowCreateForm={setShowCreateForm}
            handleCreateAction={handleCreateAction}
            handleStageChange={handleStageChange}
            handleToggleAction={handleToggleAction}
            handleUploadEvidence={handleUploadEvidence}
            updateActionForm={updateActionForm}
          />
        )}
      </section>

      {showCreateForm && page === "modifications" && (
        <CreateModificationDialog
          ecrForm={ecrForm}
          pilots={pilots}
          projects={projects}
          saving={saving}
          onClose={() => setShowCreateForm(false)}
          onSubmit={handleCreateEcr}
          updateEcrForm={updateEcrForm}
        />
      )}
    </main>
  );
}

function DashboardPage({ stats, requests, onCreateRequest }) {
  const visibleRequests = requests
    .filter((request) => request.currentStage !== "CLOSED" && request.currentStage !== "CANCELLED")
    .slice(0, 5);
  const recentRequests = visibleRequests.length > 0 ? visibleRequests : requests.slice(0, 5);

  return (
    <section className="page-content">
      <PageHeader eyebrow="Vue generale" title="Tableau de bord" subtitle="Suivi rapide des modifications et du referentiel projet." />
      <div className="stat-grid">
        <StatCard label="Demandes" value={stats.requests} icon={ClipboardList} />
        <StatCard label="Actives" value={stats.active} icon={Gauge} />
        <StatCard label="Cloturees" value={stats.closed} icon={CheckCircle2} />
        <StatCard label="Projets" value={stats.projects} icon={FolderKanban} />
      </div>
      <section className="panel">
        <div className="section-title">
          <h2>Dernieres modifications</h2>
          <button className="secondary-action" onClick={onCreateRequest}>
            <Plus size={16} />
            Creer ECR
          </button>
        </div>
        <div className="compact-list">
          {requests.length === 0 ? (
            <EmptyState title="Aucune modification creee" text="Commencez par creer une demande ECR depuis le bouton Creer ECR." />
          ) : (
            recentRequests.map((request) => (
              <article className="compact-row" key={request.id}>
                <div>
                  <strong>{request.modificationNumber || request.client}</strong>
                  <span>{request.modificationProject || "Projet non renseigne"}</span>
                </div>
                <small className="stage-pill">{stageLabel(request.currentStage, Boolean(request.newVersion))}</small>
              </article>
            ))
          )}
        </div>
      </section>
    </section>
  );
}

function CreateModificationDialog({ ecrForm, pilots, projects, saving, onClose, onSubmit, updateEcrForm }) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        aria-labelledby="create-modification-title"
        aria-modal="true"
        className="dialog-card"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <NewModificationPage
          ecrForm={ecrForm}
          pilots={pilots}
          projects={projects}
          saving={saving}
          onCancel={onClose}
          onSubmit={onSubmit}
          updateEcrForm={updateEcrForm}
        />
      </div>
    </div>
  );
}

function NewModificationPage({ ecrForm, pilots, projects, saving, onCancel, onSubmit, updateEcrForm }) {
  const availableStages = getStages(ecrForm.newVersion);

  return (
    <section className="creation-panel">
      <form className="panel form-page" onSubmit={onSubmit}>
        <div className="form-intro">
          <div>
            <p className="eyebrow">Creation ECR</p>
            <h2 id="create-modification-title">Nouvelle modification</h2>
            <p>Renseignez les informations de base, creez la demande, puis continuez directement le suivi des phases et actions sur cette meme page.</p>
          </div>
          <span className="stage-pill">Creation assistee</span>
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
        <PhasePreview stages={availableStages} />
        <div className="field-grid">
          <label>
            Client
            <input required value={ecrForm.client} onChange={(event) => updateEcrForm("client", event.target.value)} />
          </label>
          <label>
            Projet
            <select required value={ecrForm.modificationProject} onChange={(event) => updateEcrForm("modificationProject", event.target.value)}>
              <option value="">Selectionner un projet</option>
              {projects.map((project) => (
                <option key={project.name} value={project.name}>{project.name}</option>
              ))}
            </select>
          </label>
          <label>
            Produit
            <input value={ecrForm.product} onChange={(event) => updateEcrForm("product", event.target.value)} />
          </label>
          <label>
            Numero ECR
            <input value={ecrForm.modificationNumber} onChange={(event) => updateEcrForm("modificationNumber", event.target.value)} />
          </label>
          <label>
            Pilote
            <input list="pilot-list" value={ecrForm.pilot} onChange={(event) => updateEcrForm("pilot", event.target.value)} />
            <datalist id="pilot-list">
              {pilots.map((pilot) => <option key={pilot.name} value={pilot.name} />)}
            </datalist>
          </label>
          <label>
            Reception
            <input type="date" value={ecrForm.receptionDate} onChange={(event) => updateEcrForm("receptionDate", event.target.value)} />
          </label>
          <label>
            SOP
            <input type="date" value={ecrForm.sopDate} onChange={(event) => updateEcrForm("sopDate", event.target.value)} />
          </label>
        </div>
        <label>
          Description de la modification
          <textarea value={ecrForm.modificationReason} onChange={(event) => updateEcrForm("modificationReason", event.target.value)} />
        </label>
        <div className="button-row">
          <button className="primary-action" disabled={saving || projects.length === 0} type="submit">
            <Plus size={16} />
            Creer et ouvrir le suivi
          </button>
          <button className="secondary-action" type="button" onClick={onCancel}>Annuler</button>
        </div>
        {projects.length === 0 && <p className="form-hint">Ajoutez d'abord au moins un projet dans le referentiel projets.</p>}
      </form>
    </section>
  );
}

function PhasePreview({ stages }) {
  return (
    <section className="phase-preview" aria-label="Apercu des phases">
      <div className="phase-preview-title">
        <h3>Apercu des phases</h3>
        <span>{stages.length} phases generees automatiquement</span>
      </div>
      <div className="phase-chip-grid">
        {stages.map(([key, label], index) => (
          <span className={`phase-chip ${stageColors[index % stageColors.length]}`} key={key}>
            <strong>{index + 1}</strong>
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}

function ProjectsPage({
  editingProject,
  planningRuleForm,
  planningRules,
  projectForm,
  projects,
  saving,
  onCancelEdit,
  onCancelPlanningRuleEdit,
  onDelete,
  onDeletePlanningRule,
  onEdit,
  onEditPlanningRule,
  onSubmit,
  onSubmitPlanningRule,
  setPlanningRuleForm,
  setProjectForm
}) {
  return (
    <section className="page-content">
      <PageHeader eyebrow="Administration" title="Referentiel projets" subtitle="L'admin maintient ici la liste complete des projets utilisables pendant la creation d'une modification." />
      <div className="split-layout">
        <form className="panel form-page" onSubmit={onSubmit}>
          <div className="form-intro">
            <div>
              <h2>{editingProject ? "Modifier le projet" : "Ajouter un projet"}</h2>
              <p>Gardez des noms courts et coherents pour faciliter la recherche pendant la creation ECR.</p>
            </div>
          </div>
          <label>
            Nom du projet
            <input disabled={Boolean(editingProject)} required value={projectForm.name} onChange={(event) => setProjectForm((form) => ({ ...form, name: event.target.value }))} />
          </label>
          <label>
            Equipe projet
            <input value={projectForm.projectTeam} onChange={(event) => setProjectForm((form) => ({ ...form, projectTeam: event.target.value }))} />
          </label>
          <div className="button-row">
            <button className="primary-action" disabled={saving} type="submit">
              <Save size={16} />
              Enregistrer
            </button>
            {editingProject && <button className="secondary-action" type="button" onClick={onCancelEdit}>Annuler</button>}
          </div>
        </form>
        <section className="panel">
          <div className="section-title">
            <h2>Liste des projets</h2>
            <span>{projects.length} projets</span>
          </div>
          <div className="table-list">
            {projects.length === 0 ? (
              <EmptyState title="Aucun projet cree" text="Ajoutez un premier projet pour debloquer la creation des modifications." />
            ) : (
              projects.map((project) => (
                <article className="project-table-row" key={project.name}>
                  <div>
                    <strong>{project.name}</strong>
                    <span>{project.projectTeam || "Equipe non renseignee"}</span>
                  </div>
                  <div className="row-actions">
                    <button className="secondary-action compact-action" type="button" onClick={() => onEdit(project)}>Modifier</button>
                    <button className="ghost-icon" type="button" onClick={() => onDelete(project.name)} title="Supprimer">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
      <PlanningRulesAdmin
        form={planningRuleForm}
        rules={planningRules}
        saving={saving}
        onCancelEdit={onCancelPlanningRuleEdit}
        onDelete={onDeletePlanningRule}
        onEdit={onEditPlanningRule}
        onSubmit={onSubmitPlanningRule}
        setForm={setPlanningRuleForm}
      />
    </section>
  );
}

function PlanningRulesAdmin({ form, rules, saving, onCancelEdit, onDelete, onEdit, onSubmit, setForm }) {
  return (
    <section className="panel planning-admin">
      <div className="section-title">
        <div>
          <h2>Parametres planning actions</h2>
          <span>Definissez la liaison entree/sortie et le nombre de jours necessaires pour calculer les dates debut/fin.</span>
        </div>
        <span>{rules.length} regles</span>
      </div>
      <form className="planning-rule-form" onSubmit={onSubmit}>
        <label>
          Phase
          <select value={form.stage} onChange={(event) => setForm((current) => ({ ...current, stage: event.target.value }))}>
            {stageDefinitions.map((stage) => (
              <option key={stage.key} value={stage.key}>{stage.modificationLabel}</option>
            ))}
          </select>
        </label>
        <label>
          Action concernee
          <input required value={form.actionTitle} onChange={(event) => setForm((current) => ({ ...current, actionTitle: event.target.value }))} placeholder="Titre exact de l'action" />
        </label>
        <label>
          Action liee
          <input value={form.dependencyActionTitle} onChange={(event) => setForm((current) => ({ ...current, dependencyActionTitle: event.target.value }))} placeholder="Vide = depart reception ECR" />
        </label>
        <label>
          Liaison
          <select value={form.dependencyAnchor} onChange={(event) => setForm((current) => ({ ...current, dependencyAnchor: event.target.value }))}>
            <option value="INPUT">Entree action liee</option>
            <option value="OUTPUT">Sortie action liee</option>
          </select>
        </label>
        <label>
          Jours de travail
          <input min="0" type="number" value={form.durationDays} onChange={(event) => setForm((current) => ({ ...current, durationDays: event.target.value }))} />
        </label>
        <div className="button-row planning-rule-actions">
          <button className="primary-action" disabled={saving} type="submit">
            <Save size={16} />
            Enregistrer regle
          </button>
          {form.actionTitle && <button className="secondary-action" type="button" onClick={onCancelEdit}>Annuler</button>}
        </div>
      </form>
      <div className="planning-rule-list">
        {rules.length === 0 ? (
          <EmptyState title="Aucune regle planning" text="Ajoutez une regle pour automatiser les dates debut/fin des actions." />
        ) : (
          rules.map((rule) => (
            <article className="planning-rule-row" key={rule.id}>
              <span className="stage-pill">{stageLabel(rule.stage)}</span>
              <div>
                <strong>{rule.actionTitle}</strong>
                <span>{rule.dependencyActionTitle ? `${rule.dependencyAnchor === "INPUT" ? "Entree" : "Sortie"} de: ${rule.dependencyActionTitle}` : "Depart reception ECR"}</span>
              </div>
              <strong className="duration-pill">{rule.durationDays} j</strong>
              <div className="row-actions">
                <button className="secondary-action compact-action" type="button" onClick={() => onEdit(rule)}>Modifier</button>
                <button className="ghost-icon" type="button" onClick={() => onDelete(rule.id)} title="Supprimer">
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function ModificationsPage(props) {
  const {
    actionForm,
    actions,
    checklist,
    completion,
    doneCount,
    filteredRequests,
    handleCreateAction,
    handleStageChange,
    handleToggleAction,
    handleUploadEvidence,
    lateActions,
    projectFilter,
    projectOptions,
    query,
    saving,
    selectedId,
    selectedRequest,
    selectedStages,
    selectedStage,
    setProjectFilter,
    setQuery,
    setSelectedId,
    setSelectedStage,
    setShowCreateForm,
    updateActionForm
  } = props;

  return (
    <section className="page-content modifications-content">
      <PageHeader eyebrow="Suivi ECR" title="Modifications" subtitle="Creez une demande, selectionnez-la, puis pilotez ses phases et actions sans quitter cette page." />
      <div className="work-layout">
        <section className="detail-panel">
          {selectedRequest ? (
            <>
              <header className="details-header">
                <div>
                  <p className="eyebrow">Demande #{selectedRequest.accessInternalNumber || selectedRequest.id}</p>
                  <h2>{selectedRequest.modificationNumber || selectedRequest.client}</h2>
                  <p>{selectedRequest.modificationReason || "Aucune description renseignee pour le moment."}</p>
                </div>
                <div className="meta-grid">
                  <div><ClipboardList size={16} /><span>Projet</span><strong>{selectedRequest.modificationProject || "A definir"}</strong></div>
                  <div><Gauge size={16} /><span>Pilote</span><strong>{selectedRequest.pilot || "A definir"}</strong></div>
                  <div><CalendarDays size={16} /><span>Reception</span><strong>{selectedRequest.receptionDate || "-"}</strong></div>
                </div>
              </header>
              <nav className="stage-tabs">
                {selectedStages.map(([key, label]) => (
                  <button key={key} className={selectedStage === key ? "tab active" : "tab"} onClick={() => handleStageChange(key)}>
                    {label}
                  </button>
                ))}
              </nav>
              <section className="progress-row">
                <div><span>Avancement checklist</span><strong>{completion}%</strong></div>
                <div className="progress-track"><span style={{ width: `${completion}%` }} /></div>
              </section>
              <ActionsPanel
                actionForm={actionForm}
                actions={actions}
                doneCount={doneCount}
                handleCreateAction={handleCreateAction}
                handleToggleAction={handleToggleAction}
                handleUploadEvidence={handleUploadEvidence}
                lateActions={lateActions}
                saving={saving}
                stageNewProject={Boolean(selectedRequest.newVersion)}
                selectedStage={selectedStage}
                updateActionForm={updateActionForm}
              />
              <ChecklistPanel checklist={checklist} />
            </>
          ) : (
            <EmptyState title="Aucune demande selectionnee" text="Selectionnez une demande dans la liste ou creez une nouvelle modification." />
          )}
        </section>
        <aside className="list-panel">
          <label className="search">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une modification" />
          </label>
          <label className="project-filter">
            <FolderKanban size={16} />
            <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
              <option value="">Tous les projets</option>
              {projectOptions.map((projectName) => (
                <option key={projectName} value={projectName}>{projectName}</option>
              ))}
            </select>
          </label>
          <button className="primary-action wide-action" onClick={() => setShowCreateForm(true)}>
            <Plus size={16} />
            Nouvelle modification
          </button>
          <div className="request-list">
            {filteredRequests.length === 0 ? (
              <EmptyState title="Aucun resultat" text="Essayez un client, un projet, un produit ou un pilote." compact />
            ) : filteredRequests.map((request) => (
              <button
                className={request.id === selectedId ? "request-card active" : "request-card"}
                key={request.id}
                onClick={() => {
                  setShowCreateForm(false);
                  setSelectedId(request.id);
                  setSelectedStage(safeStage(request.currentStage, Boolean(request.newVersion)));
                }}
              >
                <span className="request-title">{request.modificationNumber || request.client}</span>
                <span>{request.modificationProject || request.product || "Projet non renseigne"}</span>
                <strong className="stage-pill">{stageLabel(request.currentStage, Boolean(request.newVersion))}</strong>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function ActionsPanel({ actionForm, actions, doneCount, handleCreateAction, handleToggleAction, handleUploadEvidence, lateActions, saving, selectedStage, stageNewProject, updateActionForm }) {
  return (
    <section className="data-section">
      <div className="section-title">
        <h2>Actions - {stageLabel(selectedStage, stageNewProject)}</h2>
        <span>{doneCount}/{actions.length} terminees / {lateActions} retards</span>
      </div>
      <form className="action-form" onSubmit={handleCreateAction}>
        <input value={actionForm.topicRisk} onChange={(event) => updateActionForm("topicRisk", event.target.value)} placeholder="Topic_Risk" />
        <input required value={actionForm.title} onChange={(event) => updateActionForm("title", event.target.value)} placeholder="Point_verif" />
        <input value={actionForm.responsible} onChange={(event) => updateActionForm("responsible", event.target.value)} placeholder="Pilote" />
        <select value={actionForm.criticality} onChange={(event) => updateActionForm("criticality", event.target.value)}>
          <option value="1-critique">1-critique</option>
          <option value="2-moyenne">2-moyenne</option>
          <option value="3-faible">3-faible</option>
        </select>
        <input value={actionForm.expectedEvidence} onChange={(event) => updateActionForm("expectedEvidence", event.target.value)} placeholder="element_preuve" />
        <input type="date" value={actionForm.startDate} onChange={(event) => updateActionForm("startDate", event.target.value)} title="Date debut" />
        <input type="date" value={actionForm.endDate} onChange={(event) => updateActionForm("endDate", event.target.value)} title="Date fin" />
        <input min="0" type="number" value={actionForm.workDurationDays} onChange={(event) => updateActionForm("workDurationDays", event.target.value)} title="Jours de travail" />
        <label className="file-picker">
          <Paperclip size={15} />
          <span>{actionForm.evidenceFile ? actionForm.evidenceFile.name : "Evidence"}</span>
          <input type="file" onChange={(event) => updateActionForm("evidenceFile", event.target.files?.[0] || null)} />
        </label>
        <select value={actionForm.status} onChange={(event) => updateActionForm("status", event.target.value)}>
          <option value="TODO">TODO</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="DONE">DONE</option>
          <option value="LATE">LATE</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
        <button className="icon-action" disabled={saving} title="Enregistrer l'action" type="submit"><Save size={16} /></button>
      </form>
      <div className="action-list">
        {actions.length === 0 ? (
          <EmptyState title="Aucune action pour cette phase" text="Ajoutez une action ou utilisez les actions generees lors de la creation ECR." />
        ) : (
          actions.map((action) => (
            <article className={action.late ? "action-row late" : "action-row"} key={action.id}>
              <label className="action-check" title={action.status === "DONE" ? "Marquer non terminee" : "Marquer terminee"}>
                <input checked={action.checked || action.status === "DONE"} onChange={(event) => handleToggleAction(action, event.target.checked)} type="checkbox" />
              </label>
              <div><h3>{action.title}</h3><p>{action.topicRisk || "-"} / {action.expectedEvidence || "element_preuve non renseigne"}</p></div>
              <span>{action.responsible || "A definir"}</span>
              <strong className={`criticality ${criticalityClass(action.criticality)}`}>{action.criticality || "3-faible"}</strong>
              <span>{action.startDate || "-"}</span>
              <span>{action.endDate || "-"}</span>
              <span>{action.workDurationDays ?? "-"}</span>
              <span>
                {action.evidenceFileName ? (
                  <a className="file-link" href={actionEvidenceUrl(action.id)} target="_blank" rel="noreferrer">{action.evidenceFileName}</a>
                ) : "-"}
              </span>
              <small className={`status ${statusClass(action.status)}`}>{readableStatus(action.status)}</small>
              <label className="row-upload" title="Ajouter evidence">
                <Upload size={15} />
                <input type="file" onChange={(event) => handleUploadEvidence(action, event.target.files?.[0])} />
              </label>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function ChecklistPanel({ checklist }) {
  return (
    <section className="checklist">
      {checklist.length === 0 ? (
        <EmptyState title="Aucun point de verification" text="Les points de controle apparaitront ici pour la phase selectionnee." />
      ) : (
        checklist.map((item) => (
          <article className="check-row" key={item.id}>
            <CheckCircle2 className={item.status === "OK" ? "ok" : ""} size={20} />
            <div><h3>{item.verificationPoint}</h3><p>{item.topicRisk || "Risque non classe"} / {item.expectedEvidence || "Preuve non renseignee"}</p></div>
            <span>{item.pilot || "A definir"}</span>
            <strong className={`status ${statusClass(item.status)}`}>{readableStatus(item.status)}</strong>
          </article>
        ))
      )}
    </section>
  );
}

function EmptyState({ title, text, compact = false }) {
  return (
    <div className={compact ? "empty-state compact" : "empty-state"}>
      <AlertTriangle size={compact ? 18 : 22} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function PageHeader({ eyebrow, title, subtitle }) {
  return (
    <header className="page-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <article className="stat-card">
      <Icon size={20} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export default App;
