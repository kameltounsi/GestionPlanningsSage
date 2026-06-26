import React, { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Archive,
  ArchiveRestore,
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Gauge,
  Image as ImageIcon,
  Maximize2,
  MessageCircle,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Search,
  Send,
  Smile,
  Square,
  Trash2,
  Upload,
  Volume2,
  X,
  XCircle
} from "lucide-react";
import {
  createAction,
  createActionPlanningRule,
  addActionEvidenceLink,
  addActionPlanningRuleProofDocumentLink,
  addActionProofDocumentLink,
  createClientReference,
  createChatGroup,
  createEcrRequest,
  createFinishedProductReference,
  createProductReference,
  createProject,
  createRoleReference,
  createUser,
  addChatGroupMember,
  cancelEcrRequest,
  closeEcrRequest,
  confirmPasswordReset,
  clearSession,
  chatHeartbeat,
  chatOffline,
  chatTyping,
  addActionSuggestionToDefaults,
  acknowledgeActionDeadlineAlerts,
  acknowledgePhaseSoundAlerts,
  archiveEcrRequest,
  deleteAction,
  deleteActionPlanningRule,
  deleteActionAsset,
  deleteActionPlanningRuleProofDocument,
  deleteActionPlanningRuleProofDocumentItem,
  deleteClientReference,
  deleteFinishedProductReference,
  deleteProductReference,
  deleteProject,
  deleteRoleReference,
  deleteUser,
  ecrRequestFileDownloadUrl,
  getActionPlanningRules,
  getActionStandardSuggestions,
  getPendingActionDeadlineAlerts,
  getPendingPhaseSoundAlerts,
  getActions,
  getChecklist,
  getChatConversations,
  getChatGroupMessages,
  getChatMessages,
  getChatUsers,
  getClientReferences,
  getCurrentUser,
  getEcrRequestProgress,
  getEcrRequests,
  getFinishedProductReferences,
  getAuditLogs,
  getPilots,
  getProductReferences,
  getProjects,
  getRoleReferences,
  getStoredSession,
  getUsers,
  ignoreActionSuggestion,
  importFinishedProductReferences,
  login,
  logout,
  planningEventsUrl,
  planningWebSocketUrl,
  requestPasswordReset,
  storeSession,
  updateAction,
  updateActionPlanningRule,
  updateClientReference,
  updateEcrRequest,
  updateEcrStage,
  updateFinishedProductReference,
  updateProductReference,
  updateProject,
  updateRoleReference,
  updateUser,
  updateUserProfile,
  uploadActionEvidence,
  uploadActionPlanningRuleProofDocument,
  uploadActionProofDocument,
  uploadEcrRequestImage,
  actionAssetDownloadUrl,
  actionEvidenceUrl,
  actionProofDocumentDownloadUrl,
  actionProofDocumentUrl,
  approveActionValidation,
  approvePhaseValidation,
  changeUserPassword,
  getPhaseValidations,
  rejectActionValidation,
  rejectPhaseValidation,
  requestActionValidation,
  requestEcrClosure,
  requestPhaseValidation,
  sendChatMessage,
  sendChatGroupMessage,
  uploadUserPhoto,
  verifyPasswordResetCode
} from "./api";
import { EmptyState } from "./components/common/EmptyState";
import { PageHeader } from "./components/common/PageHeader";
import { StatCard } from "./components/common/StatCard";
import { emptyActionForm, emptyEcrForm, emptyFinishedProductForm, emptyPlanningRuleForm, emptyUserForm } from "./constants/forms";
import { userRoleOptions } from "./constants/roles";
import { LoginPage } from "./features/auth/LoginPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import {
  AskAiFinishedProductPage,
  AskAiFloatingButton,
  ChatFloatingButton,
  MessagingPage,
  QuickAskAiPanel,
  QuickChatPanel,
  chatTargetKey,
  formatFileSize,
  parseChatTarget,
  totalUnreadConversations
} from "./features/messaging/MessagingPage";
import { DossierReviewDialog } from "./features/modifications/DossierReviewDialog";
import { dossierReviewMetaLine } from "./features/modifications/dossierReviewExports";
import { PreferentialsPage } from "./features/preferentials/PreferentialsPage";
import { ProfilePage } from "./features/profile/ProfilePage";
import { ProjectsPage } from "./features/projects/ProjectsPage";
import { TraceabilityPage } from "./features/traceability/TraceabilityPage";
import { UsersPage } from "./features/users/UsersPage";
import { Sidebar } from "./layout/Sidebar";
import { comparePlanningRules } from "./utils/planningRules";
import { criticalityClass, readableStatus, statusClass } from "./utils/status";
import { getStages, safeStage, stageColorClass, stageLabel } from "./utils/stages";
import { userRoleLabel, userToForm } from "./utils/users";
import "./styles.css";

const swalButtons = {
  confirmButtonColor: "#2563eb",
  cancelButtonColor: "#64748b"
};

const PREFERENTIAL_PAGE_SIZE = 5;
const pageTitles = {
  dashboard: "Tableau de bord",
  modifications: "Modifications",
  "ask-ai": "Ask AI",
  projects: "Actions standard",
  traceability: "Tracabilite",
  messages: "Messagerie",
  preferentials: "Préférentiels",
  users: "Utilisateurs",
  profile: "Profil"
};
const pageRoutes = {
  dashboard: "/dashboard",
  modifications: "/modifications",
  "ask-ai": "/ask-ai",
  projects: "/actions",
  traceability: "/tracabilite",
  messages: "/messagerie",
  preferentials: "/preferentiels",
  users: "/utilisateurs",
  profile: "/profil"
};
const routePages = Object.fromEntries(Object.entries(pageRoutes).map(([key, route]) => [route, key]));
function pageFromPath(pathname = window.location.pathname) {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return routePages[normalized] || (normalized === "/" ? "dashboard" : "dashboard");
}

function routeForPage(page) {
  return pageRoutes[page] || pageRoutes.dashboard;
}

const visibleAuditActionTypes = [
  "CREATION_MODIFICATION",
  "MODIFICATION_MODIFICATION",
  "VALIDATION_PHASE",
  "REOUVERTURE_PHASE",
  "ACTION_TERMINEE",
  "VALIDATION_ACTION",
  "REFUS_VALIDATION_ACTION",
  "ANNULATION_MODIFICATION",
  "ARCHIVAGE_MODIFICATION",
  "DESARCHIVAGE_MODIFICATION",
  "AJOUT_CLIENT",
  "AJOUT_PRODUIT",
  "AJOUT_PROJET",
  "MODIFICATION_PROJET_EQUIPE"
];

function successToast(title) {
  return Swal.fire({
    title,
    icon: "success",
    timer: 1500,
    showConfirmButton: false
  });
}

function friendlyErrorMessage(message) {
  const text = String(message || "").trim();
  if (!text) return "Une erreur est survenue.";
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const payload = JSON.parse(text);
      if (payload.status === 400) return "Les donnees saisies sont invalides.";
      if (payload.status === 401) return "Session expirée. Connectez-vous à nouveau.";
      if (payload.status === 403) return "Vous n'avez pas les droits pour effectuer cette action.";
      if (payload.status === 404) return "Element introuvable.";
      if (payload.status === 409) return "Cette référence existe déjà.";
      return "Une erreur serveur est survenue. Réessayez plus tard.";
    } catch {
      return "Une erreur est survenue.";
    }
  }
  const lower = text.toLowerCase();
  if (lower.includes("exception") || lower.includes("constraint") || lower.includes("sql") || lower.includes("internal server error") || lower.includes("\"timestamp\"")) {
    return "Une erreur serveur est survenue. Réessayez plus tard.";
  }
  return text;
}

function errorAlert(message) {
  return Swal.fire({
    title: "Erreur",
    text: friendlyErrorMessage(message),
    icon: "error",
    confirmButtonText: "OK",
    confirmButtonColor: "#2563eb"
  });
}

function warningAlert(title, message) {
  return Swal.fire({
    title,
    text: message,
    icon: "warning",
    confirmButtonText: "OK",
    confirmButtonColor: "#2563eb"
  });
}

function playActionSuggestionSound() {
  try {
    const audio = new Audio("/sms-plann.mp3");
    audio.volume = 0.8;
    audio.play().catch(() => {
      const fallback = new Audio("/notif.mp3");
      fallback.volume = 0.8;
      fallback.play().catch(() => {});
    });
  } catch {
  }
}

let typingAudio = null;

function playTypingSound() {
  try {
    if (!typingAudio) {
      typingAudio = new Audio("/typing.mp3");
      typingAudio.volume = 0.45;
      typingAudio.loop = true;
    }
    if (!typingAudio.paused) return;
    typingAudio.currentTime = 0;
    typingAudio.play().catch(() => {});
  } catch {
  }
}

function stopTypingSound() {
  try {
    if (!typingAudio) return;
    typingAudio.pause();
    typingAudio.currentTime = 0;
  } catch {
  }
}

function confirmDelete(title, text) {
  return Swal.fire({
    title,
    text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Supprimer",
    cancelButtonText: "Annuler",
    confirmButtonColor: "#b42318",
    cancelButtonColor: "#64748b"
  });
}

function localDateTimeNow() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 19);
}

function formattedDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).replace("T", " ").slice(0, 16);
  }
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function isActionDone(action) {
  return Boolean(action?.checked) || action?.status === "DONE" || action?.status === "DONE_LATE";
}

function actionCompletionRate(actions = []) {
  if (!actions.length) return 0;
  return Math.round((actions.filter(isActionDone).length / actions.length) * 100);
}

function cancelledCompletionRate(request, actions = []) {
  if (request?.currentStage !== "CANCELLED") return null;
  if (request.closureStatus) return 100;
  const cancelledActions = actions.filter((action) => action.stage === "CANCELLED");
  return cancelledActions.length > 0 ? actionCompletionRate(cancelledActions) : 0;
}

function modificationCompletionRate(request, actions = []) {
  if (request?.currentStage === "CLOSED" || request?.closureStatus) return 100;
  if (request?.currentStage === "CANCELLED") return cancelledCompletionRate(request, actions) ?? 0;
  return actionCompletionRate(actions);
}

function workflowCompletionRate(request, actions = []) {
  if (!request) return 0;
  if (request.currentStage === "CLOSED" || request.closureStatus) return 100;
  if (request.currentStage === "CANCELLED") return cancelledCompletionRate(request, actions) ?? 0;
  const stages = getStages(Boolean(request.newVersion)).filter(([stage]) => stage !== "CANCELLED");
  const currentIndex = stages.findIndex(([stage]) => stage === request.currentStage);
  if (currentIndex < 0 || stages.length <= 1) return 0;
  return Math.round((currentIndex / (stages.length - 1)) * 100);
}

function dashboardProgressGroups(requests = [], labelFor, limit = 5, progressFor = workflowCompletionRate) {
  return Array.from(requests.reduce((map, request) => {
    const label = labelFor(request) || "Non renseigne";
    const item = map.get(label) || { label, count: 0, progressTotal: 0, late: 0, active: 0 };
    item.count += 1;
    item.progressTotal += progressFor(request);
    if (request.currentStage !== "CLOSED" && request.currentStage !== "CANCELLED") {
      item.active += 1;
    }
    const sopDate = parseDateOnly(request.sopDate);
    if (sopDate && sopDate < new Date() && request.currentStage !== "CLOSED" && request.currentStage !== "CANCELLED") {
      item.late += 1;
    }
    map.set(label, item);
    return map;
  }, new Map()).values())
    .map((item) => ({ ...item, progress: Math.round(item.progressTotal / Math.max(1, item.count)) }))
    .sort((first, second) => second.count - first.count || first.progress - second.progress || first.label.localeCompare(second.label, "fr", { sensitivity: "base" }))
    .slice(0, limit);
}

function allWorkflowStagesApproved(request, validations = []) {
  if (!request) return false;
  if (request.currentStage === "CANCELLED") {
    return validations.find((validation) => validation.stage === "CANCELLED")?.status === "APPROVED";
  }
  const workflowStages = getStages(Boolean(request.newVersion))
    .map(([key]) => key)
    .filter((stage) => stage !== "CLOSED");
  return workflowStages.length > 0 && workflowStages.every((stage) => (
    validations.find((validation) => validation.stage === stage)?.status === "APPROVED"
  ));
}

function isTerminalRequest(request) {
  return request?.currentStage === "CLOSED" || Boolean(request?.closureStatus);
}

function isClosedRequest(request) {
  return request?.currentStage === "CLOSED" || Boolean(request?.closureStatus);
}

function isCancelledRequest(request) {
  return request?.currentStage === "CANCELLED" || Boolean(request?.cancelledStatus);
}

function isActiveRequest(request) {
  return Boolean(request) && !request.archived && request.currentStage !== "CLOSED" && request.currentStage !== "CANCELLED";
}

function requestMatchesView(request, view, canAdmin = false) {
  if (!request) return false;
  if (view === "archived") return canAdmin && Boolean(request.archived);
  if (request.archived && view !== "all") return false;
  if (view === "active") return isActiveRequest(request);
  if (view === "closed") return !request.archived && request.currentStage === "CLOSED";
  if (view === "cancelled") return !request.archived && request.currentStage === "CANCELLED";
  return canAdmin || !request.archived;
}

