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
  createClientReference,
  createEcrRequest,
  createProductReference,
  createProject,
  createUser,
  clearSession,
  deleteActionPlanningRule,
  deleteAction,
  deleteClientReference,
  deleteEcrRequest,
  deleteProductReference,
  deleteProject,
  deleteUser,
  getActionPlanningRules,
  getActions,
  getChecklist,
  getClientReferences,
  getCurrentUser,
  getEcrRequests,
  getPilots,
  getProductReferences,
  getProjects,
  getStoredSession,
  getUsers,
  login,
  logout,
  storeSession,
  updateAction,
  updateActionPlanningRule,
  updateClientReference,
  updateEcrRequest,
  updateEcrStage,
  updateProductReference,
  updateProject,
  updateUser,
  updateUserProfile,
  uploadActionEvidence,
  uploadEcrRequestImage,
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
import { userRoleLabel, userToForm } from "./utils/users";
import "./styles.css";

function App() {
  const [authSession, setAuthSession] = useState(getStoredSession());
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [page, setPage] = useState("dashboard");
  const [menuCollapsed, setMenuCollapsed] = useState(false);
  const [requests, setRequests] = useState([]);
  const [pilots, setPilots] = useState([]);
  const [projects, setProjects] = useState([]);
  const [clientReferences, setClientReferences] = useState([]);
  const [productReferences, setProductReferences] = useState([]);
  const [planningRules, setPlanningRules] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedStage, setSelectedStage] = useState("FEASIBILITY_VALIDATION");
  const [checklist, setChecklist] = useState([]);
  const [actions, setActions] = useState([]);
  const [ecrForm, setEcrForm] = useState(emptyEcrForm);
  const [ecrEditForm, setEcrEditForm] = useState(emptyEcrForm);
  const [actionForm, setActionForm] = useState(emptyActionForm);
  const [projectForm, setProjectForm] = useState({ name: "", projectTeam: "" });
  const [clientReferenceForm, setClientReferenceForm] = useState({ name: "" });
  const [productReferenceForm, setProductReferenceForm] = useState({ name: "" });
  const [planningRuleForm, setPlanningRuleForm] = useState(emptyPlanningRuleForm);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [profileForm, setProfileForm] = useState(emptyUserForm);
  const [passwordForm, setPasswordForm] = useState({ password: "", confirmation: "" });
  const [editingPlanningRule, setEditingPlanningRule] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [editingEcrRequest, setEditingEcrRequest] = useState(null);
  const [editingClientReference, setEditingClientReference] = useState(null);
  const [editingProductReference, setEditingProductReference] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
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
      const matchesSearch = !normalized || [request.client, request.product, request.modificationProject, request.modificationNumber, request.modificationReason, request.modificationDetail, request.dossierReview, request.pilot]
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
  const clientOptions = useMemo(
    () => uniqueSorted(clientReferences.map((client) => client.name)),
    [clientReferences]
  );
  const productOptions = useMemo(
    () => uniqueSorted(productReferences.map((product) => product.name)),
    [productReferences]
  );

  const dashboardStats = useMemo(() => {
    const active = requests.filter((request) => request.currentStage !== "CLOSED" && request.currentStage !== "CANCELLED").length;
    const closed = requests.filter((request) => request.currentStage === "CLOSED").length;
    return { active, closed, projects: projects.length, requests: requests.length };
  }, [requests, projects]);

  function loadInitialData() {
    return Promise.all([getEcrRequests(), getPilots(), getProjects(), getClientReferences(), getProductReferences(), getActionPlanningRules(), getUsers(), getCurrentUser()])
      .then(([requestData, pilotData, projectData, clientReferenceData, productReferenceData, planningRuleData, userData, currentUserData]) => {
        setRequests(requestData);
        setPilots(pilotData);
        setProjects(projectData);
        setClientReferences(clientReferenceData);
        setProductReferences(productReferenceData);
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
    if (!showCreateForm && !showEditForm) return undefined;

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setShowCreateForm(false);
        setShowEditForm(false);
        setEditingEcrRequest(null);
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [showCreateForm, showEditForm]);

  function updateEcrForm(field, value) {
    setEcrForm((form) => updateEcrFormState(form, field, value, projects));
  }

  function updateEcrEditForm(field, value) {
    setEcrEditForm((form) => updateEcrFormState(form, field, value, projects));
  }

  function updateActionForm(field, value) {
    setActionForm((form) => ({ ...form, [field]: value }));
  }

  function buildEcrPayload(form) {
    const { beforePhotoFile, afterPhotoFile, sopDate, ...payload } = form;
    return {
      ...payload,
      accessInternalNumber: form.accessInternalNumber ? Number(form.accessInternalNumber) : null,
      currentStage: safeStage(form.currentStage, form.newVersion),
      receptionDate: form.receptionDate || null,
      initialActions: (form.initialActions || [])
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
    createEcrRequest(buildEcrPayload(ecrForm))
      .then((savedRequest) => {
        const uploads = [];
        if (ecrForm.beforePhotoFile) {
          uploads.push(uploadEcrRequestImage(savedRequest.id, "before", ecrForm.beforePhotoFile));
        }
        if (ecrForm.afterPhotoFile) {
          uploads.push(uploadEcrRequestImage(savedRequest.id, "after", ecrForm.afterPhotoFile));
        }
        return Promise.all(uploads)
          .then(() => savedRequest)
          .catch(() => {
            setError("Modification créée, mais l'upload d'une image a échoué.");
            return savedRequest;
          });
      })
      .then((savedRequest) => {
        setEcrForm(emptyEcrForm);
        setSelectedId(savedRequest.id);
        setSelectedStage(savedRequest.currentStage);
        setShowCreateForm(false);
        setPage("modifications");
        return loadInitialData();
      })
      .catch(() => setError("Création ECR impossible. Créez d'abord le projet, puis vérifiez les champs obligatoires."))
      .finally(() => setSaving(false));
  }

  function openEditEcr(request) {
    setEcrEditForm(requestToEcrForm(request));
    setEditingEcrRequest(request);
    setShowCreateForm(false);
    setShowEditForm(true);
  }

  function closeEditEcr() {
    setShowEditForm(false);
    setEditingEcrRequest(null);
    setEcrEditForm(emptyEcrForm);
  }

  function handleUpdateEcr(event) {
    event.preventDefault();
    if (!editingEcrRequest) return;
    setSaving(true);
    setError("");
    updateEcrRequest(editingEcrRequest.id, buildEcrPayload(ecrEditForm))
      .then((savedRequest) => {
        const uploads = [];
        if (ecrEditForm.beforePhotoFile) {
          uploads.push(uploadEcrRequestImage(savedRequest.id, "before", ecrEditForm.beforePhotoFile));
        }
        if (ecrEditForm.afterPhotoFile) {
          uploads.push(uploadEcrRequestImage(savedRequest.id, "after", ecrEditForm.afterPhotoFile));
        }
        return Promise.all(uploads)
          .then(() => savedRequest)
          .catch(() => {
            setError("Modification enregistrée, mais l'upload d'une image a échoué.");
            return savedRequest;
          });
      })
      .then((savedRequest) => {
        closeEditEcr();
        setSelectedId(savedRequest.id);
        setSelectedStage(safeStage(savedRequest.currentStage, Boolean(savedRequest.newVersion)));
        return loadInitialData();
      })
      .catch(() => setError("Mise à jour de la modification impossible. Vérifiez les champs obligatoires."))
      .finally(() => setSaving(false));
  }

  function handleStageChange(stage) {
    if (!selectedRequest) return;
    setSelectedStage(stage);
    updateEcrStage(selectedRequest.id, stage)
      .then((updatedRequest) => setRequests((items) => items.map((item) => (item.id === updatedRequest.id ? updatedRequest : item))))
      .catch(() => setError("Impossible de sauvegarder l'étape ECR."));
  }

  function openRequest(request) {
    setSelectedId(request.id);
    setSelectedStage(safeStage(request.currentStage, Boolean(request.newVersion)));
    setShowCreateForm(false);
    setShowEditForm(false);
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
          setError("Suppression de la modification impossible. Vérifiez les droits ou les données liées.");
          Swal.fire("Erreur", "Suppression de la modification impossible.", "error");
        })
        .finally(() => setSaving(false));
    });
  }

  function actionFormPayload(form, stage) {
    const evidenceRequired = form.evidenceRequired || isCriticalAction(form);
    return {
      ...form,
      evidenceFile: undefined,
      evidenceRequired,
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

  function isCriticalAction(action) {
    return String(action?.criticality || "").startsWith("1");
  }

  function requiresEvidence(action) {
    return Boolean(action?.evidenceRequired) || isCriticalAction(action);
  }

  function handleCreateAction(event) {
    event.preventDefault();
    if (!selectedRequest) return Promise.resolve();
    const evidenceFiles = filesFromValue(actionForm.evidenceFile);
    if (requiresEvidence(actionForm) && actionForm.status === "DONE" && evidenceFiles.length === 0) {
      setError("Ajoutez un asset avant de créer cette action comme terminée.");
      Swal.fire("Asset requis", "Ajoutez un asset avant de créer cette action comme terminée.", "warning");
      return Promise.reject(new Error("Evidence required"));
    }
    setSaving(true);
    const payload = actionFormPayload(actionForm, selectedStage);
    const createPayload = evidenceFiles.length > 0 && payload.status === "DONE"
      ? { ...payload, checked: false, status: "TODO", closedDate: null }
      : payload;
    return createAction(selectedRequest.id, createPayload)
      .then((savedAction) => {
        if (evidenceFiles.length > 0) {
          return uploadActionEvidenceFiles(savedAction.id, evidenceFiles)
            .then((actionWithEvidence) => (payload.status === "DONE" ? updateAction(actionWithEvidence.id, payload) : actionWithEvidence));
        }
        return savedAction;
      })
      .then(() => getActions(selectedRequest.id, selectedStage))
      .then((actionData) => {
        setActions(actionData);
        setActionForm(emptyActionForm);
      })
      .catch(() => setError("Création action impossible."))
      .finally(() => setSaving(false));
  }

  function handleUpdateAction(action, form) {
    if (!selectedRequest) return Promise.resolve();
    if (form.status === "DONE" && dependencyBlocksCompletion(action)) {
      const dependency = dependencyFor(action);
      setError("Terminez d'abord l'action précédente avant de valider cette action.");
      Swal.fire("Action bloquée", `Terminez d'abord: ${dependency.title || "action précédente"}.`, "warning");
      return Promise.reject(new Error("Dependency incomplete"));
    }
    const evidenceFiles = filesFromValue(form.evidenceFile);
    if (requiresEvidence(form) && form.status === "DONE" && !hasActionAsset(action) && evidenceFiles.length === 0) {
      setError("Ajoutez un asset avant de terminer cette action.");
      Swal.fire("Asset requis", "Ajoutez un asset avant de terminer cette action.", "warning");
      return Promise.reject(new Error("Evidence required"));
    }
    setSaving(true);
    setError("");
    const payload = {
      ...actionFormPayload(form, selectedStage),
      dependsOnActionId: action.dependsOnActionId ?? null,
      dependencyAnchor: action.dependencyAnchor || "OUTPUT"
    };
    const saveRequest = evidenceFiles.length > 0
      ? uploadActionEvidenceFiles(action.id, evidenceFiles).then(() => updateAction(action.id, payload))
      : updateAction(action.id, payload);
    return saveRequest
      .then(() => getActions(selectedRequest.id, selectedStage))
      .then((actionData) => {
        setActions(actionData);
        Swal.fire({ title: "Action modifiée", icon: "success", timer: 1300, showConfirmButton: false });
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
      setError("Terminez d'abord l'action précédente avant de valider cette action.");
      Swal.fire("Action bloquée", `Terminez d'abord: ${dependency.title || "action précédente"}.`, "warning");
      return;
    }
    if (completed && requiresEvidence(action) && !hasActionAsset(action)) {
      setError("Cette action nécessite un asset avant d'être terminée.");
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
        setError("Impossible de mettre à jour l'action.");
      });
  }

  function handleUploadEvidence(action, fileValue) {
    const files = filesFromValue(fileValue);
    if (files.length === 0) return;
    setError("");
    uploadActionEvidenceFiles(action.id, files)
      .then(() => getActions(selectedId, selectedStage))
      .then((actionData) => setActions(actionData))
      .catch(() => setError("Ajout du fichier evidence impossible."));
  }

  function handleSaveProject(event) {
    event.preventDefault();
    const name = projectForm.name.trim();
    if (!name) return;
    const projectLeadCount = countSelectedProjectLeads(projectForm.projectTeam, users);
    if (projectLeadCount !== 1) {
      setError("Choisissez un et un seul Chef de projet dans l'équipe projet.");
      Swal.fire("Chef de projet requis", "Sélectionnez exactement un utilisateur avec le rôle Chef de projet.", "warning");
      return;
    }
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
      .catch(() => setError("Sauvegarde projet impossible. Vérifiez le nom du projet."))
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

  function handleSaveClientReference(event) {
    event.preventDefault();
    const name = clientReferenceForm.name.trim();
    if (!name) return;
    setSaving(true);
    setError("");
    const request = editingClientReference
      ? updateClientReference(editingClientReference, { name })
      : createClientReference({ name });
    request
      .then((savedClient) => {
        setClientReferences((items) => [...items.filter((item) => item.id !== savedClient.id), savedClient].sort((a, b) => a.name.localeCompare(b.name)));
        setClientReferenceForm({ name: "" });
        setEditingClientReference(null);
      })
      .catch(() => setError("Sauvegarde client impossible. Vérifiez le nom."))
      .finally(() => setSaving(false));
  }

  function startClientReferenceEdit(client) {
    setEditingClientReference(client.id);
    setClientReferenceForm({ name: client.name || "" });
  }

  function handleDeleteClientReference(id) {
    setError("");
    deleteClientReference(id)
      .then(() => {
        setClientReferences((items) => items.filter((item) => item.id !== id));
        if (editingClientReference === id) {
          setEditingClientReference(null);
          setClientReferenceForm({ name: "" });
        }
      })
      .catch(() => setError("Suppression client impossible."));
  }

  function handleSaveProductReference(event) {
    event.preventDefault();
    const name = productReferenceForm.name.trim();
    if (!name) return;
    setSaving(true);
    setError("");
    const request = editingProductReference
      ? updateProductReference(editingProductReference, { name })
      : createProductReference({ name });
    request
      .then((savedProduct) => {
        setProductReferences((items) => [...items.filter((item) => item.id !== savedProduct.id), savedProduct].sort((a, b) => a.name.localeCompare(b.name)));
        setProductReferenceForm({ name: "" });
        setEditingProductReference(null);
      })
      .catch(() => setError("Sauvegarde produit impossible. Vérifiez le nom."))
      .finally(() => setSaving(false));
  }

  function startProductReferenceEdit(product) {
    setEditingProductReference(product.id);
    setProductReferenceForm({ name: product.name || "" });
  }

  function handleDeleteProductReference(id) {
    setError("");
    deleteProductReference(id)
      .then(() => {
        setProductReferences((items) => items.filter((item) => item.id !== id));
        if (editingProductReference === id) {
          setEditingProductReference(null);
          setProductReferenceForm({ name: "" });
        }
      })
      .catch(() => setError("Suppression produit impossible."));
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
      .catch(() => setError("Sauvegarde règle planning impossible. Vérifiez l'action et la durée."))
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
      .catch(() => setError("Suppression règle planning impossible."));
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
      .catch(() => setError("Sauvegarde utilisateur impossible. Vérifiez username/email uniques et les champs obligatoires."))
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
      .catch(() => setError("Mise à jour du profil impossible."))
      .finally(() => setSaving(false));
  }

  function handleChangePassword(event) {
    event.preventDefault();
    if (!currentUser) return;
    if (!passwordForm.password || passwordForm.password !== passwordForm.confirmation) {
      setError("Confirmez le nouveau mot de passe avec la même valeur.");
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
    setShowEditForm(false);
    setEditingEcrRequest(null);
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
          setShowEditForm(false);
          setEditingEcrRequest(null);
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
            users={users}
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

        {page === "preferentials" && (
          <PreferentialsPage
            clientForm={clientReferenceForm}
            clients={clientReferences}
            editingClient={editingClientReference}
            editingProduct={editingProductReference}
            productForm={productReferenceForm}
            products={productReferences}
            saving={saving}
            onCancelClientEdit={() => {
              setEditingClientReference(null);
              setClientReferenceForm({ name: "" });
            }}
            onCancelProductEdit={() => {
              setEditingProductReference(null);
              setProductReferenceForm({ name: "" });
            }}
            onDeleteClient={handleDeleteClientReference}
            onDeleteProduct={handleDeleteProductReference}
            onEditClient={startClientReferenceEdit}
            onEditProduct={startProductReferenceEdit}
            onSubmitClient={handleSaveClientReference}
            onSubmitProduct={handleSaveProductReference}
            setClientForm={setClientReferenceForm}
            setProductForm={setProductReferenceForm}
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
            onEditRequest={openEditEcr}
            handleCreateAction={handleCreateAction}
            handleDeleteAction={handleDeleteAction}
            handleDeleteRequest={handleDeleteEcr}
            handleStageChange={handleStageChange}
            handleToggleAction={handleToggleAction}
            handleUpdateAction={handleUpdateAction}
            handleUploadEvidence={handleUploadEvidence}
            isCriticalAction={isCriticalAction}
            requiresEvidence={requiresEvidence}
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
          clientOptions={clientOptions}
          ecrForm={ecrForm}
          pilots={pilots}
          productOptions={productOptions}
          projects={projects}
          saving={saving}
          users={users}
          onClose={() => setShowCreateForm(false)}
          onSubmit={handleCreateEcr}
          updateEcrForm={updateEcrForm}
        />
      )}
      {showEditForm && page === "modifications" && editingEcrRequest && (
        <EditModificationDialog
          clientOptions={clientOptions}
          ecrForm={ecrEditForm}
          existingRequest={editingEcrRequest}
          pilots={pilots}
          productOptions={productOptions}
          projects={projects}
          saving={saving}
          users={users}
          onClose={closeEditEcr}
          onSubmit={handleUpdateEcr}
          updateEcrForm={updateEcrEditForm}
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
      <PageHeader eyebrow="Vue générale" title="Tableau de bord" subtitle="Suivi rapide des modifications et du référentiel projet." />
      <div className="stat-grid">
        <StatCard label="Demandes" value={stats.requests} icon={ClipboardList} />
        <StatCard label="Actives" value={stats.active} icon={Gauge} />
        <StatCard label="Clôturées" value={stats.closed} icon={CheckCircle2} />
        <StatCard label="Projets" value={stats.projects} icon={FolderKanban} />
      </div>
      <section className="panel">
        <div className="section-title">
          <h2>Dernieres modifications</h2>
          <button className="secondary-action" onClick={onCreateRequest}>
            <Plus size={16} />
            Créer ECR
          </button>
        </div>
        <div className="compact-list">
          {requests.length === 0 ? (
            <EmptyState title="Aucune modification créée" text="Commencez par créer une demande ECR depuis le bouton Créer ECR." />
          ) : (
            recentRequests.map((request) => (
              <article className="compact-row" key={request.id}>
                <button className="compact-row-main" type="button" onClick={() => onOpenRequest(request)}>
                  <strong>{request.modificationNumber || request.client}</strong>
                  <span>{request.modificationProject || "Projet non renseigné"}</span>
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

function CreateModificationDialog({ clientOptions, ecrForm, pilots, productOptions, projects, saving, users, onClose, onSubmit, updateEcrForm }) {
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
          clientOptions={clientOptions}
          ecrForm={ecrForm}
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

function EditModificationDialog({ clientOptions, ecrForm, existingRequest, pilots, productOptions, projects, saving, users, onClose, onSubmit, updateEcrForm }) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        aria-labelledby="edit-modification-title"
        aria-modal="true"
        className="dialog-card"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <NewModificationPage
          clientOptions={clientOptions}
          ecrForm={ecrForm}
          existingRequest={existingRequest}
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

function NewModificationPage({ clientOptions, ecrForm, existingRequest = null, mode = "create", pilots, productOptions, projects, saving, submitIcon: SubmitIcon = Plus, submitLabel = "Créer et ouvrir le suivi", users, onCancel, onSubmit, updateEcrForm }) {
  const availableStages = getStages(ecrForm.newVersion);
  const selectedProject = projects.find((project) => project.name === ecrForm.modificationProject);
  const projectTeamMembers = parseProjectTeam(selectedProject?.projectTeam);
  const canCreateModification = projects.length > 0 && projectTeamMembers.length > 0 && Boolean(ecrForm.pilot);
  const displayedClientOptions = includeCurrentOption(clientOptions, ecrForm.client);
  const displayedProductOptions = includeCurrentOption(productOptions, ecrForm.product);
  const titleId = mode === "edit" ? "edit-modification-title" : "create-modification-title";
  const currentBeforePhoto = existingRequest?.beforePhotoUrl;
  const currentAfterPhoto = existingRequest?.afterPhotoUrl;

  return (
    <section className="creation-panel">
      <form className="panel form-page" onSubmit={onSubmit}>
        <div className="form-intro">
          <div>
            <p className="eyebrow">{mode === "edit" ? "Modification ECR" : "Création ECR"}</p>
            <h2 id={titleId}>{mode === "edit" ? "Modifier la modification" : "Nouvelle modification"}</h2>
            <p>{mode === "edit" ? "Mettez à jour les informations de la demande, puis enregistrez pour continuer le suivi." : "Renseignez les informations de base, créez la demande, puis continuez directement le suivi des phases et actions sur cette même page."}</p>
          </div>
          <span className="stage-pill teal">{mode === "edit" ? "Édition" : "Création assistée"}</span>
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
            Numéro automatique système
            <input disabled placeholder="Généré après création" value={ecrForm.accessInternalNumber || ""} onChange={(event) => updateEcrForm("accessInternalNumber", event.target.value)} />
          </label>
          <label>
            Numéro client externe
            <input value={ecrForm.modificationNumber} onChange={(event) => updateEcrForm("modificationNumber", event.target.value)} />
          </label>
          <label>
            Client
            <select required value={ecrForm.client} onChange={(event) => updateEcrForm("client", event.target.value)}>
              <option value="">Sélectionner un client</option>
              {displayedClientOptions.map((client) => <option key={client} value={client}>{client}</option>)}
            </select>
          </label>
          <label>
            Projet
            <select required value={ecrForm.modificationProject} onChange={(event) => updateEcrForm("modificationProject", event.target.value)}>
              <option value="">Sélectionner un projet</option>
              {projects.map((project) => (
                <option key={project.name} value={project.name}>{project.name}</option>
              ))}
            </select>
          </label>
          <label>
            Produit
            <select required value={ecrForm.product} onChange={(event) => updateEcrForm("product", event.target.value)}>
              <option value="">Sélectionner un produit</option>
              {displayedProductOptions.map((product) => <option key={product} value={product}>{product}</option>)}
            </select>
          </label>
          <label>
            Pilote
            <select required disabled={!ecrForm.modificationProject || projectTeamMembers.length === 0} value={ecrForm.pilot} onChange={(event) => updateEcrForm("pilot", event.target.value)}>
              <option value="">{ecrForm.modificationProject ? "Sélectionner dans l'équipe projet" : "Sélectionner d'abord un projet"}</option>
              {projectTeamMembers.map((member) => (
                <option key={member} value={member}>{formatUserWithRole(member, users)}</option>
              ))}
            </select>
          </label>
          <label>
            Réception
            <input type="date" value={ecrForm.receptionDate} onChange={(event) => updateEcrForm("receptionDate", event.target.value)} />
          </label>
          <div className="calculated-field">
            <span>SOP</span>
            <strong>{ecrForm.sopDate || "Calculé après génération des actions"}</strong>
          </div>
          <label>
            Mixabilité
            <select value={ecrForm.mixability} onChange={(event) => updateEcrForm("mixability", event.target.value)}>
              <option value="">Non renseignée</option>
              <option value="MIXABLE">Oui mixable</option>
              <option value="NON_MIXABLE">Non mixable</option>
            </select>
          </label>
          <label>
            Photo état
            <input accept="image/*" type="file" onChange={(event) => updateEcrForm("beforePhotoFile", event.target.files?.[0] || null)} />
            <span className="form-hint">{ecrForm.beforePhotoFile?.name || (currentBeforePhoto ? "Image actuelle conservée si aucun fichier n'est choisi" : "Image avant modification")}</span>
            {currentBeforePhoto && (
              <a className="form-image-preview" href={currentBeforePhoto} target="_blank" rel="noreferrer">
                <img alt="Photo état actuelle" src={currentBeforePhoto} />
                Voir l'image actuelle
              </a>
            )}
          </label>
          <label>
            Photo devient
            <input accept="image/*" type="file" onChange={(event) => updateEcrForm("afterPhotoFile", event.target.files?.[0] || null)} />
            <span className="form-hint">{ecrForm.afterPhotoFile?.name || (currentAfterPhoto ? "Image actuelle conservée si aucun fichier n'est choisi" : "Image après modification")}</span>
            {currentAfterPhoto && (
              <a className="form-image-preview" href={currentAfterPhoto} target="_blank" rel="noreferrer">
                <img alt="Photo devient actuelle" src={currentAfterPhoto} />
                Voir l'image actuelle
              </a>
            )}
          </label>
        </div>
        {!ecrForm.newVersion && (
        <fieldset className="modification-type-field">
          <legend>Type de modification</legend>
          <label className="action-asset-toggle">
            <input checked={ecrForm.digitChange} type="checkbox" onChange={(event) => updateEcrForm("digitChange", event.target.checked)} />
            Digit change
          </label>
          <label className="action-asset-toggle">
            <input checked={ecrForm.componentChange} type="checkbox" onChange={(event) => updateEcrForm("componentChange", event.target.checked)} />
            Component change
          </label>
          <label className="action-asset-toggle">
            <input checked={ecrForm.processChange} type="checkbox" onChange={(event) => updateEcrForm("processChange", event.target.checked)} />
            Process change
          </label>
          <label className="action-asset-toggle">
            <input checked={ecrForm.supplierChange} type="checkbox" onChange={(event) => updateEcrForm("supplierChange", event.target.checked)} />
            Supplier change
          </label>
        </fieldset>
        )}
        <label>
          Raison de modification
          <textarea value={ecrForm.modificationReason} onChange={(event) => updateEcrForm("modificationReason", event.target.value)} />
        </label>
        <label>
          Détail de modification
          <textarea value={ecrForm.modificationDetail} onChange={(event) => updateEcrForm("modificationDetail", event.target.value)} />
        </label>
        <label>
          Revue dossier
          <textarea value={ecrForm.dossierReview} onChange={(event) => updateEcrForm("dossierReview", event.target.value)} placeholder="Historique de suivi, OIL list, revues planifiées" />
        </label>
        <div className="button-row">
          <button className="primary-action" disabled={saving || !canCreateModification} type="submit">
            <SubmitIcon size={16} />
            {submitLabel}
          </button>
          <button className="secondary-action" type="button" onClick={onCancel}>Annuler</button>
        </div>
        {projects.length === 0 && <p className="form-hint">Ajoutez d'abord au moins un projet dans le référentiel projets.</p>}
        {ecrForm.modificationProject && projectTeamMembers.length === 0 && <p className="form-hint project-team-warning">Ce projet n'a pas encore d'Équipe projet.</p>}
        {projectTeamMembers.length > 0 && !ecrForm.pilot && <p className="form-hint project-team-warning">Sélectionnez un pilote dans l'équipe du projet.</p>}
        <p className="form-hint">Les actions standard de chaque phase sont générées automatiquement depuis la page Projets / Actions standard par phase.</p>
      </form>
    </section>
  );
}

function PhasePreview({ stages }) {
  return (
    <section className="phase-preview" aria-label="Aperçu des phases">
      <div className="phase-preview-title">
        <h3>Aperçu des phases</h3>
        <span>{stages.length} phases générées automatiquement</span>
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

function PreferentialsPage({
  clientForm,
  clients,
  editingClient,
  editingProduct,
  productForm,
  products,
  saving,
  onCancelClientEdit,
  onCancelProductEdit,
  onDeleteClient,
  onDeleteProduct,
  onEditClient,
  onEditProduct,
  onSubmitClient,
  onSubmitProduct,
  setClientForm,
  setProductForm
}) {
  return (
    <section className="page-content">
      <PageHeader eyebrow="Référentiel" title="Préférentiels" subtitle="Gérez les listes de clients et de produits utilisées dans les modifications." />
      <div className="preferentials-grid">
        <PreferentialPanel
          count={clients.length}
          editing={editingClient}
          emptyText="Ajoutez les clients disponibles pour la création des modifications."
          emptyTitle="Aucun client"
          form={clientForm}
          saving={saving}
          title="Clients"
          onCancelEdit={onCancelClientEdit}
          onDelete={onDeleteClient}
          onEdit={onEditClient}
          onSubmit={onSubmitClient}
          references={clients}
          setForm={setClientForm}
        />
        <PreferentialPanel
          count={products.length}
          editing={editingProduct}
          emptyText="Ajoutez les produits disponibles pour la création des modifications."
          emptyTitle="Aucun produit"
          form={productForm}
          saving={saving}
          title="Produits"
          onCancelEdit={onCancelProductEdit}
          onDelete={onDeleteProduct}
          onEdit={onEditProduct}
          onSubmit={onSubmitProduct}
          references={products}
          setForm={setProductForm}
        />
      </div>
    </section>
  );
}

function PreferentialPanel({ count, editing, emptyText, emptyTitle, form, references, saving, title, onCancelEdit, onDelete, onEdit, onSubmit, setForm }) {
  return (
    <section className="panel preferential-panel">
      <form className="form-page compact-preferential-form" onSubmit={onSubmit}>
        <div className="section-title">
          <div>
            <h2>{title}</h2>
            <span>{count} élément{count > 1 ? "s" : ""}</span>
          </div>
        </div>
        <label>
          Nom
          <input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
        </label>
        <div className="button-row">
          <button className="primary-action" disabled={saving} type="submit">
            <Save size={16} />
            Enregistrer
          </button>
          {editing && <button className="secondary-action" type="button" onClick={onCancelEdit}>Annuler</button>}
        </div>
      </form>
      <div className="table-list">
        {references.length === 0 ? (
          <EmptyState title={emptyTitle} text={emptyText} compact />
        ) : references.map((reference) => (
          <article className="project-table-row" key={reference.id}>
            <div>
              <strong>{reference.name}</strong>
              <span>ID #{reference.id}</span>
            </div>
            <div className="row-actions">
              <button className="secondary-action compact-action icon-only-action" type="button" onClick={() => onEdit(reference)} aria-label={`Modifier ${reference.name}`} title="Modifier">
                <Pencil size={15} />
              </button>
              <button className="ghost-icon" type="button" onClick={() => onDelete(reference.id)} title="Supprimer">
                <Trash2 size={15} />
              </button>
            </div>
          </article>
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
  users,
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
      <PageHeader eyebrow="Administration" title="Référentiel projets" subtitle="L'admin maintient ici la liste complète des projets utilisables pendant la création d'une modification." />
      <div className="split-layout">
        <form className="panel form-page" onSubmit={onSubmit}>
          <div className="form-intro">
            <div>
              <h2>{editingProject ? "Modifier le projet" : "Ajouter un projet"}</h2>
              <p>Gardez des noms courts et cohérents pour faciliter la recherche pendant la création ECR.</p>
            </div>
          </div>
          <label>
            Nom du projet
            <input disabled={Boolean(editingProject)} required value={projectForm.name} onChange={(event) => setProjectForm((form) => ({ ...form, name: event.target.value }))} />
          </label>
          <ProjectTeamSelector
            projectTeam={projectForm.projectTeam}
            users={users}
            onChange={(projectTeam) => setProjectForm((form) => ({ ...form, projectTeam }))}
          />
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
              <EmptyState title="Aucun projet créé" text="Ajoutez un premier projet pour débloquer la création des modifications." />
            ) : (
              projects.map((project) => (
                <article className="project-table-row" key={project.name}>
                  <div>
                    <strong>{project.name}</strong>
                    <span>{formatProjectTeamWithRoles(project.projectTeam, users)}</span>
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
    return [user.fullName, user.username, user.email, userRoleLabel(user.role)]
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
                  checked={checked}
                  type="checkbox"
                  onChange={(event) => toggleUser(user, event.target.checked)}
                />
                <span>
                  <strong>{userName}</strong>
                  <small>{userRoleLabel(user.role)}</small>
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

function parseProjectTeam(projectTeam) {
  return String(projectTeam || "")
    .split(/[,;]+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function updateEcrFormState(form, field, value, projects) {
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
  return nextForm;
}

function requestToEcrForm(request) {
  return {
    ...emptyEcrForm,
    accessInternalNumber: request.accessInternalNumber || "",
    modificationNumber: request.modificationNumber || "",
    client: request.client || "",
    product: request.product || "",
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

function fileNamesLabel(value, fallback) {
  const files = filesFromValue(value);
  if (files.length === 0) return fallback;
  if (files.length === 1) return files[0].name;
  return `${files.length} assets sélectionnés`;
}

function uploadActionEvidenceFiles(actionId, files) {
  return files.reduce(
    (promise, file) => promise.then(() => uploadActionEvidence(actionId, file)),
    Promise.resolve(null)
  );
}

function actionAssets(action) {
  const assets = Array.isArray(action?.assets) ? action.assets : [];
  if (assets.length > 0) return assets;
  if (!action?.evidenceFileName) return [];
  return [{
    id: `legacy-${action.id}`,
    fileName: action.evidenceFileName,
    fileUrl: actionEvidenceUrl(action.id)
  }];
}

function hasActionAsset(action) {
  return actionAssets(action).length > 0;
}

function modificationTypesLabel(request) {
  if (request?.newVersion) return "Nouveau projet";
  const types = [
    request?.digitChange ? "Digit change" : "",
    request?.componentChange ? "Component change" : "",
    request?.processChange ? "Process change" : "",
    request?.supplierChange ? "Supplier change" : ""
  ].filter(Boolean);
  return types.length ? types.join(", ") : "-";
}

function formatProjectTeamWithRoles(projectTeam, users) {
  const members = parseProjectTeam(projectTeam);
  if (members.length === 0) return "Équipe non renseignée";
  return members.map((member) => formatUserWithRole(member, users)).join(", ");
}

function formatUserWithRole(userName, users) {
  const user = findUserByTeamName(userName, users);
  return user ? `${userName} (${userRoleLabel(user.role)})` : userName;
}

function findUserByTeamName(userName, users) {
  return users.find((user) => [user.fullName, user.username, user.email].filter(Boolean).includes(userName));
}

function selectedProjectLeadNames(users) {
  return users
    .filter(isProjectLead)
    .map((user) => user.fullName || user.username || user.email)
    .filter(Boolean);
}

function countSelectedProjectLeads(projectTeam, users) {
  const selectedNames = parseProjectTeam(projectTeam);
  return selectedProjectLeadNames(users).filter((name) => selectedNames.includes(name)).length;
}

function isProjectLead(user) {
  return user?.role === "CHEF_DE_PROJET";
}

function ModificationsPage(props) {
  const [listOpen, setListOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
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
    isCriticalAction,
    lateActions,
    projectFilter,
    projectOptions,
    query,
    onEditRequest,
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
    requiresEvidence,
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
        <button className="primary-action" type="button" onClick={() => {
          setShowCreateForm(true);
        }}>
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
                  <p>{selectedRequest.modificationReason || "Aucune description renseignée pour le moment."}</p>
                  {selectedRequest.modificationDetail && <p>{selectedRequest.modificationDetail}</p>}
                </div>
                <div className="detail-header-actions">
                  <button
                    className="ghost-icon detail-edit-action"
                    disabled={saving}
                    type="button"
                    onClick={() => onEditRequest(selectedRequest)}
                    title="Modifier la modification"
                    aria-label="Modifier la modification"
                  >
                    <Pencil size={16} />
                  </button>
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
                </div>
                <div className="meta-grid">
                  <div><ClipboardList size={16} /><span>Projet</span><strong>{selectedRequest.modificationProject || "À définir"}</strong></div>
                  <div><ClipboardList size={16} /><span>Client</span><strong>{selectedRequest.client || "-"}</strong></div>
                  <div><ClipboardList size={16} /><span>Produit</span><strong>{selectedRequest.product || "-"}</strong></div>
                  <div><Gauge size={16} /><span>Pilote</span><strong>{selectedRequest.pilot || "À définir"}</strong></div>
                  <div><CalendarDays size={16} /><span>Réception</span><strong>{selectedRequest.receptionDate || "-"}</strong></div>
                  <div><CalendarDays size={16} /><span>SOP</span><strong>{selectedRequest.sopDate || "-"}</strong></div>
                  <div><ClipboardList size={16} /><span>Mixabilité</span><strong>{mixabilityLabel(selectedRequest.mixability)}</strong></div>
                  <div><ClipboardList size={16} /><span>Type</span><strong>{modificationTypesLabel(selectedRequest)}</strong></div>
                  <div><ClipboardList size={16} /><span>Revue dossier</span><strong>{selectedRequest.dossierReview || "-"}</strong></div>
                </div>
                {(selectedRequest.beforePhotoUrl || selectedRequest.afterPhotoUrl) && (
                  <div className="request-image-grid">
                    {selectedRequest.beforePhotoUrl && (
                      <button
                        type="button"
                        onClick={() => setPreviewImage({ title: "Photo état", url: selectedRequest.beforePhotoUrl })}
                        title="Agrandir la photo état"
                      >
                        <span>Photo état</span>
                        <img alt="Photo état" src={selectedRequest.beforePhotoUrl} />
                      </button>
                    )}
                    {selectedRequest.afterPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => setPreviewImage({ title: "Photo devient", url: selectedRequest.afterPhotoUrl })}
                        title="Agrandir la photo devient"
                      >
                        <span>Photo devient</span>
                        <img alt="Photo devient" src={selectedRequest.afterPhotoUrl} />
                      </button>
                    )}
                  </div>
                )}
              </header>
              <section className="request-workspace">
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
                  isCriticalAction={isCriticalAction}
                  lateActions={lateActions}
                  requiresEvidence={requiresEvidence}
                  saving={saving}
                  stageNewProject={Boolean(selectedRequest.newVersion)}
                  selectedStage={selectedStage}
                  updateActionForm={updateActionForm}
                />
                <ChecklistPanel checklist={checklist} />
              </section>
            </>
          ) : (
            <EmptyState title="Aucune demande sélectionnée" text="Sélectionnez une demande dans la liste ou créez une nouvelle modification." />
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
                <button
                  className={request.id === selectedId ? "request-card active" : "request-card"}
                  key={request.id}
                  onClick={() => selectRequest(request)}
                >
                  <span className="request-title">{request.modificationNumber || request.client}</span>
                  <span>{request.modificationProject || request.product || "Projet non renseigné"}</span>
                  <strong className={`stage-pill ${stageColorClass(request.currentStage)}`}>{stageLabel(request.currentStage, Boolean(request.newVersion))}</strong>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      {previewImage && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setPreviewImage(null)}>
          <section
            aria-labelledby="image-preview-title"
            aria-modal="true"
            className="image-preview-dialog"
            onMouseDown={(event) => event.stopPropagation()}
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
    </section>
  );
}

function ActionsPanel({ actionForm, actions, doneCount, handleCreateAction, handleDeleteAction, handleToggleAction, handleUpdateAction, handleUploadEvidence, isCriticalAction, lateActions, requiresEvidence, saving, selectedStage, stageNewProject, updateActionForm }) {
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
          <span>{doneCount}/{actions.length} terminées / {lateActions} retards</span>
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
        isCriticalAction={isCriticalAction}
        requiresEvidence={requiresEvidence}
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
                <span>{doneCount}/{actions.length} terminées / {lateActions} retards</span>
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
              isCriticalAction={isCriticalAction}
              requiresEvidence={requiresEvidence}
              saving={saving}
            />
          </section>
        </div>
      )}
      {createOpen && (
        <ActionCreateDialog
          actionForm={actionForm}
          isCriticalAction={isCriticalAction}
          saving={saving}
          onClose={() => setCreateOpen(false)}
          onSubmit={submitCreateAction}
          updateActionForm={updateActionForm}
        />
      )}
    </section>
  );
}

function ActionList({ actions, expanded = false, handleDeleteAction, handleToggleAction, handleUpdateAction, handleUploadEvidence, isCriticalAction, requiresEvidence, saving }) {
  const [editingAction, setEditingAction] = useState(null);

  return (
    <>
      <div className={expanded ? "action-list expanded" : "action-list"}>
        {actions.length === 0 ? (
          <EmptyState title="Aucune action pour cette phase" text="Ajoutez une action ou utilisez les actions générées lors de la création ECR." />
        ) : (
          actions.map((action) => (
            <article className={action.late ? "action-row late" : "action-row"} key={action.id}>
              <label className="action-check" title={action.status === "DONE" ? "Marquer non terminée" : "Marquer terminée"}>
                <input checked={action.checked || action.status === "DONE"} onChange={(event) => handleToggleAction(action, event.target.checked)} type="checkbox" />
              </label>
              <div className="action-main">
                <h3>{action.title}</h3>
                <p>{action.topicRisk || "-"} / {action.expectedEvidence || "élément preuve non renseigné"}</p>
              </div>
              <div className="action-meta">
                <span><em>Pilote</em><strong>{action.responsible || "À définir"}</strong></span>
                <span><em>Criticite</em><strong className={`criticality ${criticalityClass(action.criticality)}`}>{action.criticality || "3-faible"}</strong></span>
                <span><em>Debut</em><strong>{action.startDate || "-"}</strong></span>
                <span><em>Fin</em><strong>{action.endDate || "-"}</strong></span>
                <span><em>Jours</em><strong>{action.workDurationDays ?? "-"}</strong></span>
                <span><em>Asset</em><strong>{requiresEvidence(action) ? "Obligatoire" : "Optionnel"}</strong></span>
                <span className="evidence-meta">
                  <em>Assets</em>
                  <strong className="asset-link-list">
                    {actionAssets(action).length > 0 ? actionAssets(action).map((asset) => (
                      <a className="file-link" href={asset.fileUrl || actionEvidenceUrl(action.id)} key={asset.id || asset.fileName} target="_blank" rel="noreferrer">
                        {asset.fileName || "Asset"}
                      </a>
                    )) : "-"}
                  </strong>
                </span>
                <span><em>Status</em><small className={`status ${statusClass(action.status)}`}>{readableStatus(action.status)}</small></span>
              </div>
              <div className="action-row-tools">
                <label className="row-upload" title="Ajouter evidence">
                  <Upload size={15} />
                  <input multiple type="file" onChange={(event) => handleUploadEvidence(action, event.target.files)} />
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
          isCriticalAction={isCriticalAction}
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

function ActionCreateDialog({ actionForm, isCriticalAction, saving, onClose, onSubmit, updateActionForm }) {
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
          <input value={actionForm.expectedEvidence} onChange={(event) => updateActionForm("expectedEvidence", event.target.value)} placeholder="élément preuve" />
          <input type="date" value={actionForm.startDate} onChange={(event) => updateActionForm("startDate", event.target.value)} title="Date debut" />
          <input type="date" value={actionForm.endDate} onChange={(event) => updateActionForm("endDate", event.target.value)} title="Date fin" />
          <input min="0" type="number" value={actionForm.workDurationDays} onChange={(event) => updateActionForm("workDurationDays", event.target.value)} title="Jours de travail" />
          <label className="file-picker">
            <Paperclip size={15} />
            <span>{fileNamesLabel(actionForm.evidenceFile, "Assets")}</span>
            <input multiple type="file" onChange={(event) => updateActionForm("evidenceFile", event.target.files)} />
          </label>
          <label className="action-asset-toggle">
            <input
              checked={actionForm.evidenceRequired || isCriticalAction(actionForm)}
              disabled={isCriticalAction(actionForm)}
              type="checkbox"
              onChange={(event) => updateActionForm("evidenceRequired", event.target.checked)}
            />
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

function ActionEditDialog({ action, isCriticalAction, saving, onClose, onSubmit }) {
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
          <input value={form.expectedEvidence} onChange={(event) => updateForm("expectedEvidence", event.target.value)} placeholder="élément preuve" />
          <input type="date" value={form.startDate} onChange={(event) => updateForm("startDate", event.target.value)} title="Date debut" />
          <input type="date" value={form.endDate} onChange={(event) => updateForm("endDate", event.target.value)} title="Date fin" />
          <input min="0" type="number" value={form.workDurationDays} onChange={(event) => updateForm("workDurationDays", event.target.value)} title="Jours de travail" />
          <label className="file-picker">
            <Paperclip size={15} />
            <span>{fileNamesLabel(form.evidenceFile, actionAssets(action).length ? `${actionAssets(action).length} asset(s)` : "Assets")}</span>
            <input multiple type="file" onChange={(event) => updateForm("evidenceFile", event.target.files)} />
          </label>
          <label className="action-asset-toggle">
            <input
              checked={form.evidenceRequired || isCriticalAction(form)}
              disabled={isCriticalAction(form)}
              type="checkbox"
              onChange={(event) => updateForm("evidenceRequired", event.target.checked)}
            />
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
        <EmptyState title="Aucun point de vérification" text="Les points de contrôle apparaîtront ici pour la phase sélectionnée." />
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
