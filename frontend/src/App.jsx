import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  FolderKanban,
  Gauge,
  Maximize2,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
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
  deleteAction,
  deleteEcrRequest,
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
import { EmptyState } from "./components/common/EmptyState";
import { PageHeader } from "./components/common/PageHeader";
import { StatCard } from "./components/common/StatCard";
import { emptyActionForm, emptyEcrForm, emptyPlanningRuleForm, emptyUserForm } from "./constants/forms";
import { userRoleOptions } from "./constants/roles";
import { stageColors } from "./constants/stages";
import { PlanningRulesAdmin } from "./features/actionRules/PlanningRulesAdmin";
import { LoginPage } from "./features/auth/LoginPage";
import { ProfilePage } from "./features/profile/ProfilePage";
import { UsersPage } from "./features/users/UsersPage";
import { Sidebar } from "./layout/Sidebar";
import { comparePlanningRules } from "./utils/planningRules";
import { criticalityClass, readableStatus, statusClass } from "./utils/status";
import { getStages, safeStage, stageColorClass, stageLabel } from "./utils/stages";
import { userToForm } from "./utils/users";
import "./styles.css";

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

  function openRequest(request) {
    setSelectedId(request.id);
    setSelectedStage(safeStage(request.currentStage, Boolean(request.newVersion)));
    setShowCreateForm(false);
    setPage("modifications");
  }

  function handleDeleteEcr(request) {
    const label = request.modificationNumber || request.client || `#${request.id}`;
    Swal.fire({
      title: "Supprimer la modification ?",
      text: `La modification ${label} sera supprimée définitivement.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Supprimer",
      cancelButtonText: "Annuler",
      confirmButtonColor: "#b42318"
    }).then((result) => {
      if (!result.isConfirmed) return;
      setSaving(true);
      setError("");
      deleteEcrRequest(request.id)
        .then(() => getEcrRequests())
        .then((requestData) => {
          setRequests(requestData);
          if (selectedId === request.id) {
            const nextRequest = requestData[0] || null;
            setSelectedId(nextRequest?.id ?? null);
            setSelectedStage(nextRequest ? safeStage(nextRequest.currentStage, Boolean(nextRequest.newVersion)) : "FEASIBILITY_VALIDATION");
          }
          Swal.fire({ title: "Suppression effectuee", icon: "success", timer: 1500, showConfirmButton: false });
        })
        .catch(() => {
          setError("Suppression de la modification impossible. Verifiez les droits ou les donnees liees.");
          Swal.fire("Erreur", "Suppression de la modification impossible.", "error");
        })
        .finally(() => setSaving(false));
    });
  }

  function actionFormPayload(form, stage) {
    return {
      ...form,
      evidenceFile: undefined,
      checked: form.status === "DONE",
      closedDate: form.status === "DONE" ? new Date().toISOString().slice(0, 10) : null,
      deadline: form.deadline || null,
      date1: form.date1 || null,
      date2: form.date2 || null,
      date3: form.date3 || null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      workDurationDays: Number(form.workDurationDays) || 1,
      stage
    };
  }

  function dependencyFor(action) {
    return action?.dependsOnActionId ? actions.find((item) => item.id === action.dependsOnActionId) : null;
  }

  function dependencyBlocksCompletion(action) {
    const dependency = dependencyFor(action);
    return dependency && !(dependency.checked || dependency.status === "DONE");
  }

  function handleCreateAction(event) {
    event.preventDefault();
    if (!selectedRequest) return Promise.resolve();
    if (actionForm.evidenceRequired && actionForm.status === "DONE" && !actionForm.evidenceFile) {
      setError("Ajoutez un asset avant de creer cette action comme terminee.");
      Swal.fire("Asset requis", "Ajoutez un asset avant de creer cette action comme terminee.", "warning");
      return Promise.reject(new Error("Evidence required"));
    }
    setSaving(true);
    const payload = actionFormPayload(actionForm, selectedStage);
    const createPayload = actionForm.evidenceFile && payload.status === "DONE"
      ? { ...payload, checked: false, status: "TODO", closedDate: null }
      : payload;
    return createAction(selectedRequest.id, createPayload)
      .then((savedAction) => {
        if (actionForm.evidenceFile) {
          return uploadActionEvidence(savedAction.id, actionForm.evidenceFile)
            .then((actionWithEvidence) => (payload.status === "DONE" ? updateAction(actionWithEvidence.id, payload) : actionWithEvidence));
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

  function handleUpdateAction(action, form) {
    if (!selectedRequest) return Promise.resolve();
    if (form.status === "DONE" && dependencyBlocksCompletion(action)) {
      const dependency = dependencyFor(action);
      setError("Terminez d'abord l'action precedente avant de valider cette action.");
      Swal.fire("Action bloquee", `Terminez d'abord: ${dependency.title || "action precedente"}.`, "warning");
      return Promise.reject(new Error("Dependency incomplete"));
    }
    if (form.evidenceRequired && form.status === "DONE" && !action.evidenceFileName && !form.evidenceFile) {
      setError("Ajoutez un asset avant de terminer cette action.");
      Swal.fire("Asset requis", "Ajoutez un asset avant de terminer cette action.", "warning");
      return Promise.reject(new Error("Evidence required"));
    }
    setSaving(true);
    setError("");
    const payload = actionFormPayload(form, selectedStage);
    const saveRequest = form.evidenceFile
      ? uploadActionEvidence(action.id, form.evidenceFile).then(() => updateAction(action.id, payload))
      : updateAction(action.id, payload);
    return saveRequest
      .then(() => getActions(selectedRequest.id, selectedStage))
      .then((actionData) => {
        setActions(actionData);
        Swal.fire({ title: "Action modifiee", icon: "success", timer: 1300, showConfirmButton: false });
      })
      .catch((error) => {
        setError("Modification action impossible.");
        Swal.fire("Erreur", "Modification action impossible.", "error");
        throw error;
      })
      .finally(() => setSaving(false));
  }

  function handleDeleteAction(action) {
    if (!selectedRequest) return;
    Swal.fire({
      title: "Supprimer l'action ?",
      text: action.title || "Cette action sera supprimée définitivement.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Supprimer",
      cancelButtonText: "Annuler",
      confirmButtonColor: "#b42318"
    }).then((result) => {
      if (!result.isConfirmed) return;
      setSaving(true);
      setError("");
      deleteAction(action.id)
        .then(() => getActions(selectedRequest.id, selectedStage))
        .then((actionData) => {
          setActions(actionData);
          Swal.fire({ title: "Action supprimée", icon: "success", timer: 1300, showConfirmButton: false });
        })
        .catch(() => {
          setError("Suppression action impossible.");
          Swal.fire("Erreur", "Suppression action impossible.", "error");
        })
        .finally(() => setSaving(false));
    });
  }

  function handleToggleAction(action, completed) {
    if (completed && dependencyBlocksCompletion(action)) {
      const dependency = dependencyFor(action);
      setError("Terminez d'abord l'action precedente avant de valider cette action.");
      Swal.fire("Action bloquee", `Terminez d'abord: ${dependency.title || "action precedente"}.`, "warning");
      return;
    }
    if (completed && action.evidenceRequired && !action.evidenceFileName) {
      setError("Cette action necessite un asset avant d'etre terminee.");
      Swal.fire("Asset requis", "Ajoutez un asset avant de terminer cette action.", "warning");
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
      expectedEvidence: null,
      dependencyActionTitle: planningRuleForm.dependencyActionTitle.trim() || null,
      dependencyAnchor: "OUTPUT",
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
      <Sidebar
        collapsed={menuCollapsed}
        page={page}
        onCollapseToggle={() => setMenuCollapsed((collapsed) => !collapsed)}
        onLogout={handleLogout}
        onNavigate={(nextPage) => {
          setPage(nextPage);
          setShowCreateForm(false);
        }}
      />

      <section className="page-shell">
        {error && (
          <div className="banner">
            <CircleAlert size={18} />
            {error}
          </div>
        )}

        {page === "dashboard" && (
          <DashboardPage
            requests={requests}
            saving={saving}
            stats={dashboardStats}
            onCreateRequest={openCreateFlow}
            onDeleteRequest={handleDeleteEcr}
            onOpenRequest={openRequest}
          />
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
            handleDeleteAction={handleDeleteAction}
            handleDeleteRequest={handleDeleteEcr}
            handleStageChange={handleStageChange}
            handleToggleAction={handleToggleAction}
            handleUpdateAction={handleUpdateAction}
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

function DashboardPage({ requests, saving, stats, onCreateRequest, onDeleteRequest, onOpenRequest }) {
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
            <EmptyState title="Aucune modification creee" text="Commencez par créer une demande ECR depuis le bouton Créer ECR." />
          ) : (
            recentRequests.map((request) => (
              <article className="compact-row" key={request.id}>
                <button className="compact-row-main" type="button" onClick={() => onOpenRequest(request)}>
                  <strong>{request.modificationNumber || request.client}</strong>
                  <span>{request.modificationProject || "Projet non renseigne"}</span>
                </button>
                <div className="compact-row-actions">
                  <small className={`stage-pill ${stageColorClass(request.currentStage)}`}>{stageLabel(request.currentStage, Boolean(request.newVersion))}</small>
                  <button
                    className="ghost-icon"
                    disabled={saving}
                    type="button"
                    onClick={() => onDeleteRequest(request)}
                    title="Supprimer la modification"
                    aria-label="Supprimer la modification"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
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
            <p>Renseignez les informations de base, créez la demande, puis continuez directement le suivi des phases et actions sur cette meme page.</p>
          </div>
          <span className="stage-pill teal">Creation assistée</span>
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
              <EmptyState title="Aucun projet cree" text="Ajoutez un premier projet pour débloquer la création des modifications." />
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

function ModificationsPage(props) {
  const [listOpen, setListOpen] = useState(false);
  const {
    actionForm,
    actions,
    checklist,
    completion,
    doneCount,
    filteredRequests,
    handleCreateAction,
    handleDeleteAction,
    handleDeleteRequest,
    handleStageChange,
    handleToggleAction,
    handleUpdateAction,
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

  function selectRequest(request) {
    setShowCreateForm(false);
    setSelectedId(request.id);
    setSelectedStage(safeStage(request.currentStage, Boolean(request.newVersion)));
    setListOpen(false);
  }

  return (
    <section className="page-content modifications-content">
      <PageHeader eyebrow="Suivi ECR" title="Modifications" subtitle="Créez une demande, sélectionnez-la, puis pilotez ses phases et actions sans quitter cette page." />
      <div className="modifications-toolbar">
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
        <button className="secondary-action" type="button" onClick={() => setListOpen(true)}>
          <ClipboardList size={16} />
          Liste modifications
        </button>
        <button className="primary-action" type="button" onClick={() => setShowCreateForm(true)}>
          <Plus size={16} />
          Nouvelle modification
        </button>
      </div>
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
                <button
                  className="ghost-icon detail-delete-action"
                  disabled={saving}
                  type="button"
                  onClick={() => handleDeleteRequest(selectedRequest)}
                  title="Supprimer la modification"
                  aria-label="Supprimer la modification"
                >
                  <Trash2 size={16} />
                </button>
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
                handleDeleteAction={handleDeleteAction}
                handleToggleAction={handleToggleAction}
                handleUpdateAction={handleUpdateAction}
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
            <EmptyState title="Aucune demande selectionnee" text="Sélectionnez une demande dans la liste ou créez une nouvelle modification." />
          )}
        </section>
      </div>
      {listOpen && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setListOpen(false)}>
          <section
            aria-labelledby="request-dialog-title"
            aria-modal="true"
            className="request-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="actions-dialog-header">
              <div>
                <p className="eyebrow">Selection</p>
                <h2 id="request-dialog-title">Liste des modifications</h2>
                <span>{filteredRequests.length} resultat{filteredRequests.length > 1 ? "s" : ""}</span>
              </div>
              <button className="ghost-icon" type="button" onClick={() => setListOpen(false)} title="Fermer">
                <X size={18} />
              </button>
            </header>
            <div className="request-list">
              {filteredRequests.length === 0 ? (
                <EmptyState title="Aucun resultat" text="Essayez un client, un projet, un produit ou un pilote." compact />
              ) : filteredRequests.map((request) => (
                <button
                  className={request.id === selectedId ? "request-card active" : "request-card"}
                  key={request.id}
                  onClick={() => selectRequest(request)}
                >
                  <span className="request-title">{request.modificationNumber || request.client}</span>
                  <span>{request.modificationProject || request.product || "Projet non renseigne"}</span>
                  <strong className={`stage-pill ${stageColorClass(request.currentStage)}`}>{stageLabel(request.currentStage, Boolean(request.newVersion))}</strong>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function ActionsPanel({ actionForm, actions, doneCount, handleCreateAction, handleDeleteAction, handleToggleAction, handleUpdateAction, handleUploadEvidence, lateActions, saving, selectedStage, stageNewProject, updateActionForm }) {
  const [expanded, setExpanded] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const stageTitle = stageLabel(selectedStage, stageNewProject);

  function submitCreateAction(event) {
    handleCreateAction(event).then(() => setCreateOpen(false)).catch(() => {});
  }

  return (
    <section className="data-section">
      <div className="section-title">
        <div>
          <h2>Actions - {stageTitle}</h2>
          <span>{doneCount}/{actions.length} terminees / {lateActions} retards</span>
        </div>
        <div className="row-actions">
          <button className="primary-action compact-action" type="button" onClick={() => setCreateOpen(true)} title="Ajouter une action">
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
        actions={actions}
        handleDeleteAction={handleDeleteAction}
        handleToggleAction={handleToggleAction}
        handleUpdateAction={handleUpdateAction}
        handleUploadEvidence={handleUploadEvidence}
        saving={saving}
      />
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
            <ActionList
              actions={actions}
              expanded
              handleDeleteAction={handleDeleteAction}
              handleToggleAction={handleToggleAction}
              handleUpdateAction={handleUpdateAction}
              handleUploadEvidence={handleUploadEvidence}
              saving={saving}
            />
          </section>
        </div>
      )}
      {createOpen && (
        <ActionCreateDialog
          actionForm={actionForm}
          saving={saving}
          onClose={() => setCreateOpen(false)}
          onSubmit={submitCreateAction}
          updateActionForm={updateActionForm}
        />
      )}
    </section>
  );
}

function ActionList({ actions, expanded = false, handleDeleteAction, handleToggleAction, handleUpdateAction, handleUploadEvidence, saving }) {
  const [editingAction, setEditingAction] = useState(null);

  return (
    <>
      <div className={expanded ? "action-list expanded" : "action-list"}>
        {actions.length === 0 ? (
          <EmptyState title="Aucune action pour cette phase" text="Ajoutez une action ou utilisez les actions generées lors de la création ECR." />
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
              <div className="action-row-tools">
                <label className="row-upload" title="Ajouter evidence">
                  <Upload size={15} />
                  <input type="file" onChange={(event) => handleUploadEvidence(action, event.target.files?.[0])} />
                </label>
                <button className="ghost-icon" disabled={saving} type="button" onClick={() => setEditingAction(action)} title="Modifier l'action" aria-label="Modifier l'action">
                  <Pencil size={15} />
                </button>
                <button className="ghost-icon danger-icon" disabled={saving} type="button" onClick={() => handleDeleteAction(action)} title="Supprimer l'action" aria-label="Supprimer l'action">
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))
        )}
      </div>
      {editingAction && (
        <ActionEditDialog
          action={editingAction}
          saving={saving}
          onClose={() => setEditingAction(null)}
          onSubmit={(form) => handleUpdateAction(editingAction, form).then(() => setEditingAction(null)).catch(() => {})}
        />
      )}
    </>
  );
}

function actionToForm(action) {
  return {
    topicRisk: action.topicRisk || "",
    title: action.title || "",
    responsible: action.responsible || "",
    criticality: action.criticality || "3-faible",
    expectedEvidence: action.expectedEvidence || "",
    evidence: action.evidence || "",
    evidenceFile: null,
    deadline: action.deadline || "",
    date1: action.date1 || "",
    date2: action.date2 || "",
    date3: action.date3 || "",
    startDate: action.startDate || "",
    endDate: action.endDate || "",
    workDurationDays: action.workDurationDays ?? 1,
    status: action.status || "TODO",
    evidenceRequired: Boolean(action.evidenceRequired),
    comment: action.comment || ""
  };
}

function ActionCreateDialog({ actionForm, saving, onClose, onSubmit, updateActionForm }) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        aria-labelledby="create-action-title"
        aria-modal="true"
        className="dialog-card action-edit-dialog panel form-page"
        onMouseDown={(event) => event.stopPropagation()}
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
        <div className="action-edit-grid">
          <input value={actionForm.topicRisk} onChange={(event) => updateActionForm("topicRisk", event.target.value)} placeholder="Topic_Risk" />
          <input required value={actionForm.title} onChange={(event) => updateActionForm("title", event.target.value)} placeholder="Point_verif" />
          <select value={actionForm.responsible} onChange={(event) => updateActionForm("responsible", event.target.value)}>
            <option value="">Pilote</option>
            {userRoleOptions.map(([value, label]) => (
              <option key={value} value={label}>{label}</option>
            ))}
          </select>
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

function ActionEditDialog({ action, saving, onClose, onSubmit }) {
  const [form, setForm] = useState(() => actionToForm(action));

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    onSubmit(form);
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        aria-labelledby="edit-action-title"
        aria-modal="true"
        className="dialog-card action-edit-dialog panel form-page"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submit}
        role="dialog"
      >
        <div className="form-intro">
          <div>
            <p className="eyebrow">Action</p>
            <h2 id="edit-action-title">Modifier l'action</h2>
            <p>{action.title}</p>
          </div>
          <button className="ghost-icon" type="button" onClick={onClose} title="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="action-edit-grid">
          <input value={form.topicRisk} onChange={(event) => updateForm("topicRisk", event.target.value)} placeholder="Topic_Risk" />
          <input required value={form.title} onChange={(event) => updateForm("title", event.target.value)} placeholder="Point_verif" />
          <select value={form.responsible} onChange={(event) => updateForm("responsible", event.target.value)}>
            <option value="">Pilote</option>
            {userRoleOptions.map(([value, label]) => (
              <option key={value} value={label}>{label}</option>
            ))}
          </select>
          <select value={form.criticality} onChange={(event) => updateForm("criticality", event.target.value)}>
            <option value="1-critique">1-critique</option>
            <option value="2-moyenne">2-moyenne</option>
            <option value="3-faible">3-faible</option>
          </select>
          <input value={form.expectedEvidence} onChange={(event) => updateForm("expectedEvidence", event.target.value)} placeholder="element_preuve" />
          <input type="date" value={form.startDate} onChange={(event) => updateForm("startDate", event.target.value)} title="Date debut" />
          <input type="date" value={form.endDate} onChange={(event) => updateForm("endDate", event.target.value)} title="Date fin" />
          <input min="0" type="number" value={form.workDurationDays} onChange={(event) => updateForm("workDurationDays", event.target.value)} title="Jours de travail" />
          <label className="file-picker">
            <Paperclip size={15} />
            <span>{form.evidenceFile ? form.evidenceFile.name : action.evidenceFileName || "Evidence"}</span>
            <input type="file" onChange={(event) => updateForm("evidenceFile", event.target.files?.[0] || null)} />
          </label>
          <label className="action-asset-toggle">
            <input checked={form.evidenceRequired} type="checkbox" onChange={(event) => updateForm("evidenceRequired", event.target.checked)} />
            Asset requis
          </label>
          <select value={form.status} onChange={(event) => updateForm("status", event.target.value)}>
            <option value="TODO">TODO</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="DONE">DONE</option>
            <option value="LATE">LATE</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
          <textarea value={form.comment} onChange={(event) => updateForm("comment", event.target.value)} placeholder="Commentaire" />
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

function ChecklistPanel({ checklist }) {
  return (
    <section className="checklist">
      {checklist.length === 0 ? (
        <EmptyState title="Aucun point de verification" text="Les points de controle apparaitront ici pour la phase selectionnée." />
      ) : (
        checklist.map((item) => (
          <article className="check-row" key={item.id}>
            <CheckCircle2 className={item.status === "OK" ? "ok" : ""} size={20} />
            <div><h3>{item.verificationPoint}</h3><p>{item.topicRisk || "Risque non classé"} / {item.expectedEvidence || "Preuve non renseignée"}</p></div>
            <span>{item.pilot || "A définir"}</span>
            <strong className={`status ${statusClass(item.status)}`}>{readableStatus(item.status)}</strong>
          </article>
        ))
      )}
    </section>
  );
}

export default App;