function requestLoadOptions(view, user) {
  return isAdminUser(user) && (view === "archived" || view === "all")
    ? { view }
    : {};
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeExcelHtml(value) {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

function requestDisplayName(request) {
  return request?.modificationNumber || request?.client || request?.product || "Modification sans reference";
}

function fileNameToken(value) {
  return String(value || "modification")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "modification";
}

function stagesForRequest(request) {
  if (!request) return getStages(false);
  const stages = getStages(Boolean(request.newVersion));
  if (request.currentStage !== "CANCELLED") {
    return stages;
  }
  const cancelledFromStage = request.cancelledFromStage;
  const cancelledFromIndex = stages.findIndex(([key]) => key === cancelledFromStage);
  const visibleStages = cancelledFromIndex >= 0 ? stages.slice(0, cancelledFromIndex + 1) : [];
  return [
    ...visibleStages,
    ["CANCELLED", stageLabel("CANCELLED", Boolean(request.newVersion))]
  ];
}

const modificationDossierChecklist = [
  [1, "Donnée client : DT /Presentation/drawing", "DT", "Chef de projet"],
  [2, "Analyse Donnée client :", "Check list de drawing/Mail/OIL", "Chef de projet"],
  [3, "ECR form/ Demande de modification", "ECR", "Chef de projet"],
  [4, "compte rendu de réunion", "Compte de rendu", "Chef de projet"],
  [5, "Planning de modification et de réalisation", "Planning", "Chef de projet"],
  [6, "Avis de modification ( était devient )/ Preuve de formation/Aide Visuelle", "Avis de modif", "Chef de projet"],
  [7, "Fiche de présence en formation de la modification : tous les concernés : production , coupe , couture , delibera", "fiche de présence", "Chef de projet"],
  [8, "Identification des premières cartons modifiés", "Papier A4", "Qualité projet"],
  [9, "Check list de validation digit par rapport plan client ( tv controller/plan papier )", "check list", "CAO"],
  [10, "Validation sur obsolète en cas de besoins", "placement", "CAO/Chef de projet"],
  [11, "Consommation de tissu par kit par coiffe par digit", "tableau par mail", "CAO"],
  [12, "Rapport de réalisation VP/Proto/PRS", "rapport", "Chef de projet"],
  [13, "Rapport de faisabilité", "rapport", "Chef de projet"],
  [14, "Validation de programme Airbag/Proces spécifiques ( campo)", "fiche de validation", "Process"],
  [15, "Paramètres process coupe/Couture à jour", "fiche de paramètres", "Process"],
  [16, "Amdec process", "Tableau d'indice", "Chef de projet"],
  [17, "Plan de surveillance à jour", "Tableau d'indice", "Qualité projet"],
  [18, "Ok 1er piéce à jour remplie lors de modification ( coupe et couture )", "document", "Qualité projet"],
  [19, "Mise à jour de plan de coiffe", "document", "CAO"],
  [20, "Mise à jour de fiche rebut", "document", "CAO"],
  [21, "Instruction de travail à jour", "document", "Amelioration contunie"],
  [22, "Chemin de contrôle à jour", "document", "Qualité projet"],
  [23, "Instructions d'emballage à jour", "document", "Logistique"],
  [24, "Liste des références à jour", "Liste de ref", "Chef de projet"],
  [25, "Fiche de validation Etiquettes de traçabilité", "fiche de validation", "Chef de projet"],
  [26, "Mise à jour Gallia : Indice/DR", "imprimer gallia", "Chef de projet"],
  [27, "Mise à jour de BOM : composant/Kit", "Gamma/Mail/Fiche de revision sur gamma", "Chef de projet"],
  [28, "Offre de prix composant/outillages/Machine", "document", "Chef de projet"],
  [29, "Besoin MP diffusé et suivi de commandes MP", "document", "Chef de projet"],
  [30, "Fiche de vérification /inventaire avant modif/Obsolete", "rapport", "Chef de projet"],
  [31, "Isolation des restes des découpes non modifiés", "Papier A4", ""],
  [32, "Identification des découpes/composant modifiés", "Papier A4", ""],
  [33, "Rapport de contrôle coupe et PDCA pour les cas NOK", "rapport", "Qualité"],
  [34, "Rapport de contrôle couture et PDCA pour les cas NOK", "rapport", "Qualité"],
  [35, "Rapport de contrôle composants et PDCA pour les cas NOK", "rapport", "Qualité"],
  [36, "Check list de validation prototype", "rapport", "Qualité projet"],
  [37, "Rump up & mesure de capacité", "dossier", "Chef de projet"],
  [38, "Capabilité & R&R", "document", "Process"],
  [39, "PPAP PSW Validé", "psw", "Qualité"],
  [40, "Mise à jour Gallia : ajout \"AQP\" sur GAMMA System", "Gallia/Gamma", "Qualité"],
  [41, "Demande de dérogation", "N°dérogation/Base", "Qualité"],
  [42, "LLS", "document", "Qualité"],
  [43, "Document de retrait /Diffusion document", "document", "Chef de projet"],
  [44, "Mise a jours identification shop stock selon nouveau composant", "base acces", "Chef de projet"],
  [45, "PDFA update", "PDFA", "Chef de projet"]
];

function normalizeMatchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function actionProofLabel(action) {
  return [
    action?.proofDocument,
    action?.proofDocumentFileName,
    ...(action?.proofDocuments || []).map((document) => document?.fileName || document?.name),
    action?.expectedEvidence,
    action?.evidence,
    action?.evidenceFileName,
    ...(action?.assets || []).map((asset) => asset?.fileName || asset?.name)
  ].filter(Boolean).join(" / ");
}

function actionProofBulletList(action) {
  const items = [
    action?.proofDocument,
    action?.proofDocumentFileName,
    ...(action?.proofDocuments || []).map((document) => document?.fileName || document?.name),
    action?.expectedEvidence,
    action?.evidence,
    action?.evidenceFileName,
    ...(action?.assets || []).map((asset) => asset?.fileName || asset?.name)
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .filter((item, index, list) => list.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index);
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "-";
}

function findChecklistAction(actions, topic, document) {
  const topicText = normalizeMatchText(topic);
  const documentText = normalizeMatchText(document);
  return actions.find((action) => {
    const titleText = normalizeMatchText([action.title, action.topicRisk, action.description].filter(Boolean).join(" "));
    const evidenceText = normalizeMatchText(actionProofLabel(action));
    return (titleText && (titleText.includes(topicText) || topicText.includes(titleText)))
      || (documentText && evidenceText.includes(documentText));
  });
}

function dossierDate(value) {
  return value ? formatDateOnly(value) : "";
}

function dossierBoolean(value) {
  return value ? "Oui" : "Non";
}

function modificationDossierExportExcel(request, actions = []) {
  const sortedActions = [...actions].sort((first, second) =>
    (Number(first.id) || 0) - (Number(second.id) || 0)
  );
  const generatedAt = new Date().toLocaleString("fr-FR");
  const modificationTypes = modificationTypesLabel(request);
  const statusLabel = request.cancelledStatus
    ? "Annulée"
    : request.closureStatus
      ? "Clôturée"
      : "Active";
  const checklistRows = modificationDossierChecklist.map(([number, topic, document, pilot]) => {
    const action = findChecklistAction(sortedActions, topic, document);
    const cancelled = action?.status === "CANCELLED";
    const applicable = Boolean(action) && !cancelled;
    return `<tr class="body-row">
      <td class="center">${number}</td>
      <td class="topic" colspan="2">${escapeExcelHtml(action?.title || topic)}</td>
      <td>${escapeExcelHtml(actionProofLabel(action) || document)}</td>
      <td>${escapeExcelHtml(action?.responsible || pilot || "")}</td>
      <td class="center">${cancelled ? "X" : ""}</td>
      <td class="center">${applicable ? "X" : ""}</td>
      <td class="center">${escapeHtml(dossierDate(action?.date1 || action?.startDate || action?.deadline))}</td>
      <td class="center">${escapeHtml(dossierDate(action?.date2 || action?.endDate))}</td>
      <td class="center">${escapeHtml(dossierDate(action?.closedDate || action?.finalizationDate))}</td>
    </tr>`;
  }).join("");
  const actionRows = sortedActions.map((action, index) => `<tr class="info-row">
    <td class="center">${index + 1}</td>
    <td colspan="2">${escapeExcelHtml(action.title || "-")}</td>
    <td>${escapeExcelHtml(stageLabel(action.stage, Boolean(request.newVersion)))}</td>
    <td>${escapeExcelHtml(action.responsible || "-")}</td>
    <td>${escapeExcelHtml(action.validatorDisplayName || action.validator || "-")}</td>
    <td>${escapeExcelHtml(action.criticality || "-")}</td>
    <td>${escapeExcelHtml(action.status || "-")}</td>
    <td>${escapeHtml(dossierDate(action.deadline || action.endDate))}</td>
    <td>${escapeExcelHtml(action.comment || action.dossierReview || "")}</td>
  </tr>`).join("");
  const infoRows = [
    ["N° interne Access", request.accessInternalNumber],
    ["N° modification", request.modificationNumber],
    ["Client", request.client],
    ["Projet", request.modificationProject],
    ["Produit", request.product],
    ["Pilote", request.pilot],
    ["Phase courante", stageLabel(request.currentStage, Boolean(request.newVersion))],
    ["Statut", statusLabel],
    ["Type de modification", modificationTypes],
    ["Nouvelle version", dossierBoolean(request.newVersion)],
    ["Changement digit", dossierBoolean(request.digitChange)],
    ["Changement composant", dossierBoolean(request.componentChange)],
    ["Changement process", dossierBoolean(request.processChange)],
    ["Changement fournisseur", dossierBoolean(request.supplierChange)],
    ["Mixabilité", mixabilityLabel(request.mixability)],
    ["Raison de modification", request.modificationReason],
    ["Détail de modification", request.modificationDetail],
    ["Revue dossier", request.dossierReview],
    ["Photo état actuel", request.beforePhotoUrl || request.beforePhoto],
    ["Photo devient", request.afterPhotoUrl || request.afterPhoto],
    ["Dossier technique", request.technicalFile],
    ["Planning client", request.clientPlanning],
    ["Planning interne", request.internalPlanning],
    ["OIL list", request.oilList],
    ["Rapport", request.report],
    ["Extraction générée le", generatedAt]
  ].map(([label, value]) => `<tr class="info-row"><td colspan="3">${escapeExcelHtml(label)}</td><td colspan="7">${escapeExcelHtml(value || "-")}</td></tr>`).join("");

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Dossier de modification - ${escapeHtml(requestDisplayName(request))}</title><style>
    body{font-family:Calibri,Arial,sans-serif;color:#000;margin:0;background:#fff}
    table{border-collapse:collapse;table-layout:fixed;width:1540px}
    col.c1{width:42px} col.c2{width:230px} col.c3{width:370px} col.c4{width:360px} col.c5{width:260px}
    col.c6{width:145px} col.c7{width:180px} col.c8{width:124px} col.c9{width:124px} col.c10{width:140px}
    td,th{border:1px solid #000;padding:5px 7px;vertical-align:top;font-size:11px;white-space:normal;line-height:1.25;mso-number-format:"\\@";}
    .title{font-size:20px;font-weight:700;text-align:center;background:#d9eaf7;height:42px}
    .doc{font-weight:700;text-align:center;background:#d9eaf7}
    .field{font-size:14px;font-weight:700;height:30px;background:#fff}
    .section{font-weight:700;text-align:center;background:#d9eaf7}
    .header th{background:#bdd7ee;font-weight:700;text-align:center;height:30px}
    .body-row td{height:32px}
    .topic{font-weight:600}
    .center{text-align:center}
    .sign{height:28px}
    .info-title td{background:#d9eaf7;font-weight:700;text-align:center;font-size:14px}
    .info-row td{height:28px}
    .muted{color:#404040}
  </style></head><body><table>
    <colgroup><col class="c1"><col class="c2"><col class="c3"><col class="c4"><col class="c5"><col class="c6"><col class="c7"><col class="c8"><col class="c9"><col class="c10"></colgroup>
    <tr><td colspan="2" rowspan="3"></td><td class="title" colspan="5" rowspan="3">Dossier de Modification /Nouveau Produit /Process</td><td class="doc" colspan="3">SAGE-INS-ENG-32</td></tr>
    <tr><td class="doc" colspan="3">Révision : 05</td></tr>
    <tr><td class="doc" colspan="3">Date : 13/05/2026</td></tr>
    <tr><td class="field" colspan="10">Client /Projet&nbsp;&nbsp;: ${escapeHtml([request.client, request.modificationProject].filter(Boolean).join(" / ") || "-")}</td></tr>
    <tr><td class="field" colspan="10">Produit : ${escapeHtml(request.product || "-")}</td></tr>
    <tr><td class="field" colspan="10">Modification : ${escapeHtml([request.modificationReason, request.modificationDetail].filter(Boolean).join(" - ") || "-")}</td></tr>
    <tr><td class="field" colspan="10">N° Modif ${escapeHtml(request.modificationNumber || "-")}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Date de réception ${escapeHtml(dossierDate(request.receptionDate) || "-")}</td></tr>
    <tr><td class="section" colspan="3">Faisabilité interne</td><td class="section" colspan="3">validation client</td><td class="section" colspan="4">PPAP Validé le</td></tr>
    <tr><td class="center" colspan="3">${escapeHtml(dossierDate(request.feasibilityValidationDate) || (request.feasibilityValidation ? "Oui" : ""))}</td><td class="center" colspan="3">${escapeHtml(dossierDate(request.customerValidationDate) || (request.customerValidation ? "Oui" : ""))}</td><td class="center" colspan="4">${escapeHtml(dossierDate(request.ppapValidationDate) || (request.ppapValidation ? "Oui" : ""))}</td></tr>
    <tr><td class="section" colspan="3">SOP&nbsp;&nbsp;${escapeHtml(dossierDate(request.sopDate) || "-")}</td><td class="section">Cloture le</td><td class="center" colspan="2">${escapeHtml(dossierDate(request.closureDate) || (request.closureStatus ? "Oui" : ""))}</td><td class="section">Annulé le</td><td class="center" colspan="3">${escapeHtml(dossierDate(request.cancelledDate) || (request.cancelledStatus ? "Oui" : ""))}</td></tr>
    <tr class="header"><th>N°</th><th colspan="2">Topic</th><th>Document de preuve</th><th>Pilote</th><th>NA</th><th>Applicable</th><th>Date1</th><th>Date2</th><th>Cloture</th></tr>
    ${checklistRows}
    <tr><td colspan="10"></td></tr>
    <tr><td></td><td class="section" colspan="2">Validation Pilote Processus :</td><td class="section">Engineering</td><td class="section">Quality</td><td class="section">Logistique</td><td class="section">Finance</td><td class="section">Coupe</td><td class="section">Production</td><td></td></tr>
    <tr class="sign"><td></td><td colspan="2">Date</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr class="sign"><td></td><td colspan="2">Nom</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr class="sign"><td></td><td colspan="2">Signature</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    <tr class="info-title"><td colspan="10">Informations modification</td></tr>
    ${infoRows}
    <tr class="info-title"><td colspan="10">Actions de la modification</td></tr>
    <tr class="header"><th>N°</th><th colspan="2">Action</th><th>Phase</th><th>Responsable</th><th>Validateur</th><th>Criticité</th><th>Statut</th><th>Échéance</th><th>Commentaire</th></tr>
    ${actionRows || `<tr class="info-row"><td colspan="10" class="center muted">Aucune action renseignée.</td></tr>`}
  </table></body></html>`;
}

function requestStatusLabel(request) {
  if (isCancelledRequest(request)) return "Annulee";
  if (isClosedRequest(request)) return "Cloturee";
  if (request?.closureRequested) return "Cloture demandee";
  return "Active";
}

function sageModificationDossierExportExcel(request, actions = []) {
  const stageOrder = new Map(getStages(Boolean(request.newVersion)).map(([stage], index) => [stage, index]));
  const sortedActions = [...actions].sort((first, second) =>
    (stageOrder.get(first.stage) ?? 99) - (stageOrder.get(second.stage) ?? 99)
      || (Number(first.id) || 0) - (Number(second.id) || 0)
  );
  const generatedAt = new Date().toLocaleString("fr-FR");
  const statusLabel = requestStatusLabel(request);
  const doneCount = sortedActions.filter(isActionDone).length;
  const cancelledCount = sortedActions.filter((action) => action.status === "CANCELLED").length;
  const lateCount = sortedActions.filter((action) => actionGanttStatusClass(action) === "late").length;
  const proofCount = sortedActions.filter((action) => actionProofLabel(action)).length;
  const completionRate = modificationCompletionRate(request, sortedActions);
  const actionRows = sortedActions.map((action, index) => `<tr class="action-row">
    <td class="center">${index + 1}</td>
    <td>${escapeExcelHtml(stageLabel(action.stage, Boolean(request.newVersion)))}</td>
    <td class="topic">${escapeExcelHtml(action.title || "-")}</td>
    <td>${escapeExcelHtml(action.responsible || "-")}</td>
    <td>${escapeExcelHtml(action.validatorDisplayName || action.validator || "-")}</td>
    <td>${escapeExcelHtml(action.criticality || "-")}</td>
    <td>${escapeExcelHtml(actionGanttStatusLabel(action))}</td>
    <td class="center">${action.status === "CANCELLED" ? "X" : ""}</td>
    <td class="center">${action.status === "CANCELLED" ? "" : "X"}</td>
    <td class="center">${escapeHtml(dossierDate(action.startDate || action.date1))}</td>
    <td class="center">${escapeHtml(dossierDate(action.deadline || action.endDate || action.date2))}</td>
    <td class="center">${escapeHtml(dossierDate(action.closedDate || action.finalizationDate))}</td>
    <td>${escapeExcelHtml(actionProofLabel(action) || "-")}</td>
    <td>${escapeExcelHtml(action.comment || action.dossierReview || "")}</td>
  </tr>`).join("");
  const stageSummaryRows = getStages(Boolean(request.newVersion))
    .filter(([stage]) => sortedActions.some((action) => action.stage === stage))
    .map(([stage, label]) => {
      const stageActions = sortedActions.filter((action) => action.stage === stage);
      const stageDone = stageActions.filter(isActionDone).length;
      const stageLate = stageActions.filter((action) => actionGanttStatusClass(action) === "late").length;
      return `<tr class="info-row">
        <td colspan="3">${escapeExcelHtml(label)}</td>
        <td class="center">${stageActions.length}</td>
        <td class="center">${stageDone}</td>
        <td class="center">${stageLate}</td>
        <td colspan="8">${escapeExcelHtml(stageActions.map((action) => action.title).filter(Boolean).join(" | ") || "-")}</td>
      </tr>`;
    }).join("");
  const infoRows = [
    ["Numero interne Access", request.accessInternalNumber],
    ["Numero modification", request.modificationNumber],
    ["Client", request.client],
    ["Projet", request.modificationProject],
    ["Produit", request.product],
    ["Produits finis", request.finishedProducts],
    ["Pilote", request.pilot],
    ["Phase courante", stageLabel(request.currentStage, Boolean(request.newVersion))],
    ["Statut", statusLabel],
    ["Type de modification", modificationTypesLabel(request)],
    ["Nouvelle version", dossierBoolean(request.newVersion)],
    ["Changement digit", dossierBoolean(request.digitChange)],
    ["Changement composant", dossierBoolean(request.componentChange)],
    ["Changement process", dossierBoolean(request.processChange)],
    ["Changement fournisseur", dossierBoolean(request.supplierChange)],
    ["Mixabilite", mixabilityLabel(request.mixability)],
    ["Raison de modification", request.modificationReason],
    ["Detail de modification", request.modificationDetail],
    ["Revue dossier", request.dossierReview],
    ["Photo etat actuel", request.beforePhotoUrl || request.beforePhoto],
    ["Photo devient", request.afterPhotoUrl || request.afterPhoto],
    ["Dossier technique", request.technicalFile],
    ["Planning client", request.clientPlanning],
    ["Planning interne", request.internalPlanning],
    ["OIL list", request.oilList],
    ["Rapport", request.report],
    ["Extraction generee le", generatedAt]
  ].map(([label, value]) => `<tr class="info-row"><td colspan="3">${escapeExcelHtml(label)}</td><td colspan="11">${escapeExcelHtml(value || "-")}</td></tr>`).join("");

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Dossier SAGE - ${escapeHtml(requestDisplayName(request))}</title><style>
    body{font-family:Calibri,Arial,sans-serif;color:#172008;margin:0;background:#fff}
    table{border-collapse:collapse;table-layout:fixed;width:1900px}
    col.c1{width:48px} col.c2{width:190px} col.c3{width:360px} col.c4{width:180px} col.c5{width:180px}
    col.c6{width:120px} col.c7{width:140px} col.c8{width:70px} col.c9{width:95px} col.c10{width:120px}
    col.c11{width:120px} col.c12{width:120px} col.c13{width:350px} col.c14{width:320px}
    td,th{border:1px solid #26340f;padding:6px 8px;vertical-align:top;font-size:11px;white-space:normal;line-height:1.25;mso-number-format:"\\@";}
    .brand{background:#172008;color:#fff;font-size:18px;font-weight:700;text-align:center}
    .brand-sub{background:#5f7f13;color:#fff;font-size:13px;font-weight:700;text-align:center}
    .title{font-size:22px;font-weight:700;text-align:center;background:#e7f0dc;color:#172008;height:46px}
    .doc{font-weight:700;text-align:center;background:#dce8ce;color:#172008}
    .field{font-size:14px;font-weight:700;height:30px;background:#fff}
    .section{font-weight:700;text-align:center;background:#dce8ce;color:#172008}
    .header th{background:#5f7f13;color:#fff;font-weight:700;text-align:center;height:32px}
    .action-row td{height:34px}
    .topic{font-weight:600}
    .center{text-align:center}
    .metric{background:#f7f9f1;text-align:center}
    .metric strong{display:block;font-size:20px;color:#172008}
    .metric span{display:block;color:#5f7f13;font-size:10px;font-weight:700;text-transform:uppercase}
    .sign{height:34px}
    .info-title td{background:#dce8ce;color:#172008;font-weight:700;text-align:center;font-size:14px}
    .info-row td{height:28px}
    .muted{color:#404040}
  </style></head><body><table>
    <colgroup><col class="c1"><col class="c2"><col class="c3"><col class="c4"><col class="c5"><col class="c6"><col class="c7"><col class="c8"><col class="c9"><col class="c10"><col class="c11"><col class="c12"><col class="c13"><col class="c14"></colgroup>
    <tr><td class="brand" colspan="14">SAGE Automotive Interiors</td></tr>
    <tr><td class="brand-sub" colspan="14">Dossier ECR personnalise SAGE - extraction conforme aux actions de la modification</td></tr>
    <tr><td class="title" colspan="10" rowspan="3">Dossier de Modification / Nouveau Produit / Process</td><td class="doc" colspan="4">SAGE-INS-ENG-32</td></tr>
    <tr><td class="doc" colspan="4">Revision : 05</td></tr>
    <tr><td class="doc" colspan="4">Date : 13/05/2026</td></tr>
    <tr><td class="field" colspan="14">Client / Projet : ${escapeHtml([request.client, request.modificationProject].filter(Boolean).join(" / ") || "-")}</td></tr>
    <tr><td class="field" colspan="14">Produit / Produits finis : ${escapeHtml([request.product, request.finishedProducts].filter(Boolean).join(" / ") || "-")}</td></tr>
    <tr><td class="field" colspan="14">Modification : ${escapeHtml([request.modificationReason, request.modificationDetail].filter(Boolean).join(" - ") || "-")}</td></tr>
    <tr><td class="field" colspan="14">Numero modification : ${escapeHtml(request.modificationNumber || "-")} &nbsp;&nbsp; Date de reception : ${escapeHtml(dossierDate(request.receptionDate) || "-")} &nbsp;&nbsp; SOP : ${escapeHtml(dossierDate(request.sopDate) || "-")}</td></tr>
    <tr>
      <td class="metric" colspan="3"><span>Statut</span><strong>${escapeHtml(statusLabel)}</strong></td>
      <td class="metric" colspan="3"><span>Avancement</span><strong>${completionRate}%</strong></td>
      <td class="metric" colspan="2"><span>Actions</span><strong>${sortedActions.length}</strong></td>
      <td class="metric" colspan="2"><span>Done</span><strong>${doneCount}</strong></td>
      <td class="metric" colspan="2"><span>Retard</span><strong>${lateCount}</strong></td>
      <td class="metric" colspan="2"><span>Preuves</span><strong>${proofCount}</strong></td>
    </tr>
    <tr><td class="section" colspan="4">Phase courante</td><td class="section" colspan="3">Cloture le</td><td class="section" colspan="3">Annule le</td><td class="section" colspan="4">Actions annulees</td></tr>
    <tr><td class="center" colspan="4">${escapeHtml(stageLabel(request.currentStage, Boolean(request.newVersion)))}</td><td class="center" colspan="3">${escapeHtml(dossierDate(request.closureDate) || (request.closureStatus ? "Oui" : "-"))}</td><td class="center" colspan="3">${escapeHtml(dossierDate(request.cancelledDate) || (request.cancelledStatus ? "Oui" : "-"))}</td><td class="center" colspan="4">${cancelledCount}</td></tr>
    <tr class="info-title"><td colspan="14">Informations modification SAGE</td></tr>
    ${infoRows}
    <tr class="info-title"><td colspan="14">Synthese par phase</td></tr>
    <tr class="header"><th colspan="3">Phase</th><th>Total</th><th>Done</th><th>Retard</th><th colspan="8">Actions de la phase</th></tr>
    ${stageSummaryRows || `<tr class="info-row"><td colspan="14" class="center muted">Aucune action rattachee aux phases.</td></tr>`}
    <tr class="info-title"><td colspan="14">Plan d'actions ECR - memes actions que la modification selectionnee</td></tr>
    <tr class="header"><th>N</th><th>Phase</th><th>Action</th><th>Responsable</th><th>Validateur</th><th>Criticite</th><th>Statut</th><th>NA</th><th>Applicable</th><th>Debut</th><th>Echeance</th><th>Cloture</th><th>Preuves / documents</th><th>Commentaire</th></tr>
    ${actionRows || `<tr class="info-row"><td colspan="14" class="center muted">Aucune action renseignee pour cette modification.</td></tr>`}
    <tr><td colspan="14"></td></tr>
    <tr><td></td><td class="section" colspan="3">Validation Pilote Processus</td><td class="section" colspan="2">Engineering</td><td class="section" colspan="2">Quality</td><td class="section" colspan="2">Logistique</td><td class="section" colspan="2">Finance</td><td class="section" colspan="2">Production</td></tr>
    <tr class="sign"><td></td><td colspan="3">Date</td><td colspan="2"></td><td colspan="2"></td><td colspan="2"></td><td colspan="2"></td><td colspan="2"></td></tr>
    <tr class="sign"><td></td><td colspan="3">Nom</td><td colspan="2"></td><td colspan="2"></td><td colspan="2"></td><td colspan="2"></td><td colspan="2"></td></tr>
    <tr class="sign"><td></td><td colspan="3">Signature</td><td colspan="2"></td><td colspan="2"></td><td colspan="2"></td><td colspan="2"></td><td colspan="2"></td></tr>
  </table></body></html>`;
}

function projectPlanStyleDossierExportExcel(request, actions = []) {
  const stages = getStages(Boolean(request.newVersion));
  const stageOrder = new Map(stages.map(([stage], index) => [stage, index]));
  const generatedAt = new Date().toLocaleString("fr-FR");
  const sortedActions = [...actions].sort((first, second) =>
    (stageOrder.get(first.stage) ?? 99) - (stageOrder.get(second.stage) ?? 99)
      || (Number(first.id) || 0) - (Number(second.id) || 0)
  );
  const clientParts = String(request.client || "")
    .split(/&|\/|;|,/)
    .map((client) => client.trim())
    .filter(Boolean);
  const firstClient = clientParts[0] || request.client || "Client 1";
  const secondClient = clientParts[1] || "Client 2";
  const statusLegend = [
    ["all item", sortedActions.length],
    ["open item", Math.max(0, sortedActions.length - sortedActions.filter(isActionDone).length)],
    ["plan", "0.25"],
    ["do", "0.5"],
    ["check", "0.75"],
    ["closed item", "1"],
    ["overdue Item", "0"]
  ];
  const phasePalette = ["phase-yellow", "phase-orange", "phase-green", "phase-blue", "phase-red"];
  const actionRows = sortedActions.map((action, index) => {
    const stageIndex = stageOrder.get(action.stage) ?? 0;
    const isFirstInStage = index === 0 || sortedActions[index - 1]?.stage !== action.stage;
    const startDate = dossierDate(action.startDate || action.date1 || action.createdAt);
    const endDate = dossierDate(action.deadline || action.endDate || action.date2);
    const completionDate = dossierDate(action.closedDate || action.finalizationDate);
    const clientValue = action.status === "CANCELLED" ? 0 : isActionDone(action) ? 1 : actionGanttStatusClass(action) === "late" ? 0 : 0.5;
    const priority = criticalityClass(action.criticality) === "critical" ? "Elevee" : criticalityClass(action.criticality) === "medium" ? "Moyenne" : "Faible";
    return `<tr class="plan-row">
      <td class="phase ${phasePalette[stageIndex % phasePalette.length]}">${isFirstInStage ? escapeExcelHtml(stageLabel(action.stage, Boolean(request.newVersion))) : ""}</td>
      <td class="action">${escapeExcelHtml(action.title || "-")}</td>
      <td>${escapeExcelHtml(action.responsible || "-")}</td>
      <td class="center date-cell">${escapeHtml(startDate)}</td>
      <td class="center date-cell">${escapeHtml(endDate)}</td>
      <td class="center">${startDate && endDate ? `=E${index + 11}-D${index + 11}` : ""}</td>
      <td class="center date-cell">${escapeHtml(completionDate)}</td>
      <td class="center progress">${clientValue}</td>
      <td class="center progress">${clientValue}</td>
      <td class="center progress">=AVERAGE(H${index + 11}:I${index + 11})</td>
      <td>${escapeExcelHtml(priority)}</td>
      <td>${escapeExcelHtml([action.comment, action.dossierReview, actionProofLabel(action)].filter(Boolean).join(" | "))}</td>
    </tr>`;
  }).join("");
  const phaseRows = stages
    .filter(([stage]) => sortedActions.some((action) => action.stage === stage))
    .map(([stage, label], index) => {
      const stageActions = sortedActions.filter((action) => action.stage === stage);
      const firstRowIndex = sortedActions.findIndex((action) => action.stage === stage) + 11;
      const lastRowIndex = firstRowIndex + stageActions.length - 1;
      return `<tr class="phase-summary">
        <td class="${phasePalette[index % phasePalette.length]}">${escapeExcelHtml(label)}</td>
        <td colspan="8">${escapeExcelHtml(stageActions.map((action) => action.title).filter(Boolean).join(" | "))}</td>
        <td class="center">=AVERAGE(J${firstRowIndex}:J${lastRowIndex})</td>
        <td colspan="2">${stageActions.length} action${stageActions.length > 1 ? "s" : ""}</td>
      </tr>`;
    }).join("");
  const legendRows = statusLegend.map(([label, value], index) => `<tr>
    <td colspan="10"></td>
    <td class="legend-label">${escapeExcelHtml(label)}</td>
    <td class="legend-value">${escapeExcelHtml(value)}</td>
  </tr>`).join("");

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Project plan - ${escapeHtml(requestDisplayName(request))}</title><style>
    body{font-family:"Century Gothic",Calibri,Arial,sans-serif;color:#000;margin:0;background:#fff}
    table{border-collapse:collapse;table-layout:fixed;width:1450px}
    col.c1{width:92px} col.c2{width:520px} col.c3{width:230px} col.c4{width:95px} col.c5{width:95px} col.c6{width:85px}
    col.c7{width:105px} col.c8{width:70px} col.c9{width:70px} col.c10{width:80px} col.c11{width:105px} col.c12{width:380px}
    td,th{border:1px solid #000;padding:5px 7px;vertical-align:middle;font-size:10pt;line-height:1.2;white-space:normal;mso-number-format:"\\@";}
    .title-row td{border:none;height:63px}
    .project-title{font-size:22pt;font-weight:700;text-align:right;vertical-align:middle}
    .meta-label{font-size:12pt;font-weight:700;text-align:right;background:#f2f2f2}
    .meta-value{font-size:12pt;text-align:left}
    .legend-label,.legend-value{font-size:10pt}
    .header th{background:#c00000;color:#fff;font-weight:700;text-align:center;height:25px}
    .header th.action-head,.header th.resp-head,.header th.comment-head{text-align:left}
    .plan-row td{height:20px}
    .phase{font-weight:700;text-align:center}
    .phase-yellow{background:#ffff00}
    .phase-orange{background:#ffc000}
    .phase-green{background:#92d050}
    .phase-blue{background:#94effb}
    .phase-red{background:#ff0000;color:#fff}
    .action{text-align:left}
    .center{text-align:center}
    .date-cell{mso-number-format:"dd/mm/yyyy"}
    .progress{background:#ff0000;mso-number-format:"0%"}
    .phase-summary td{height:24px;font-weight:700}
    .footer-title{background:#f2f2f2;font-weight:700;text-align:center}
    .signature{height:34px}
  </style></head><body><table>
    <colgroup><col class="c1"><col class="c2"><col class="c3"><col class="c4"><col class="c5"><col class="c6"><col class="c7"><col class="c8"><col class="c9"><col class="c10"><col class="c11"><col class="c12"></colgroup>
    <tr class="title-row"><td colspan="2"></td><td class="project-title" colspan="4">PLANNING DE PROJET</td><td colspan="6"></td></tr>
    <tr><td></td><td class="meta-label">NOM DU PROJET</td><td class="meta-value">${escapeExcelHtml(request.modificationProject || "-")}</td><td colspan="7"></td><td class="legend-label">all item</td><td class="legend-value">${sortedActions.length}</td></tr>
    <tr><td></td><td class="meta-label">CLIENT</td><td class="meta-value">${escapeExcelHtml(request.client || "-")}</td><td colspan="7"></td><td class="legend-label">open item</td><td class="legend-value">${Math.max(0, sortedActions.length - sortedActions.filter(isActionDone).length)}</td></tr>
    <tr><td></td><td class="meta-label">SOP DATE</td><td class="meta-value">${escapeExcelHtml(dossierDate(request.sopDate) || "-")}</td><td colspan="7"></td><td class="legend-label">plan</td><td class="legend-value">0.25</td></tr>
    <tr><td></td><td class="meta-label">TYPE</td><td class="meta-value">${escapeExcelHtml(modificationTypesLabel(request))}</td><td colspan="7"></td><td class="legend-label">do</td><td class="legend-value">0.5</td></tr>
    <tr><td></td><td class="meta-label">CHEF DE PROJETS</td><td class="meta-value">${escapeExcelHtml(request.pilot || "-")}</td><td colspan="7"></td><td class="legend-label">check</td><td class="legend-value">0.75</td></tr>
    <tr><td></td><td class="meta-label">DATE DE CREATION</td><td class="meta-value">${escapeExcelHtml(dossierDate(request.receptionDate) || "-")}</td><td colspan="7"></td><td class="legend-label">closed item</td><td class="legend-value">1</td></tr>
    <tr><td></td><td class="meta-label">DATE DE MISE A JOUR</td><td class="meta-value">${escapeExcelHtml(generatedAt)}</td><td colspan="7"></td><td class="legend-label">overdue Item</td><td class="legend-value">0</td></tr>
    <tr><td colspan="12"></td></tr>
    <tr class="header"><th>Phase</th><th class="action-head">Action</th><th class="resp-head">Responsable</th><th>Début</th><th>Fin</th><th># Jours</th><th>Date de comp</th><th>${escapeExcelHtml(firstClient)}</th><th>${escapeExcelHtml(secondClient)}</th><th>% Comp</th><th>PRIORITÉ</th><th class="comment-head">COMMENTAIRES</th></tr>
    ${actionRows || `<tr class="plan-row"><td colspan="12" class="center">Aucune action renseignee pour cette modification.</td></tr>`}
    <tr><td colspan="12"></td></tr>
    ${phaseRows}
    <tr><td colspan="12"></td></tr>
    <tr><td class="footer-title" colspan="12">Synthese SAGE ECR - ${escapeExcelHtml(requestDisplayName(request))}</td></tr>
    <tr><td colspan="2">Statut</td><td colspan="2">${escapeExcelHtml(requestStatusLabel(request))}</td><td colspan="2">Avancement</td><td colspan="2">${modificationCompletionRate(request, sortedActions)}%</td><td colspan="2">Preuves</td><td colspan="2">${sortedActions.filter((action) => actionProofLabel(action)).length}</td></tr>
    <tr><td colspan="2">Raison</td><td colspan="10">${escapeExcelHtml(request.modificationReason || "-")}</td></tr>
    <tr><td colspan="2">Detail</td><td colspan="10">${escapeExcelHtml(request.modificationDetail || "-")}</td></tr>
    <tr><td colspan="2">Revue dossier</td><td colspan="10">${escapeExcelHtml(request.dossierReview || "-")}</td></tr>
    <tr><td colspan="12"></td></tr>
    <tr><td class="footer-title" colspan="2">Validation</td><td class="footer-title" colspan="2">Program</td><td class="footer-title" colspan="2">Quality</td><td class="footer-title" colspan="2">Operation</td><td class="footer-title" colspan="2">Logistic</td><td class="footer-title" colspan="2">Customer Unit</td></tr>
    <tr class="signature"><td colspan="2">Date</td><td colspan="2"></td><td colspan="2"></td><td colspan="2"></td><td colspan="2"></td><td colspan="2"></td></tr>
    <tr class="signature"><td colspan="2">Nom</td><td colspan="2"></td><td colspan="2"></td><td colspan="2"></td><td colspan="2"></td><td colspan="2"></td></tr>
    <tr class="signature"><td colspan="2">Signature</td><td colspan="2"></td><td colspan="2"></td><td colspan="2"></td><td colspan="2"></td><td colspan="2"></td></tr>
  </table></body></html>`;
}

function completePhaseDossierExportExcel(request, actions = []) {
  const stages = getStages(Boolean(request.newVersion));
  const stageOrder = new Map(stages.map(([stage], index) => [stage, index]));
  const sortedActions = [...actions].sort((first, second) =>
    (stageOrder.get(first.stage || request.currentStage) ?? 99) - (stageOrder.get(second.stage || request.currentStage) ?? 99)
      || (Number(first.id) || 0) - (Number(second.id) || 0)
  );
  const generatedAt = new Date().toLocaleString("fr-FR");
  const doneCount = sortedActions.filter(isActionDone).length;
  const lateCount = sortedActions.filter((action) => actionGanttStatusClass(action) === "late").length;
  const proofCount = sortedActions.filter((action) => actionProofLabel(action)).length;
  const completionRate = modificationCompletionRate(request, sortedActions);
  const phaseClasses = ["phase-sage"];
  let excelRow = 13;
  const phaseSections = stages
    .filter(([stage]) => sortedActions.some((action) => (action.stage || request.currentStage) === stage))
    .map(([stage, label], phaseIndex) => {
      const phaseActions = sortedActions.filter((action) => (action.stage || request.currentStage) === stage);
      const phaseDone = phaseActions.filter(isActionDone).length;
      const phaseLate = phaseActions.filter((action) => actionGanttStatusClass(action) === "late").length;
      const phaseClass = phaseClasses[phaseIndex % phaseClasses.length];
      const rows = phaseActions.map((action, index) => {
        excelRow += 1;
        const startDate = dossierDate(action.startDate || action.date1 || action.createdAt);
        const endDate = dossierDate(action.deadline || action.endDate || action.date2);
        const completionDate = dossierDate(action.closedDate || action.finalizationDate);
        const plannedDays = Number(action.workDurationDays) || (startDate && endDate ? `=F${excelRow}-E${excelRow}` : "");
        const statusClassName = action.status === "CANCELLED"
          ? "status-cancelled"
          : isActionDone(action) ? "status-done" : actionGanttStatusClass(action) === "late" ? "status-late" : "status-open";
        const priority = criticalityClass(action.criticality) === "critical"
          ? "Elevee"
          : criticalityClass(action.criticality) === "medium" ? "Moyenne" : "Faible";
        return `<tr class="action-row">
          <td class="center">${index + 1}</td>
          <td class="action">${escapeExcelHtml(action.title || "-")}</td>
          <td>${escapeExcelHtml(action.responsible || "-")}</td>
          <td>${escapeExcelHtml(action.validatorDisplayName || action.validator || "-")}</td>
          <td class="center date-cell">${escapeHtml(startDate)}</td>
          <td class="center date-cell">${escapeHtml(endDate)}</td>
          <td class="center">${escapeHtml(plannedDays)}</td>
          <td class="center date-cell">${escapeHtml(completionDate)}</td>
          <td class="${statusClassName}">${escapeExcelHtml(actionGanttStatusLabel(action))}</td>
          <td>${escapeExcelHtml(priority)}</td>
          <td class="proof-list">${escapeExcelHtml(actionProofBulletList(action))}</td>
          <td>${escapeExcelHtml(action.comment || action.dossierReview || "")}</td>
        </tr>`;
      }).join("");
      excelRow += 2;
      return `<tr class="phase-title">
        <td class="${phaseClass}" colspan="12">${escapeExcelHtml(label)} | Actions: ${phaseActions.length} | Done: ${phaseDone} | Retard: ${phaseLate}</td>
      </tr>
      <tr class="header">
        <th>N</th><th>Action</th><th>Pilote / Responsable</th><th>Validateur</th><th>Date debut</th><th>Date fin</th><th># Jours</th><th>Date cloture</th><th>Statut</th><th>Priorite</th><th>Preuves / documents</th><th>Commentaires</th>
      </tr>
      ${rows}`;
    }).join("");

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Dossier Excel - ${escapeHtml(requestDisplayName(request))}</title><style>
    body{font-family:Calibri,Arial,sans-serif;color:#172008;margin:0;background:#fff}
    table{border-collapse:collapse;table-layout:fixed;width:1780px}
    col.c1{width:54px} col.c2{width:430px} col.c3{width:190px} col.c4{width:190px} col.c5{width:120px} col.c6{width:120px}
    col.c7{width:80px} col.c8{width:120px} col.c9{width:135px} col.c10{width:105px} col.c11{width:300px} col.c12{width:340px}
    td,th{border:1px solid #172008;padding:6px 8px;vertical-align:middle;font-size:10pt;line-height:1.25;white-space:normal;mso-number-format:"\\@";}
    .title{background:#172008;color:#fff;font-size:20pt;font-weight:700;text-align:center;height:42px}
    .subtitle{background:#5f7f13;color:#fff;font-size:12pt;font-weight:700;text-align:center}
    .meta-label{background:#e7f0dc;font-weight:700}
    .meta-value{background:#fbfcf8}
    .metric{background:#f7f9f1;text-align:center}
    .metric strong{display:block;font-size:18pt;color:#172008}
    .metric span{display:block;color:#5f7f13;font-size:9pt;font-weight:700;text-transform:uppercase}
    .phase-title td,.phase-title{color:#000;font-size:13pt;font-weight:700;height:28px;text-align:left}
    .phase-sage{background:#5f7f13;color:#fff}
    .header th{background:#c0b600;color:#fff;font-weight:700;text-align:center;height:28px}
    .action{text-align:left}.center{text-align:center}.date-cell{mso-number-format:"dd/mm/yyyy"}
    .action-row td{height:30px}
    .status-done{background:#5f7f13;color:#fff;text-align:center;font-weight:700}
    .status-late{background:#ff0202;color:#fff;text-align:center;font-weight:700}
    .status-open{background:#676267;color:#fff;text-align:center;font-weight:700}
    .status-cancelled{background:#ff0202;color:#fff;text-align:center;font-weight:700}
    .footer-title{background:#dce8ce;font-weight:700;text-align:center}
    .signature{height:34px}
  </style></head><body><table>
    <colgroup><col class="c1"><col class="c2"><col class="c3"><col class="c4"><col class="c5"><col class="c6"><col class="c7"><col class="c8"><col class="c9"><col class="c10"><col class="c11"><col class="c12"></colgroup>
    <tr><td class="title" colspan="12">DOSSIER EXCEL COMPLET - SAGE Automotive Interiors</td></tr>
    <tr><td class="subtitle" colspan="12">Tableau phase par phase des actions de la modification</td></tr>
    <tr><td class="meta-label" colspan="2">Modification</td><td class="meta-value" colspan="4">${escapeExcelHtml(requestDisplayName(request))}</td><td class="meta-label" colspan="2">Statut</td><td class="meta-value" colspan="4">${escapeExcelHtml(requestStatusLabel(request))}</td></tr>
    <tr><td class="meta-label" colspan="2">Client</td><td class="meta-value" colspan="4">${escapeExcelHtml(request.client || "-")}</td><td class="meta-label" colspan="2">Projet</td><td class="meta-value" colspan="4">${escapeExcelHtml(request.modificationProject || "-")}</td></tr>
    <tr><td class="meta-label" colspan="2">Produit</td><td class="meta-value" colspan="4">${escapeExcelHtml(request.product || "-")}</td><td class="meta-label" colspan="2">Produits finis</td><td class="meta-value" colspan="4">${escapeExcelHtml(request.finishedProducts || "-")}</td></tr>
    <tr><td class="meta-label" colspan="2">Pilote modification</td><td class="meta-value" colspan="4">${escapeExcelHtml(request.pilot || "-")}</td><td class="meta-label" colspan="2">SOP</td><td class="meta-value" colspan="4">${escapeExcelHtml(dossierDate(request.sopDate) || "-")}</td></tr>
    <tr><td class="meta-label" colspan="2">Date reception</td><td class="meta-value" colspan="4">${escapeExcelHtml(dossierDate(request.receptionDate) || "-")}</td><td class="meta-label" colspan="2">Extraction</td><td class="meta-value" colspan="4">${escapeExcelHtml(generatedAt)}</td></tr>
    <tr>
      <td class="metric" colspan="3"><span>Actions</span><strong>${sortedActions.length}</strong></td>
      <td class="metric" colspan="3"><span>Done</span><strong>${doneCount}</strong></td>
      <td class="metric" colspan="2"><span>Retard</span><strong>${lateCount}</strong></td>
      <td class="metric" colspan="2"><span>Preuves</span><strong>${proofCount}</strong></td>
      <td class="metric" colspan="2"><span>Avancement</span><strong>${completionRate}%</strong></td>
    </tr>
    <tr><td class="meta-label" colspan="2">Raison</td><td class="meta-value" colspan="10">${escapeExcelHtml(request.modificationReason || "-")}</td></tr>
    <tr><td class="meta-label" colspan="2">Detail</td><td class="meta-value" colspan="10">${escapeExcelHtml(request.modificationDetail || "-")}</td></tr>
    <tr><td colspan="12"></td></tr>
    ${phaseSections || `<tr><td colspan="12" class="center">Aucune action renseignee pour cette modification.</td></tr>`}
    <tr><td colspan="12"></td></tr>
    <tr><td class="footer-title" colspan="12">Synthese SAGE ECR - ${escapeExcelHtml(requestDisplayName(request))}</td></tr>
    <tr><td colspan="2">Revue dossier</td><td colspan="10">${escapeExcelHtml(request.dossierReview || "-")}</td></tr>
    <tr><td colspan="12"></td></tr>
  </table></body></html>`;
}

function professionalDossierPdfHtml(request, actions = [], phaseValidations = []) {
  const sortedActions = [...actions].sort((first, second) =>
    (String(first.stage || "").localeCompare(String(second.stage || ""), "fr", { sensitivity: "base" }))
      || (Number(first.id) || 0) - (Number(second.id) || 0)
  );
  const doneActions = sortedActions.filter(isActionDone).length;
  const lateActionsCount = sortedActions.filter((action) => actionGanttStatusClass(action) === "late").length;
  const proofCount = sortedActions.filter((action) => actionProofLabel(action)).length;
  const completionRate = modificationCompletionRate(request, sortedActions);
  const generatedAt = new Date().toLocaleString("fr-FR");
  const infoRows = [
    ["Numero modification", request.modificationNumber || requestDisplayName(request)],
    ["Client", request.client],
    ["Projet", request.modificationProject],
    ["Produit", request.product],
    ["Produits finis", request.finishedProducts],
    ["Pilote", request.pilot],
    ["Statut", requestStatusLabel(request)],
    ["Phase actuelle", stageLabel(request.currentStage, Boolean(request.newVersion))],
    ["Reception", formatDateOnly(request.receptionDate)],
    ["SOP", formatDateOnly(request.sopDate)],
    ["Cloture", formatDateOnly(request.closureDate)],
    ["Annulation", formatDateOnly(request.cancelledDate)],
    ["Type", modificationTypesLabel(request)],
    ["Mixabilite", mixabilityLabel(request.mixability)]
  ];
  const actionRows = sortedActions.map((action, index) => `<tr>
    <td>${index + 1}</td>
    <td><strong>${escapeHtml(action.title || "-")}</strong><span>${escapeHtml(action.comment || action.dossierReview || "")}</span></td>
    <td>${escapeHtml(stageLabel(action.stage, Boolean(request.newVersion)))}</td>
    <td>${escapeHtml(action.responsible || "-")}</td>
    <td>${escapeHtml(action.validatorDisplayName || action.validator || "-")}</td>
    <td>${escapeHtml(actionGanttStatusLabel(action))}</td>
    <td>${escapeHtml(formatDateOnly(action.deadline || action.endDate))}</td>
    <td>${escapeHtml(actionProofLabel(action) || "-")}</td>
  </tr>`).join("");
  const validationRows = phaseValidations.map((validation) => `<tr>
    <td>${escapeHtml(stageLabel(validation.stage, Boolean(request.newVersion)))}</td>
    <td>${escapeHtml(validation.status || "-")}</td>
    <td>${escapeHtml(validation.requestedBy || validation.validatorName || "-")}</td>
    <td>${escapeHtml(formatDateOnly(validation.requestedAt || validation.updatedAt || validation.createdAt))}</td>
    <td>${escapeHtml(validation.rejectionReason || validation.comment || "-")}</td>
  </tr>`).join("");
  const infoHtml = infoRows.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "-")}</strong></div>`).join("");
  const signatureDepartments = ["Pilote", "Engineering", "Qualite", "Logistique", "Finance", "Production"];
  const signatureHtml = signatureDepartments.map((department) => `<div class="signature-box"><strong>${escapeHtml(department)}</strong><span>Nom / Date</span><i>Signature</i></div>`).join("");

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Dossier ECR - ${escapeHtml(requestDisplayName(request))}</title><style>
    @page{size:A4 portrait;margin:12mm}
    *{box-sizing:border-box}
    html,body,.pdf-export-page,.cover,.metric,.info-grid div,.signature-box,th{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{margin:0;background:#eef2e8;color:#172008;font-family:Arial,sans-serif}
    .pdf-export-page{background:#fff;min-height:1120px;padding:30px;width:794px}
    .cover{display:grid;align-content:space-between;background:linear-gradient(135deg,#f7f9f1 0%,#ffffff 55%,#e7f0dc 100%);border:1px solid #cdd9bd}
    .brand{display:flex;align-items:center;gap:16px;border-bottom:4px solid #5f7f13;padding-bottom:18px}
    .brand img{height:58px;width:132px;object-fit:contain;background:#fff;border:1px solid #bfd0a3;border-radius:4px;padding:6px}
    .brand h1{font-family:Georgia,serif;font-size:36px;line-height:1.05;margin:0;text-transform:uppercase}
    .brand span{color:#5f7f13;font-weight:800;text-transform:uppercase}
    .cover-main{display:grid;gap:20px}
    .cover-title h2{font-size:28px;margin:0 0 8px}
    .cover-title p{color:#4b5563;font-size:14px;line-height:1.5;margin:0}
    .metrics{display:grid;gap:10px;grid-template-columns:repeat(4,1fr)}
    .metric{background:#172008;color:#fff;border-radius:6px;padding:12px}
    .metric span{display:block;color:#dce8ce;font-size:10px;font-weight:800;text-transform:uppercase}
    .metric strong{display:block;font-size:24px;margin-top:6px}
    .info-grid{display:grid;gap:8px;grid-template-columns:repeat(2,1fr)}
    .info-grid div{border:1px solid #d9e3c8;border-radius:6px;padding:10px;background:#fbfcf8}
    .info-grid span{display:block;color:#60704e;font-size:10px;font-weight:800;text-transform:uppercase}
    .info-grid strong{display:block;font-size:13px;margin-top:4px}
    h3{border-bottom:2px solid #5f7f13;font-size:18px;margin:0 0 12px;padding-bottom:8px}
    .section{display:grid;gap:14px}
    .text-block{border:1px solid #d9e3c8;border-radius:6px;padding:12px;min-height:80px}
    .text-block span{color:#60704e;display:block;font-size:10px;font-weight:800;text-transform:uppercase}
    .text-block p{font-size:13px;line-height:1.5;margin:6px 0 0;white-space:pre-wrap}
    table{border-collapse:collapse;width:100%;table-layout:fixed}
    th,td{border:1px solid #cbd5bd;font-size:10px;line-height:1.3;padding:6px;vertical-align:top;word-break:break-word}
    th{background:#5f7f13;color:#fff;text-align:left}
    td span{color:#60704e;display:block;font-size:9px;margin-top:3px}
    .signature-grid{display:grid;gap:10px;grid-template-columns:repeat(3,1fr)}
    .signature-box{border:1px solid #172008;border-radius:4px;min-height:96px;padding:10px}
    .signature-box span,.signature-box i{display:block;color:#60704e;font-size:11px;margin-top:14px}
    .footer{align-items:center;border-top:1px solid #d9e3c8;color:#60704e;display:flex;font-size:10px;justify-content:space-between;margin-top:auto;padding-top:10px}
  </style></head><body>
    <main class="pdf-export-page cover">
      <div class="brand"><img src="/sage_logo1.png" alt="SAGE Automotive Interiors"><div><span>Dossier ECR professionnel</span><h1>Dossier de modification</h1></div></div>
      <section class="cover-main">
        <div class="cover-title">
          <h2>${escapeHtml(requestDisplayName(request))}</h2>
          <p>${escapeHtml([request.client, request.modificationProject, request.product].filter(Boolean).join(" | ") || "Synthese dossier ECR")}</p>
        </div>
        <div class="metrics">
          <div class="metric"><span>Avancement</span><strong>${completionRate}%</strong></div>
          <div class="metric"><span>Actions</span><strong>${sortedActions.length}</strong></div>
          <div class="metric"><span>Done</span><strong>${doneActions}</strong></div>
          <div class="metric"><span>Retard</span><strong>${lateActionsCount}</strong></div>
        </div>
        <div class="info-grid">${infoHtml}</div>
      </section>
      <div class="footer"><span>Genere le ${escapeHtml(generatedAt)}</span><span>${escapeHtml(requestStatusLabel(request))}</span></div>
    </main>
    <main class="pdf-export-page section">
      <h3>Synthese modification</h3>
      <div class="text-block"><span>Raison de modification</span><p>${escapeHtml(request.modificationReason || "-")}</p></div>
      <div class="text-block"><span>Detail de modification</span><p>${escapeHtml(request.modificationDetail || "-")}</p></div>
      <div class="text-block"><span>Revue dossier</span><p>${escapeHtml(request.dossierReview || "-")}</p></div>
      <h3>Validations de phases</h3>
      <table><thead><tr><th>Phase</th><th>Statut</th><th>Responsable</th><th>Date</th><th>Commentaire</th></tr></thead><tbody>${validationRows || `<tr><td colspan="5">Aucune validation renseignee.</td></tr>`}</tbody></table>
      <div class="footer"><span>${escapeHtml(requestDisplayName(request))}</span><span>Synthese</span></div>
    </main>
    <main class="pdf-export-page section">
      <h3>Plan d'actions et preuves</h3>
      <table><thead><tr><th>N</th><th>Action</th><th>Phase</th><th>Resp.</th><th>Valid.</th><th>Statut</th><th>Echeance</th><th>Preuve</th></tr></thead><tbody>${actionRows || `<tr><td colspan="8">Aucune action renseignee.</td></tr>`}</tbody></table>
      <div class="metrics">
        <div class="metric"><span>Preuves</span><strong>${proofCount}</strong></div>
        <div class="metric"><span>Actions done</span><strong>${doneActions}</strong></div>
        <div class="metric"><span>Actions retard</span><strong>${lateActionsCount}</strong></div>
        <div class="metric"><span>Total</span><strong>${sortedActions.length}</strong></div>
      </div>
      <div class="footer"><span>${escapeHtml(requestDisplayName(request))}</span><span>Actions</span></div>
    </main>
    <main class="pdf-export-page section">
      <h3>Signatures</h3>
      <div class="signature-grid">${signatureHtml}</div>
      <div class="footer"><span>${escapeHtml(requestDisplayName(request))}</span><span>Signatures</span></div>
    </main>
  </body></html>`;
}

function parseDateOnly(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOnly(value) {
  const date = value instanceof Date ? value : parseDateOnly(value);
  return date ? new Intl.DateTimeFormat("fr-FR").format(date) : "-";
}

function daysBetween(start, end) {
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function startOfLocalDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function requestTimelineStart(request) {
  return parseDateOnly(request.receptionDate)
    || parseDateOnly(request.feasibilityValidationDate)
    || parseDateOnly(request.internalCostingDate)
    || parseDateOnly(request.internalVpValidationDate)
    || parseDateOnly(request.customerValidationDate)
    || parseDateOnly(request.ppapValidationDate)
    || parseDateOnly(request.closureDate)
    || parseDateOnly(request.cancelledDate)
    || new Date();
}

function requestTimelineEnd(request, startDate) {
  const today = new Date();
  const explicitEnd = parseDateOnly(request.sopDate)
    || parseDateOnly(request.closureDate)
    || parseDateOnly(request.cancelledDate);
  if (explicitEnd && explicitEnd >= startDate) return explicitEnd;
  const fallbackEnd = request.currentStage === "CLOSED" || request.currentStage === "CANCELLED"
    ? startDate
    : today > startDate ? today : addDays(startDate, 30);
  return fallbackEnd >= startDate ? fallbackEnd : startDate;
}

function actionTimelineStart(action, fallbackDate) {
  const deadline = parseDateOnly(action.deadline);
  const duration = Math.max(1, Number(action.workDurationDays) || 1);
  return parseDateOnly(action.startDate)
    || parseDateOnly(action.date1)
    || (deadline ? addDays(deadline, -duration) : null)
    || fallbackDate
    || new Date();
}

function actionTimelineEnd(action, startDate) {
  const explicitEnd = parseDateOnly(action.endDate)
    || parseDateOnly(action.deadline)
    || parseDateOnly(action.date3)
    || parseDateOnly(action.date2);
  if (explicitEnd && explicitEnd >= startDate) return explicitEnd;
  const duration = Math.max(1, Number(action.workDurationDays) || 1);
  return addDays(startDate, duration);
}

function actionGanttStatusClass(action) {
  if (action?.status === "CANCELLED") return "cancelled";
  if (isActionDone(action)) return "closed";
  const end = parseDateOnly(action.endDate) || parseDateOnly(action.deadline);
  return end && end < new Date() ? "late" : "planned";
}

function isCriticalActionValue(action) {
  return String(action?.criticality || "").startsWith("1");
}

function actionGanttStatusLabel(action) {
  if (action?.status === "CANCELLED") return "Annulée";
  if (isActionDone(action)) return "Done";
  return actionGanttStatusClass(action) === "late" ? "En retard" : "Planifié / à faire";
}

function actionGanttColor(action) {
  const status = actionGanttStatusClass(action);
  if (status === "cancelled") return "#6b7280";
  if (status === "closed") return "#25D366";
  if (status === "late") return "#b42318";
  return "#8a9275";
}

function ganttColorBarStyle(color) {
  return `background:${color};border-color:${color};color:${color}`;
}

function ganttScale(timelineStart, timelineEnd) {
  const totalDays = Math.max(1, daysBetween(timelineStart, timelineEnd));
  if (totalDays <= 45) {
    return Array.from({ length: totalDays + 1 }, (_, index) => {
      const date = addDays(timelineStart, index);
      return { date, label: date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) };
    });
  }
  if (totalDays <= 150) {
    const ticks = [];
    for (let offset = 0; offset <= totalDays; offset += 7) {
      const date = addDays(timelineStart, offset);
      ticks.push({ date, label: date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) });
    }
    if (ticks[ticks.length - 1]?.date < timelineEnd) {
      ticks.push({ date: timelineEnd, label: timelineEnd.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) });
    }
    return ticks;
  }
  const ticks = [];
  const cursor = new Date(timelineStart.getFullYear(), timelineStart.getMonth(), 1);
  if (cursor < timelineStart) cursor.setMonth(cursor.getMonth() + 1);
  ticks.push({ date: timelineStart, label: timelineStart.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }) });
  while (cursor < timelineEnd) {
    ticks.push({ date: new Date(cursor), label: cursor.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }) });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  ticks.push({ date: timelineEnd, label: timelineEnd.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }) });
  return ticks;
}

function ganttBarStyle(start, end, timelineStart, totalDays) {
  const left = Math.max(0, Math.min(100, (daysBetween(timelineStart, start) / totalDays) * 100));
  const width = Math.max(1, Math.min(100 - left, (Math.max(1, daysBetween(start, end)) / totalDays) * 100));
  return `left:${left}%;width:${width}%`;
}

function ganttStagesForRequest(request, selectedStages = []) {
  const baseStages = selectedStages.length > 0 ? selectedStages : stagesForRequest(request);
  const regularStages = baseStages.filter(([stage]) => stage !== "CANCELLED");
  if (request?.currentStage !== "CANCELLED") {
    return regularStages;
  }
  const cancelledFromStage = request.cancelledFromStage;
  const cancelledIndex = regularStages.findIndex(([stage]) => stage === cancelledFromStage);
  const visibleStages = cancelledIndex >= 0 ? regularStages.slice(0, cancelledIndex + 1) : regularStages;
  return [
    ...visibleStages,
    ["CANCELLED", stageLabel("CANCELLED", Boolean(request?.newVersion))]
  ];
}

function filterGanttActionsForRequest(request, actions = [], selectedStages = []) {
  const allowedStages = new Set(ganttStagesForRequest(request, selectedStages).map(([stage]) => stage));
  return actions.filter((action) => {
    const stage = action.stage || request?.currentStage || "FEASIBILITY_VALIDATION";
    return allowedStages.has(stage);
  });
}

async function downloadHtmlAsPdf(fileName, html, options = {}) {
  const orientation = options.orientation || "landscape";
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = options.width || "1280px";
  host.style.background = "#ffffff";
    host.innerHTML = html;
    document.body.appendChild(host);
    try {
      const element = host.querySelector(".pdf-export-page") || host.querySelector(".gantt-export-page") || host;
      const images = Array.from(host.querySelectorAll("img"));
      await inlinePdfImages(images);
      await Promise.all(images.map((image) => image.complete ? Promise.resolve() : new Promise((resolve) => {
        image.onload = resolve;
        image.onerror = resolve;
      })));
      const pages = Array.from(host.querySelectorAll(".pdf-export-page"));
      if (pages.length > 1) {
        await saveHtmlPagesAsPdf(fileName, pages, { ...options, orientation });
        return;
      }
      const canvas = await html2canvas(element, {
      backgroundColor: options.backgroundColor || "#f7f9f1",
      scale: 2,
      useCORS: true
    });
    const pdf = new jsPDF({ orientation, unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 18;
    const imageWidth = pageWidth - margin * 2;
    const imageHeight = (canvas.height * imageWidth) / canvas.width;
    const pageImageHeight = pageHeight - margin * 2;
    const pageCanvasHeight = Math.max(1, Math.floor((pageImageHeight * canvas.width) / imageWidth));
    let sourceY = 0;
    let pageIndex = 0;
    while (sourceY < canvas.height) {
      const sliceHeight = Math.min(pageCanvasHeight, canvas.height - sourceY);
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const context = pageCanvas.getContext("2d");
      context.drawImage(
        canvas,
        0,
        sourceY,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight
      );
      const sliceImageHeight = (sliceHeight * imageWidth) / canvas.width;
      if (pageIndex > 0) pdf.addPage("a4", orientation);
      pdf.addImage(pageCanvas.toDataURL("image/png"), "PNG", margin, margin, imageWidth, sliceImageHeight);
      sourceY += sliceHeight;
      pageIndex += 1;
    }
    pdf.save(fileName);
  } finally {
    host.remove();
  }
}

async function saveHtmlPagesAsPdf(fileName, pages, options = {}) {
  const orientation = options.orientation || "portrait";
  const pdf = new jsPDF({ orientation, unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 18;
  for (let index = 0; index < pages.length; index += 1) {
    const canvas = await html2canvas(pages[index], {
      backgroundColor: options.backgroundColor || "#f7f9f1",
      scale: 2,
      useCORS: true
    });
    const imageWidth = pageWidth - margin * 2;
    const imageHeight = Math.min(pageHeight - margin * 2, (canvas.height * imageWidth) / canvas.width);
    if (index > 0) {
      pdf.addPage("a4", orientation);
    }
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin, imageWidth, imageHeight);
  }
  pdf.save(fileName);
}

async function inlinePdfImages(images = []) {
  await Promise.all(images.map(async (image) => {
    const source = image.getAttribute("src") || "";
    if (!source || source.startsWith("data:")) {
      return;
    }
    try {
      const response = await fetch(new URL(source, window.location.href).toString());
      if (!response.ok) {
        return;
      }
      const blob = await response.blob();
      const dataUrl = await blobToDataUrl(blob);
      image.setAttribute("src", dataUrl);
    } catch {
      // Keep the original URL if the browser cannot inline it.
    }
  }));
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function modificationGanttPdfHtml(request, actions = [], selectedStages = [], progressSummary = null) {
  const fallbackStart = requestTimelineStart(request);
  const ganttStages = ganttStagesForRequest(request, selectedStages);
  const filteredActions = filterGanttActionsForRequest(request, actions, selectedStages);
  const allModificationActions = filterGanttActionsForRequest(request, actions, stagesForRequest(request));
  const actionRows = filteredActions
    .map((action) => {
      const start = actionTimelineStart(action, fallbackStart);
      const end = actionTimelineEnd(action, start);
      return { action, start, end };
    })
    .sort((first, second) => first.start - second.start || String(first.action.title || "").localeCompare(String(second.action.title || ""), "fr", { sensitivity: "base" }));
  const requestEnd = requestTimelineEnd(request, fallbackStart);
  const minDate = actionRows.reduce((min, row) => row.start < min ? row.start : min, fallbackStart);
  const maxDate = actionRows.reduce((max, row) => row.end > max ? row.end : max, requestEnd);
  const timelineStart = addDays(minDate, -2);
  const timelineEnd = addDays(maxDate, 3);
  const totalDays = Math.max(1, daysBetween(timelineStart, timelineEnd));
  const ticks = ganttScale(timelineStart, timelineEnd);
  const gridStep = 100 / Math.max(1, ticks.length);
  const stageOrder = new Map(ganttStages.map(([key], index) => [key, index]));
  const groupedRows = actionRows.reduce((groups, row) => {
    const stage = row.action.stage || request.currentStage || "FEASIBILITY_VALIDATION";
    if (!groups.has(stage)) groups.set(stage, []);
    groups.get(stage).push(row);
    return groups;
  }, new Map());
  const sortedStages = ganttStages.length > 0
    ? ganttStages.map(([key]) => key)
    : Array.from(groupedRows.keys()).sort((first, second) => (stageOrder.get(first) ?? 99) - (stageOrder.get(second) ?? 99));
  const computedDoneCount = allModificationActions.filter(isActionDone).length;
  const progressTotalActions = Number(progressSummary?.totalActions);
  const progressDoneActions = Number(progressSummary?.doneActions);
  const progressRate = Number(progressSummary?.progress);
  const globalActionCount = Number.isFinite(progressTotalActions) ? progressTotalActions : allModificationActions.length;
  const doneCount = Number.isFinite(progressDoneActions) ? progressDoneActions : computedDoneCount;
  const completionRate = Math.max(0, Math.min(100, Math.round(Number.isFinite(progressRate) ? progressRate : modificationCompletionRate(request, allModificationActions))));
  const lateCount = actionRows.filter(({ action }) => actionGanttStatusClass(action) === "late").length;
  const criticalCount = actionRows.filter(({ action }) => isCriticalActionValue(action)).length;
  const stagePages = [];
  let currentPageRows = [];
  const maxRowsPerPage = 12;
  const pushCurrentGanttPage = () => {
    if (currentPageRows.length > 0) {
      stagePages.push(currentPageRows);
      currentPageRows = [];
    }
  };
  const pushGanttRows = (rows) => {
    if (currentPageRows.length + rows.length > maxRowsPerPage) {
      pushCurrentGanttPage();
    }
    currentPageRows.push(...rows);
  };
  sortedStages.forEach((stage) => {
    const stageRows = (groupedRows.get(stage) || []).sort((first, second) => first.start - second.start);
    const stageStart = stageRows.reduce((min, row) => row.start < min ? row.start : min, stageRows[0]?.start || null);
    const stageEnd = stageRows.reduce((max, row) => row.end > max ? row.end : max, stageRows[0]?.end || null);
    const phaseBar = stageStart && stageEnd
      ? `<span class="phase-bar" style="${ganttBarStyle(stageStart, stageEnd, timelineStart, totalDays)}"></span>`
      : "";
    const phaseRow = `<div class="gantt-row phase-row">
        <div class="left activity">${escapeHtml(stageLabel(stage, Boolean(request.newVersion)))}</div>
        <div class="left date">${escapeHtml(stageStart ? formatDateOnly(stageStart) : "-")}</div>
        <div class="left date">${escapeHtml(stageEnd ? formatDateOnly(stageEnd) : "-")}</div>
        <div class="timeline">${phaseBar}</div>
      </div>`;
    const actionRowHtml = stageRows.map(({ action, start, end }) => {
        const assignee = action.responsible || "Responsable";
        const actionColor = actionGanttColor(action);
        const critical = isCriticalActionValue(action);
        const criticalText = critical ? " | Criticité: Critique" : "";
        const barClass = `${actionGanttStatusClass(action)}${critical ? " critical-action" : ""}`;
        return `<div class="gantt-row">
          <div class="left activity"><strong>${escapeHtml(action.title || `Action ${action.id || ""}`)}</strong><span>Statut: ${escapeHtml(actionGanttStatusLabel(action))}${escapeHtml(criticalText)} | Pilote: ${escapeHtml(assignee)} | Validateur: ${escapeHtml(action.validatorDisplayName || action.validator || "Validateur")}</span></div>
          <div class="left date">${escapeHtml(formatDateOnly(start))}</div>
          <div class="left date">${escapeHtml(formatDateOnly(end))}</div>
          <div class="timeline"><span class="bar ${barClass}" style="${ganttBarStyle(start, end, timelineStart, totalDays)};${ganttColorBarStyle(actionColor)}"></span></div>
        </div>`;
      });
    if (actionRowHtml.length === 0) {
      pushGanttRows([phaseRow]);
      return;
    }
    for (let index = 0; index < actionRowHtml.length;) {
      if (currentPageRows.length > maxRowsPerPage - 2) {
        pushCurrentGanttPage();
      }
      const availableActionRows = Math.max(1, maxRowsPerPage - currentPageRows.length - 1);
      const actionChunk = actionRowHtml.slice(index, index + availableActionRows);
      pushGanttRows([phaseRow, ...actionChunk]);
      index += actionChunk.length;
      if (index < actionRowHtml.length) {
        pushCurrentGanttPage();
      }
    }
  });
  pushCurrentGanttPage();
  if (stagePages.length === 0) {
    stagePages.push([]);
  }
  const tickColumns = `repeat(${Math.max(1, ticks.length)}, 1fr)`;
  const tableHeadHtml = `<div class="gantt-row gantt-head"><div class="left">Activites</div><div class="left">Deb</div><div class="left">Fin</div><div class="timeline">${ticks.map((tick) => `<span class="tick">${escapeHtml(tick.label)}</span>`).join("")}</div></div>`;
  const legendHtml = `<div class="legend"><span><i style="${ganttColorBarStyle("#8a9275")}"></i>Planifié / à faire</span><span><i style="${ganttColorBarStyle("#25D366")}"></i>Done</span><span><i style="${ganttColorBarStyle("#b42318")}"></i>En retard</span><span><i style="${ganttColorBarStyle("#6b7280")}"></i>Annulée</span><span><i class="critical-legend" style="${ganttColorBarStyle("#8a9275")}"></i>Critique: orange + statut</span></div>`;
  const pageHtml = stagePages.map((pageRows, pageIndex) => `<main class="pdf-export-page gantt-export-page">
    <header>
      <div class="brand-block"><img class="gantt-logo" src="/sage_logo1.png" alt="SAGE Automotive Interiors" /><div><h1>DIAGRAMME <span>DE GANTT</span></h1><div class="meta">${escapeHtml(requestDisplayName(request))} | Projet: ${escapeHtml(request.modificationProject || "-")} | Client: ${escapeHtml(request.client || "-")} | Produit: ${escapeHtml(request.product || "-")} | Pilote: ${escapeHtml(request.pilot || "-")}<br>Extraction: ${escapeHtml(new Date().toLocaleString("fr-FR"))} | Periode: ${escapeHtml(formatDateOnly(timelineStart))} - ${escapeHtml(formatDateOnly(timelineEnd))} | Avancement global actuel: ${completionRate}%</div></div></div>
      <div class="summary"><span>Actions globales: ${globalActionCount}</span><span>Actions affichees: ${actionRows.length}</span><span>Done global: ${doneCount}</span><span>En retard: ${lateCount}</span><span>Critiques: ${criticalCount}</span><span>Phase: ${escapeHtml(stageLabel(request.currentStage, Boolean(request.newVersion)))}</span><span class="progress-summary"><span class="progress-line"><b class="progress-label">Avancement global actuel: ${completionRate}%</b><i class="progress-track"><i class="progress-fill"></i></i></span></span></div>
    </header>
    <section class="gantt-table">
      ${tableHeadHtml}
      ${actionRows.length === 0 ? `<div class="empty">Aucune action planifiee pour cette modification.</div>` : pageRows.join("")}
    </section>
    <footer class="gantt-footer">
      ${legendHtml}
      <span class="page-number">Page ${pageIndex + 1} / ${stagePages.length}</span>
    </footer>
  </main>`).join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Gantt - ${escapeHtml(requestDisplayName(request))}</title><style>
    @page{size:A4 landscape;margin:10mm}
    *{box-sizing:border-box}
    html,body,.gantt-table,.timeline,.left,.bar,.phase-bar,.legend i{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{font-family:Arial,sans-serif;color:#172008;margin:0;background:#ffffff}
    .gantt-export-page{background:#f7f9f1;display:flex;flex-direction:column;min-height:860px;padding:14px;width:1280px}
    header{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:10px;background:#fff;padding:0 0 8px;border-bottom:3px solid #5f7f13}
    .brand-block{display:flex;align-items:flex-start;gap:14px}
    .gantt-logo{display:block;height:54px;width:126px;object-fit:contain;border:1px solid #bfd0a3;border-radius:4px;padding:5px;background:#fff}
    h1{font-family:Georgia,serif;font-size:28px;margin:0 0 4px;text-transform:uppercase}
    h1 span{color:#5f7f13}
    .meta{font-size:11px;color:#586148;line-height:1.45}
    .summary{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    .summary>span{border:1px solid #bfd0a3;padding:5px 8px;font-size:11px;background:#f7f9f1}
    .summary .progress-summary{flex-basis:100%;background:#fff}
    .progress-line{display:flex;align-items:center;gap:8px}
    .progress-label{font-weight:700;color:#172008;white-space:nowrap}
    .progress-track{flex:1;min-width:150px;height:8px;border:1px solid #bfd0a3;background:#eef4e2}
    .progress-fill{display:block;height:100%;background:#5f7f13;width:${completionRate}%}
    .gantt-table{background:#fff;border:1px solid #5f7f13}
    .gantt-row{display:grid;grid-template-columns:260px 84px 84px minmax(760px,1fr);min-height:43px;break-inside:avoid}
    .gantt-head{min-height:34px;background:#5f7f13;color:#fff;font-weight:700}
    .left{border-right:1px solid #d9e3c8;border-bottom:1px solid #d9e3c8;padding:6px 8px;background:#fff}
    .gantt-head .left{background:#5f7f13;border-right:1px solid #cddaaf;border-bottom:0;font-size:12px}
    .activity{font-size:12px}
    .activity strong{display:block;font-weight:700}
    .activity span{display:block;font-size:9.5px;color:#586148;margin-top:2px;white-space:normal;overflow:visible;text-overflow:clip;line-height:1.25;overflow-wrap:anywhere}
    .date{text-align:center;font-size:11px;white-space:nowrap}
    .timeline{position:relative;border-bottom:1px solid #d9e3c8;background-color:#f7f9f1;background-image:linear-gradient(to right,#d9e3c8 1px,transparent 1px);background-size:${gridStep}% 100%}
    .gantt-head .timeline{display:grid;grid-template-columns:${tickColumns};background:#5f7f13;border-bottom:0}
    .tick{border-left:1px solid #cddaaf;padding:7px 4px;text-align:center;font-size:10px;white-space:nowrap}
    .phase-row .left{background:#edf3df;font-weight:700}
    .phase-row .timeline{background:#f1f6e8}
    .phase-bar{position:absolute;top:14px;height:0;border-top:12px solid #5f7f13;background:#5f7f13;border-radius:2px;opacity:.95}
    .bar{position:absolute;top:13px;height:16px;border:1px solid;border-radius:1px;min-width:4px}
    .bar.late{box-shadow:0 0 0 2px #7f1d1d}
    .bar.critical-action::after{background:#c98a2c;bottom:0;content:"";position:absolute;right:0;top:0;width:38%}
    .gantt-footer{margin-top:auto}
    .legend{display:grid;grid-template-columns:repeat(5,1fr);gap:8px 18px;margin-top:10px;padding:8px;background:#fff;border-top:1px solid #5f7f13;font-size:11px}
    .legend span{display:flex;align-items:center;gap:8px;font-weight:700}
    .legend i{display:inline-block;width:34px;height:14px;border:1px solid}
    .legend i.critical-legend{background:linear-gradient(to right,#8a9275 0 62%,#c98a2c 62% 100%) !important}
    .page-number{color:#586148;display:block;font-size:11px;font-weight:700;margin-top:6px;text-align:right}
    .empty{padding:24px;text-align:center;color:#586148;background:#fff}
  </style></head><body>${pageHtml}</body></html>`;
}

function downloadTextFile(fileName, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadBlobFile(fileName, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function isAdminUser(user) {
  const role = normalizeRoleToken(user?.role);
  return hasApplicationRole(user, "ADMIN", "Admin")
    || role === "administrateur"
    || normalizeRoleToken(user?.username) === "fchelbi"
    || normalizeRoleToken(user?.email) === "f.chalbi@sagetunisia.com";
}

function canValidatePhases(user) {
  return isAdminUser(user) || hasApplicationRole(user, "MANAGER", "Manager");
}

function canSeeAllActionsForUser(user, request) {
  return isAdminUser(user) || isRequestPilot(user, request);
}

function normalizeRoleToken(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replaceAll("_", " ");
}

function hasApplicationRole(user, code, label) {
  const value = normalizeRoleToken(user?.role).replaceAll("_", " ");
  return value === normalizeRoleToken(code).replaceAll("_", " ") || value === normalizeRoleToken(label);
}

function canManageActionForUser(user, action, phaseValidations = [], request = action?.request) {
  if (isTerminalRequest(request)) return false;
  if (request?.currentStage === "CANCELLED" && action?.stage !== "CANCELLED") return false;
  if (isActionPhaseApproved(action, phaseValidations)) return false;
  return canManageActionAssignmentForUser(user, action);
}

function canManageActionAssignmentForUser(user, action) {
  if (isAdminUser(user)) return true;
  const responsible = normalizeRoleToken(action?.responsible);
  if (!responsible) return false;
  return [user?.jobTitle, user?.fullName, user?.username, user?.email]
    .filter(Boolean)
    .some((value) => normalizeRoleToken(value) === responsible);
}

function isActionPilotForUser(user, action) {
  const responsible = normalizeRoleToken(action?.responsible);
  if (!responsible) return false;
  return [user?.jobTitle, user?.fullName, user?.username, user?.email, user?.role]
    .filter(Boolean)
    .some((value) => normalizeRoleToken(value) === responsible);
}

function canValidateActionForUser(user, action) {
  if (!user || !action) return false;
  const validators = [action.validator, action.validatorRole, action.validatorDisplayName]
    .map(normalizeRoleToken)
    .filter((value) => value && !isUndefinedValidatorToken(value));
  if (validators.length === 0) return isAdminUser(user);
  return validators.some((validator) => userMatchesAssignment(user, validator));
}

function isUndefinedValidatorToken(value) {
  const token = normalizeRoleToken(value);
  return token === "validateur a definir" || token === "a definir";
}

function isActionAwaitingValidation(action, phaseValidation) {
  return phaseValidation?.status === "PENDING" && action?.validationStatus === "PENDING";
}

function canRequestRejectedActionValidationForUser(user, action, request) {
  return action?.validationStatus === "REJECTED"
    && isActionDone(action)
    && (isRequestPilot(user, request) || isActionPilotForUser(user, action));
}

function canToggleActionForUser(user, action, request, phaseValidations = []) {
  if (isTerminalRequest(request)) return false;
  if (request?.currentStage === "CANCELLED" && action?.stage !== "CANCELLED") return false;
  if (isActionPhaseApproved(action, phaseValidations)) return false;
  if (!isActionPilotForUser(user, action)) return false;
  return !isActionDone(action) || action?.stage === request?.currentStage;
}

function isActionPhaseApproved(action, phaseValidations = []) {
  return phaseValidations.find((validation) => validation.stage === action?.stage)?.status === "APPROVED";
}

function canDeleteActionInPhase(action, phaseValidations = []) {
  if (!isActionPhaseApproved(action, phaseValidations)) return true;
  return !isActionDone(action) && action?.validationStatus !== "APPROVED";
}

function canDeleteActionForUser(user, action, request, phaseValidations = []) {
  if (isTerminalRequest(request)) return false;
  if (request?.currentStage === "CANCELLED" && action?.stage !== "CANCELLED") return false;
  if (!canDeleteActionInPhase(action, phaseValidations)) return false;
  if (isAdminUser(user)) return true;
  return isRequestPilot(user, request) || canManageActionAssignmentForUser(user, action);
}

function canEditActionDurationForUser(user, action, request, phaseValidations = []) {
  if (!isRequestPilot(user, request)) return false;
  if (request?.currentStage === "CLOSED") return false;
  if (request?.currentStage === "CANCELLED" && action?.stage !== "CANCELLED") return false;
  return !isActionPhaseApproved(action, phaseValidations);
}

function blockingActionFor(action, actions = []) {
  if (!action?.dependsOnActionId) return null;
  return actions.find((item) => item.id === action.dependsOnActionId) || null;
}

function actionCreatedTime(action) {
  const time = Date.parse(action?.createdAt || "");
  return Number.isNaN(time) ? null : time;
}

function actionPlanningTime(action) {
  const time = Date.parse(action?.startDate || action?.endDate || action?.deadline || "");
  return Number.isNaN(time) ? null : time;
}

function compareActionDisplayOrder(first, second) {
  const firstPlanningTime = actionPlanningTime(first);
  const secondPlanningTime = actionPlanningTime(second);
  if (firstPlanningTime !== null && secondPlanningTime !== null && firstPlanningTime !== secondPlanningTime) {
    return firstPlanningTime - secondPlanningTime;
  }
  if (firstPlanningTime !== null && secondPlanningTime === null) return -1;
  if (firstPlanningTime === null && secondPlanningTime !== null) return 1;
  const firstTime = actionCreatedTime(first);
  const secondTime = actionCreatedTime(second);
  if (firstTime !== null && secondTime !== null && firstTime !== secondTime) {
    return firstTime - secondTime;
  }
  return (Number(first?.id) || 0) - (Number(second?.id) || 0);
}

function actionOrderNumber(action, actions = []) {
  const orderedActions = [...actions].sort(compareActionDisplayOrder);
  const index = orderedActions.findIndex((item) => item.id === action?.id);
  return index >= 0 ? index + 1 : null;
}

function blockingActionLabel(action, actions = []) {
  if (!action?.dependsOnActionId) return "Aucune";
  const dependency = blockingActionFor(action, actions);
  const dependencyOrder = actionOrderNumber(dependency, actions);
  const prefix = dependencyOrder ? `Action ${dependencyOrder}` : `Action #${action.dependsOnActionId}`;
  return dependency?.title ? `${prefix}: ${dependency.title}` : prefix;
}

function isRequestPilot(user, request) {
  const pilot = normalizeRoleToken(request?.pilot);
  if (!pilot) return false;
  return [user?.fullName, user?.username, user?.email, user?.jobTitle, user?.role]
    .filter(Boolean)
    .some((value) => normalizeRoleToken(value) === pilot);
}

function userMatchesAssignment(user, assignment) {
  const token = normalizeRoleToken(assignment);
  if (!token || !user) return false;
  const exactMatch = [user.jobTitle, user.fullName, user.username, user.email, user.role]
    .filter(Boolean)
    .some((value) => normalizeRoleToken(value) === token);
  if (exactMatch) return true;
  if (token.length < 3) return false;
  return [user.fullName, user.username, String(user.email || "").split("@")[0]]
    .filter(Boolean)
    .some((value) => normalizeRoleToken(value).split(/\s+/).includes(token));
}

function isActionParticipantForUser(user, action) {
  if (isAdminUser(user)) return true;
  return userMatchesAssignment(user, action?.responsible)
    || userMatchesAssignment(user, action?.validator)
    || userMatchesAssignment(user, action?.validatorRole)
    || userMatchesAssignment(user, action?.validatorDisplayName);
}

function isRequestParticipantForUser(user, request, actions = []) {
  if (isAdminUser(user)) return true;
  return isRequestPilot(user, request) || actions.some((action) => isActionParticipantForUser(user, action));
}

function firstActionParticipantStage(user, actions = []) {
  return actions.find((action) => isActionParticipantForUser(user, action))?.stage || null;
}

function isImageAsset(contentType, url) {
  const type = String(contentType || "").toLowerCase();
  if (type) return type.startsWith("image/");
  return /\.(apng|avif|bmp|gif|jpe?g|png|svg|webp)(\?|#|$)/i.test(String(url || ""));
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || "").trim());
}

function isValidPhone(value) {
  const text = String(value || "").trim();
  return !text || /^\+?[0-9\s().-]{8,20}$/.test(text);
}

function App() {
  const [authSession, setAuthSession] = useState(getStoredSession());
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [passwordResetStep, setPasswordResetStep] = useState("login");
  const [passwordResetEmail, setPasswordResetEmail] = useState("");
  const [passwordResetCode, setPasswordResetCode] = useState(["", "", "", ""]);
  const [passwordResetForm, setPasswordResetForm] = useState({ password: "", confirmation: "" });
  const [page, setPage] = useState(pageFromPath());
  const [menuCollapsed, setMenuCollapsed] = useState(false);
  const [requests, setRequests] = useState([]);
  const [pilots, setPilots] = useState([]);
  const [projects, setProjects] = useState([]);
  const [clientReferences, setClientReferences] = useState([]);
  const [productReferences, setProductReferences] = useState([]);
  const [finishedProductReferences, setFinishedProductReferences] = useState([]);
  const [roleReferences, setRoleReferences] = useState([]);
  const [planningRules, setPlanningRules] = useState([]);
  const [actionSuggestions, setActionSuggestions] = useState([]);
  const [users, setUsers] = useState([]);
  const [chatUsers, setChatUsers] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [selectedChatUserId, setSelectedChatUserId] = useState(null);
  const [chatDraft, setChatDraft] = useState("");
  const [chatFile, setChatFile] = useState(null);
  const [chatSending, setChatSending] = useState(false);
  const [chatGroupFormOpen, setChatGroupFormOpen] = useState(false);
  const [chatGroupName, setChatGroupName] = useState("");
  const [chatGroupProjectName, setChatGroupProjectName] = useState("");
  const [chatGroupMemberIds, setChatGroupMemberIds] = useState([]);
  const [quickChatOpen, setQuickChatOpen] = useState(false);
  const [quickAskAiOpen, setQuickAskAiOpen] = useState(false);
  const [chatNotificationCount, setChatNotificationCount] = useState(0);
  const [chatTypingNotice, setChatTypingNotice] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditQuery, setAuditQuery] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedStage, setSelectedStage] = useState("FEASIBILITY_VALIDATION");
  const [checklist, setChecklist] = useState([]);
  const [actions, setActions] = useState([]);
  const [actionsByRequestId, setActionsByRequestId] = useState({});
  const [phaseValidations, setPhaseValidations] = useState([]);
  const [ecrForm, setEcrForm] = useState(emptyEcrForm);
  const [ecrEditForm, setEcrEditForm] = useState(emptyEcrForm);
  const [actionForm, setActionForm] = useState(emptyActionForm);
  const [projectForm, setProjectForm] = useState({ name: "", projectTeam: "" });
  const [clientReferenceForm, setClientReferenceForm] = useState({ name: "" });
  const [productReferenceForm, setProductReferenceForm] = useState({ name: "" });
  const [finishedProductReferenceForm, setFinishedProductReferenceForm] = useState(emptyFinishedProductForm);
  const [roleReferenceForm, setRoleReferenceForm] = useState({ name: "" });
  const [planningRuleForm, setPlanningRuleForm] = useState(emptyPlanningRuleForm);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [profileForm, setProfileForm] = useState(emptyUserForm);
  const [passwordForm, setPasswordForm] = useState({ password: "", confirmation: "" });
  const [editingPlanningRule, setEditingPlanningRule] = useState(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const notifiedSuggestionIds = useRef(new Set());
  const [editingProject, setEditingProject] = useState(null);
  const [editingEcrRequest, setEditingEcrRequest] = useState(null);
  const [editingClientReference, setEditingClientReference] = useState(null);
  const [editingProductReference, setEditingProductReference] = useState(null);
  const [editingFinishedProductReference, setEditingFinishedProductReference] = useState(null);
  const [editingRoleReference, setEditingRoleReference] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [requestTypeFilter, setRequestTypeFilter] = useState("");
  const [requestArchiveView, setRequestArchiveView] = useState("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const chatFileInputRef = useRef(null);
  const chatTypingSentAt = useRef(0);
  const chatTypingStopTimer = useRef(null);
  const chatTypingClearTimer = useRef(null);
  const realtimeRefreshTimer = useRef(null);
  const selectedDetailsRequestId = useRef(0);

  const selectedRequest = requests.find((request) => request.id === selectedId);
  const selectedStages = useMemo(() => {
    return stagesForRequest(selectedRequest);
  }, [selectedRequest]);
  const visibleStages = useMemo(() => {
    if (!selectedRequest || isAdminUser(currentUser)) return selectedStages;
    const approvedStages = new Set(phaseValidations
      .filter((validation) => validation.status === "APPROVED")
      .map((validation) => validation.stage)
      .filter(Boolean));
    const currentStage = selectedRequest.currentStage;
    return selectedStages.filter(([key]) => key === currentStage || approvedStages.has(key));
  }, [currentUser, phaseValidations, selectedRequest, selectedStages]);
  const waitingForClosedParticipantActions = Boolean(
    selectedRequest &&
    !isAdminUser(currentUser) &&
    isClosedRequest(selectedRequest) &&
    !Object.prototype.hasOwnProperty.call(actionsByRequestId, selectedRequest.id)
  );
  const canLoadSelectedStage = !waitingForClosedParticipantActions && visibleStages.some(([key]) => key === selectedStage);
  const activeRequests = useMemo(() => requests.filter(isActiveRequest), [requests]);
  const visibleActions = useMemo(() => (
    canSeeAllActionsForUser(currentUser, selectedRequest) ? actions : actions.filter((action) => isActionParticipantForUser(currentUser, action))
  ), [actions, currentUser, selectedRequest]);
  const doneCount = actions.filter(isActionDone).length;
  const completion = modificationCompletionRate(selectedRequest, actions);
  const lateActions = actions.filter((action) => action.late).length;

  const filteredRequests = useMemo(() => {
    const normalized = normalizeSearchText(query);
    const canAdmin = isAdminUser(currentUser);
    return requests.filter((request) => {
      if (!requestMatchesView(request, requestArchiveView, canAdmin)) return false;
      if (!canAdmin && !isRequestParticipantForUser(currentUser, request, actionsByRequestId[request.id] || [])) return false;
      const matchesProject = !projectFilter || request.modificationProject === projectFilter;
      const matchesType = !requestTypeFilter
        || (requestTypeFilter === "new-project" ? Boolean(request.newVersion) : !request.newVersion);
      const matchesSearch = !normalized || [request.client, request.product, request.modificationProject, request.modificationNumber, request.modificationReason, request.modificationDetail, request.dossierReview, request.pilot]
        .filter(Boolean)
        .some((value) => normalizeSearchText(value).includes(normalized));
      return matchesProject && matchesType && matchesSearch;
    });
  }, [actionsByRequestId, currentUser, requests, query, projectFilter, requestArchiveView, requestTypeFilter]);

  const requestSearchSuggestions = useMemo(() => {
    const normalized = normalizeSearchText(query);
    if (!normalized) return [];
    const exactOrPrefix = [];
    const contains = [];
    for (const request of filteredRequests) {
      const label = requestDisplayName(request);
      const normalizedLabel = normalizeSearchText(label);
      const item = { request, label };
      if (normalizedLabel === normalized || normalizedLabel.startsWith(normalized)) {
        exactOrPrefix.push(item);
      } else if (normalizedLabel.includes(normalized)) {
        contains.push(item);
      }
    }
    return [...exactOrPrefix, ...contains].slice(0, 8);
  }, [filteredRequests, query]);

  useEffect(() => {
    if (!currentUser || filteredRequests.length === 0) return;
    if (selectedId && filteredRequests.some((request) => request.id === selectedId)) return;
    const nextRequest = filteredRequests[0];
    const participantStage = firstActionParticipantStage(currentUser, actionsByRequestId[nextRequest.id] || []);
    setSelectedId(nextRequest.id);
    setSelectedStage(safeStage(participantStage || nextRequest.currentStage, Boolean(nextRequest.newVersion)));
  }, [actionsByRequestId, currentUser, filteredRequests, selectedId]);

  const projectOptions = useMemo(() => {
    const requestProjectNames = requests.map((request) => request.modificationProject);
    const names = isAdminUser(currentUser)
      ? [
        ...projects.map((project) => project.name),
        ...requestProjectNames
      ]
      : requestProjectNames;
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [currentUser, projects, requests]);
  const clientOptions = useMemo(
    () => uniqueSorted(clientReferences.map((client) => client.name)),
    [clientReferences]
  );
  const productOptions = useMemo(
    () => uniqueSorted(productReferences.map((product) => product.name)),
    [productReferences]
  );
  const actionRoleOptions = useMemo(
    () => uniqueSorted([
      ...userRoleOptions.map(([, label]) => label),
      ...roleReferences.map((role) => role.name)
    ]),
    [roleReferences]
  );

  useEffect(() => {
    if (!projectFilter || projectOptions.includes(projectFilter)) {
      return;
    }
    setProjectFilter("");
  }, [projectFilter, projectOptions]);

  useEffect(() => {
    if (!currentUser || isAdminUser(currentUser)) {
      setActionsByRequestId({});
      return undefined;
    }
    const requestIds = requests
      .filter((request) => !request.archived && request.id)
      .map((request) => request.id)
      .sort((first, second) => Number(first) - Number(second));
    if (requestIds.length === 0) {
      setActionsByRequestId({});
      return undefined;
    }
    let active = true;
    Promise.all(requestIds.map((requestId) =>
      getActions(requestId)
        .then((items) => [requestId, Array.isArray(items) ? items : []])
        .catch(() => [requestId, []])
    )).then((entries) => {
      if (!active) return;
      setActionsByRequestId(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
  }, [currentUser, requests]);

  useEffect(() => {
    if (isAdminUser(currentUser) || requestArchiveView !== "archived") {
      return;
    }
    setRequestArchiveView("all");
  }, [currentUser, requestArchiveView]);

  const dashboardStats = useMemo(() => {
    const visibleRequests = requests.filter((request) => !request.archived);
    const active = visibleRequests.filter(isActiveRequest).length;
    const closed = visibleRequests.filter((request) => request.currentStage === "CLOSED").length;
    return { active, closed, projects: projects.length, requests: visibleRequests.length };
  }, [requests, projects]);

  const filteredAuditLogs = useMemo(() => {
    const normalized = auditQuery.trim().toLowerCase();
    return auditLogs
      .map(normalizeAuditLog)
      .filter(Boolean)
      .filter((log) => visibleAuditActionTypes.includes(log.actionType))
      .filter((log) => {
      const matchesAction = !auditActionFilter || log.actionType === auditActionFilter;
      const matchesSearch = !normalized || [
        log.actorName,
        log.actorRole,
        log.actionType,
        auditActionSentence(log),
        auditTargetSummary(log),
        auditResultLabel(log)
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalized));
      return matchesAction && matchesSearch;
    });
  }, [auditLogs, auditActionFilter, auditQuery]);

  const auditActionOptions = useMemo(
    () => visibleAuditActionTypes.filter((actionType) => auditLogs.map(normalizeAuditLog).some((log) => log?.actionType === actionType)),
    [auditLogs]
  );

  useEffect(() => {
    document.title = authSession?.token ? pageTitles[page] || "Application ECR" : "Connexion";
  }, [authSession?.token, page]);

  useEffect(() => {
    function syncPageFromLocation() {
      setPage(pageFromPath());
      setShowCreateForm(false);
      setShowEditForm(false);
      setEditingEcrRequest(null);
    }

    window.addEventListener("popstate", syncPageFromLocation);
    return () => window.removeEventListener("popstate", syncPageFromLocation);
  }, []);

  useEffect(() => {
    if (!["traceability", "modifications"].includes(page) || !isAdminUser(currentUser)) return;
    getAuditLogs()
      .then(setAuditLogs)
      .catch(() => {
        setAuditLogs([]);
        setError("Chargement de la tracabilite impossible.");
      });
  }, [currentUser, page]);

  useEffect(() => {
    if (!isAdminUser(currentUser)) {
      setActionSuggestions([]);
      notifiedSuggestionIds.current = new Set();
      return;
    }
    notifiedSuggestionIds.current = new Set();
    refreshActionSuggestions({ notify: true });
  }, [currentUser]);

  useEffect(() => {
    if (!isAdminUser(currentUser)) return undefined;
    const intervalId = window.setInterval(() => {
      refreshActionSuggestions({ notify: true, openDialog: false });
    }, 3000);
    return () => window.clearInterval(intervalId);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return undefined;
    refreshActionDeadlineAlerts();
    refreshPhaseSoundAlerts();
    const intervalId = window.setInterval(() => {
      refreshActionDeadlineAlerts();
      refreshPhaseSoundAlerts();
    }, 3000);
    return () => window.clearInterval(intervalId);
  }, [currentUser]);

  useEffect(() => {
    if (!authSession?.token || !currentUser) {
      setChatUsers([]);
      setChatMessages([]);
      setSelectedChatUserId(null);
      return undefined;
    }
    const sendChatHeartbeat = () => getStoredSession()?.token ? chatHeartbeat().catch(() => {}) : Promise.resolve();
    const sendChatOffline = () => getStoredSession()?.token ? chatOffline().catch(() => {}) : Promise.resolve();
    refreshChatData();
    sendChatHeartbeat();
    const intervalId = window.setInterval(() => {
      sendChatHeartbeat();
      loadChatUsers();
    }, 60000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendChatHeartbeat();
        refreshChatData();
      }
    };
    const handleBeforeUnload = () => {
      sendChatOffline();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      sendChatOffline();
    };
  }, [authSession?.token, currentUser?.id]);

  function refreshActionSuggestions(options = {}) {
    const { notify = false, openDialog = true } = options;
    if (!isAdminUser(currentUser)) return Promise.resolve([]);
    return getActionStandardSuggestions()
      .then((items) => {
        const nextIds = new Set(items.map((item) => item.id));
        const newItems = items.filter((item) => !notifiedSuggestionIds.current.has(item.id));
        setActionSuggestions(items);
        if (notify && newItems.length > 0) {
          playActionSuggestionSound();
        }
        notifiedSuggestionIds.current = nextIds;
        if (items.length > 0 && (openDialog || newItems.length > 0)) {
          setSuggestionsOpen(true);
        }
        return items;
      })
      .catch(() => {
        setActionSuggestions([]);
        return [];
      });
  }

  function refreshActionDeadlineAlerts() {
    return getPendingActionDeadlineAlerts()
      .then((alerts) => {
        if (!Array.isArray(alerts) || alerts.length === 0) {
          return [];
        }
        playActionSuggestionSound();
        const firstAlert = alerts[0];
        Swal.fire({
          toast: true,
          position: "top-end",
          icon: firstAlert.alertType === "J_PLUS_1" ? "error" : "warning",
          title: `${alerts.length} alerte${alerts.length > 1 ? "s" : ""} échéance action`,
          text: `${firstAlert.actionTitle || "Action"} - ${firstAlert.requestLabel || "Modification"}`,
          showConfirmButton: false,
          timer: 7000,
          timerProgressBar: true
        });
        return acknowledgeActionDeadlineAlerts(alerts.map((alert) => alert.id)).then(() => alerts);
      })
      .catch(() => []);
  }

  function refreshPhaseSoundAlerts() {
    return getPendingPhaseSoundAlerts()
      .then((alerts) => {
        if (!Array.isArray(alerts) || alerts.length === 0) {
          return [];
        }
        playActionSuggestionSound();
        const firstAlert = alerts[0];
        const request = requests.find((item) => item.id === firstAlert.requestId);
        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: "Phase validée avec succès",
          html: `<div style="text-align:left">
              <div><strong>${escapeHtml(firstAlert.approvedPhaseLabel || "Phase")}</strong> validée dans <strong>${escapeHtml(firstAlert.requestLabel || "Modification")}</strong>.</div>
              <div>Nouvelle phase ouverte: <strong>${escapeHtml(firstAlert.openedPhaseLabel || "Phase suivante")}</strong>.</div>
            </div>`,
          showConfirmButton: true,
          confirmButtonText: "Consulter",
          showCancelButton: true,
          cancelButtonText: "Fermer",
          timer: 12000,
          timerProgressBar: true
        }).then((result) => {
          if (!result.isConfirmed) {
            return;
          }
          if (request) {
            openRequest(request, firstAlert.openedStage || request.currentStage);
            return;
          }
          if (firstAlert.requestId) {
            setSelectedId(firstAlert.requestId);
            if (firstAlert.openedStage) {
              setSelectedStage(firstAlert.openedStage);
            }
            navigateToPage("modifications");
          }
        });
        return acknowledgePhaseSoundAlerts(alerts.map((alert) => alert.id)).then(() => alerts);
      })
      .catch(() => []);
  }

  function loadChatUsers() {
    if (!getStoredSession()?.token) {
      setChatUsers([]);
      setChatNotificationCount(0);
      return Promise.resolve([]);
    }
    return getChatConversations()
      .then((items) => {
        const nextUsers = Array.isArray(items) ? items : [];
        setChatUsers(nextUsers);
        setChatNotificationCount(totalUnreadConversations(nextUsers));
        setSelectedChatUserId((currentId) => currentId ?? (nextUsers[0] ? chatTargetKey(nextUsers[0]) : null));
        return nextUsers;
      })
      .catch(() => {
        setChatUsers([]);
        return [];
      });
  }

  function loadChatMessages(peerId = selectedChatUserId) {
    if (!getStoredSession()?.token) {
      setChatMessages([]);
      return Promise.resolve([]);
    }
    const target = parseChatTarget(peerId);
    if (!target.id) {
      setChatMessages([]);
      return Promise.resolve([]);
    }
    const request = target.type === "group" ? getChatGroupMessages(target.id) : getChatMessages(target.id);
    return request
      .then((items) => {
        const nextMessages = Array.isArray(items) ? items : [];
        setChatMessages(nextMessages);
        return nextMessages;
      })
      .catch(() => {
        setChatMessages([]);
        return [];
      });
  }

  function refreshChatData(peerId = selectedChatUserId) {
    return Promise.all([
      loadChatUsers(),
      peerId ? loadChatMessages(peerId) : Promise.resolve([])
    ]);
  }

  function handleSelectChatUser(targetKey) {
    setSelectedChatUserId(targetKey);
    loadChatMessages(targetKey).then(() => loadChatUsers());
  }

  function handleChatFileChange(event) {
    const file = event.target.files?.[0] || null;
    setChatFile(file);
  }

  function clearChatFile() {
    setChatFile(null);
    if (chatFileInputRef.current) {
      chatFileInputRef.current.value = "";
    }
  }

  function handleChatDraftChange(value) {
    setChatDraft(value);
    const target = parseChatTarget(selectedChatUserId);
    const now = Date.now();
    window.clearTimeout(chatTypingStopTimer.current);
    if (!target.id) return;
    if (now - chatTypingSentAt.current >= 1800) {
      chatTypingSentAt.current = now;
      chatTyping(target.type, target.id, true).catch(() => {});
    }
    chatTypingStopTimer.current = window.setTimeout(() => {
      chatTyping(target.type, target.id, false).catch(() => {});
    }, 2200);
  }

  function handleSendChatMessage(event) {
    event.preventDefault();
    if (!selectedChatUserId || chatSending) return;
    if (!chatDraft.trim() && !chatFile) {
      warningAlert("Message vide", "Ecrivez un message ou joignez un fichier avant l'envoi.");
      return;
    }
    setChatSending(true);
    const target = parseChatTarget(selectedChatUserId);
    window.clearTimeout(chatTypingStopTimer.current);
    chatTyping(target.type, target.id, false).catch(() => {});
    const request = target.type === "group"
      ? sendChatGroupMessage(target.id, chatDraft, chatFile)
      : sendChatMessage(target.id, chatDraft, chatFile);
    request
      .then((message) => {
        setChatMessages((items) => [...items, message]);
        setChatDraft("");
        clearChatFile();
        return loadChatUsers();
      })
      .catch((message) => errorAlert(message.message || message))
      .finally(() => setChatSending(false));
  }

  function handleToggleChatGroupMember(userId) {
    setChatGroupMemberIds((ids) =>
      ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]
    );
  }

  function handleChatGroupProjectChange(projectName) {
    setChatGroupProjectName(projectName);
    const project = projects.find((item) => item.name === projectName);
    const memberIds = projectTeamUserIds(project?.projectTeam, users, currentUser);
    setChatGroupMemberIds(memberIds);
    setChatGroupName((name) => name.trim() ? name : projectName);
  }

  function handleCreateChatGroup(event) {
    event.preventDefault();
    if (!chatGroupName.trim()) {
      warningAlert("Nom requis", "Donnez un nom au groupe de discussion.");
      return;
    }
    if (chatGroupMemberIds.length === 0) {
      warningAlert("Membres requis", "Selectionnez au moins un utilisateur pour creer le groupe.");
      return;
    }
    setChatSending(true);
    createChatGroup(chatGroupName.trim(), chatGroupMemberIds, chatGroupProjectName.trim())
      .then((group) => {
        setChatGroupName("");
        setChatGroupProjectName("");
        setChatGroupMemberIds([]);
        setChatGroupFormOpen(false);
        return loadChatUsers().then(() => {
          const key = chatTargetKey(group);
          setSelectedChatUserId(key);
          return loadChatMessages(key);
        });
      })
      .catch((message) => errorAlert(message.message || message))
      .finally(() => setChatSending(false));
  }

  function handleAddChatGroupMember(groupId, userId) {
    if (!groupId || !userId) return Promise.resolve();
    setChatSending(true);
    return addChatGroupMember(groupId, userId)
      .then((group) => {
        const groupKey = chatTargetKey(group);
        setSelectedChatUserId(groupKey);
        return refreshChatData(groupKey).then(() => {
          successToast("Membre ajoute au groupe");
        });
      })
      .catch((message) => errorAlert(message.message || message))
      .finally(() => setChatSending(false));
  }

  function notifyIncomingChat(title = "Nouveau message") {
    if (!quickChatOpen && page !== "messages") {
      setChatNotificationCount((count) => count + 1);
    }
    playActionSuggestionSound();
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "info",
      title,
      text: "Ouvrez la messagerie rapide pour repondre.",
      showConfirmButton: false,
      timer: 4500,
      timerProgressBar: true
    });
  }

  function openQuickChat() {
    setQuickChatOpen(true);
    setChatNotificationCount(0);
    refreshChatData();
  }

  function loadInitialData() {
    return Promise.all([getEcrRequests(), getPilots(), getProjects(), getClientReferences(), getProductReferences(), getFinishedProductReferences(), getRoleReferences(), getActionPlanningRules(), getUsers(), getCurrentUser()])
      .then(([requestData, pilotData, projectData, clientReferenceData, productReferenceData, finishedProductReferenceData, roleReferenceData, planningRuleData, userData, currentUserData]) => {
        setRequests(requestData);
        setPilots(pilotData);
        setProjects(projectData);
        setClientReferences(clientReferenceData);
        setProductReferences(productReferenceData);
        setFinishedProductReferences(finishedProductReferenceData);
        setRoleReferences(roleReferenceData);
        setPlanningRules(planningRuleData);
        setUsers(userData);
        setCurrentUser(currentUserData);
        setProfileForm(userToForm(currentUserData));
        setSelectedId((currentId) => currentId ?? requestData[0]?.id ?? null);
      });
  }
  function refreshSelectedData(requestId = selectedId, stage = selectedStage) {
    if (!requestId) return Promise.resolve([]);
    const requestSequence = ++selectedDetailsRequestId.current;

    return Promise.all([
      getEcrRequests(requestLoadOptions(requestArchiveView, currentUser)),
      getChecklist(requestId, stage),
      getActions(requestId, stage),
      getPhaseValidations(requestId),
      getActions(requestId)
    ]).then(([requestData, checklistData, actionData, validationData, requestActionData]) => {
      if (requestSequence !== selectedDetailsRequestId.current) {
        return actionData;
      }
      setRequests(requestData);
      setChecklist(checklistData);
      setActions(actionData);
      setPhaseValidations(validationData);
      setActionsByRequestId((current) => ({
        ...current,
        [requestId]: Array.isArray(requestActionData) ? requestActionData : []
      }));
      return actionData;
    });
  }

  function refreshRealtimeData() {
    const requestId = selectedId;
    const stage = selectedStage;
    const baseRequests = getEcrRequests(requestLoadOptions(requestArchiveView, currentUser)).then((requestData) => {
      setRequests(requestData);
      return requestData;
    });
    const currentDetails = requestId
      ? Promise.all([getChecklist(requestId, stage), getActions(requestId, stage), getPhaseValidations(requestId), getActions(requestId)])
          .then(([checklistData, actionData, validationData, requestActionData]) => {
            setChecklist(checklistData);
            setActions(actionData);
            setPhaseValidations(validationData);
            setActionsByRequestId((current) => ({
              ...current,
              [requestId]: Array.isArray(requestActionData) ? requestActionData : []
            }));
          })
      : Promise.resolve();
    const adminData = isAdminUser(currentUser)
      ? Promise.all([getActionStandardSuggestions(), page === "traceability" ? getAuditLogs() : Promise.resolve(auditLogs)])
          .then(([suggestionData, auditData]) => {
            setActionSuggestions(suggestionData);
            if (Array.isArray(auditData)) setAuditLogs(auditData);
          })
      : Promise.resolve();
    return Promise.all([baseRequests, currentDetails, adminData]).catch(() => {});
  }

  useEffect(() => {
    if (!authSession?.token || !currentUser) return undefined;
    let events = null;
    let socket = null;
    let usingSseFallback = false;
    let disposed = false;

    const handlePlanningUpdated = () => {
      window.clearTimeout(realtimeRefreshTimer.current);
      realtimeRefreshTimer.current = window.setTimeout(refreshRealtimeData, 250);
    };
    const handleChatMessage = (payload = {}) => {
      const currentId = Number(currentUser?.id);
      const senderId = Number(payload.senderId);
      const recipientId = Number(payload.recipientId);
      const activeTarget = parseChatTarget(selectedChatUserId);
      const activePeerId = activeTarget.type === "user" ? Number(activeTarget.id) : null;
      const concernsCurrentUser = senderId === currentId || recipientId === currentId;
      if (!concernsCurrentUser) return;
      loadChatUsers();
      if (activePeerId && (senderId === activePeerId || recipientId === activePeerId)) {
        loadChatMessages(selectedChatUserId);
      }
      setChatTypingNotice(null);
      stopTypingSound();
      if (recipientId === currentId && senderId !== currentId) {
        notifyIncomingChat("Nouveau message recu");
      }
    };
    const handleChatPresence = () => {
      loadChatUsers();
    };
    const handleChatGroupMessage = (payload = {}) => {
      const groupId = Number(payload.groupId);
      const senderId = Number(payload.senderId);
      const activeTarget = parseChatTarget(selectedChatUserId);
      loadChatUsers();
      if (activeTarget.type === "group" && Number(activeTarget.id) === groupId) {
        loadChatMessages(selectedChatUserId);
      }
      setChatTypingNotice(null);
      stopTypingSound();
      if (senderId !== Number(currentUser?.id)) {
        notifyIncomingChat("Nouveau message groupe");
      }
    };
    const handleChatTyping = (payload = {}) => {
      const senderId = Number(payload.senderId);
      if (!senderId || senderId === Number(currentUser?.id)) return;
      const targetType = payload.targetType || "user";
      const targetId = Number(payload.targetId);
      const active = String(payload.active ?? "true") === "true";
      const activeTarget = parseChatTarget(selectedChatUserId);
      const matchesActiveDirect = targetType === "user"
        && targetId === Number(currentUser?.id)
        && activeTarget.type === "user"
        && activeTarget.id === senderId;
      const matchesActiveGroup = targetType === "group"
        && activeTarget.type === "group"
        && Number(activeTarget.id) === targetId;
      if (!matchesActiveDirect && !matchesActiveGroup) return;
      window.clearTimeout(chatTypingClearTimer.current);
      if (!active) {
        setChatTypingNotice(null);
        stopTypingSound();
        return;
      }
      setChatTypingNotice(`${payload.senderName || "Quelqu'un"} est en train d'ecrire...`);
      playTypingSound();
      chatTypingClearTimer.current = window.setTimeout(() => {
        setChatTypingNotice(null);
        stopTypingSound();
      }, 3500);
    };
    const startSseFallback = () => {
      if (disposed) return;
      if (usingSseFallback) return;
      usingSseFallback = true;
      events = new EventSource(planningEventsUrl(authSession.token));
      events.addEventListener("planning-updated", handlePlanningUpdated);
      events.addEventListener("chat-message", (event) => {
        let payload = {};
        try {
          payload = JSON.parse(event.data || "{}");
        } catch {
          payload = {};
        }
        handleChatMessage(payload);
      });
      events.addEventListener("chat-presence", handleChatPresence);
      events.addEventListener("chat-group-message", (event) => {
        let payload = {};
        try {
          payload = JSON.parse(event.data || "{}");
        } catch {
          payload = {};
        }
        handleChatGroupMessage(payload);
      });
      events.addEventListener("chat-typing", (event) => {
        let payload = {};
        try {
          payload = JSON.parse(event.data || "{}");
        } catch {
          payload = {};
        }
        handleChatTyping(payload);
      });
      events.onerror = () => {};
    };

    try {
      socket = new WebSocket(planningWebSocketUrl(authSession.token));
      socket.onmessage = (message) => {
        let envelope = {};
        try {
          envelope = JSON.parse(message.data || "{}");
        } catch {
          envelope = {};
        }
        if (envelope.event === "planning-updated") handlePlanningUpdated();
        if (envelope.event === "chat-message") handleChatMessage(envelope.data || {});
        if (envelope.event === "chat-presence") handleChatPresence();
        if (envelope.event === "chat-group-message") handleChatGroupMessage(envelope.data || {});
        if (envelope.event === "chat-typing") handleChatTyping(envelope.data || {});
      };
      socket.onerror = startSseFallback;
      socket.onclose = () => {
        if (!usingSseFallback) startSseFallback();
      };
    } catch {
      startSseFallback();
    }

    return () => {
      disposed = true;
      window.clearTimeout(chatTypingClearTimer.current);
      window.clearTimeout(chatTypingStopTimer.current);
      stopTypingSound();
      window.clearTimeout(realtimeRefreshTimer.current);
      if (events) events.close();
      if (socket) socket.close();
    };
  }, [authSession?.token, currentUser, selectedId, selectedStage, requestArchiveView, page, selectedChatUserId]);

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
        setError("Session expirée ou API indisponible. Connectez-vous à nouveau.");
      })
      .finally(() => setLoading(false));
  }, [authSession?.token]);

  useLayoutEffect(() => {
    if (!selectedId || !canLoadSelectedStage) {
      selectedDetailsRequestId.current += 1;
      setChecklist([]);
      setActions([]);
      setPhaseValidations([]);
      return;
    }
    const requestSequence = ++selectedDetailsRequestId.current;
    setChecklist([]);
    setActions([]);
    setPhaseValidations([]);
    Promise.all([getChecklist(selectedId, selectedStage), getActions(selectedId, selectedStage), getPhaseValidations(selectedId)])
      .then(([checklistData, actionData, validationData]) => {
        if (requestSequence !== selectedDetailsRequestId.current) return;
        setChecklist(checklistData);
        setActions(actionData);
        setPhaseValidations(validationData);
      })
      .catch(() => {
        if (requestSequence !== selectedDetailsRequestId.current) return;
        setChecklist([]);
        setActions([]);
        setPhaseValidations([]);
      });
  }, [selectedId, selectedStage, canLoadSelectedStage]);

  useEffect(() => {
    if (!selectedRequest) return;
    if (waitingForClosedParticipantActions) return;
    if (!visibleStages.some(([key]) => key === selectedStage)) {
      setSelectedStage(visibleStages[0]?.[0] || (selectedRequest.currentStage === "CANCELLED" ? "CANCELLED" : safeStage(selectedRequest.currentStage, Boolean(selectedRequest.newVersion))));
      return;
    }
    const nextStage = safeStage(selectedStage, Boolean(selectedRequest.newVersion));
    if (nextStage !== selectedStage && visibleStages.some(([key]) => key === nextStage)) {
      setSelectedStage(nextStage);
    }
  }, [selectedRequest, selectedStage, visibleStages, waitingForClosedParticipantActions]);

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

  useEffect(() => {
    if (currentUser && !isAdminUser(currentUser) && ["projects", "traceability", "preferentials", "users"].includes(page)) {
      navigateToPage("modifications", { replace: true });
    }
  }, [currentUser, page]);

  function navigateToPage(nextPage, options = {}) {
    const nextRoute = routeForPage(nextPage);
    if (window.location.pathname !== nextRoute) {
      if (options.replace) {
        window.history.replaceState(null, "", nextRoute);
      } else {
        window.history.pushState(null, "", nextRoute);
      }
    }
    setPage(nextPage);
  }

  function updateEcrForm(field, value) {
    setEcrForm((form) => updateEcrFormState(form, field, value, projects, finishedProductReferences));
  }

  function updateEcrEditForm(field, value) {
    setEcrEditForm((form) => updateEcrFormState(form, field, value, projects, finishedProductReferences));
  }

  function updateActionForm(field, value) {
    setActionForm((form) => {
      if (field === "proofDocumentFile") {
        return { ...form, proofDocumentFile: mergeSelectedFiles(form.proofDocumentFile, value) };
      }
      return { ...form, [field]: value };
    });
  }

  function removeActionProofDocumentFile(index) {
    setActionForm((form) => ({
      ...form,
      proofDocumentFile: filesFromValue(form.proofDocumentFile).filter((_, fileIndex) => fileIndex !== index)
    }));
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
          evidenceRequired: action.evidenceRequired || isCriticalAction(action),
          workDurationDays: Number(action.workDurationDays) || 1
        }))
    };
  }

  function handleCreateEcr(event) {
    event.preventDefault();
    if (!validateEcrRequiredFields(ecrForm, requests, null, setError)) {
      return;
    }
    if (parseSelectedProducts(ecrForm.product).length === 0) {
      const message = "Selectionnez au moins un produit.";
      setError(message);
      warningAlert("Produit requis", message);
      return;
    }
    if (!validateFinishedProductsSelection(ecrForm, finishedProductReferences, setError)) {
      return;
    }
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
            const message = "Modification créée, mais l'upload d'une image a echoue.";
            setError(message);
            warningAlert("Upload incomplet", message);
            return savedRequest;
          });
      })
      .then((savedRequest) => {
        setEcrForm(emptyEcrForm);
        setSelectedId(savedRequest.id);
        setSelectedStage(savedRequest.currentStage);
        setShowCreateForm(false);
        navigateToPage("modifications");
        successToast("Modification créée");
        return refreshSelectedData(
            savedRequest.id,
            safeStage(savedRequest.currentStage, Boolean(savedRequest.newVersion))
        );
      })
      .catch(() => {
        const message = "Création ECR impossible. Créez d'abord le projet, puis vérifiez les champs obligatoires.";
        setError(message);
        errorAlert(message);
      })
      .finally(() => setSaving(false));
  }

  function openEditEcr(request) {
    if (isTerminalRequest(request)) {
      warningAlert("Modification terminée", "Cette modification est terminée ou clôturée. Elle est désormais en lecture seule.");
      return;
    }
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
    if (!validateEcrRequiredFields(ecrEditForm, requests, editingEcrRequest.id, setError)) {
      return;
    }
    if (parseSelectedProducts(ecrEditForm.product).length === 0) {
      const message = "Selectionnez au moins un produit.";
      setError(message);
      warningAlert("Produit requis", message);
      return;
    }
    if (!validateFinishedProductsSelection(ecrEditForm, finishedProductReferences, setError)) {
      return;
    }
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
            const message = "Modification enregistree, mais l'upload d'une image a echoue.";
            setError(message);
            warningAlert("Upload incomplet", message);
            return savedRequest;
          });
      })
      .then((savedRequest) => {
        closeEditEcr();
        setSelectedId(savedRequest.id);
        setSelectedStage(safeStage(savedRequest.currentStage, Boolean(savedRequest.newVersion)));
        successToast("Modification mise à jour");
        return refreshSelectedData(
            savedRequest.id,
            safeStage(savedRequest.currentStage, Boolean(savedRequest.newVersion))
        );
      })
      .catch(() => {
        const message = "Mise à jour de la modification impossible. Vérifiez les champs obligatoires.";
        setError(message);
        errorAlert(message);
      })
      .finally(() => setSaving(false));
  }

  function handleUpdateDossierReview(request, dossierReview) {
    if (!request) return Promise.resolve();
    if (isTerminalRequest(request)) {
      warningAlert("Modification terminée", "Cette modification est terminée ou clôturée. La revue dossier est en lecture seule.");
      return Promise.reject(new Error("Modification terminale."));
    }
    if (!isAdminUser(currentUser) && !isRequestPilot(currentUser, request)) {
      warningAlert("Lecture seule", "Seul le pilote de la modification ou l'admin peut modifier la revue dossier.");
      return Promise.reject(new Error("Revue dossier en lecture seule."));
    }
    const payload = {
      ...buildEcrPayload(requestToEcrForm(request)),
      dossierReview
    };
    setSaving(true);
    setError("");
    return updateEcrRequest(request.id, payload)
      .then((savedRequest) => {
        setRequests((items) => items.map((item) => (item.id === savedRequest.id ? savedRequest : item)));
        setSelectedId(savedRequest.id);
        successToast("Revue dossier enregistree");
        return savedRequest;
      })
      .catch((error) => {
        const message = "Enregistrement de la revue dossier impossible.";
        setError(message);
        errorAlert(message);
        throw error;
      })
      .finally(() => setSaving(false));
  }

  function handleStageChange(stage) {
    if (!selectedRequest) return;
    if (isTerminalRequest(selectedRequest)) {
      warningAlert("Modification terminée", "Cette modification est terminée ou clôturée. La phase ne peut plus être modifiée.");
      return;
    }
    if (!isAdminUser(currentUser)) {
      warningAlert("Action reservee", "Seul l'admin peut rouvrir ou modifier la phase courante.");
      return;
    }
    if (stage === selectedRequest.currentStage) {
      setSelectedStage(stage);
      return;
    }
    const latestValidation = phaseValidations.find((validation) => validation.stage === stage);
    if (stage !== selectedRequest.currentStage && latestValidation?.status === "APPROVED") {
      setSelectedStage(stage);
      warningAlert("Phase validée", "Utilisez le bouton Rouvrir la phase pour remettre cette phase en phase courante.");
      return;
    }
    setSelectedStage(stage);
    updateEcrStage(selectedRequest.id, stage)
      .then((updatedRequest) => {
        setRequests((items) => items.map((item) => (item.id === updatedRequest.id ? updatedRequest : item)));
        return refreshSelectedData(updatedRequest.id, safeStage(updatedRequest.currentStage, Boolean(updatedRequest.newVersion)));
      })
      .catch(() => {
        const message = "Impossible de sauvegarder l'etape ECR.";
        setError(message);
        errorAlert(message);
      });
  }

  function handleReopenPhase(validation) {
    if (!selectedRequest || !validation || !isAdminUser(currentUser)) return;
    if (isTerminalRequest(selectedRequest)) {
      warningAlert("Modification terminée", "Cette modification est terminée ou clôturée. Elle ne peut plus être rouverte.");
      return;
    }
    setSaving(true);
    setError("");
    updateEcrStage(selectedRequest.id, validation.stage)
      .then((updatedRequest) => {
        setRequests((items) => items.map((item) => (item.id === updatedRequest.id ? updatedRequest : item)));
        setSelectedStage(safeStage(updatedRequest.currentStage, Boolean(updatedRequest.newVersion)));
        return refreshSelectedData(updatedRequest.id, safeStage(updatedRequest.currentStage, Boolean(updatedRequest.newVersion)));
      })
      .then(() => successToast("Phase rouverte"))
      .catch((exception) => {
        const message = exception?.message || "Reouverture de phase impossible.";
        setError(message);
        errorAlert(message);
      })
      .finally(() => setSaving(false));
  }

  function openRequest(request, stageOverride) {
    if (isClosedRequest(request)) {
      warningAlert("Modification cloturee", "C'est une modification cloturee et vous ne pouvez plus la modifier.");
    }
    setSelectedId(request.id);
    const participantStage = firstActionParticipantStage(currentUser, actionsByRequestId[request.id] || []);
    setSelectedStage(safeStage(stageOverride || participantStage || request.currentStage, Boolean(request.newVersion)));
    setShowCreateForm(false);
    setShowEditForm(false);
    navigateToPage("modifications");
  }

  function handleRequestArchiveViewChange(view) {
    if (view === requestArchiveView) return;
    setRequestArchiveView(view);
    setSaving(true);
    setError("");
    getEcrRequests(requestLoadOptions(view, currentUser))
      .then((requestData) => {
        setRequests(requestData);
        if (selectedId) {
          const canAdmin = isAdminUser(currentUser);
          const selectedStillVisible = requestData.some((item) => item.id === selectedId && requestMatchesView(item, view, canAdmin));
          if (!selectedStillVisible) {
            const nextRequest = requestData.find((item) => requestMatchesView(item, view, canAdmin)) || null;
            const participantStage = nextRequest ? firstActionParticipantStage(currentUser, actionsByRequestId[nextRequest.id] || []) : null;
            setSelectedId(nextRequest?.id ?? null);
            setSelectedStage(nextRequest ? safeStage(participantStage || nextRequest.currentStage, Boolean(nextRequest.newVersion)) : "FEASIBILITY_VALIDATION");
          }
        }
      })
      .catch(() => {
        const message = "Chargement des modifications impossible.";
        setError(message);
        errorAlert(message);
      })
      .finally(() => setSaving(false));
  }

  function handleArchiveEcr(request, archived = true) {
    const label = requestDisplayName(request);
    const title = archived ? "Archiver la modification ?" : "Desarchiver la modification ?";
    const text = archived
      ? `La modification ${label} ne sera plus affichee dans la liste des modifications actives.`
      : `La modification ${label} reviendra dans la liste des modifications actives.`;
    confirmDelete(title, text).then((result) => {
      if (!result.isConfirmed) return;
      setSaving(true);
      setError("");
      archiveEcrRequest(request.id, archived)
        .then(() => getEcrRequests(requestLoadOptions(requestArchiveView, currentUser)))
        .then((requestData) => {
          setRequests(requestData);
          if (selectedId === request.id && archived && requestArchiveView !== "archived" && requestArchiveView !== "all") {
            const nextRequest = requestData.find((item) => requestMatchesView(item, requestArchiveView, isAdminUser(currentUser))) || null;
            const participantStage = nextRequest ? firstActionParticipantStage(currentUser, actionsByRequestId[nextRequest.id] || []) : null;
            setSelectedId(nextRequest?.id ?? null);
            setSelectedStage(nextRequest ? safeStage(participantStage || nextRequest.currentStage, Boolean(nextRequest.newVersion)) : "FEASIBILITY_VALIDATION");
          }
          successToast(archived ? "Modification archivée" : "Modification désarchivée");
        })
        .catch(() => {
          const message = archived
            ? "Archivage de la modification impossible. Vérifiez vos droits."
            : "Desarchivage de la modification impossible. Vérifiez vos droits.";
          setError(message);
          errorAlert(message);
        })
        .finally(() => setSaving(false));
    });
  }

  function handleCancelEcr(request) {
    if (!request) return;
    if (!isAdminUser(currentUser)) {
      warningAlert("Action reservee", "Seul l'admin peut annuler une modification.");
      return;
    }
    if (request.currentStage === "CANCELLED") {
      warningAlert("Modification annulée", "Cette modification est déjà annulée.");
      return;
    }
    const label = requestDisplayName(request);
    Swal.fire({
      ...swalButtons,
      title: "Annuler la modification ?",
      text: `La modification ${label} passera immediatement en phase Cancelled.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Annuler la modification",
      cancelButtonText: "Retour",
      confirmButtonColor: "#b42318"
    }).then((result) => {
      if (!result.isConfirmed) return;
      setSaving(true);
      setError("");
      cancelEcrRequest(request.id)
        .then((updatedRequest) => {
          setRequests((items) => items.map((item) => (item.id === updatedRequest.id ? updatedRequest : item)));
          setSelectedId(updatedRequest.id);
          setSelectedStage("CANCELLED");
          return getEcrRequests(requestLoadOptions(requestArchiveView, currentUser));
        })
        .then((requestData) => {
          setRequests(requestData);
          successToast("Modification annulée");
          return refreshSelectedData(request.id, "CANCELLED");
        })
        .catch((exception) => {
          const message = exception?.message || "Annulation de la modification impossible. Vérifiez vos droits.";
          setError(message);
          errorAlert(message);
        })
        .finally(() => setSaving(false));
    });
  }

  function actionFormPayload(form, stage) {
    const evidenceRequired = form.evidenceRequired || hasActionProofDocument(form) || isCriticalAction(form);
    const done = isActionDone(form);
    return {
      ...form,
      evidenceFile: undefined,
      proofDocumentFile: undefined,
      evidenceLinkName: undefined,
      evidenceLinkUrl: undefined,
      proofDocumentLinkName: undefined,
      proofDocumentLinkUrl: undefined,
      evidenceRequired,
      checked: done,
      closedDate: done ? new Date().toISOString().slice(0, 10) : null,
      finalizationDate: done ? form.finalizationDate || localDateTimeNow() : null,
      deadline: form.deadline || null,
      date1: form.date1 || null,
      date2: form.date2 || null,
      date3: form.date3 || null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      workDurationDays: Number(form.workDurationDays) || 1,
      dependsOnActionId: form.dependsOnActionId ? Number(form.dependsOnActionId) : null,
      dependencyAnchor: form.dependencyAnchor || "OUTPUT",
      routineAction: false,
      recurrenceIntervalDays: null,
      stage: form.stage || stage
    };
  }

  function dependencyFor(action) {
    return action?.dependsOnActionId ? actions.find((item) => item.id === action.dependsOnActionId) : null;
  }

  function dependencyBlocksCompletion(action) {
    const dependency = dependencyFor(action);
    return dependency && !isActionDone(dependency);
  }

  function isCriticalAction(action) {
    return String(action?.criticality || "").startsWith("1");
  }

  function requiresEvidence(action) {
    return Boolean(action?.evidenceRequired) || hasActionProofDocument(action) || isCriticalAction(action);
  }

  function hasActionProofDocument(action) {
    return filesFromValue(action?.proofDocumentFile).length > 0
      || Boolean(String(action?.proofDocumentLinkUrl || "").trim())
      || actionProofDocuments(action).length > 0;
  }

  function refreshCurrentActionsAndRequests() {
    if (!selectedRequest) return Promise.resolve([]);
    return refreshSelectedData(selectedRequest.id, selectedStage);
  }

  function handleCreateAction(event) {
    event.preventDefault();
    if (!selectedRequest) return Promise.resolve();
    if (isTerminalRequest(selectedRequest)) {
      const message = "Cette modification est terminée ou clôturée. Les actions sont en lecture seule.";
      setError(message);
      warningAlert("Modification terminée", message);
      return Promise.reject(new Error("Modification terminale"));
    }
    if (isActionPhaseApproved({ stage: actionForm.stage || selectedStage }, phaseValidations)) {
      const message = "Impossible d'ajouter une action dans une phase déjà validée. Reouvrez la phase avant de la modifier.";
      setError(message);
      warningAlert("Phase validée", message);
      return Promise.reject(new Error("Phase approved"));
    }
    if (!String(actionForm.responsible || "").trim() || !String(actionForm.validator || "").trim()) {
      const message = "Choisissez le pilote d'action et le validateur avant de créer l'action. Sans ces deux champs, l'action ne sera pas créée.";
      setError(message);
      warningAlert("Pilote et validateur requis", message);
      return Promise.reject(new Error("Action assignees required"));
    }
    const evidenceFiles = filesFromValue(actionForm.evidenceFile);
    const proofDocumentFiles = filesFromValue(actionForm.proofDocumentFile);
    const evidenceLink = { name: actionForm.evidenceLinkName, url: actionForm.evidenceLinkUrl };
    const proofDocumentLink = { name: actionForm.proofDocumentLinkName, url: actionForm.proofDocumentLinkUrl };
    const hasEvidenceLink = Boolean(evidenceLink.url?.trim());
    const hasProofDocumentLink = Boolean(proofDocumentLink.url?.trim());
    if (requiresEvidence(actionForm) && isActionDone(actionForm) && evidenceFiles.length === 0 && !hasEvidenceLink) {
      const message = "Ajoutez un asset avant de créér cette action comme terminée.";
      setError(message);
      warningAlert("Asset requis", message);
      return Promise.reject(new Error("Evidence required"));
    }
    if (isActionDone(actionForm) && !isActionPilotForUser(currentUser, actionForm)) {
      const message = "Seul le pilote responsable de l'action peut la créér directement comme terminée.";
      setError(message);
      warningAlert("Action reservee", message);
      return Promise.reject(new Error("Action completion forbidden"));
    }
    setSaving(true);
    setError("");
    const payload = actionFormPayload(actionForm, selectedStage);
    const finalPayload = proofDocumentFiles.length > 0 || hasProofDocumentLink ? { ...payload, evidenceRequired: true } : payload;
    const createBasePayload = proofDocumentFiles.length > 0 || hasProofDocumentLink ? { ...payload, evidenceRequired: actionForm.evidenceRequired || isCriticalAction(actionForm) } : payload;
    const hasUploads = proofDocumentFiles.length > 0 || evidenceFiles.length > 0 || hasProofDocumentLink || hasEvidenceLink;
    const createPayload = hasUploads && isActionDone(finalPayload)
      ? { ...createBasePayload, checked: false, status: "TODO", closedDate: null, finalizationDate: null }
      : createBasePayload;
    return createAction(selectedRequest.id, createPayload)
      .then((savedAction) => {
        const proofUpload = proofDocumentFiles.length > 0 ? uploadActionProofDocumentFiles(savedAction.id, proofDocumentFiles) : Promise.resolve(savedAction);
        return proofUpload.then((actionWithProof) => {
          const proofLinkUpload = hasProofDocumentLink ? uploadActionProofDocumentLink(actionWithProof.id, proofDocumentLink) : Promise.resolve(actionWithProof);
          return proofLinkUpload.then((actionWithProofLink) => {
            const evidenceUpload = evidenceFiles.length > 0 ? uploadActionEvidenceFiles(actionWithProofLink.id, evidenceFiles) : Promise.resolve(actionWithProofLink);
            return evidenceUpload.then((actionWithEvidence) => {
              const evidenceLinkUpload = hasEvidenceLink ? uploadActionEvidenceLink(actionWithEvidence.id, evidenceLink) : Promise.resolve(actionWithEvidence);
              return evidenceLinkUpload.then((actionWithEvidenceLink) => (isActionDone(finalPayload) ? updateAction(actionWithEvidenceLink.id, finalPayload) : actionWithEvidenceLink));
            });
          });
        });
      })
      .then(() => refreshCurrentActionsAndRequests())
      .then((actionData) => {
        setActions(actionData);
        setActionForm(emptyActionForm);
        successToast("Action créée");
      })
      .catch((error) => {
        if (error.message === "Evidence required" || error.message === "Action completion forbidden" || error.message === "Phase approved") throw error;
        const message = error.message?.includes("422")
          ? "La date de debut de l'action ne peut pas etre apres le debut d'une phase suivante."
          : error.message?.includes("403")
          ? "Action créée, mais seuls le responsable de l'action ou un profil autorise peuvent la marquer terminée."
          : "Création action impossible.";
        setError(message);
        errorAlert(message);
        throw error;
      })
      .finally(() => setSaving(false));
  }

  function handleToggleAction(action, completed) {
    if (isTerminalRequest(selectedRequest)) {
      warningAlert("Modification terminée", "Cette modification est terminée ou clôturée. Les actions sont en lecture seule.");
      return;
    }
    if (isActionPhaseApproved(action, phaseValidations)) {
      warningAlert("Phase validée", "Impossible de modifier une action dans une phase déjà validée. Reouvrez la phase avant de la modifier.");
      return;
    }
    if (!completed && action?.stage !== selectedRequest?.currentStage) {
      warningAlert("Action verrouillee", "L'admin doit d'abord remettre cette phase en phase courante avant de rouvrir une action.");
      return;
    }
    if (completed && dependencyBlocksCompletion(action)) {
      const dependency = dependencyFor(action);
      const message = `Terminez d'abord: ${dependency.title || "action precedente"}.`;
      setError("Terminez d'abord l'action precedente avant de valider cette action.");
      warningAlert("Action bloquee", message);
      return;
    }
    if (completed && requiresEvidence(action) && !hasActionAsset(action)) {
      const message = "Ajoutez un asset avant de terminer cette action.";
      setError(message);
      warningAlert("Asset requis", message);
      return;
    }
    const updatedAction = {
      ...action,
      late: completed ? false : action.late,
      checked: completed,
      status: completed ? "DONE" : "TODO",
      closedDate: completed ? new Date().toISOString().slice(0, 10) : null,
      finalizationDate: completed ? localDateTimeNow() : null
    };

    updateAction(action.id, updatedAction)
        .then(() => refreshSelectedData(selectedRequest.id, selectedStage))
        .then(() => {
          successToast(completed ? "Action terminée" : "Action rouverte");
      })
      .catch((error) => {
        const message = error.message?.includes("403")
          ? "Seul le responsable de l'action peut la marquer terminée."
          : "Impossible de mettre a jour l'action.";
        setError(message);
        errorAlert(message);
      });
  }

  function handleUpdateActionDuration(action, durationValue) {
    if (!selectedRequest || !action?.id) return;
    if (isTerminalRequest(selectedRequest)) {
      warningAlert("Modification terminée", "Cette modification est terminée ou clôturée. Les actions sont en lecture seule.");
      return;
    }
    if (isActionPhaseApproved(action, phaseValidations)) {
      warningAlert("Phase validée", "Impossible de modifier la duree d'une action dans une phase déjà validée. Reouvrez la phase avant de la modifier.");
      return;
    }
    const duration = Math.max(0, Number(durationValue) || 0);
    if (duration === (Number(action.workDurationDays) || 0)) return;
    setSaving(true);
    setError("");
    updateAction(action.id, { ...action, workDurationDays: duration })
      .then(() => refreshSelectedData(selectedRequest.id, selectedStage))
      .then(() => {
        successToast("Durée mise à jour");
      })
      .catch((error) => {
        const message = error.message?.includes("403")
          ? "Seul le pilote de la modification peut modifier la duree des actions."
          : "Impossible de mettre a jour la duree de l'action.";
        setError(message);
        errorAlert(message);
      })
      .finally(() => setSaving(false));
  }

  function handleUploadEvidence(action, fileValue) {
    const files = filesFromValue(fileValue);
    if (files.length === 0) return;
    if (isTerminalRequest(selectedRequest)) {
      warningAlert("Modification terminée", "Cette modification est terminée ou clôturée. Les assets sont en lecture seule.");
      return;
    }
    if (isActionPhaseApproved(action, phaseValidations)) {
      warningAlert("Phase validée", "Impossible d'ajouter un asset dans une phase déjà validée. Reouvrez la phase avant de la modifier.");
      return;
    }
    setError("");
    uploadActionEvidenceFiles(action.id, files)
        .then(() => refreshSelectedData(selectedId, selectedStage))
        .then(() => {
          successToast("Asset ajoute");
        })
      .catch(() => {
        const message = "Ajout du fichier evidence impossible.";
        setError(message);
        errorAlert(message);
      });
  }

  function handleAddEvidenceLink(action, link) {
    if (!link?.url?.trim()) return;
    if (isTerminalRequest(selectedRequest)) {
      warningAlert("Modification terminée", "Cette modification est terminée ou clôturée. Les assets sont en lecture seule.");
      return;
    }
    if (isActionPhaseApproved(action, phaseValidations)) {
      warningAlert("Phase validée", "Impossible d'ajouter un asset dans une phase déjà validée. Reouvrez la phase avant de la modifier.");
      return;
    }
    setError("");
    uploadActionEvidenceLink(action.id, link)
      .then(() => refreshSelectedData(selectedId, selectedStage))
      .then(() => {
        successToast("Lien asset ajoute");
      })
      .catch(() => {
        const message = "Ajout du lien asset impossible.";
        setError(message);
        errorAlert(message);
      });
  }

  function refreshPhaseValidations(requestId = selectedId) {
    if (!requestId) return Promise.resolve([]);
    return getPhaseValidations(requestId).then((items) => {
      setPhaseValidations(items);
      return items;
    });
  }

  function handleDeleteActionAsset(action, asset) {
    if (isTerminalRequest(selectedRequest)) {
      warningAlert("Modification terminée", "Cette modification est terminée ou clôturée. Les assets sont en lecture seule.");
      return;
    }
    if (isActionPhaseApproved(action, phaseValidations)) {
      warningAlert("Phase validée", "Impossible de supprimer un asset dans une phase déjà validée. Reouvrez la phase avant de la modifier.");
      return;
    }
    if (!asset || asset.legacy) {
      warningAlert("Suppression indisponible", "Cet ancien fichier ne peut pas être supprimé depuis la liste des assets.");
      return;
    }
    confirmDelete("Supprimer l'asset ?", `L'asset ${asset.fileName || "sélectionné"} sera supprimé de l'action et de Cloudinary.`).then((result) => {
      if (!result.isConfirmed) return;
      setError("");
      deleteActionAsset(asset.id)
        .then(() => refreshSelectedData(selectedId, selectedStage))
        .then(() => {
          successToast("Asset supprime");
        })
        .catch(() => {
          const message = "Suppression de l'asset impossible.";
          setError(message);
          errorAlert(message);
        });
    });
  }

  function handleDeleteAction(action) {
    if (!selectedRequest || !action?.id) return;
    if (isTerminalRequest(selectedRequest)) {
      warningAlert("Modification terminée", "Cette modification est terminée ou clôturée. Les actions sont en lecture seule.");
      return;
    }
    if (!canDeleteActionInPhase(action, phaseValidations)) {
      warningAlert("Action validée", "Impossible de supprimer une action déjà terminée ou validée. Reouvrez la phase avant de la modifier.");
      return;
    }
    confirmDelete("Supprimer l'action ?", `L'action ${action.title || "sélectionnée"} sera supprimée. Le SOP et les dates des actions suivantes seront recalcules.`).then((result) => {
      if (!result.isConfirmed) return;
      setSaving(true);
      setError("");
      deleteAction(action.id)
        .then(() => refreshSelectedData(selectedId, selectedStage))
        .then(() => {
          successToast("Action supprimée");
        })
        .catch((error) => {
          const message = error.message?.includes("403")
            ? "Suppression impossible: vous devez être admin ou pilote de la modification. Les actions déjà terminées ou validées restent protégées."
            : "Suppression de l'action impossible.";
          setError(message);
          errorAlert(message);
        })
        .finally(() => setSaving(false));
    });
  }

  function handleRequestPhaseValidation() {
    if (!selectedRequest) return;
    if (!isRequestPilot(currentUser, selectedRequest)) {
      warningAlert("Validation reservee", "Seul le pilote de la modification peut demander la validation de phase.");
      return;
    }
    if (selectedStage !== selectedRequest.currentStage) {
      warningAlert("Phase non courante", "La demande de validation concerne uniquement la phase courante de la modification.");
      setSelectedStage(safeStage(selectedRequest.currentStage, Boolean(selectedRequest.newVersion)));
      return;
    }
    if (actions.length === 0 || actions.some((action) => !isActionDone(action))) {
      warningAlert("Phase non terminée", "Toutes les actions de la phase doivent être terminées avant la demande de validation.");
      return;
    }
    setSaving(true);
    requestPhaseValidation(selectedRequest.id, selectedStage)
      .then(() => {
        successToast("Demande envoyée");
        return refreshSelectedData(selectedRequest.id, selectedStage);
      })
      .catch((exception) => errorAlert(exception?.message || "Demande de validation impossible. Vérifiez que vous êtes sur la phase courante et que toutes ses actions sont terminées."))
      .finally(() => setSaving(false));
  }

  function handleApprovePhase(validation) {
    if (!selectedRequest || !validation) return;
    setSaving(true);
    approvePhaseValidation(selectedRequest.id, validation.id)
        .then((updatedRequest) => {
          const nextStage = safeStage(updatedRequest.currentStage, Boolean(updatedRequest.newVersion));
          setSelectedStage(nextStage);
          successToast("Phase validée");
          return refreshSelectedData(updatedRequest.id, nextStage);
        })
      .catch((exception) => errorAlert(exception?.message || "Validation de phase impossible."))
      .finally(() => setSaving(false));
  }

  function handleRequestClosure() {
    if (!selectedRequest) return;
    if (!isRequestPilot(currentUser, selectedRequest)) {
      warningAlert("Demande reservee", "Seul le pilote de la modification peut demander la cloture.");
      return;
    }
    if (!allWorkflowStagesApproved(selectedRequest, phaseValidations)) {
      const message = selectedRequest.currentStage === "CANCELLED"
        ? "Terminez et validez les actions de la phase Cancelled / Project Cancelled avant de demander la cloture."
        : "Toutes les phases doivent etre terminees et validees avant la demande de cloture.";
      warningAlert("Phases non validees", message);
      return;
    }
    setSaving(true);
    requestEcrClosure(selectedRequest.id)
      .then((updatedRequest) => {
        successToast("Demande de cloture envoyee a l'admin");
        return refreshSelectedData(updatedRequest.id, safeStage(updatedRequest.currentStage, Boolean(updatedRequest.newVersion)));
      })
      .catch((exception) => errorAlert(exception?.message || "Demande de cloture impossible."))
      .finally(() => setSaving(false));
  }

  function handleCloseRequest() {
    if (!selectedRequest) return;
    if (!isAdminUser(currentUser)) {
      warningAlert("Action reservee", "Seul l'admin peut marquer la modification comme terminee ou cloturee.");
      return;
    }
    setSaving(true);
    closeEcrRequest(selectedRequest.id)
      .then((updatedRequest) => {
        successToast("Modification cloturée");
        return refreshSelectedData(updatedRequest.id, safeStage(updatedRequest.currentStage, Boolean(updatedRequest.newVersion)));
      })
      .catch((exception) => errorAlert(exception?.message || "Cloture de la modification impossible."))
      .finally(() => setSaving(false));
  }

  function handleRejectPhase(validation, stageActions = actions) {
    if (!selectedRequest || !validation) return;
    const completedActions = stageActions.filter(isActionDone);
    const actionsHtml = completedActions.length
      ? completedActions.map((action) => (
        `<label class="swal-action-choice"><input type="checkbox" value="${escapeHtml(action.title || "")}" /> <span>${escapeHtml(action.title || "-")}</span></label>`
      )).join("")
      : "<p class=\"swal-action-empty\">Aucune action terminée dans cette phase.</p>";
    Swal.fire({
      title: "Refuser la phase",
      html: `<textarea id="refusal-reason" class="swal2-textarea" placeholder="Raison du refus: manque document, manque action..."></textarea><div class="swal-action-list-title">Actions à revisiter</div><div id="actions-revisit-list" class="swal-action-list">${actionsHtml}</div>`,
      showCancelButton: true,
      confirmButtonText: "Refuser",
      cancelButtonText: "Annuler",
      confirmButtonColor: "#b42318",
      preConfirm: () => {
        const reason = document.getElementById("refusal-reason")?.value.trim();
        const actionsToRevisit = Array.from(document.querySelectorAll("#actions-revisit-list input:checked"))
          .map((input) => input.value)
          .join("\n");
        if (!reason) {
          Swal.showValidationMessage("Indiquez la raison du refus.");
          return false;
        }
        if (!actionsToRevisit) {
          Swal.showValidationMessage("Sélectionnez au moins une action à revisiter.");
          return false;
        }
        return { reason, actionsToRevisit };
      }
    }).then((result) => {
      if (!result.isConfirmed) return;
      setSaving(true);
      rejectPhaseValidation(selectedRequest.id, validation.id, result.value)
        .then(() => {
          successToast("Phase refusée");
          return refreshPhaseValidations(selectedRequest.id);
        })
        .catch((exception) => errorAlert(exception?.message || "Refus de phase impossible."))
        .finally(() => setSaving(false));
    });
  }

  function handleApproveActionValidation(validation, action) {
    if (!selectedRequest || !validation || !action) return;
    setSaving(true);
    approveActionValidation(selectedRequest.id, validation.id, action.id)
        .then(() => getEcrRequests())
        .then((requestData) => {
          const refreshedRequest = requestData.find((item) => item.id === selectedRequest.id);
          const nextStage = refreshedRequest
              ? safeStage(refreshedRequest.currentStage, Boolean(refreshedRequest.newVersion))
              : selectedStage;

          setSelectedStage(nextStage);
          successToast("Action validée");
          return refreshSelectedData(selectedRequest.id, nextStage);
        })
      .catch((exception) => errorAlert(exception?.message || "Validation de l'action impossible."))
      .finally(() => setSaving(false));
  }

  function handleRejectActionValidation(validation, action) {
    if (!selectedRequest || !validation || !action) return;
    Swal.fire({
      ...swalButtons,
      title: "Refuser l'action ?",
      html: `<textarea id="action-refusal-reason" class="swal2-textarea" placeholder="Motif du refus"></textarea>`,
      showCancelButton: true,
      confirmButtonText: "Refuser",
      cancelButtonText: "Annuler",
      confirmButtonColor: "#b42318",
      preConfirm: () => {
        const reason = document.getElementById("action-refusal-reason")?.value.trim();
        if (!reason) {
          Swal.showValidationMessage("Indiquez le motif du refus.");
          return false;
        }
        return { reason };
      }
    }).then((result) => {
      if (!result.isConfirmed) return;
      setSaving(true);
      rejectActionValidation(selectedRequest.id, validation.id, action.id, result.value)
        .then(() => {
          successToast("Action refusée");
          return refreshSelectedData(selectedRequest.id, selectedStage);
        })
        .catch((exception) => errorAlert(exception?.message || "Refus de l'action impossible."))
        .finally(() => setSaving(false));
    });
  }

  function handleRequestActionValidation(validation, action) {
    if (!selectedRequest || !validation || !action) return;
    setSaving(true);
    requestActionValidation(selectedRequest.id, validation.id, action.id)
      .then(() => {
        successToast("Validation de l'action redemandee");
        return refreshSelectedData(selectedRequest.id, selectedStage);
      })
      .catch((exception) => errorAlert(exception?.message || "Redemande de validation impossible. Vérifiez que l'action est terminée."))
      .finally(() => setSaving(false));
  }

  function handleSaveProject(event) {
    event.preventDefault();
    const name = projectForm.name.trim();
    if (!name) return Promise.reject(new Error("Nom du projet requis."));
    const projectLeadCount = countSelectedProjectLeads(projectForm.projectTeam, users);
    if (projectLeadCount !== 1) {
      const message = "Selectionnez exactement un utilisateur avec le role Chef de projet.";
      setError("Choisissez un et un seul Chef de projet dans l'equipe projet.");
      warningAlert("Chef de projet requis", message);
      return Promise.reject(new Error(message));
    }
    setSaving(true);
    setError("");
    const payload = { name, projectTeam: projectForm.projectTeam.trim() || null };
    const isEdit = Boolean(editingProject);
    const request = isEdit ? updateProject(editingProject, payload) : createProject(payload);
    return request
      .then((savedProject) => {
        setProjects((items) => [...items.filter((item) => item.name !== editingProject && item.name !== savedProject.name), savedProject].sort((a, b) => a.name.localeCompare(b.name)));
        setProjectForm({ name: "", projectTeam: "" });
        setEditingProject(null);
        successToast(isEdit ? "Projet modifie" : "Projet ajoute");
        if (selectedRequest?.modificationProject === savedProject.name || selectedRequest?.modificationProject === editingProject) {
          return refreshCurrentActionsAndRequests();
        }
        return getEcrRequests().then(setRequests);
      })
      .catch(() => {
        const message = "Sauvegarde projet impossible. Vérifiez le nom du projet.";
        setError(message);
        errorAlert(message);
        throw new Error(message);
      })
      .finally(() => setSaving(false));
  }

  function startProjectEdit(project) {
    setEditingProject(project.name);
    setProjectForm({ name: project.name, projectTeam: project.projectTeam || "" });
  }

  function handleDeleteProject(name) {
    setError("");
    confirmDelete("Supprimer le projet ?", `Le projet ${name} sera supprimé définitivement.`).then((result) => {
      if (!result.isConfirmed) return;
      deleteProject(name)
        .then(() => {
          setProjects((items) => items.filter((item) => item.name !== name));
          if (editingProject === name) {
            setEditingProject(null);
            setProjectForm({ name: "", projectTeam: "" });
          }
          successToast("Projet supprime");
        })
        .catch(() => {
          const message = "Suppression projet impossible.";
          setError(message);
          errorAlert(message);
        });
    });
  }

  function handleSaveClientReference(event) {
    event.preventDefault();
    const name = clientReferenceForm.name.trim();
    if (!name) return;
    setSaving(true);
    setError("");
    const isEdit = Boolean(editingClientReference);
    const request = isEdit
      ? updateClientReference(editingClientReference, { name })
      : createClientReference({ name });
    return request
      .then((savedClient) => {
        setClientReferences((items) => [...items.filter((item) => item.id !== savedClient.id), savedClient].sort((a, b) => a.name.localeCompare(b.name)));
        setClientReferenceForm({ name: "" });
        setEditingClientReference(null);
        successToast(isEdit ? "Client modifie" : "Client ajoute");
      })
      .catch((exception) => {
        const message = "Sauvegarde client impossible. Vérifiez le nom.";
        setError(message);
        errorAlert(message);
        throw exception;
      })
      .finally(() => setSaving(false));
  }

  function startClientReferenceEdit(client) {
    setEditingClientReference(client.id);
    setClientReferenceForm({ name: client.name || "" });
  }

  function handleDeleteClientReference(id) {
    const client = clientReferences.find((item) => item.id === id);
    setError("");
    confirmDelete("Supprimer le client ?", `Le client ${client?.name || "sélectionné"} sera supprimé définitivement.`).then((result) => {
      if (!result.isConfirmed) return;
      deleteClientReference(id)
        .then(() => {
          setClientReferences((items) => items.filter((item) => item.id !== id));
          if (editingClientReference === id) {
            setEditingClientReference(null);
            setClientReferenceForm({ name: "" });
          }
          successToast("Client supprime");
        })
        .catch(() => {
          const message = "Suppression client impossible.";
          setError(message);
          errorAlert(message);
        });
    });
  }

  function handleSaveProductReference(event) {
    event.preventDefault();
    const name = productReferenceForm.name.trim();
    if (!name) return;
    setSaving(true);
    setError("");
    const isEdit = Boolean(editingProductReference);
    const request = isEdit
      ? updateProductReference(editingProductReference, { name })
      : createProductReference({ name });
    return request
      .then((savedProduct) => {
        setProductReferences((items) => [...items.filter((item) => item.id !== savedProduct.id), savedProduct].sort((a, b) => a.name.localeCompare(b.name)));
        setProductReferenceForm({ name: "" });
        setEditingProductReference(null);
        successToast(isEdit ? "Produit modifie" : "Produit ajoute");
      })
      .catch((exception) => {
        const message = "Sauvegarde produit impossible. Vérifiez le nom.";
        setError(message);
        errorAlert(message);
        throw exception;
      })
      .finally(() => setSaving(false));
  }

  function startProductReferenceEdit(product) {
    setEditingProductReference(product.id);
    setProductReferenceForm({ name: product.name || "" });
  }

  function handleDeleteProductReference(id) {
    const product = productReferences.find((item) => item.id === id);
    setError("");
    confirmDelete("Supprimer le produit ?", `Le produit ${product?.name || "sélectionné"} sera supprimé définitivement.`).then((result) => {
      if (!result.isConfirmed) return;
      deleteProductReference(id)
        .then(() => {
          setProductReferences((items) => items.filter((item) => item.id !== id));
          if (editingProductReference === id) {
            setEditingProductReference(null);
            setProductReferenceForm({ name: "" });
          }
          successToast("Produit supprime");
        })
        .catch(() => {
          const message = "Suppression produit impossible.";
          setError(message);
          errorAlert(message);
        });
    });
  }

  function finishedProductPayload(form) {
    return {
      client: form.client.trim(),
      project: form.project.trim(),
      partNumber: form.partNumber.trim(),
      designation: form.designation.trim() || null,
      customerPn: form.customerPn.trim() || null,
      product: form.product.trim(),
      coiffeIndex: form.coiffeIndex.trim() || null,
      drawingIndex: form.drawingIndex.trim() || null,
      reducedCode: form.reducedCode.trim(),
      salePrice: form.salePrice === "" ? null : Number(form.salePrice),
      productionIntegrationDate: form.productionIntegrationDate || null,
      comments: form.comments.trim() || null
    };
  }

  function handleSaveFinishedProductReference(event) {
    event.preventDefault();
    const payload = finishedProductPayload(finishedProductReferenceForm);
    if (!payload.client || !payload.project || !payload.product || !payload.partNumber || !payload.reducedCode) {
      warningAlert("Champs requis", "Renseignez client, projet, produit, part number et code réduit.");
      return Promise.reject(new Error("Champs requis."));
    }
    setSaving(true);
    setError("");
    const isEdit = Boolean(editingFinishedProductReference);
    const request = isEdit
      ? updateFinishedProductReference(editingFinishedProductReference, payload)
      : createFinishedProductReference(payload);
    return request
      .then((savedFinishedProduct) => {
        setFinishedProductReferences((items) => [...items.filter((item) => item.id !== savedFinishedProduct.id), savedFinishedProduct]
          .sort((a, b) => [a.project, a.product, a.partNumber].join("|").localeCompare([b.project, b.product, b.partNumber].join("|"))));
        setFinishedProductReferenceForm(emptyFinishedProductForm);
        setEditingFinishedProductReference(null);
        successToast(isEdit ? "Produit fini modifie" : "Produit fini ajoute");
      })
      .catch((exception) => {
        const message = friendlyErrorMessage(exception?.message || "Sauvegarde du produit fini impossible. Vérifiez les clés uniques.");
        setError(message);
        errorAlert(message);
        throw exception;
      })
      .finally(() => setSaving(false));
  }

  function startFinishedProductReferenceEdit(finishedProduct) {
    setEditingFinishedProductReference(finishedProduct.id);
    setFinishedProductReferenceForm({
      client: finishedProduct.client || "",
      project: finishedProduct.project || "",
      partNumber: finishedProduct.partNumber || "",
      designation: finishedProduct.designation || "",
      customerPn: finishedProduct.customerPn || "",
      product: finishedProduct.product || "",
      coiffeIndex: finishedProduct.coiffeIndex || "",
      drawingIndex: finishedProduct.drawingIndex || "",
      reducedCode: finishedProduct.reducedCode || "",
      salePrice: finishedProduct.salePrice ?? "",
      productionIntegrationDate: finishedProduct.productionIntegrationDate || "",
      comments: finishedProduct.comments || ""
    });
  }

  function handleDeleteFinishedProductReference(id) {
    const finishedProduct = finishedProductReferences.find((item) => item.id === id);
    setError("");
    confirmDelete("Supprimer le produit fini ?", `Le produit fini ${finishedProduct?.partNumber || "sélectionné"} sera supprimé définitivement.`).then((result) => {
      if (!result.isConfirmed) return;
      deleteFinishedProductReference(id)
        .then(() => {
          setFinishedProductReferences((items) => items.filter((item) => item.id !== id));
          if (editingFinishedProductReference === id) {
            setEditingFinishedProductReference(null);
            setFinishedProductReferenceForm(emptyFinishedProductForm);
          }
          successToast("Produit fini supprime");
        })
        .catch(() => {
          const message = "Suppression produit fini impossible.";
          setError(message);
          errorAlert(message);
        });
    });
  }

  function handleImportFinishedProducts(file) {
    if (!file) return Promise.resolve();
    setSaving(true);
    setError("");
    return importFinishedProductReferences(file)
      .then((result) => getFinishedProductReferences().then((items) => {
        setFinishedProductReferences(items);
        const issues = result.issues || [];
        const issuePreview = issues
          .slice(0, 8)
          .map((issue) => `Ligne ${issue.rowNumber || "-"}: ${issue.message}`)
          .join("\n");
        Swal.fire({
          icon: result.createdCount > 0 ? "success" : "info",
          title: "Import produits finis",
          text: [
            `${result.createdCount || 0} produit(s) fini(s) ajoute(s).`,
            `${result.skippedCount || 0} ligne(s) ignoree(s).`,
            issuePreview,
            issues.length > 8 ? `... ${issues.length - 8} autre(s) alerte(s).` : ""
          ].filter(Boolean).join("\n"),
          confirmButtonColor: "#6b7f13"
        });
      }))
      .catch((exception) => {
        const message = friendlyErrorMessage(exception?.message || "Import des produits finis impossible.");
        setError(message);
        errorAlert(message);
      })
      .finally(() => setSaving(false));
  }

  function handleSaveRoleReference(event) {
    event.preventDefault();
    const name = roleReferenceForm.name.trim();
    if (!name) return;
    setSaving(true);
    setError("");
    const isEdit = Boolean(editingRoleReference);
    const request = isEdit
      ? updateRoleReference(editingRoleReference, { name })
      : createRoleReference({ name });
    return request
      .then((savedRole) => {
        setRoleReferences((items) => [...items.filter((item) => item.id !== savedRole.id), savedRole].sort((a, b) => a.name.localeCompare(b.name)));
        setRoleReferenceForm({ name: "" });
        setEditingRoleReference(null);
        successToast(isEdit ? "Rôle modifié" : "Rôle ajouté");
      })
      .catch((exception) => {
        const message = "Sauvegarde rôle impossible. Vérifiez le nom.";
        setError(message);
        errorAlert(message);
        throw exception;
      })
      .finally(() => setSaving(false));
  }

  function startRoleReferenceEdit(role) {
    setEditingRoleReference(role.id);
    setRoleReferenceForm({ name: role.name || "" });
  }

  function handleDeleteRoleReference(id) {
    const role = roleReferences.find((item) => item.id === id);
    setError("");
    confirmDelete("Supprimer le rôle ?", `Le rôle ${role?.name || "sélectionné"} sera supprimé définitivement.`).then((result) => {
      if (!result.isConfirmed) return;
      deleteRoleReference(id)
        .then(() => {
          setRoleReferences((items) => items.filter((item) => item.id !== id));
          if (editingRoleReference === id) {
            setEditingRoleReference(null);
            setRoleReferenceForm({ name: "" });
          }
          successToast("Rôle supprimé");
        })
        .catch(() => {
          const message = "Suppression rôle impossible.";
          setError(message);
          errorAlert(message);
        });
    });
  }

  function handleSavePlanningRule(event) {
    event.preventDefault();
    if (!planningRuleForm.actionTitle.trim()) return;
    const proofDocumentFiles = filesFromValue(planningRuleForm.proofDocumentFile);
    const proofDocumentLink = { name: planningRuleForm.proofDocumentLinkName, url: planningRuleForm.proofDocumentLinkUrl };
    const hasProofDocumentLink = Boolean(proofDocumentLink.url?.trim());
    setSaving(true);
    setError("");
    const payload = {
      ...planningRuleForm,
      proofDocumentFile: undefined,
      proofDocumentLinkName: undefined,
      proofDocumentLinkUrl: undefined,
      actionTitle: planningRuleForm.actionTitle.trim(),
      topicRisk: planningRuleForm.topicRisk.trim() || null,
      responsible: planningRuleForm.responsible.trim() || null,
      validator: planningRuleForm.validator.trim() || null,
      expectedEvidence: planningRuleForm.expectedEvidence.trim() || null,
      evidenceRequired: planningRuleForm.evidenceRequired || proofDocumentFiles.length > 0 || hasProofDocumentLink || hasPlanningRuleProofDocument(planningRuleForm),
      dependencyActionTitle: planningRuleForm.routineAction ? null : planningRuleForm.dependencyActionTitle.trim() || null,
      dependencyAnchor: "OUTPUT",
      routineAction: Boolean(planningRuleForm.routineAction),
      recurrenceIntervalDays: planningRuleForm.routineAction ? Math.max(1, Number(planningRuleForm.recurrenceIntervalDays) || 1) : null,
      durationDays: Number(planningRuleForm.durationDays) || 0
    };
    const isEdit = Boolean(editingPlanningRule);
    const request = isEdit ? updateActionPlanningRule(editingPlanningRule, payload) : createActionPlanningRule(payload);
    request
      .then((savedRule) => {
        const fileUpload = proofDocumentFiles.length === 0 ? Promise.resolve(savedRule) : uploadActionPlanningRuleProofDocumentFiles(savedRule.id, proofDocumentFiles);
        return fileUpload.then((ruleWithFiles) => (hasProofDocumentLink ? uploadActionPlanningRuleProofDocumentLink(ruleWithFiles.id, proofDocumentLink) : ruleWithFiles));
      })
      .then((savedRule) => {
        setPlanningRules((items) => [...items.filter((item) => item.id !== savedRule.id), savedRule].sort(comparePlanningRules));
        setPlanningRuleForm(emptyPlanningRuleForm);
        setEditingPlanningRule(null);
        successToast(isEdit ? "Règle planning modifiée" : "Règle planning ajoutée");
        return selectedId ? Promise.all([getActions(selectedId, selectedStage), getEcrRequests()]) : Promise.resolve([actions, requests]);
      })
      .then(([actionData, requestData]) => {
        if (Array.isArray(actionData)) setActions(actionData);
        if (Array.isArray(requestData)) setRequests(requestData);
      })
      .catch(() => {
        const message = "Sauvegarde règle planning impossible. Vérifiez l'action et la durée.";
        setError(message);
        errorAlert(message);
      })
      .finally(() => setSaving(false));
  }

  function handleDeletePlanningRuleProofDocument(ruleId) {
    if (!ruleId) {
      setPlanningRuleForm((form) => ({ ...form, proofDocumentFile: null }));
      return;
    }
    confirmDelete("Supprimer l'élément preuve ?", "Le document sera supprimé de cette action standard et de Cloudinary.").then((result) => {
      if (!result.isConfirmed) return;
      setSaving(true);
      setError("");
      deleteActionPlanningRuleProofDocument(ruleId)
        .then((savedRule) => {
          setPlanningRules((items) => [...items.filter((item) => item.id !== savedRule.id), savedRule].sort(comparePlanningRules));
          setPlanningRuleForm((form) => ({
            ...form,
            proofDocument: "",
            proofDocumentFile: null,
            proofDocumentFileName: "",
            proofDocumentFileUrl: "",
            proofDocumentContentType: "",
            proofDocumentFileSize: null,
            proofDocumentPublicId: "",
            proofDocumentResourceType: "",
            proofDocuments: []
          }));
          successToast("Element preuve supprime");
        })
        .catch(() => {
          const message = "Suppression de l'élément preuve impossible.";
          setError(message);
          errorAlert(message);
        })
        .finally(() => setSaving(false));
    });
  }

  function handleDeletePlanningRuleProofDocumentItem(proofDocumentId) {
    if (!proofDocumentId) return;
    confirmDelete("Supprimer l'élément preuve ?", "Le document sera supprimé de cette action standard et de Cloudinary.").then((result) => {
      if (!result.isConfirmed) return;
      setSaving(true);
      setError("");
      deleteActionPlanningRuleProofDocumentItem(proofDocumentId)
        .then((savedRule) => {
          setPlanningRules((items) => [...items.filter((item) => item.id !== savedRule.id), savedRule].sort(comparePlanningRules));
          setPlanningRuleForm((form) => form.id === savedRule.id ? { ...form, ...savedRule, proofDocumentFile: form.proofDocumentFile } : form);
          successToast("Element preuve supprime");
        })
        .catch(() => {
          const message = "Suppression de l'élément preuve impossible.";
          setError(message);
          errorAlert(message);
        })
        .finally(() => setSaving(false));
    });
  }

  function handleAddSuggestionToDefaults(suggestion) {
    if (!suggestion) return;
    setSaving(true);
    addActionSuggestionToDefaults(suggestion.id)
      .then(() => Promise.all([getActionPlanningRules(), refreshActionSuggestions()]))
      .then(([rules]) => {
        setPlanningRules(rules);
        successToast("Action ajoutee aux actions standard");
      })
      .catch((exception) => {
        const message = String(exception?.message || "");
        errorAlert(message.includes("409") ? "Une action standard avec ce nom existe déjà dans cette phase." : "Ajout aux actions standard impossible.");
      })
      .finally(() => setSaving(false));
  }

  function handleIgnoreSuggestion(suggestion) {
    if (!suggestion) return;
    setSaving(true);
    ignoreActionSuggestion(suggestion.id)
      .then(refreshActionSuggestions)
      .then(() => successToast("Suggestion ignoree"))
      .finally(() => setSaving(false));
  }

  function startPlanningRuleEdit(rule) {
    setEditingPlanningRule(rule.id);
    setPlanningRuleForm({
      stage: rule.stage,
      id: rule.id,
      appliesToModification: rule.appliesToModification ?? true,
      appliesToNewProject: rule.appliesToNewProject ?? true,
      actionTitle: rule.actionTitle || "",
      topicRisk: rule.topicRisk || "",
      responsible: rule.responsible || "",
      validator: rule.validator || "",
      criticality: rule.criticality || "3-faible",
      expectedEvidence: rule.expectedEvidence || "",
      proofDocument: rule.proofDocument || "",
      proofDocumentFile: null,
      proofDocumentFileName: rule.proofDocumentFileName || "",
      proofDocumentFileUrl: rule.proofDocumentFileUrl || "",
      proofDocumentContentType: rule.proofDocumentContentType || "",
      proofDocumentFileSize: rule.proofDocumentFileSize || null,
      proofDocumentPublicId: rule.proofDocumentPublicId || "",
      proofDocumentResourceType: rule.proofDocumentResourceType || "",
      proofDocuments: rule.proofDocuments || [],
      evidenceRequired: Boolean(rule.evidenceRequired),
      dependencyActionTitle: rule.dependencyActionTitle || "",
      dependencyAnchor: rule.dependencyAnchor || "OUTPUT",
      routineAction: Boolean(rule.routineAction),
      recurrenceIntervalDays: rule.recurrenceIntervalDays || 7,
      durationDays: rule.durationDays ?? 1
    });
  }

  function handleDeletePlanningRule(id) {
    const rule = planningRules.find((item) => item.id === id);
    setError("");
    confirmDelete("Supprimer la règle planning ?", `La règle ${rule?.actionTitle || "sélectionnée"} sera supprimée définitivement.`).then((result) => {
      if (!result.isConfirmed) return;
      deleteActionPlanningRule(id)
        .then(() => {
          setPlanningRules((items) => items.filter((item) => item.id !== id));
          if (editingPlanningRule === id) {
            setEditingPlanningRule(null);
            setPlanningRuleForm(emptyPlanningRuleForm);
          }
          successToast("Règle planning supprimée");
          return selectedId ? refreshSelectedData(selectedId, selectedStage) : Promise.resolve();
        })
        .catch(() => {
          const message = "Suppression règle planning impossible.";
          setError(message);
          errorAlert(message);
        });
    });
  }

  function handleSaveUser(event) {
    event.preventDefault();
    const { profilePhotoFile, profilePhotoUrl, ...userPayload } = userForm;
    const payload = {
      ...userPayload,
      fullName: userForm.fullName.trim(),
      username: userForm.username.trim(),
      email: userForm.email.trim(),
      jobTitle: userForm.jobTitle.trim(),
      phone: userForm.phone.trim(),
      chef1: userForm.chef1.trim(),
      chef2: userForm.chef2.trim()
    };
    if (!payload.chef1 || !payload.chef2) {
      const message = "Affectez Chef 1 et Chef 2 avant d'enregistrer l'utilisateur.";
      setError(message);
      warningAlert("Chefs requis", message);
      return;
    }
    if (!isValidEmail(payload.email)) {
      const message = "Saisissez une adresse email valide, par exemple nom@sagetunisia.com.";
      setError(message);
      warningAlert("Email invalide", message);
      return;
    }
    if (!isValidPhone(payload.phone)) {
      const message = "Saisissez un numéro de téléphone valide: 8 à 20 caractères, chiffres, espaces, +, -, points ou parenthèses.";
      setError(message);
      warningAlert("Téléphone invalide", message);
      return;
    }
    setSaving(true);
    setError("");
    const isEdit = Boolean(editingUser);
    const nextPassword = isEdit ? String(payload.password || "").trim() : "";
    if (isEdit) {
      delete payload.password;
    }
    const request = isEdit ? updateUser(editingUser, payload) : createUser(payload);
    request
      .then((savedUser) => (
        isEdit && nextPassword
          ? changeUserPassword(savedUser.id, nextPassword).then(() => savedUser)
          : savedUser
      ))
      .then((savedUser) => (
        profilePhotoFile
          ? uploadUserPhoto(savedUser.id, profilePhotoFile)
          : savedUser
      ))
      .then((savedUser) => {
        setUsers((items) => [...items.filter((item) => item.id !== savedUser.id), savedUser].sort((a, b) => String(a.fullName).localeCompare(String(b.fullName))));
        if (currentUser?.id === savedUser.id) {
          setCurrentUser(savedUser);
          setProfileForm(userToForm(savedUser));
        }
        setUserForm(emptyUserForm);
        setEditingUser(null);
        successToast(isEdit ? "Utilisateur modifie" : "Utilisateur ajoute");
        return selectedId ? refreshSelectedData(selectedId, selectedStage) : Promise.resolve();
      })
      .catch((exception) => {
        const detail = exception?.message || "";
        const message = detail && !detail.startsWith("API error")
          ? detail
          : "Sauvegarde utilisateur impossible. Vérifiez username/email uniques, les champs obligatoires et la configuration SMTP.";
        setError(message);
        errorAlert(message);
      })
      .finally(() => setSaving(false));
  }

  function startUserEdit(user) {
    setEditingUser(user.id);
    setUserForm(userToForm(user));
  }

  function handleDeleteUser(id) {
    const user = users.find((item) => item.id === id);
    setError("");
    confirmDelete("Supprimer l'utilisateur ?", `Le compte ${user?.fullName || user?.email || "sélectionné"} sera supprimé définitivement.`).then((result) => {
      if (!result.isConfirmed) return;
      deleteUser(id)
        .then(() => {
          setUsers((items) => items.filter((item) => item.id !== id));
          if (editingUser === id) {
            setEditingUser(null);
            setUserForm(emptyUserForm);
          }
          successToast("Utilisateur supprime");
          return selectedId ? refreshSelectedData(selectedId, selectedStage) : Promise.resolve();
        })
        .catch(() => {
          const message = "Suppression utilisateur impossible.";
          setError(message);
          errorAlert(message);
        });
    });
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
        successToast("Profil mis a jour");
        return selectedId ? refreshSelectedData(selectedId, selectedStage) : Promise.resolve();
      })
      .catch(() => {
        const message = "Mise à jour du profil impossible.";
        setError(message);
        errorAlert(message);
      })
      .finally(() => setSaving(false));
  }

  function handleChangePassword(event) {
    event.preventDefault();
    if (!currentUser) return;
    if (!passwordForm.password || passwordForm.password !== passwordForm.confirmation) {
      const message = "Confirmez le nouveau mot de passe avec la meme valeur.";
      setError(message);
      warningAlert("Confirmation requise", message);
      return;
    }
    setSaving(true);
    setError("");
    changeUserPassword(currentUser.id, passwordForm.password)
      .then(() => {
        setPasswordForm({ password: "", confirmation: "" });
        successToast("Mot de passe modifie");
      })
      .catch(() => {
        const message = "Changement de mot de passe impossible.";
        setError(message);
        errorAlert(message);
      })
      .finally(() => setSaving(false));
  }

  function handleUploadUserPhoto(file) {
    if (!currentUser || !file) return;
    setError("");
    uploadUserPhoto(currentUser.id, file)
      .then((savedUser) => {
        setCurrentUser(savedUser);
        setUsers((items) => items.map((item) => (item.id === savedUser.id ? savedUser : item)));
        successToast("Photo mise à jour");
      })
      .catch(() => {
        const message = "Ajout de la photo impossible.";
        setError(message);
        errorAlert(message);
      });
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
        const authenticatedUserName = session.user?.fullName || session.user?.username || session.user?.email || "";
        successToast(`Welcome Back${authenticatedUserName ? ` : ${authenticatedUserName}` : ""}`);
      })
      .catch(() => {
        const message = "Email ou mot de passe incorrect.";
        setError(message);
        errorAlert(message);
      })
      .finally(() => setSaving(false));
  }

  function resetPasswordRecoveryState() {
    setPasswordResetStep("login");
    setPasswordResetEmail("");
    setPasswordResetCode(["", "", "", ""]);
    setPasswordResetForm({ password: "", confirmation: "" });
    setError("");
  }

  function showForgotPassword() {
    setPasswordResetEmail(loginForm.email || "");
    setPasswordResetCode(["", "", "", ""]);
    setPasswordResetForm({ password: "", confirmation: "" });
    setPasswordResetStep("email");
    setError("");
  }

  function handleRequestPasswordReset(event) {
    event.preventDefault();
    if (!isValidEmail(passwordResetEmail)) {
      const message = "Saisissez une adresse email valide.";
      setError(message);
      warningAlert("Email invalide", message);
      return;
    }
    setSaving(true);
    setError("");
    requestPasswordReset(passwordResetEmail)
      .then(() => {
        setPasswordResetCode(["", "", "", ""]);
        setPasswordResetStep("code");
        successToast("Code envoyé par email");
      })
      .catch((error) => {
        const message = error?.message || "Envoi du code impossible.";
        setError(message);
        errorAlert(message);
      })
      .finally(() => setSaving(false));
  }

  function handleResendPasswordResetCode() {
    if (!passwordResetEmail) return;
    setSaving(true);
    setError("");
    requestPasswordReset(passwordResetEmail)
      .then(() => {
        setPasswordResetCode(["", "", "", ""]);
        successToast("Nouveau code envoyé");
      })
      .catch((error) => {
        const message = error?.message || "Renvoi du code impossible.";
        setError(message);
        errorAlert(message);
      })
      .finally(() => setSaving(false));
  }

  function handleVerifyPasswordResetCode(event) {
    event.preventDefault();
    const code = passwordResetCode.join("");
    if (!code.match(/^\d{4}$/)) {
      const message = "Saisissez les 4 chiffres du code reçu.";
      setError(message);
      warningAlert("Code incomplet", message);
      return;
    }
    setSaving(true);
    setError("");
    verifyPasswordResetCode(passwordResetEmail, code)
      .then(() => {
        setPasswordResetStep("password");
        successToast("Code valide");
      })
      .catch(() => {
        const message = "Code incorrect ou expire.";
        setError(message);
        errorAlert(message);
      })
      .finally(() => setSaving(false));
  }

  function handleConfirmPasswordReset(event) {
    event.preventDefault();
    const code = passwordResetCode.join("");
    if (!passwordResetForm.password || passwordResetForm.password !== passwordResetForm.confirmation) {
      const message = "Confirmez le nouveau mot de passe avec la meme valeur.";
      setError(message);
      warningAlert("Confirmation requise", message);
      return;
    }
    setSaving(true);
    setError("");
    confirmPasswordReset(passwordResetEmail, code, passwordResetForm.password)
      .then(() => {
        resetPasswordRecoveryState();
        setLoginForm({ email: passwordResetEmail, password: "" });
        successToast("Mot de passe modifié");
      })
      .catch(() => {
        const message = "Changement du mot de passe impossible. Redemandez un code.";
        setError(message);
        errorAlert(message);
      })
      .finally(() => setSaving(false));
  }

  function handleLogout() {
    Swal.fire({
      title: "Se déconnecter ?",
      text: "Votre session active sera fermée.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Se déconnecter",
      cancelButtonText: "Annuler",
      ...swalButtons
    }).then((result) => {
      if (!result.isConfirmed) return;
      (getStoredSession()?.token ? chatOffline().catch(() => {}) : Promise.resolve())
        .then(() => logout())
        .catch(() => clearSession())
        .finally(() => {
          setAuthSession(null);
          setCurrentUser(null);
          setRequests([]);
          setUsers([]);
          setChatUsers([]);
          setChatMessages([]);
          setSelectedChatUserId(null);
          navigateToPage("dashboard", { replace: true });
          successToast("Déconnexion effectuée");
        });
    });
  }

  function openCreateFlow() {
    navigateToPage("modifications");
    setShowEditForm(false);
    setEditingEcrRequest(null);
    setShowCreateForm(true);
  }

  function handleNavigate(nextPage, event) {
    if (event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      event.preventDefault();
    }
    if (nextPage === "modifications") {
      const request = selectedRequest || requests.find((item) => item.id === selectedId) || requests[0];
      if (request) {
        setSelectedId(request.id);
        setSelectedStage(safeStage(request.currentStage, Boolean(request.newVersion)));
      }
    }
    navigateToPage(nextPage);
    setShowCreateForm(false);
    setShowEditForm(false);
    setEditingEcrRequest(null);
  }

  if (loading) {
    return <main className="centered">Chargement...</main>;
  }

  if (!authSession?.token) {
    return (
      <LoginPage
        error={error}
        form={loginForm}
        passwordResetCode={passwordResetCode}
        passwordResetEmail={passwordResetEmail}
        passwordResetForm={passwordResetForm}
        passwordResetStep={passwordResetStep}
        saving={saving}
        onBackToLogin={resetPasswordRecoveryState}
        onConfirmPasswordReset={handleConfirmPasswordReset}
        onRequestPasswordReset={handleRequestPasswordReset}
        onResendPasswordResetCode={handleResendPasswordResetCode}
        onShowForgotPassword={showForgotPassword}
        onSubmit={handleLogin}
        onVerifyPasswordResetCode={handleVerifyPasswordResetCode}
        setForm={setLoginForm}
        setPasswordResetCode={setPasswordResetCode}
        setPasswordResetEmail={setPasswordResetEmail}
        setPasswordResetForm={setPasswordResetForm}
      />
    );
  }

  return (
    <main className={menuCollapsed ? "app-frame nav-collapsed" : "app-frame"}>
      <Sidebar
          collapsed={menuCollapsed}
          canAdmin={isAdminUser(currentUser)}
          currentUser={currentUser}
          page={page}
          pageHref={routeForPage}
          onCollapseToggle={() => setMenuCollapsed((collapsed) => !collapsed)}
          onLogout={handleLogout}
          onNavigate={handleNavigate}
      />
      <section className="page-shell">
        {error && (
          <div className="banner">
            <CircleAlert size={18} />
            {error}
          </div>
        )}

        {isAdminUser(currentUser) && actionSuggestions.length > 0 && (
          <div className="banner action-suggestion-banner">
            <CircleAlert size={18} />
            {actionSuggestions.length} action{actionSuggestions.length > 1 ? "s" : ""} créée{actionSuggestions.length > 1 ? "s" : ""} par pilote en attente de decision.
            <button className="secondary-action compact-action" type="button" onClick={() => setSuggestionsOpen(true)}>
              Voir
            </button>
          </div>
        )}

        {page === "dashboard" && (
          <DashboardPage
            clients={clientReferences}
            currentUser={currentUser}
            downloadBlobFile={downloadBlobFile}
            downloadHtmlAsPdf={downloadHtmlAsPdf}
            downloadTextFile={downloadTextFile}
            errorAlert={errorAlert}
            planningRules={planningRules}
            products={productReferences}
            projects={projects}
            requests={requests}
            roles={roleReferences}
            saving={saving}
            stats={dashboardStats}
            successToast={successToast}
            users={users}
            warningAlert={warningAlert}
            onCreateRequest={openCreateFlow}
            onOpenRequest={openRequest}
          />
        )}

        {page === "projects" && (
          <ProjectsPage
            actionRoleOptions={actionRoleOptions}
            planningRuleForm={planningRuleForm}
            planningRules={planningRules}
            saving={saving}
            onCancelPlanningRuleEdit={() => {
              setEditingPlanningRule(null);
              setPlanningRuleForm(emptyPlanningRuleForm);
            }}
            onDeletePlanningRule={handleDeletePlanningRule}
            onDeletePlanningRuleProofDocument={handleDeletePlanningRuleProofDocument}
            onDeletePlanningRuleProofDocumentItem={handleDeletePlanningRuleProofDocumentItem}
            onEditPlanningRule={startPlanningRuleEdit}
            onSubmitPlanningRule={handleSavePlanningRule}
            setPlanningRuleForm={setPlanningRuleForm}
          />
        )}

        {page === "ask-ai" && (
          <AskAiFinishedProductPage
            finishedProducts={finishedProductReferences}
            requests={requests}
            warningAlert={warningAlert}
            onOpenRequest={openRequest}
          />
        )}

        {page === "traceability" && (
          <TraceabilityPage
            actionFilter={auditActionFilter}
            actionOptions={auditActionOptions}
            logs={filteredAuditLogs}
            query={auditQuery}
            total={auditLogs.length}
            onRefresh={() => getAuditLogs().then(setAuditLogs)}
            setActionFilter={setAuditActionFilter}
            setQuery={setAuditQuery}
          />
        )}

        {page === "messages" && (
          <MessagingPage
            currentUser={currentUser}
            draft={chatDraft}
            file={chatFile}
            fileInputRef={chatFileInputRef}
            groupFormOpen={chatGroupFormOpen}
            groupMemberIds={chatGroupMemberIds}
            groupName={chatGroupName}
            groupProjectName={chatGroupProjectName}
            messages={chatMessages}
            projects={projects}
            selectedUserId={selectedChatUserId}
            sending={chatSending}
            typingNotice={chatTypingNotice}
            users={chatUsers}
            onClearFile={clearChatFile}
            onAddGroupMember={handleAddChatGroupMember}
            onCreateGroup={handleCreateChatGroup}
            onDraftChange={handleChatDraftChange}
            onFileChange={handleChatFileChange}
            onGroupMemberToggle={handleToggleChatGroupMember}
            onGroupProjectChange={handleChatGroupProjectChange}
            onRefresh={() => refreshChatData()}
            onSelectUser={handleSelectChatUser}
            onSend={handleSendChatMessage}
            setGroupFormOpen={setChatGroupFormOpen}
            setGroupName={setChatGroupName}
            setGroupProjectName={setChatGroupProjectName}
          />
        )}

        {page === "preferentials" && (
          <PreferentialsPage
            clientForm={clientReferenceForm}
            clients={clientReferences}
            editingClient={editingClientReference}
            editingFinishedProduct={editingFinishedProductReference}
            editingProduct={editingProductReference}
            editingProject={editingProject}
            editingRole={editingRoleReference}
            finishedProductForm={finishedProductReferenceForm}
            finishedProducts={finishedProductReferences}
            productForm={productReferenceForm}
            products={productReferences}
            projectForm={projectForm}
            projects={projects}
            roleForm={roleReferenceForm}
            roles={roleReferences}
            saving={saving}
            users={users}
            onCancelClientEdit={() => {
              setEditingClientReference(null);
              setClientReferenceForm({ name: "" });
            }}
            onCancelFinishedProductEdit={() => {
              setEditingFinishedProductReference(null);
              setFinishedProductReferenceForm(emptyFinishedProductForm);
            }}
            onCancelProductEdit={() => {
              setEditingProductReference(null);
              setProductReferenceForm({ name: "" });
            }}
            onCancelRoleEdit={() => {
              setEditingRoleReference(null);
              setRoleReferenceForm({ name: "" });
            }}
            onCancelProjectEdit={() => {
              setEditingProject(null);
              setProjectForm({ name: "", projectTeam: "" });
            }}
            onDeleteClient={handleDeleteClientReference}
            onDeleteFinishedProduct={handleDeleteFinishedProductReference}
            onDeleteProduct={handleDeleteProductReference}
            onDeleteProject={handleDeleteProject}
            onDeleteRole={handleDeleteRoleReference}
            onEditClient={startClientReferenceEdit}
            onEditFinishedProduct={startFinishedProductReferenceEdit}
            onEditProduct={startProductReferenceEdit}
            onEditProject={startProjectEdit}
            onEditRole={startRoleReferenceEdit}
            onImportFinishedProducts={handleImportFinishedProducts}
            onSubmitClient={handleSaveClientReference}
            onSubmitFinishedProduct={handleSaveFinishedProductReference}
            onSubmitProduct={handleSaveProductReference}
            onSubmitProject={handleSaveProject}
            onSubmitRole={handleSaveRoleReference}
            setClientForm={setClientReferenceForm}
            setFinishedProductForm={setFinishedProductReferenceForm}
            setProductForm={setProductReferenceForm}
            setProjectForm={setProjectForm}
            setRoleForm={setRoleReferenceForm}
          />
        )}

        {page === "modifications" && (
          <ModificationsPage
            actionForm={actionForm}
            actionRoleOptions={actionRoleOptions}
            actions={actions}
            actionsByRequestId={actionsByRequestId}
            auditLogs={auditLogs}
            checklist={checklist}
            completion={completion}
            doneCount={doneCount}
            downloadBlobFile={downloadBlobFile}
            downloadHtmlAsPdf={downloadHtmlAsPdf}
            downloadTextFile={downloadTextFile}
            errorAlert={errorAlert}
            filteredRequests={filteredRequests}
            currentUser={currentUser}
            lateActions={lateActions}
            phaseValidations={phaseValidations}
            projectFilter={projectFilter}
            projectOptions={projectOptions}
            query={query}
            requests={requests}
            requestSearchSuggestions={requestSearchSuggestions}
            requestArchiveView={requestArchiveView}
            requestTypeFilter={requestTypeFilter}
            saving={saving}
            selectedId={selectedId}
            selectedRequest={selectedRequest}
            selectedStages={visibleStages}
            selectedStage={selectedStage}
            successToast={successToast}
            setQuery={setQuery}
            setProjectFilter={setProjectFilter}
            setSelectedId={setSelectedId}
            setSelectedStage={setSelectedStage}
            setShowCreateForm={setShowCreateForm}
            setRequestTypeFilter={setRequestTypeFilter}
            onRequestArchiveViewChange={handleRequestArchiveViewChange}
            handleCreateAction={handleCreateAction}
            handleArchiveEcr={handleArchiveEcr}
            handleCancelEcr={handleCancelEcr}
            handleDeleteAction={handleDeleteAction}
            handleStageChange={handleStageChange}
            handleToggleAction={handleToggleAction}
            handleUpdateActionDuration={handleUpdateActionDuration}
            handleDeleteActionAsset={handleDeleteActionAsset}
            handleUploadEvidence={handleUploadEvidence}
            handleAddEvidenceLink={handleAddEvidenceLink}
            removeActionProofDocumentFile={removeActionProofDocumentFile}
            handleApprovePhase={handleApprovePhase}
            handleApproveActionValidation={handleApproveActionValidation}
            handleCloseRequest={handleCloseRequest}
            handleRejectActionValidation={handleRejectActionValidation}
            handleRequestActionValidation={handleRequestActionValidation}
            handleRejectPhase={handleRejectPhase}
            handleReopenPhase={handleReopenPhase}
            handleRequestClosure={handleRequestClosure}
            handleRequestPhaseValidation={handleRequestPhaseValidation}
            isCriticalAction={isCriticalAction}
            onEditRequest={openEditEcr}
            onUpdateDossierReview={handleUpdateDossierReview}
            requiresEvidence={requiresEvidence}
            updateActionForm={updateActionForm}
          />
        )}

        {page === "users" && (
          <UsersPage
            actionRoleOptions={actionRoleOptions}
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

      <AskAiFloatingButton onClick={() => setQuickAskAiOpen(true)} />
      <ChatFloatingButton count={chatNotificationCount} onClick={openQuickChat} />

      {quickAskAiOpen && (
        <QuickAskAiPanel
          finishedProducts={finishedProductReferences}
          requests={requests}
          warningAlert={warningAlert}
          onClose={() => setQuickAskAiOpen(false)}
          onOpenRequest={(request) => {
            setQuickAskAiOpen(false);
            openRequest(request);
          }}
        />
      )}

      {quickChatOpen && (
        <QuickChatPanel
          currentUser={currentUser}
          draft={chatDraft}
          file={chatFile}
          fileInputRef={chatFileInputRef}
          messages={chatMessages}
          selectedUser={chatUsers.find((user) => chatTargetKey(user) === selectedChatUserId)}
          sending={chatSending}
          typingNotice={chatTypingNotice}
          users={chatUsers}
          onClearFile={clearChatFile}
          onClose={() => setQuickChatOpen(false)}
          onDraftChange={handleChatDraftChange}
          onFileChange={handleChatFileChange}
          onSelectUser={handleSelectChatUser}
          onSend={handleSendChatMessage}
        />
      )}

      {showCreateForm && page === "modifications" && (
        <CreateModificationDialog
          clientOptions={clientOptions}
          ecrForm={ecrForm}
          finishedProductReferences={finishedProductReferences}
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
          finishedProductReferences={finishedProductReferences}
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

      {suggestionsOpen && isAdminUser(currentUser) && actionSuggestions.length > 0 && (
        <ActionSuggestionDialog
          saving={saving}
          suggestions={actionSuggestions}
          onAdd={handleAddSuggestionToDefaults}
          onClose={() => setSuggestionsOpen(false)}
          onIgnore={handleIgnoreSuggestion}
        />
      )}
    </main>
  );
}

function normalizeAuditLog(log) {
  if (!log) return null;
  if (visibleAuditActionTypes.includes(log.actionType)) return log;
  const path = String(log.path || "").toLowerCase();
  const method = String(log.httpMethod || "").toUpperCase();
  const targetType = String(log.targetType || "").toLowerCase();
  let actionType = null;
  let normalizedTargetType = log.targetType;

  if (method === "POST" && path === "/api/ecr-requests") {
    actionType = "CREATION_MODIFICATION";
    normalizedTargetType = "modification";
  } else if (method === "PUT" && path.match(/^\/api\/ecr-requests\/\d+$/)) {
    actionType = "MODIFICATION_MODIFICATION";
    normalizedTargetType = "modification";
  } else if (method === "POST" && path.match(/\/phase-validations\/\d+\/approve$/)) {
    actionType = "VALIDATION_PHASE";
    normalizedTargetType = "phase";
  } else if (method === "PATCH" && path.includes("/stage")) {
    actionType = "REOUVERTURE_PHASE";
    normalizedTargetType = "phase";
  } else if (method === "POST" && path.match(/\/phase-validations\/\d+\/actions\/\d+\/approve$/)) {
    actionType = "VALIDATION_ACTION";
    normalizedTargetType = "action";
  } else if (method === "POST" && path.match(/\/phase-validations\/\d+\/actions\/\d+\/reject$/)) {
    actionType = "REFUS_VALIDATION_ACTION";
    normalizedTargetType = "action";
  } else if (method === "PUT" && targetType === "actions") {
    actionType = "ACTION_TERMINEE";
    normalizedTargetType = "action";
  } else if (method === "POST" && path === "/api/preferentials/clients") {
    actionType = "AJOUT_CLIENT";
    normalizedTargetType = "client";
  } else if (method === "POST" && path === "/api/preferentials/products") {
    actionType = "AJOUT_PRODUIT";
    normalizedTargetType = "produit";
  } else if (method === "POST" && path === "/api/projects") {
    actionType = "AJOUT_PROJET";
    normalizedTargetType = "projet";
  } else if (method === "PUT" && path.startsWith("/api/projects/")) {
    actionType = "MODIFICATION_PROJET_EQUIPE";
    normalizedTargetType = "projet";
  }

  return actionType ? { ...log, actionType, targetType: normalizedTargetType } : null;
}

function auditTargetLabel(targetType) {
  const labels = {
    action: "Action",
    actions: "Action",
    "action-assets": "Asset action",
    "action-planning-rules": "Action standard",
    auth: "Authentification",
    client: "Client",
    documents: "Document",
    "ecr-requests": "Modification",
    modification: "Modification",
    penalties: "Penalite",
    preferentials: "Referentiel",
    phase: "Phase",
    produit: "Produit",
    projet: "Projet",
    projects: "Projet",
    users: "Utilisateur"
  };
  return labels[targetType] || targetType || "-";
}

function auditActionSentence(log) {
  const labels = {
    CREATION_MODIFICATION: "Création d'une modification",
    MODIFICATION_MODIFICATION: "Modification d'une modification",
    VALIDATION_PHASE: "Validation d'une phase",
    REOUVERTURE_PHASE: "Reouverture d'une phase",
    ANNULATION_MODIFICATION: "Annulation d'une modification",
    ACTION_TERMINEE: "Action marquée comme terminée",
    VALIDATION_ACTION: "Validation d'une action",
    REFUS_VALIDATION_ACTION: "Refus de validation d'une action",
    AJOUT_CLIENT: "Ajout d'un client",
    AJOUT_PRODUIT: "Ajout d'un produit",
    AJOUT_PROJET: "Ajout d'un projet",
    MODIFICATION_PROJET_EQUIPE: "Modification d'un projet ou de son equipe"
  };
  return labels[log.actionType] || "Changement suivi";
}

function auditSucceeded(log) {
  return Number(log.responseStatus) < 400;
}

function auditResultLabel(log) {
  return auditSucceeded(log) ? "Effectue" : "Non effectue";
}

function auditTargetSummary(log) {
  if (["ACTION_TERMINEE", "VALIDATION_PHASE", "REOUVERTURE_PHASE"].includes(log.actionType)) return "Modification";
  const labels = {
    CREATION_MODIFICATION: "Modification",
    MODIFICATION_MODIFICATION: "Modification",
    VALIDATION_ACTION: "Action",
    REFUS_VALIDATION_ACTION: "Action",
    AJOUT_CLIENT: "Client",
    AJOUT_PRODUIT: "Produit",
    AJOUT_PROJET: "Projet",
    MODIFICATION_PROJET_EQUIPE: "Projet"
  };
  return labels[log.actionType] || auditTargetLabel(log.targetType);
}

function CreateModificationDialog({ clientOptions, ecrForm, finishedProductReferences, pilots, productOptions, projects, saving, users, onClose, onSubmit, updateEcrForm }) {
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

function EditModificationDialog({ clientOptions, ecrForm, existingRequest, finishedProductReferences, pilots, productOptions, projects, saving, users, onClose, onSubmit, updateEcrForm }) {
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

function NewModificationPage({ clientOptions, ecrForm, existingRequest = null, finishedProductReferences = [], mode = "create", pilots, productOptions, projects, saving, submitIcon: SubmitIcon = Plus, submitLabel = "Créer et ouvrir le suivi", users, onCancel, onSubmit, updateEcrForm }) {
  const availableStages = getStages(ecrForm.newVersion);
  const selectedProject = projects.find((project) => project.name === ecrForm.modificationProject);
  const projectTeamMembers = parseProjectTeam(selectedProject?.projectTeam);
  const projectPilotOptions = projectLeadTeamMembers(selectedProject?.projectTeam, users);
  const canCreateModification = projects.length > 0 && projectPilotOptions.includes(ecrForm.pilot);
  const displayedClientOptions = includeCurrentOption(clientOptions, ecrForm.client);
  const selectedProducts = parseSelectedProducts(ecrForm.product);
  const displayedProductOptions = includeCurrentOptions(productOptions, selectedProducts);
  const availableFinishedProducts = finishedProductsForForm(ecrForm, finishedProductReferences);
  const selectedFinishedProducts = parseSelectedProducts(ecrForm.finishedProducts);
  const displayedFinishedProducts = includeCurrentFinishedProducts(availableFinishedProducts, selectedFinishedProducts);
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
    projects,
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
        <PhasePreview newVersion={ecrForm.newVersion} stages={availableStages} />
        <div className="field-grid">
          <label>
            Numéro client externe
            <input required value={ecrForm.modificationNumber} onChange={(event) => updateEcrForm("modificationNumber", event.target.value)} />
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
            <legend>Produits finis</legend>
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
            Pilote
            <select required disabled={!ecrForm.modificationProject || projectPilotOptions.length === 0} value={ecrForm.pilot} onChange={(event) => updateEcrForm("pilot", event.target.value)}>
              <option value="">{ecrForm.modificationProject ? "Sélectionner un chef de projet" : "Sélectionner d'abord un projet"}</option>
              {projectPilotOptions.map((member) => (
                <option key={member} value={member}>{formatUserWithRole(member, users)}</option>
              ))}
            </select>
          </label>
          <label>
            Réception
            <input required type="date" value={ecrForm.receptionDate} onChange={(event) => updateEcrForm("receptionDate", event.target.value)} />
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
            <input type="file" onChange={(event) => updateEcrForm("beforePhotoFile", event.target.files?.[0] || null)} />
            <span className="form-hint">{ecrForm.beforePhotoFile?.name || (currentBeforePhoto ? "Document actuel conservé si aucun fichier n'est choisi" : "Document avant modification")}</span>
            {currentBeforePhoto && (
              <a className="form-image-preview" href={currentBeforeDownloadUrl} target="_blank" rel="noreferrer">
                {currentBeforeIsImage ? <img alt="Photo état actuelle" src={currentBeforeDownloadUrl} /> : <FileText size={28} />}
                Voir le fichier actuel
              </a>
            )}
          </label>
          <label>
            Photo devient
            <input type="file" onChange={(event) => updateEcrForm("afterPhotoFile", event.target.files?.[0] || null)} />
            <span className="form-hint">{ecrForm.afterPhotoFile?.name || (currentAfterPhoto ? "Document actuel conservé si aucun fichier n'est choisi" : "Document après modification")}</span>
            {currentAfterPhoto && (
              <a className="form-image-preview" href={currentAfterDownloadUrl} target="_blank" rel="noreferrer">
                {currentAfterIsImage ? <img alt="Photo devient actuelle" src={currentAfterDownloadUrl} /> : <FileText size={28} />}
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
    .replace(/[\u0300-\u036f]/g, "")
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

function parseProjectTeam(projectTeam) {
  return String(projectTeam || "")
    .split(/[,;]+/)
    .map((name) => name.trim())
    .filter(Boolean);
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
    .split(/[,;]+/)
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
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.onend = () => setSpeaking(false);
  utterance.onerror = () => setSpeaking(false);
  setSpeaking(true);
  window.speechSynthesis.speak(utterance);
}

function stopFinishedProductSpeech(setSpeaking) {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
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
    .filter((reference) => selectedProducts.includes(normalizeReferenceValue(reference.product)))
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

function validateEcrRequiredFields(form, requests = [], currentRequestId, setError) {
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

function actionAssetUrl(action, asset) {
  if (asset?.resourceType === "link" && asset.fileUrl) return asset.fileUrl;
  return asset?.legacy ? actionEvidenceUrl(action.id) : actionAssetDownloadUrl(asset.id);
}

function actionProofDocumentItemUrl(action, proofDocument) {
  if (proofDocument?.resourceType === "link" && proofDocument.fileUrl) return proofDocument.fileUrl;
  return proofDocument?.legacy ? actionProofDocumentUrl(action.id) : actionProofDocumentDownloadUrl(proofDocument.id);
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
  return user ? `${userName} (${userDisplayRole(user)})` : userName;
}

function userDisplayRole(user) {
  return userRoleLabel(user?.role);
}

function findUserByTeamName(userName, users) {
  return users.find((user) => [user.fullName, user.username, user.email].filter(Boolean).includes(userName));
}

function projectTeamUserIds(projectTeam, users, currentUser) {
  return parseProjectTeam(projectTeam)
    .map((member) => findUserByTeamName(member, users))
    .filter(Boolean)
    .map((user) => user.id)
    .filter((id) => Number(id) !== Number(currentUser?.id));
}

function projectLeadTeamMembers(projectTeam, users) {
  return parseProjectTeam(projectTeam).filter((member) => {
    const user = findUserByTeamName(member, users);
    return isProjectLead(user);
  });
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

function ModificationsPage(props) {
  const [listOpen, setListOpen] = useState(false);
  const [userSidebarOpen, setUserSidebarOpen] = useState(true);
  const [previewImage, setPreviewImage] = useState(null);
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
    doneCount,
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
    lateActions,
    phaseValidations,
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
    setProjectFilter,
    setQuery,
    setSelectedId,
    setSelectedStage,
    setShowCreateForm,
    setRequestTypeFilter,
    requiresEvidence,
    updateActionForm
  } = props;
  const canAdmin = isAdminUser(currentUser);
  const canValidate = canValidatePhases(currentUser);
  const canRequestValidation = isRequestPilot(currentUser, selectedRequest);
  const requestTerminal = isTerminalRequest(selectedRequest);
  const canManageDossierReview = !requestTerminal && (canAdmin || canRequestValidation);
  const canExportDossierReview = canAdmin || canRequestValidation;
  const canExportGantt = Boolean(selectedRequest);
  const canCancelRequest = !requestTerminal && canAdmin && selectedRequest?.currentStage !== "CANCELLED";
  const workflowApproved = allWorkflowStagesApproved(selectedRequest, phaseValidations);
  const canRequestClosure = !requestTerminal && canRequestValidation && workflowApproved && !selectedRequest?.closureRequested;
  const canCloseRequest = !requestTerminal && canAdmin && workflowApproved && selectedRequest?.closureRequested;
  const currentValidation = phaseValidations.find((validation) => validation.stage === selectedStage && validation.status === "PENDING");
  const latestStageValidation = phaseValidations.find((validation) => validation.stage === selectedStage);
  const visibleActions = canSeeAllActionsForUser(currentUser, selectedRequest) ? actions : actions.filter((action) => isActionParticipantForUser(currentUser, action));
  const stageActionsDone = actions.length > 0 && actions.every(isActionDone);
  const isCurrentStage = selectedRequest && selectedStage === selectedRequest.currentStage;
  const authenticatedUserRequests = useMemo(() => {
    const userRequests = canAdmin
      ? [...requests]
      : requests.filter((request) => !request.archived && isRequestParticipantForUser(currentUser, request, actionsByRequestId[request.id] || []));
    return userRequests.sort((first, second) => {
      const firstDate = parseDateOnly(first.receptionDate)?.getTime() || 0;
      const secondDate = parseDateOnly(second.receptionDate)?.getTime() || 0;
      return secondDate - firstDate || String(requestDisplayName(first)).localeCompare(String(requestDisplayName(second)), "fr", { sensitivity: "base" });
    });
  }, [actionsByRequestId, canAdmin, currentUser, requests]);
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
    const participantStage = firstActionParticipantStage(currentUser, actionsByRequestId[request.id] || []);
    setSelectedStage(safeStage(participantStage || request.currentStage, Boolean(request.newVersion)));
    setDetailsCollapsed(false);
    setListOpen(false);
  }

  function exportModificationGanttPdf() {
    if (!selectedRequest) return;
    Promise.all([
      getActions(selectedRequest.id),
      getEcrRequestProgress(selectedRequest.id).catch(() => null)
    ])
      .then(async ([requestActions, progressSummary]) => {
        await downloadHtmlAsPdf(
          `diagramme-gantt-${fileNameToken(requestDisplayName(selectedRequest))}.pdf`,
          modificationGanttPdfHtml(selectedRequest, requestActions, stagesForRequest(selectedRequest), progressSummary)
        );
        successToast("Diagramme de Gantt PDF telecharge");
      })
      .catch(() => {
        errorAlert("Generation du diagramme de Gantt impossible.");
      });
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
        }} disabled={!canAdmin}>
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
                  disabled={!canAdmin || saving || requestTerminal}
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
                  <div><ClipboardList size={16} /><span>Produit</span><strong>{selectedRequest.product || "-"}</strong></div>
                  <div><ClipboardList size={16} /><span>Produits finis</span><strong>{selectedRequest.finishedProducts || "-"}</strong></div>
                  <div><Gauge size={16} /><span>Pilote</span><strong>{selectedRequest.pilot || "À définir"}</strong></div>
                  <div><CalendarDays size={16} /><span>Réception</span><strong>{selectedRequest.receptionDate || "-"}</strong></div>
                  <div><CalendarDays size={16} /><span>SOP</span><strong>{selectedRequest.sopDate || "-"}</strong></div>
                  <div><ClipboardList size={16} /><span>Mixabilité</span><strong>{mixabilityLabel(selectedRequest.mixability)}</strong></div>
                  <div><ClipboardList size={16} /><span>Type</span><strong>{modificationTypesLabel(selectedRequest)}</strong></div>
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
                    <button className="dossier-review-card" type="button" onClick={exportModificationGanttPdf} title="Extraire le diagramme de Gantt">
                      <CalendarDays size={24} />
                      <span>Gantt PDF</span>
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
                        onClick={() => (canAdmin && !requestTerminal ? handleStageChange(key) : setSelectedStage(key))}
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
                  readOnly={requestTerminal}
                  stageNewProject={Boolean(selectedRequest.newVersion)}
                  selectedStages={selectedStages}
                  selectedStage={selectedStage}
                  updateActionForm={updateActionForm}
                  removeActionProofDocumentFile={removeActionProofDocumentFile}
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

function PhaseValidationPanel({ canAdmin, canRequestValidation, canValidate, isCurrentStage, latestValidation, readOnly = false, saving, stageActionsDone, validation, validationRate, onApprove, onReject, onReopen, onRequest }) {
  const phaseApproved = latestValidation?.status === "APPROVED";
  const phaseReopened = latestValidation?.status === "REOPENED";
  const displayedRate = latestValidation?.validationRate ?? validationRate ?? 0;
  const allActionsValidated = validation && (validation.totalActions || 0) > 0 && (validation.approvedActions || 0) >= (validation.totalActions || 0);
  const statusText = !isCurrentStage
    ? "Cette phase est consultable, mais seule la phase courante peut être envoyée en validation"
    : phaseApproved
      ? "Phase déjà validée"
    : phaseReopened
      ? "Phase rouverte, en attente de reprise"
    : validation
      ? "Demande en attente de validation"
      : !canRequestValidation
        ? "Seul le pilote de la modification peut demander la validation"
        : stageActionsDone
        ? "Phase prête a envoyér en validation"
        : "Toutes les actions doivent être terminées";
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

function phaseValidationStatusLabel(status) {
  if (status === "APPROVED") return "Phase validée";
  if (status === "REOPENED") return "Phase rouverte";
  return "Phase refusée";
}

function ActionsPanel({ actionForm, actionRoleOptions, actions, canAdmin, currentUser, doneCount, handleCreateAction, handleDeleteAction, handleToggleAction, handleUpdateActionDuration, handleApproveActionValidation, handleRejectActionValidation, handleRequestActionValidation, handleDeleteActionAsset, handleUploadEvidence, handleAddEvidenceLink, isCriticalAction, lateActions, phaseValidation, phaseValidations = [], readOnly = false, requiresEvidence, saving, selectedRequest, selectedStages, selectedStage, stageNewProject, updateActionForm, removeActionProofDocumentFile }) {
  const [expanded, setExpanded] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const stageTitle = stageLabel(selectedStage, stageNewProject);
  const canCreateAction = !readOnly && (canAdmin || isRequestPilot(currentUser, selectedRequest));

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
        readOnly={readOnly}
        saving={saving}
        selectedRequest={selectedRequest}
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
              readOnly={readOnly}
              saving={saving}
              selectedRequest={selectedRequest}
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

function ActionList({ actions, currentUser, expanded = false, phaseValidation, phaseValidations = [], readOnly = false, handleToggleAction, handleUpdateActionDuration, handleApproveActionValidation, handleRejectActionValidation, handleRequestActionValidation, handleDeleteAction, handleDeleteActionAsset, handleUploadEvidence, handleAddEvidenceLink, requiresEvidence, saving, selectedRequest }) {
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
          <EmptyState title="Aucune action pour cette phase" text="Ajoutez une action ou utilisez les actions générées lors de la création ECR." />
        ) : (
          [...actions].sort(compareActionDisplayOrder).map((action, index) => {
            const blockingAction = blockingActionFor(action, actions);
            const isBlocked = Boolean(action.dependsOnActionId && (!blockingAction || !isActionDone(blockingAction)));
            const canDeleteAction = !readOnly && canDeleteActionForUser(currentUser, action, selectedRequest, phaseValidations);
            const canEditDuration = !readOnly && canEditActionDurationForUser(currentUser, action, selectedRequest, phaseValidations);
            const canManageAction = !readOnly && canManageActionForUser(currentUser, action, phaseValidations, selectedRequest);
            const canToggleAction = !readOnly && canToggleActionForUser(currentUser, action, selectedRequest, phaseValidations);

            return (
            <article className={action.late ? "action-row late" : "action-row"} key={action.id}>
              <label className="action-check" title={isActionDone(action) ? "Marquer non terminée" : "Marquer terminée"}>
                <input checked={isActionDone(action)} disabled={saving || !canToggleAction} onChange={(event) => handleToggleAction(action, event.target.checked)} type="checkbox" />
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
                <span><em>Pilote</em><strong>{action.responsible || "À définir"}</strong></span>
                <span><em>Validateur</em><strong>{action.validatorDisplayName || action.validator || "à définir"}</strong></span>
                <span><em>Criticité</em><strong className={`criticality ${criticalityClass(action.criticality)}`}>{action.criticality || "3-faible"}</strong></span>
                <span className="blocking-action-meta"><em>Blocage</em><strong className={isBlocked ? "status late" : action.dependsOnActionId ? "status done" : ""}>{action.dependsOnActionId ? `Par: ${blockingActionLabel(action, actions)}` : "Aucune"}</strong></span>
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
                        <a className="file-link" href={actionProofDocumentItemUrl(action, proofDocument)} target="_blank" rel="noreferrer">
                          {proofDocument.fileName || "Element preuve"}
                        </a>
                      </span>
                    )) : "-"}
                  </strong>
                </span>
                <span className="evidence-meta">
                  <em>Assets</em>
                  <strong className="asset-link-list">
                    {actionAssets(action).length > 0 ? actionAssets(action).map((asset) => (
                      <span className="asset-link-item" key={asset.id || asset.fileName}>
                        <a className="file-link" href={actionAssetUrl(action, asset)} target="_blank" rel="noreferrer">
                          {asset.fileName || "Asset"}
                        </a>
                        {!asset.legacy && (
                          <button className="ghost-icon asset-delete-action" disabled={saving || !canManageAction} type="button" onClick={() => handleDeleteActionAsset(action, asset)} title="Supprimer l'asset">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </span>
                    )) : "-"}
                  </strong>
                  <label className={canManageAction ? "row-upload asset-upload-action" : "row-upload asset-upload-action disabled"} title="Affecter un asset">
                    <Upload size={15} />
                    <input disabled={saving || !canManageAction} multiple type="file" onChange={(event) => {
                      const selectedFiles = Array.from(event.currentTarget.files || []);
                      handleUploadEvidence(action, selectedFiles);
                      event.currentTarget.value = "";
                    }} />
                  </label>
                  {canManageAction && (
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
                    <small className={`status ${action.validationStatus === "APPROVED" ? "done" : action.validationStatus === "REJECTED" ? "late" : "in_progress"}`}>
                      {action.validationStatus === "APPROVED" ? "Validee" : action.validationStatus === "REJECTED" ? "Refusee" : "En attente"}
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
                    {!readOnly && canRequestRejectedActionValidationForUser(currentUser, action, selectedRequest) && phaseValidation?.status === "PENDING" && (
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

function ActionSuggestionDialog({ saving, suggestions, onAdd, onClose, onIgnore }) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="action-suggestion-title"
        aria-modal="true"
        className="dialog-card action-suggestion-dialog panel"
        onMouseDown={(event) => event.stopPropagation()}
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

function ActionCreateDialog({ actionForm, actionRoleOptions, actions = [], isCriticalAction, saving, selectedStages = [], stageNewProject, onClose, onSubmit, updateActionForm, removeActionProofDocumentFile }) {
  const selectedActionStage = actionForm.stage || selectedStages[0]?.[0] || "";
  const selectedProofDocumentFiles = filesFromValue(actionForm.proofDocumentFile);
  const hasProofDocumentLink = Boolean(String(actionForm.proofDocumentLinkUrl || "").trim());
  const dependencyOptions = actions
    .filter((action) => action.stage === selectedActionStage)
    .filter((action) => action.id)
    .sort(compareActionDisplayOrder);

  function addProofDocumentFiles(event) {
    const selectedFiles = Array.from(event.currentTarget.files || []);
    if (selectedFiles.length > 0) {
      updateActionForm("proofDocumentFile", selectedFiles);
    }
    event.currentTarget.value = "";
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        aria-labelledby="create-action-title"
        aria-modal="true"
        className="dialog-card action-rule-dialog panel form-page"
        noValidate
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
        <div className="planning-rule-form dialog-rule-form">
          <label>
            Phase
            <select value={selectedActionStage} onChange={(event) => updateActionForm("stage", event.target.value)}>
              {selectedStages.map(([stage, label]) => (
                <option key={stage} value={stage}>{label || stageLabel(stage, stageNewProject)}</option>
              ))}
            </select>
          </label>
          <label className="planning-action-title-field">
            Action
            <input required value={actionForm.title} onChange={(event) => updateActionForm("title", event.target.value)} placeholder="Ex: Action 7 - Validation input" />
          </label>
          <label>
            Topic / risque
            <input value={actionForm.topicRisk} onChange={(event) => updateActionForm("topicRisk", event.target.value)} placeholder="Risque ou sujet" />
          </label>
          <label>
            Pilote d'action
            <ActionRoleSelect required options={actionRoleOptions} value={actionForm.responsible} onChange={(value) => updateActionForm("responsible", value)} />
          </label>
          <label>
            Validateur
            <ActionRoleSelect required options={actionRoleOptions} value={actionForm.validator} onChange={(value) => updateActionForm("validator", value)} placeholder="Selectionner un role" />
          </label>
          <label>
            Criticité
            <select value={actionForm.criticality} onChange={(event) => updateActionForm("criticality", event.target.value)}>
              <option value="1-critique">1-critique</option>
              <option value="2-moyenne">2-moyenne</option>
              <option value="3-faible">3-faible</option>
            </select>
          </label>
          <label>
            Bloquee par
            <select value={actionForm.dependsOnActionId || ""} onChange={(event) => updateActionForm("dependsOnActionId", event.target.value)}>
              <option value="">Aucune action</option>
              {dependencyOptions.map((action, index) => (
                <option key={action.id} value={action.id}>Action {index + 1} - {action.title}</option>
              ))}
            </select>
          </label>
          <label>
            Jours de travail
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
                placeholder="Nom du lien preuve"
                value={actionForm.proofDocumentLinkName || ""}
                onChange={(event) => updateActionForm("proofDocumentLinkName", event.target.value)}
              />
              <input
                placeholder="Lien fichier partagé"
                value={actionForm.proofDocumentLinkUrl || ""}
                onChange={(event) => updateActionForm("proofDocumentLinkUrl", event.target.value)}
              />
            </div>
          </div>
          <div className="asset-link-inputs action-evidence-link-inputs">
            <input
              placeholder="Nom du lien asset"
              value={actionForm.evidenceLinkName || ""}
              onChange={(event) => updateActionForm("evidenceLinkName", event.target.value)}
            />
            <input
              placeholder="Lien asset partagé"
              value={actionForm.evidenceLinkUrl || ""}
              onChange={(event) => updateActionForm("evidenceLinkUrl", event.target.value)}
            />
          </div>
          <label className="asset-required-field user-enabled-field">
            <input
              checked={actionForm.evidenceRequired || selectedProofDocumentFiles.length > 0 || hasProofDocumentLink || isCriticalAction(actionForm)}
              disabled={selectedProofDocumentFiles.length > 0 || hasProofDocumentLink || isCriticalAction(actionForm)}
              type="checkbox"
              onChange={(event) => updateActionForm("evidenceRequired", event.target.checked)}
            />
            Asset obligatoire
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

export default App;
