import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  ListChecks,
  Lock,
  LogOut,
  Mail,
  Maximize2,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  UserCircle,
  Users,
  X
} from "lucide-react";
import {
  createAction,
  createActionPlanningRule,
  createEcrRequest,
  createProject,
  createUser,
  clearSession,
  deleteActionPlanningRule,
  deleteProject,
  deleteUser,
  getActionPlanningRules,
  getActions,
  getChecklist,
  getCurrentUser,
  getEcrRequests,
  getPilots,
  getProjects,
  getStoredSession,
  getUsers,
  login,
  logout,
  storeSession,
  updateAction,
  updateActionPlanningRule,
  updateEcrStage,
  updateProject,
  updateUser,
  updateUserProfile,
  uploadActionEvidence,
  actionEvidenceUrl,
  changeUserPassword,
  uploadUserPhoto
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
  ["projects", "Projets", FolderKanban],
  ["users", "Utilisateurs", Users],
  ["profile", "Profil", UserCircle]
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
  currentStage: "FEASIBILITY_VALIDATION",
  initialActions: []
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
  evidenceRequired: false,
  comment: ""
};

const emptyPlanningRuleForm = {
  stage: "FEASIBILITY_VALIDATION",
  appliesToModification: true,
  appliesToNewProject: true,
  actionTitle: "",
  topicRisk: "",
  responsible: "",
  criticality: "3-faible",
  expectedEvidence: "",
  evidenceRequired: false,
  dependencyActionTitle: "",
  dependencyAnchor: "OUTPUT",
  durationDays: 1
};

const emptyUserForm = {
  fullName: "",
  username: "",
  jobTitle: "",
  email: "",
  password: "",
  phone: "",
  role: "CHEF_DE_PROJET",
  enabled: true
};

const userRoleOptions = [
  ["ADMIN", "Admin"],
  ["CHEF_DE_PROJET", "Chef de projet"],
  ["VALIDATEUR", "Validateur"],
  ["MANAGER", "Manager"]
];

function userRoleLabel(role) {
  return userRoleOptions.find(([value]) => value === role)?.[1] || role || "-";
}

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

function userToForm(user) {
  return {
    fullName: user?.fullName || "",
    username: user?.username || "",
    jobTitle: user?.jobTitle || "",
    email: user?.email || "",
    password: "",
    phone: user?.phone || "",
    role: user?.role || "CHEF_DE_PROJET",
    enabled: user?.enabled ?? true
  };
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
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

function stageColorClass(stage) {
  const index = stageDefinitions.findIndex((definition) => definition.key === stage);
  return stageColors[index >= 0 ? index % stageColors.length : 0];
}

function App() {
  const [authSession, setAuthSession] = useState(getStoredSession());
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [page, setPage] = useState("dashboard");
  const [menuCollapsed, setMenuCollapsed] = useState(false);
  const [requests, setRequests] = useState([]);
  const [pilots, setPilots] = useState([]);
  const [projects, setProjects] = useState([]);
  const [planningRules, setPlanningRules] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedStage, setSelectedStage] = useState("FEASIBILITY_VALIDATION");
  const [checklist, setChecklist] = useState([]);
  const [actions, setActions] = useState([]);
  const [ecrForm, setEcrForm] = useState(emptyEcrForm);
  const [actionForm, setActionForm] = useState(emptyActionForm);
  const [projectForm, setProjectForm] = useState({ name: "", projectTeam: "" });
  const [planningRuleForm, setPlanningRuleForm] = useState(emptyPlanningRuleForm);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [profileForm, setProfileForm] = useState(emptyUserForm);
  const [passwordForm, setPasswordForm] = useState({ password: "", confirmation: "" });
  const [editingPlanningRule, setEditingPlanningRule] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
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
    return Promise.all([getEcrRequests(), getPilots(), getProjects(), getActionPlanningRules(), getUsers(), getCurrentUser()])
      .then(([requestData, pilotData, projectData, planningRuleData, userData, currentUserData]) => {
        setRequests(requestData);
        setPilots(pilotData);
        setProjects(projectData);
        setPlanningRules(planningRuleData);
        setUsers(userData);
        setCurrentUser(currentUserData);
        setProfileForm(userToForm(currentUserData));
        setSelectedId((currentId) => currentId ?? requestData[0]?.id ?? null);
      });
  }

  useEffect(() => {
    if (!authSession?.token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadInitialData()
      .catch(() => {
        clearSession();
        setAuthSession(null);
        setCurrentUser(null);
        setError("Session expiree ou API indisponible. Connectez-vous a nouveau.");
      })
      .finally(() => setLoading(false));
  }, [authSession?.token]);

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
        nextForm.initialActions = form.initialActions.filter((action) => isStageAllowed(action.stage, value));
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
      sopDate: ecrForm.sopDate || null,
      initialActions: ecrForm.initialActions
        .filter((action) => action.title.trim())
        .map(({ clientId, ...action }) => ({
          ...action,
          workDurationDays: Number(action.workDurationDays) || 1
        }))
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
    if (actionForm.evidenceRequired && actionForm.status === "DONE" && !actionForm.evidenceFile) {
      setError("Ajoutez un asset avant de creer cette action comme terminee.");
      return;
    }
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
    if (completed && action.evidenceRequired && !action.evidenceFileName) {
      setError("Cette action necessite un asset avant d'etre terminee.");
      return;
    }
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
      topicRisk: planningRuleForm.topicRisk.trim() || null,
      responsible: planningRuleForm.responsible.trim() || null,
      expectedEvidence: planningRuleForm.expectedEvidence.trim() || null,
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
      appliesToModification: rule.appliesToModification ?? true,
      appliesToNewProject: rule.appliesToNewProject ?? true,
      actionTitle: rule.actionTitle || "",
      topicRisk: rule.topicRisk || "",
      responsible: rule.responsible || "",
      criticality: rule.criticality || "3-faible",
      expectedEvidence: rule.expectedEvidence || "",
      evidenceRequired: Boolean(rule.evidenceRequired),
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

  function handleSaveUser(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      ...userForm,
      fullName: userForm.fullName.trim(),
      username: userForm.username.trim(),
      email: userForm.email.trim(),
      jobTitle: userForm.jobTitle.trim(),
      phone: userForm.phone.trim()
    };
    const request = editingUser ? updateUser(editingUser, payload) : createUser(payload);
    request
      .then((savedUser) => {
        setUsers((items) => [...items.filter((item) => item.id !== savedUser.id), savedUser].sort((a, b) => String(a.fullName).localeCompare(String(b.fullName))));
        if (currentUser?.id === savedUser.id) {
          setCurrentUser(savedUser);
          setProfileForm(userToForm(savedUser));
        }
        setUserForm(emptyUserForm);
        setEditingUser(null);
      })
      .catch(() => setError("Sauvegarde utilisateur impossible. Verifiez username/email uniques et les champs obligatoires."))
      .finally(() => setSaving(false));
  }

  function startUserEdit(user) {
    setEditingUser(user.id);
    setUserForm(userToForm(user));
  }

  function handleDeleteUser(id) {
    setError("");
    deleteUser(id)
      .then(() => {
        setUsers((items) => items.filter((item) => item.id !== id));
        if (editingUser === id) {
          setEditingUser(null);
          setUserForm(emptyUserForm);
        }
      })
      .catch(() => setError("Suppression utilisateur impossible."));
  }

  function handleSaveProfile(event) {
    event.preventDefault();
    if (!currentUser) return;
    setSaving(true);
    setError("");
    updateUserProfile(currentUser.id, profileForm)
      .then((savedUser) => {
        setCurrentUser(savedUser);
        setProfileForm(userToForm(savedUser));
        setUsers((items) => items.map((item) => (item.id === savedUser.id ? savedUser : item)));
      })
      .catch(() => setError("Mise a jour du profil impossible."))
      .finally(() => setSaving(false));
  }

  function handleChangePassword(event) {
    event.preventDefault();
    if (!currentUser) return;
    if (!passwordForm.password || passwordForm.password !== passwordForm.confirmation) {
      setError("Confirmez le nouveau mot de passe avec la meme valeur.");
      return;
    }
    setSaving(true);
    setError("");
    changeUserPassword(currentUser.id, passwordForm.password)
      .then(() => setPasswordForm({ password: "", confirmation: "" }))
      .catch(() => setError("Changement de mot de passe impossible."))
      .finally(() => setSaving(false));
  }

  function handleUploadUserPhoto(file) {
    if (!currentUser || !file) return;
    setError("");
    uploadUserPhoto(currentUser.id, file)
      .then((savedUser) => {
        setCurrentUser(savedUser);
        setUsers((items) => items.map((item) => (item.id === savedUser.id ? savedUser : item)));
      })
      .catch(() => setError("Ajout de la photo impossible."));
  }

  function handleLogin(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    login(loginForm.email, loginForm.password)
      .then((session) => {
        storeSession(session);
        setAuthSession(session);
        setCurrentUser(session.user);
        setProfileForm(userToForm(session.user));
        setLoginForm({ email: "", password: "" });
      })
      .catch(() => setError("Email ou mot de passe incorrect."))
      .finally(() => setSaving(false));
  }

  function handleLogout() {
    logout()
      .catch(() => clearSession())
      .finally(() => {
        setAuthSession(null);
        setCurrentUser(null);
        setRequests([]);
        setUsers([]);
        setPage("dashboard");
      });
  }

  function openCreateFlow() {
    setPage("modifications");
    setShowCreateForm(true);
  }

  if (loading) {
    return <main className="centered">Chargement...</main>;
  }

  if (!authSession?.token) {
    return (
      <LoginPage
        error={error}
        form={loginForm}
        saving={saving}
        onSubmit={handleLogin}
        setForm={setLoginForm}
      />
    );
  }

  return (
    <main className={menuCollapsed ? "app-frame nav-collapsed" : "app-frame"}>
      <aside className="app-nav">
        <div className="brand">
          <ClipboardList className="brand-mark" size={24} />
          <div className="brand-copy">
            <h1>Gestion Planning</h1>
            <span>Application ECR</span>
          </div>
          <button
            aria-label={menuCollapsed ? "Agrandir le menu" : "Reduire le menu"}
            className="nav-toggle"
            onClick={() => setMenuCollapsed((collapsed) => !collapsed)}
            title={menuCollapsed ? "Agrandir le menu" : "Reduire le menu"}
            type="button"
          >
            {menuCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
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
              <span>{label}</span>
            </button>
          ))}
          <button className="menu-item logout-item" onClick={handleLogout} type="button">
            <LogOut size={18} />
            <span>Deconnexion</span>
          </button>
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

        {page === "users" && (
          <UsersPage
            currentUser={currentUser}
            editingUser={editingUser}
            saving={saving}
            userForm={userForm}
            users={users}
            onCancelEdit={() => {
              setEditingUser(null);
              setUserForm(emptyUserForm);
            }}
            onDelete={handleDeleteUser}
            onEdit={startUserEdit}
            onSubmit={handleSaveUser}
            setUserForm={setUserForm}
          />
        )}

        {page === "profile" && (
          <ProfilePage
            currentUser={currentUser}
            passwordForm={passwordForm}
            profileForm={profileForm}
            saving={saving}
            onChangePassword={handleChangePassword}
            onSubmit={handleSaveProfile}
            onUploadPhoto={handleUploadUserPhoto}
            setPasswordForm={setPasswordForm}
            setProfileForm={setProfileForm}
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

function LoginPage({ error, form, saving, onSubmit, setForm }) {
  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="login-brand">
          <ClipboardList className="brand-mark" size={28} />
          <div>
            <p className="eyebrow">Gestion Planning</p>
            <h1>Connexion</h1>
            <span>Acces securise a l'application ECR</span>
          </div>
        </div>
        {error && (
          <div className="banner login-banner">
            <CircleAlert size={18} />
            {error}
          </div>
        )}
        <form className="login-form" onSubmit={onSubmit}>
          <label>
            Email
            <span className="input-with-icon">
              <Mail size={16} />
              <input
                autoComplete="email"
                required
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="f.chalbi@sagetunisia.com"
              />
            </span>
          </label>
          <label>
            Mot de passe
            <span className="input-with-icon">
              <Lock size={16} />
              <input
                autoComplete="current-password"
                required
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Votre mot de passe"
              />
            </span>
          </label>
          <button className="primary-action wide-action" disabled={saving} type="submit">
            <Lock size={16} />
            Se connecter
          </button>
        </form>
      </section>
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
                <small className={`stage-pill ${stageColorClass(request.currentStage)}`}>{stageLabel(request.currentStage, Boolean(request.newVersion))}</small>
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
  const actionCount = ecrForm.initialActions.length;

  function addInitialAction(stage) {
    updateEcrForm("initialActions", [
      ...ecrForm.initialActions,
      {
        clientId: `${stage}-${Date.now()}`,
        stage,
        title: "",
        responsible: ecrForm.pilot || "",
        criticality: "3-faible",
        expectedEvidence: "",
        evidenceRequired: false,
        status: "TODO",
        workDurationDays: 1
      }
    ]);
  }

  function updateInitialAction(clientId, field, value) {
    updateEcrForm("initialActions", ecrForm.initialActions.map((action) => (
      action.clientId === clientId ? { ...action, [field]: value } : action
    )));
  }

  function removeInitialAction(clientId) {
    updateEcrForm("initialActions", ecrForm.initialActions.filter((action) => action.clientId !== clientId));
  }

  return (
    <section className="creation-panel">
      <form className="panel form-page" onSubmit={onSubmit}>
        <div className="form-intro">
          <div>
            <p className="eyebrow">Creation ECR</p>
            <h2 id="create-modification-title">Nouvelle modification</h2>
            <p>Renseignez les informations de base, creez la demande, puis continuez directement le suivi des phases et actions sur cette meme page.</p>
          </div>
          <span className="stage-pill teal">Creation assistee</span>
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
        <section className="initial-actions-builder">
          <div className="section-title">
            <div>
              <h2>Actions complementaires</h2>
              <span>{actionCount} actions ajoutees en plus du referentiel admin</span>
            </div>
          </div>
          <div className="initial-stage-list">
            {availableStages.map(([stageKey, label]) => {
              const stageActions = ecrForm.initialActions.filter((action) => action.stage === stageKey);
              return (
                <article className="initial-stage" key={stageKey}>
                  <div className="initial-stage-head">
                    <span className={`stage-pill ${stageColorClass(stageKey)}`}>{label}</span>
                    <button className="secondary-action compact-action" type="button" onClick={() => addInitialAction(stageKey)}>
                      <Plus size={14} />
                      Action
                    </button>
                  </div>
                  <div className="initial-action-list">
                    {stageActions.length === 0 ? (
                      <p className="form-hint">Aucune action definie pour cette phase.</p>
                    ) : stageActions.map((action) => (
                      <div className="initial-action-row" key={action.clientId}>
                        <input required value={action.title} onChange={(event) => updateInitialAction(action.clientId, "title", event.target.value)} placeholder="Titre de l'action" />
                        <input value={action.responsible} onChange={(event) => updateInitialAction(action.clientId, "responsible", event.target.value)} placeholder="Pilote" />
                        <select value={action.criticality} onChange={(event) => updateInitialAction(action.clientId, "criticality", event.target.value)}>
                          <option value="1-critique">1-critique</option>
                          <option value="2-moyenne">2-moyenne</option>
                          <option value="3-faible">3-faible</option>
                        </select>
                        <input value={action.expectedEvidence} onChange={(event) => updateInitialAction(action.clientId, "expectedEvidence", event.target.value)} placeholder="Asset / preuve attendue" />
                        <label className="asset-required-field">
                          <input checked={action.evidenceRequired} type="checkbox" onChange={(event) => updateInitialAction(action.clientId, "evidenceRequired", event.target.checked)} />
                          Asset obligatoire
                        </label>
                        <button className="ghost-icon" type="button" onClick={() => removeInitialAction(action.clientId)} title="Supprimer l'action">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        <div className="button-row">
          <button className="primary-action" disabled={saving || projects.length === 0} type="submit">
            <Plus size={16} />
            Creer et ouvrir le suivi
          </button>
          <button className="secondary-action" type="button" onClick={onCancel}>Annuler</button>
        </div>
        {projects.length === 0 && <p className="form-hint">Ajoutez d'abord au moins un projet dans le referentiel projets.</p>}
        <p className="form-hint">Les actions standard de chaque phase sont generees automatiquement depuis la page Projets / Actions standard par phase.</p>
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
                    <button className="secondary-action compact-action icon-only-action" type="button" onClick={() => onEdit(project)} aria-label="Modifier le projet" title="Modifier">
                      <Pencil size={15} />
                    </button>
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showNewProjectStages, setShowNewProjectStages] = useState(false);

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

  return (
    <section className="panel planning-admin">
      <div className="section-title">
        <div>
          <h2>Actions standard par phase</h2>
          <span>L'admin definit les actions, criticites, preuves et liaisons qui seront generees dans chaque nouvelle ECR.</span>
        </div>
        <span>{rules.length} actions</span>
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
        type={showNewProjectStages ? "newProject" : "modification"}
        onCreate={openCreateDialog}
      />
      <div className="planning-rule-list">
        {rules.length === 0 ? (
          <EmptyState title="Aucune action standard" text="Cliquez sur une phase coloree pour creer la premiere action standard." />
        ) : (
          rules.map((rule) => (
            <article className="planning-rule-row" key={rule.id}>
              <span className={`stage-pill ${stageColorClass(rule.stage)}`}>{stageLabel(rule.stage)}</span>
              <div>
                <strong>{rule.actionTitle}</strong>
                <span>{rule.topicRisk || "Topic non renseigne"} / {rule.expectedEvidence || "Preuve non renseignee"}</span>
              </div>
              <strong className={`criticality ${criticalityClass(rule.criticality)}`}>{rule.criticality || "3-faible"}</strong>
              <span>{[rule.appliesToModification ? "Modification" : "", rule.appliesToNewProject ? "Nouveau projet" : ""].filter(Boolean).join(" + ")}</span>
              <span>{rule.dependencyActionTitle ? `Apres ${rule.dependencyAnchor === "INPUT" ? "entree" : "sortie"}: ${rule.dependencyActionTitle}` : "Depart reception ECR"}</span>
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
          form={form}
          saving={saving}
          onClose={closeDialog}
          onSubmit={submitDialog}
          setForm={setForm}
        />
      )}
    </section>
  );
}

function PhaseActionGrid({ label, newProject = false, rules, type, onCreate }) {
  const stages = stageDefinitions.filter((stage) => (newProject ? stage.newProject : stage.modification));

  return (
    <section className="admin-phase-section">
      <div className="phase-preview-title">
        <h3>{label}</h3>
        <span>{stages.length} phases</span>
      </div>
      <div className="admin-phase-grid">
        {stages.map((stage, index) => {
          const count = rules.filter((rule) => (
            rule.stage === stage.key && (newProject ? rule.appliesToNewProject : rule.appliesToModification)
          )).length;
          return (
            <button className={`admin-phase-card ${stageColors[index % stageColors.length]}`} key={`${type}-${stage.key}`} type="button" onClick={() => onCreate(stage.key, type)}>
              <strong>{newProject ? stage.newProjectLabel : stage.modificationLabel}</strong>
              <span>{count} action{count > 1 ? "s" : ""}</span>
              <Plus size={18} />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function getActionRulePhaseOptions(form) {
  if (form.appliesToNewProject && !form.appliesToModification) {
    return getStages(true);
  }
  if (form.appliesToModification && !form.appliesToNewProject) {
    return getStages(false);
  }
  return stageDefinitions
    .filter((stage) => stage.modification || stage.newProject)
    .map((stage) => [
      stage.key,
      stage.modificationLabel === stage.newProjectLabel
        ? stage.modificationLabel
        : `${stage.modificationLabel} / ${stage.newProjectLabel}`
    ]);
}

function ActionRuleDialog({ form, saving, onClose, onSubmit, setForm }) {
  const phaseOptions = getActionRulePhaseOptions(form);

  function updateScope(field, value) {
    setForm((current) => {
      const next = {
        ...current,
        [field]: value
      };
      if (!next.appliesToModification && !next.appliesToNewProject) {
        next[field === "appliesToModification" ? "appliesToNewProject" : "appliesToModification"] = true;
      }
      const nextOptions = getActionRulePhaseOptions(next);
      if (!nextOptions.some(([stage]) => stage === next.stage)) {
        next.stage = nextOptions[0]?.[0] || "FEASIBILITY_VALIDATION";
      }
      return next;
    });
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
            <h2 id="action-rule-dialog-title">{stageLabel(form.stage)}</h2>
            <p>Definissez l'action, sa criticite et ses dependances pour cette phase.</p>
          </div>
          <button className="ghost-icon" type="button" onClick={onClose} title="Fermer">
            <X size={18} />
          </button>
        </div>
        <label className="project-type-toggle action-dialog-project-toggle">
          <input
            aria-label="Action pour nouveau projet"
            checked={form.appliesToNewProject && !form.appliesToModification}
            type="checkbox"
            onChange={(event) => {
              const checked = event.target.checked;
              setForm((current) => {
                const next = {
                  ...current,
                  appliesToModification: !checked,
                  appliesToNewProject: checked
                };
                const nextOptions = getActionRulePhaseOptions(next);
                if (!nextOptions.some(([stage]) => stage === next.stage)) {
                  next.stage = nextOptions[0]?.[0] || "FEASIBILITY_VALIDATION";
                }
                return next;
              });
            }}
          />
          <span className="toggle-visual" aria-hidden="true" />
          <span>
            <strong>Nouveau Projet</strong>
          </span>
        </label>
        <div className="planning-rule-form dialog-rule-form">
          <label className="asset-required-field user-enabled-field">
            <input checked={form.appliesToModification} type="checkbox" onChange={(event) => updateScope("appliesToModification", event.target.checked)} />
            Modification
          </label>
          <label className="asset-required-field user-enabled-field">
            <input checked={form.appliesToNewProject} type="checkbox" onChange={(event) => updateScope("appliesToNewProject", event.target.checked)} />
            Nouveau projet
          </label>
          <label>
            Phase
            <select value={form.stage} onChange={(event) => setForm((current) => ({ ...current, stage: event.target.value }))}>
              {phaseOptions.map(([stage, label]) => (
                <option key={stage} value={stage}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Action
            <input required value={form.actionTitle} onChange={(event) => setForm((current) => ({ ...current, actionTitle: event.target.value }))} placeholder="Ex: Validation input" />
          </label>
          <label>
            Topic / risque
            <input value={form.topicRisk} onChange={(event) => setForm((current) => ({ ...current, topicRisk: event.target.value }))} placeholder="Risque ou sujet" />
          </label>
          <label>
            Responsable
            <input value={form.responsible} onChange={(event) => setForm((current) => ({ ...current, responsible: event.target.value }))} placeholder="Vide = pilote ECR" />
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
            Preuve attendue
            <input value={form.expectedEvidence} onChange={(event) => setForm((current) => ({ ...current, expectedEvidence: event.target.value }))} placeholder="Asset / document attendu" />
          </label>
          <label>
            Bloquee par
            <input value={form.dependencyActionTitle} onChange={(event) => setForm((current) => ({ ...current, dependencyActionTitle: event.target.value }))} placeholder="Ex: action 1 ou titre exact" />
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

function UsersPage({ currentUser, editingUser, saving, userForm, users, onCancelEdit, onDelete, onEdit, onSubmit, setUserForm }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const canAdmin = currentUser?.username === "fchelbi" || currentUser?.role === "ADMIN";

  function openCreateDialog() {
    setUserForm(emptyUserForm);
    setDialogOpen(true);
  }

  function openEditDialog(user) {
    onEdit(user);
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

  return (
    <section className="page-content users-content">
      <PageHeader eyebrow="Administration" title="Utilisateurs" subtitle="Creation et maintenance des comptes applicatifs par l'administrateur fchelbi." />
      {!canAdmin && <EmptyState title="Acces admin requis" text="Connectez-vous avec fchelbi pour administrer les utilisateurs." />}
      <div className="users-layout">
        <section className="panel">
          <div className="section-title">
            <h2>Liste des utilisateurs</h2>
            <div className="row-actions">
              <span>{users.length} comptes</span>
              <button className="primary-action compact-action" disabled={!canAdmin} type="button" onClick={openCreateDialog}>
                <Plus size={16} />
                Ajouter un utilisateur
              </button>
            </div>
          </div>
          <div className="user-table">
            {users.length === 0 ? (
              <EmptyState title="Aucun utilisateur" text="Ajoutez un premier compte pour demarrer l'administration." />
            ) : (
              users.map((user) => (
                <article className="user-row" key={user.id}>
                  <div className="avatar-cell">
                    {user.profilePhotoUrl ? <img alt="" src={user.profilePhotoUrl} /> : <UserCircle size={24} />}
                  </div>
                  <div><strong>{user.fullName}</strong><span>{user.jobTitle || "-"}</span></div>
                  <div><strong>{user.username || "-"}</strong><span>{user.email}</span></div>
                  <small className="status in_progress">{userRoleLabel(user.role)}</small>
                  <div className="row-actions">
                    <button className="secondary-action compact-action icon-only-action" disabled={!canAdmin} type="button" onClick={() => openEditDialog(user)} aria-label="Modifier l'utilisateur" title="Modifier">
                      <Pencil size={15} />
                    </button>
                    <button className="ghost-icon" disabled={!canAdmin || user.id === currentUser?.id} type="button" onClick={() => onDelete(user.id)} title="Supprimer">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
      {dialogOpen && (
        <UserDialog
          canAdmin={canAdmin}
          editingUser={editingUser}
          form={userForm}
          saving={saving}
          onClose={closeDialog}
          onSubmit={submitDialog}
          setForm={setUserForm}
        />
      )}
    </section>
  );
}

function UserDialog({ canAdmin, editingUser, form, saving, onClose, onSubmit, setForm }) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        aria-labelledby="user-dialog-title"
        aria-modal="true"
        className="dialog-card user-dialog panel form-page"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
        role="dialog"
      >
        <div className="form-intro">
          <div>
            <h2 id="user-dialog-title">{editingUser ? "Modifier l'utilisateur" : "Ajouter un utilisateur"}</h2>
            <p>Le username et l'email doivent rester uniques. Le mot de passe est requis seulement a la creation.</p>
          </div>
          <button className="ghost-icon" type="button" onClick={onClose} title="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="field-grid">
          <label>
            Nom complet
            <input required disabled={!canAdmin} value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} />
          </label>
          <label>
            Username
            <input required disabled={!canAdmin} value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} />
          </label>
          <label>
            Poste
            <input disabled={!canAdmin} value={form.jobTitle} onChange={(event) => setForm((current) => ({ ...current, jobTitle: event.target.value }))} />
          </label>
          <label>
            Email
            <input required disabled={!canAdmin} type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label>
            Mot de passe
            <input required={!editingUser} disabled={!canAdmin} type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
          </label>
          <label>
            Telephone
            <input disabled={!canAdmin} value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
          </label>
          <label>
            Role
            <select disabled={!canAdmin} value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
              {userRoleOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="asset-required-field user-enabled-field">
            <input disabled={!canAdmin} checked={form.enabled} type="checkbox" onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} />
            Compte actif
          </label>
        </div>
        <div className="button-row">
          <button className="primary-action" disabled={saving || !canAdmin} type="submit">
            <Save size={16} />
            Enregistrer
          </button>
          <button className="secondary-action" type="button" onClick={onClose}>Annuler</button>
        </div>
      </form>
    </div>
  );
}

function ProfilePage({ currentUser, passwordForm, profileForm, saving, onChangePassword, onSubmit, onUploadPhoto, setPasswordForm, setProfileForm }) {
  if (!currentUser) {
    return (
      <section className="page-content">
        <PageHeader eyebrow="Compte" title="Profil" subtitle="Les informations du compte seront disponibles apres chargement." />
        <EmptyState title="Profil indisponible" text="Le compte fchelbi n'a pas encore ete charge." />
      </section>
    );
  }

  return (
    <section className="page-content profile-content">
      <PageHeader eyebrow="Compte" title="Mon profil" subtitle="Photo, informations personnelles et changement de mot de passe." />
      <div className="profile-layout">
        <section className="panel profile-card">
          <div className="profile-photo">
            {currentUser.profilePhotoUrl ? <img alt="" src={currentUser.profilePhotoUrl} /> : <UserCircle size={72} />}
          </div>
          <h2>{currentUser.fullName}</h2>
          <span>{currentUser.jobTitle || "Poste non renseigne"}</span>
          <strong className="stage-pill teal">{userRoleLabel(currentUser.role)}</strong>
          <label className="secondary-action compact-action photo-upload">
            <Camera size={15} />
            Photo
            <input accept="image/*" type="file" onChange={(event) => onUploadPhoto(event.target.files?.[0])} />
          </label>
        </section>
        <form className="panel form-page" onSubmit={onSubmit}>
          <div className="form-intro">
            <div>
              <h2>Informations profil</h2>
              <p>Mettez a jour vos coordonnees et votre identification utilisateur.</p>
            </div>
          </div>
          <div className="field-grid">
            <label>
              Nom complet
              <input required value={profileForm.fullName} onChange={(event) => setProfileForm((form) => ({ ...form, fullName: event.target.value }))} />
            </label>
            <label>
              Username
              <input required value={profileForm.username} onChange={(event) => setProfileForm((form) => ({ ...form, username: event.target.value }))} />
            </label>
            <label>
              Poste
              <input value={profileForm.jobTitle} onChange={(event) => setProfileForm((form) => ({ ...form, jobTitle: event.target.value }))} />
            </label>
            <label>
              Email
              <input required type="email" value={profileForm.email} onChange={(event) => setProfileForm((form) => ({ ...form, email: event.target.value }))} />
            </label>
            <label>
              Telephone
              <input value={profileForm.phone} onChange={(event) => setProfileForm((form) => ({ ...form, phone: event.target.value }))} />
            </label>
          </div>
          <div className="button-row">
            <button className="primary-action" disabled={saving} type="submit">
              <Save size={16} />
              Enregistrer profil
            </button>
          </div>
        </form>
        <form className="panel form-page password-panel" onSubmit={onChangePassword}>
          <div className="form-intro">
            <div>
              <h2>Mot de passe</h2>
              <p>Choisissez un nouveau mot de passe pour votre prochain acces.</p>
            </div>
          </div>
          <label>
            Nouveau mot de passe
            <input required type="password" value={passwordForm.password} onChange={(event) => setPasswordForm((form) => ({ ...form, password: event.target.value }))} />
          </label>
          <label>
            Confirmation
            <input required type="password" value={passwordForm.confirmation} onChange={(event) => setPasswordForm((form) => ({ ...form, confirmation: event.target.value }))} />
          </label>
          <div className="button-row">
            <button className="secondary-action" disabled={saving} type="submit">
              <Save size={16} />
              Changer mot de passe
            </button>
          </div>
        </form>
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
                  <button key={key} className={`tab ${stageColorClass(key)}${selectedStage === key ? " active" : ""}`} onClick={() => handleStageChange(key)}>
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
                <strong className={`stage-pill ${stageColorClass(request.currentStage)}`}>{stageLabel(request.currentStage, Boolean(request.newVersion))}</strong>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function ActionsPanel({ actionForm, actions, doneCount, handleCreateAction, handleToggleAction, handleUploadEvidence, lateActions, saving, selectedStage, stageNewProject, updateActionForm }) {
  const [expanded, setExpanded] = useState(false);
  const stageTitle = stageLabel(selectedStage, stageNewProject);

  return (
    <section className="data-section">
      <div className="section-title">
        <div>
          <h2>Actions - {stageTitle}</h2>
          <span>{doneCount}/{actions.length} terminees / {lateActions} retards</span>
        </div>
        <button className="secondary-action compact-action" type="button" onClick={() => setExpanded(true)} title="Agrandir les actions">
          <Maximize2 size={15} />
          Agrandir
        </button>
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
        <label className="action-asset-toggle">
          <input checked={actionForm.evidenceRequired} type="checkbox" onChange={(event) => updateActionForm("evidenceRequired", event.target.checked)} />
          Asset requis
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
      <ActionList actions={actions} handleToggleAction={handleToggleAction} handleUploadEvidence={handleUploadEvidence} />
      {expanded && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setExpanded(false)}>
          <section
            aria-labelledby="expanded-actions-title"
            aria-modal="true"
            className="actions-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="actions-dialog-header">
              <div>
                <p className="eyebrow">Phase</p>
                <h2 id="expanded-actions-title">Actions - {stageTitle}</h2>
                <span>{doneCount}/{actions.length} terminees / {lateActions} retards</span>
              </div>
              <button className="ghost-icon" type="button" onClick={() => setExpanded(false)} title="Fermer">
                <X size={18} />
              </button>
            </header>
            <ActionList actions={actions} expanded handleToggleAction={handleToggleAction} handleUploadEvidence={handleUploadEvidence} />
          </section>
        </div>
      )}
    </section>
  );
}

function ActionList({ actions, expanded = false, handleToggleAction, handleUploadEvidence }) {
  return (
    <div className={expanded ? "action-list expanded" : "action-list"}>
      {actions.length === 0 ? (
        <EmptyState title="Aucune action pour cette phase" text="Ajoutez une action ou utilisez les actions generees lors de la creation ECR." />
      ) : (
        actions.map((action) => (
          <article className={action.late ? "action-row late" : "action-row"} key={action.id}>
            <label className="action-check" title={action.status === "DONE" ? "Marquer non terminee" : "Marquer terminee"}>
              <input checked={action.checked || action.status === "DONE"} onChange={(event) => handleToggleAction(action, event.target.checked)} type="checkbox" />
            </label>
            <div className="action-main">
              <h3>{action.title}</h3>
              <p>{action.topicRisk || "-"} / {action.expectedEvidence || "element_preuve non renseigne"}</p>
            </div>
            <div className="action-meta">
              <span><em>Pilote</em><strong>{action.responsible || "A definir"}</strong></span>
              <span><em>Criticite</em><strong className={`criticality ${criticalityClass(action.criticality)}`}>{action.criticality || "3-faible"}</strong></span>
              <span><em>Debut</em><strong>{action.startDate || "-"}</strong></span>
              <span><em>Fin</em><strong>{action.endDate || "-"}</strong></span>
              <span><em>Jours</em><strong>{action.workDurationDays ?? "-"}</strong></span>
              <span><em>Asset</em><strong>{action.evidenceRequired ? "Obligatoire" : "Optionnel"}</strong></span>
              <span className="evidence-meta">
                <em>Preuve</em>
                <strong>
                  {action.evidenceFileName ? (
                    <a className="file-link" href={actionEvidenceUrl(action.id)} target="_blank" rel="noreferrer">{action.evidenceFileName}</a>
                  ) : "-"}
                </strong>
              </span>
              <span><em>Status</em><small className={`status ${statusClass(action.status)}`}>{readableStatus(action.status)}</small></span>
            </div>
            <label className="row-upload" title="Ajouter evidence">
              <Upload size={15} />
              <input type="file" onChange={(event) => handleUploadEvidence(action, event.target.files?.[0])} />
            </label>
          </article>
        ))
      )}
    </div>
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
