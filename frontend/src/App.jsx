import React, { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
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
  createAction,
  createActionPlanningRule,
  createClientReference,
  createEcrRequest,
  createFinishedProductReference,
  createProductReference,
  createProject,
  createRoleReference,
  createUser,
  cancelEcrRequest,
  confirmPasswordReset,
  clearSession,
  addActionSuggestionToDefaults,
  acknowledgeActionDeadlineAlerts,
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
  getActions,
  getChecklist,
  getClientReferences,
  getCurrentUser,
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
  login,
  logout,
  planningEventsUrl,
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
  requestPhaseValidation,
  uploadUserPhoto,
  verifyPasswordResetCode
} from "./api";
import { EmptyState } from "./components/common/EmptyState";
import { PageHeader } from "./components/common/PageHeader";
import { StatCard } from "./components/common/StatCard";
import { emptyActionForm, emptyEcrForm, emptyFinishedProductForm, emptyPlanningRuleForm, emptyUserForm } from "./constants/forms";
import { userRoleOptions } from "./constants/roles";
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

const swalButtons = {
  confirmButtonColor: "#2563eb",
  cancelButtonColor: "#64748b"
};

const PREFERENTIAL_PAGE_SIZE = 5;

const pageTitles = {
  dashboard: "Tableau de bord",
  modifications: "Modifications",
  projects: "Actions standard",
  traceability: "Tracabilite",
  preferentials: "Préférentiels",
  users: "Utilisateurs",
  profile: "Profil"
};
const pageRoutes = {
  dashboard: "/dashboard",
  modifications: "/modifications",
  projects: "/actions",
  traceability: "/tracabilite",
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
    const audio = new Audio("/notif.mp3");
    audio.volume = 0.8;
    audio.play().catch(() => {});
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
    cancelButtonText: "Annulér",
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

function isTerminalRequest(request) {
  return request?.currentStage === "CLOSED" || request?.currentStage === "CANCELLED";
}

function isActiveRequest(request) {
  return Boolean(request) && !request.archived && !isTerminalRequest(request);
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

function previewText(value, maxLength = 80) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
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

function dossierReviewMetaLine(request) {
  return [
    "Demande ECR",
    request.modificationNumber,
    request.client,
    request.product
  ].filter(Boolean).join(" | ");
}

function dossierReviewExportText(request, value) {
  return [
    "Revue dossier",
    dossierReviewMetaLine(request),
    "",
    value || "Revue dossier vide."
  ].join("\n");
}

function projectDossierReviewsExportText(projectName, projectRequests) {
  const sortedRequests = [...projectRequests].sort((first, second) =>
    requestDisplayName(first).localeCompare(requestDisplayName(second), "fr", { sensitivity: "base" })
  );
  return [
    `Extraction revue dossier par projet`,
    `Projet: ${projectName || "Projet non renseigne"}`,
    `Modifications: ${sortedRequests.length}`,
    `Date extraction: ${new Date().toLocaleString("fr-FR")}`,
    "",
    ...sortedRequests.flatMap((request, index) => [
      "============================================================",
      `${index + 1}. ${requestDisplayName(request)}`,
      dossierReviewMetaLine(request),
      `Pilote: ${request.pilot || "-"}`,
      `Phase: ${stageLabel(request.currentStage, Boolean(request.newVersion))}`,
      "",
      request.dossierReview || "Revue dossier vide.",
      ""
    ])
  ].join("\n");
}

function sortedProjectDossierRequests(projectRequests) {
  return [...projectRequests].sort((first, second) =>
    requestDisplayName(first).localeCompare(requestDisplayName(second), "fr", { sensitivity: "base" })
  );
}

function projectDossierReviewsExportHtml(projectName, projectRequests) {
  const sortedRequests = sortedProjectDossierRequests(projectRequests);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Extraction revue dossier - ${escapeHtml(projectName)}</title><style>
    body{font-family:Arial,sans-serif;color:#111827;margin:32px;line-height:1.5}
    h1{font-size:22px;margin:0 0 8px}
    .meta{color:#4b5563;font-size:13px;margin-bottom:24px}
    article{break-inside:avoid;border-top:1px solid #d1d5db;padding:18px 0}
    h2{font-size:17px;margin:0 0 6px}
    dl{display:grid;grid-template-columns:120px 1fr;gap:4px 12px;margin:0 0 12px;font-size:13px}
    dt{color:#64748b;font-weight:700}
    dd{margin:0}
    pre{background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:12px;white-space:pre-wrap}
  </style></head><body><h1>Extraction revue dossier par projet</h1><div class="meta">Projet: ${escapeHtml(projectName || "Projet non renseigne")} | Modifications: ${sortedRequests.length} | Date extraction: ${escapeHtml(new Date().toLocaleString("fr-FR"))}</div>${sortedRequests.map((request, index) => `
    <article>
      <h2>${index + 1}. ${escapeHtml(requestDisplayName(request))}</h2>
      <dl>
        <dt>Demande</dt><dd>${escapeHtml(request.modificationNumber || "-")}</dd>
        <dt>Client</dt><dd>${escapeHtml(request.client || "-")}</dd>
        <dt>Produit</dt><dd>${escapeHtml(request.product || "-")}</dd>
        <dt>Pilote</dt><dd>${escapeHtml(request.pilot || "-")}</dd>
        <dt>Phase</dt><dd>${escapeHtml(stageLabel(request.currentStage, Boolean(request.newVersion)))}</dd>
      </dl>
      <pre>${escapeHtml(request.dossierReview || "Revue dossier vide.")}</pre>
    </article>`).join("")}</body></html>`;
}

function projectDossierReviewsExportExcel(projectName, projectRequests) {
  const sortedRequests = sortedProjectDossierRequests(projectRequests);
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><table border="1">
    <thead><tr><th>Projet</th><th>Modification</th><th>Client</th><th>Produit</th><th>Pilote</th><th>Phase</th><th>Revue dossier</th></tr></thead>
    <tbody>${sortedRequests.map((request) => `<tr><td>${escapeHtml(request.modificationProject || projectName || "")}</td><td>${escapeHtml(requestDisplayName(request))}</td><td>${escapeHtml(request.client || "")}</td><td>${escapeHtml(request.product || "")}</td><td>${escapeHtml(request.pilot || "")}</td><td>${escapeHtml(stageLabel(request.currentStage, Boolean(request.newVersion)))}</td><td>${escapeHtml(request.dossierReview || "Revue dossier vide.")}</td></tr>`).join("")}</tbody>
  </table></body></html>`;
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
  if (isCriticalActionValue(action)) return "critical";
  if (isActionDone(action)) return "closed";
  const end = parseDateOnly(action.endDate) || parseDateOnly(action.deadline);
  return end && end < new Date() ? "late" : "planned";
}

function isCriticalActionValue(action) {
  return String(action?.criticality || "").startsWith("1");
}

function actionGanttStatusLabel(action) {
  if (isCriticalActionValue(action)) return "Critique";
  if (isActionDone(action)) return "Done";
  return actionGanttStatusClass(action) === "late" ? "En retard" : "Planifié / à faire";
}

function actionGanttColor(action) {
  const status = actionGanttStatusClass(action);
  if (status === "critical") return "#df7d3f";
  if (status === "closed") return "#16a34a";
  if (status === "late") return "#dc2626";
  return "#9ca3af";
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

function modificationGanttPdfHtml(request, actions = [], selectedStages = []) {
  const fallbackStart = requestTimelineStart(request);
  const actionRows = actions
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
  const stageOrder = new Map(selectedStages.map(([key], index) => [key, index]));
  const groupedRows = actionRows.reduce((groups, row) => {
    const stage = row.action.stage || request.currentStage || "FEASIBILITY_VALIDATION";
    if (!groups.has(stage)) groups.set(stage, []);
    groups.get(stage).push(row);
    return groups;
  }, new Map());
  const sortedStages = selectedStages.length > 0
    ? selectedStages.map(([key]) => key)
    : Array.from(groupedRows.keys()).sort((first, second) => (stageOrder.get(first) ?? 99) - (stageOrder.get(second) ?? 99));
  const doneCount = actionRows.filter(({ action }) => isActionDone(action)).length;
  const lateCount = actionRows.filter(({ action }) => actionGanttStatusClass(action) === "late").length;
  const criticalCount = actionRows.filter(({ action }) => actionGanttStatusClass(action) === "critical").length;
  const rowHtml = sortedStages.map((stage) => {
    const stageRows = (groupedRows.get(stage) || []).sort((first, second) => first.start - second.start);
    const stageStart = stageRows.reduce((min, row) => row.start < min ? row.start : min, stageRows[0]?.start || null);
    const stageEnd = stageRows.reduce((max, row) => row.end > max ? row.end : max, stageRows[0]?.end || null);
    const phaseBar = stageStart && stageEnd
      ? `<span class="phase-bar" style="${ganttBarStyle(stageStart, stageEnd, timelineStart, totalDays)}"></span>`
      : "";
    return `<div class="gantt-row phase-row">
        <div class="left activity">${escapeHtml(stageLabel(stage, Boolean(request.newVersion)))}</div>
        <div class="left date">${escapeHtml(stageStart ? formatDateOnly(stageStart) : "-")}</div>
        <div class="left date">${escapeHtml(stageEnd ? formatDateOnly(stageEnd) : "-")}</div>
        <div class="timeline">${phaseBar}</div>
      </div>${stageRows.map(({ action, start, end }) => {
        const assignee = action.responsible || "Responsable";
        const actionColor = actionGanttColor(action);
        return `<div class="gantt-row">
          <div class="left activity"><strong>${escapeHtml(action.title || `Action ${action.id || ""}`)}</strong><span>${escapeHtml(actionGanttStatusLabel(action))} | Pilote: ${escapeHtml(assignee)} | Validateur: ${escapeHtml(action.validatorDisplayName || action.validator || "Validateur")}</span></div>
          <div class="left date">${escapeHtml(formatDateOnly(start))}</div>
          <div class="left date">${escapeHtml(formatDateOnly(end))}</div>
          <div class="timeline"><span class="bar ${actionGanttStatusClass(action)}" style="${ganttBarStyle(start, end, timelineStart, totalDays)};${ganttColorBarStyle(actionColor)}"></span></div>
        </div>`;
      }).join("")}`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Gantt - ${escapeHtml(requestDisplayName(request))}</title><style>
    @page{size:A4 landscape;margin:10mm}
    *{box-sizing:border-box}
    html,body,.gantt-table,.timeline,.left,.bar,.phase-bar,.legend i{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{font-family:Arial,sans-serif;color:#111;margin:0;background:#f7f7f7}
    header{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:10px;background:#fff;padding:0 0 8px}
    h1{font-family:Georgia,serif;font-size:28px;margin:0 0 4px;text-transform:uppercase}
    h1 span{color:#8fb5d2}
    .meta{font-size:11px;color:#526071;line-height:1.45}
    .summary{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    .summary span{border:1px solid #d8dee8;padding:5px 8px;font-size:11px;background:#fff}
    .gantt-table{background:#fff;border:1px solid #8fb5d2}
    .gantt-row{display:grid;grid-template-columns:260px 84px 84px minmax(760px,1fr);min-height:43px;break-inside:avoid}
    .gantt-head{min-height:34px;background:#8fb5d2;color:#fff;font-weight:700}
    .left{border-right:1px solid #d8d8d8;border-bottom:1px solid #d8d8d8;padding:6px 8px;background:#fff}
    .gantt-head .left{background:#8fb5d2;border-right:1px solid #dce8f1;border-bottom:0;font-size:12px}
    .activity{font-size:12px}
    .activity strong{display:block;font-weight:700}
    .activity span{display:block;font-size:9.5px;color:#526071;margin-top:2px;white-space:normal;overflow:visible;text-overflow:clip;line-height:1.25;overflow-wrap:anywhere}
    .date{text-align:center;font-size:11px;white-space:nowrap}
    .timeline{position:relative;border-bottom:1px solid #d8d8d8;background-color:#f4f4f4;background-image:linear-gradient(to right,#d8d8d8 1px,transparent 1px);background-size:${gridStep}% 100%}
    .gantt-head .timeline{display:grid;grid-template-columns:repeat(${Math.max(1, ticks.length)},1fr);background:#8fb5d2;border-bottom:0}
    .tick{border-left:1px solid #dce8f1;padding:7px 4px;text-align:center;font-size:10px;white-space:nowrap}
    .phase-row .left{background:#e9eef3;font-weight:700}
    .phase-row .timeline{background:#eef3f6}
    .phase-bar{position:absolute;top:14px;height:0;border-top:12px solid #8fb5d2;background:#8fb5d2;border-radius:2px;opacity:.95}
    .bar{position:absolute;top:13px;height:0;border-top:16px solid;border-radius:1px;min-width:4px}
    .bar.late{outline:2px solid #7f1d1d}
    .bar.critical{outline:2px solid #9a3412}
    .legend{display:grid;grid-template-columns:repeat(4,1fr);gap:8px 28px;margin-top:10px;padding:8px;background:#fff;border-top:1px solid #8fb5d2;font-size:11px}
    .legend span{display:flex;align-items:center;gap:8px;font-weight:700}
    .legend i{display:inline-block;width:34px;height:0;border-top:14px solid}
    .empty{padding:24px;text-align:center;color:#64748b;background:#fff}
  </style></head><body>
    <header>
      <div><h1>DIAGRAMME <span>DE GANTT</span></h1><div class="meta">${escapeHtml(requestDisplayName(request))} | Projet: ${escapeHtml(request.modificationProject || "-")} | Client: ${escapeHtml(request.client || "-")} | Produit: ${escapeHtml(request.product || "-")} | Pilote: ${escapeHtml(request.pilot || "-")}<br>Extraction: ${escapeHtml(new Date().toLocaleString("fr-FR"))} | Periode: ${escapeHtml(formatDateOnly(timelineStart))} - ${escapeHtml(formatDateOnly(timelineEnd))}</div></div>
      <div class="summary"><span>Actions: ${actionRows.length}</span><span>Done: ${doneCount}</span><span>En retard: ${lateCount}</span><span>Critiques: ${criticalCount}</span><span>Phase: ${escapeHtml(stageLabel(request.currentStage, Boolean(request.newVersion)))}</span></div>
    </header>
    <section class="gantt-table">
      <div class="gantt-row gantt-head"><div class="left">Activites</div><div class="left">Deb</div><div class="left">Fin</div><div class="timeline">${ticks.map((tick) => `<span class="tick">${escapeHtml(tick.label)}</span>`).join("")}</div></div>
      ${actionRows.length === 0 ? `<div class="empty">Aucune action planifiee pour cette modification.</div>` : rowHtml}
    </section>
    <div class="legend"><span><i style="${ganttColorBarStyle("#9ca3af")}"></i>Planifié / à faire</span><span><i style="${ganttColorBarStyle("#16a34a")}"></i>Done</span><span><i style="${ganttColorBarStyle("#dc2626")}"></i>En retard</span><span><i style="${ganttColorBarStyle("#df7d3f")}"></i>Critique</span></div>
    <script>window.onload=function(){window.print();};</script>
  </body></html>`;
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

function canManageActionForUser(user, action, phaseValidations = []) {
  if (isActionPhaseApproved(action, phaseValidations)) return false;
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
  const validator = normalizeRoleToken(action.validatorDisplayName || action.validator || action.validatorRole);
  if (!validator || isUndefinedValidatorToken(validator)) return isAdminUser(user);
  return [user.jobTitle, user.fullName, user.username, user.email, user.role]
    .filter(Boolean)
    .some((value) => normalizeRoleToken(value) === validator);
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
  if (isActionPhaseApproved(action, phaseValidations)) return false;
  if (!isActionPilotForUser(user, action)) return false;
  return !isActionDone(action) || action?.stage === request?.currentStage;
}

function isActionPhaseApproved(action, phaseValidations = []) {
  return phaseValidations.find((validation) => validation.stage === action?.stage)?.status === "APPROVED";
}

function canDeleteActionForUser(user, action, request, phaseValidations = []) {
  if (isActionPhaseApproved(action, phaseValidations)) return false;
  if (isAdminUser(user)) return true;
  return isRequestPilot(user, request);
}

function canEditActionDurationForUser(user, action, request, phaseValidations = []) {
  if (!isRequestPilot(user, request)) return false;
  if (request?.currentStage === "CLOSED" || request?.currentStage === "CANCELLED") return false;
  return !isActionPhaseApproved(action, phaseValidations);
}

function blockingActionFor(action, actions = []) {
  if (!action?.dependsOnActionId) return null;
  return actions.find((item) => item.id === action.dependsOnActionId) || null;
}

function blockingActionLabel(action, actions = []) {
  if (!action?.dependsOnActionId) return "Aucune";
  const dependency = blockingActionFor(action, actions);
  return dependency?.title || `Action #${action.dependsOnActionId}`;
}

function isRequestPilot(user, request) {
  const pilot = normalizeRoleToken(request?.pilot);
  if (!pilot) return false;
  return [user?.fullName, user?.username, user?.email, user?.jobTitle, user?.role]
    .filter(Boolean)
    .some((value) => normalizeRoleToken(value) === pilot);
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
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditQuery, setAuditQuery] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedStage, setSelectedStage] = useState("FEASIBILITY_VALIDATION");
  const [checklist, setChecklist] = useState([]);
  const [actions, setActions] = useState([]);
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
  const [requestArchiveView, setRequestArchiveView] = useState("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const realtimeRefreshTimer = useRef(null);
  const selectedDetailsRequestId = useRef(0);

  const selectedRequest = requests.find((request) => request.id === selectedId);
  const selectedStages = useMemo(() => {
    if (selectedRequest?.currentStage === "CANCELLED") {
      return [["CANCELLED", stageLabel("CANCELLED", Boolean(selectedRequest.newVersion))]];
    }
    return getStages(Boolean(selectedRequest?.newVersion));
  }, [selectedRequest]);
  const visibleStages = useMemo(() => {
    if (!selectedRequest || isAdminUser(currentUser)) return selectedStages;
    const currentIndex = selectedStages.findIndex(([key]) => key === selectedRequest.currentStage);
    return selectedStages.filter((_, index) => currentIndex < 0 || index <= currentIndex);
  }, [currentUser, selectedRequest, selectedStages]);
  const activeRequests = useMemo(() => requests.filter(isActiveRequest), [requests]);
  const doneCount = actions.filter(isActionDone).length;
  const completion = actions.length ? Math.round((doneCount / actions.length) * 100) : 0;
  const lateActions = actions.filter((action) => action.late).length;

  const filteredRequests = useMemo(() => {
    const normalized = normalizeSearchText(query);
    const canAdmin = isAdminUser(currentUser);
    return requests.filter((request) => {
      if (!requestMatchesView(request, requestArchiveView, canAdmin)) return false;
      const matchesProject = !projectFilter || request.modificationProject === projectFilter;
      const matchesSearch = !normalized || [request.client, request.product, request.modificationProject, request.modificationNumber, request.modificationReason, request.modificationDetail, request.dossierReview, request.pilot]
        .filter(Boolean)
        .some((value) => normalizeSearchText(value).includes(normalized));
      return matchesProject && matchesSearch;
    });
  }, [currentUser, requests, query, projectFilter, requestArchiveView]);

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
  const actionRoleOptions = useMemo(
    () => uniqueSorted([
      ...userRoleOptions.map(([, label]) => label),
      ...roleReferences.map((role) => role.name)
    ]),
    [roleReferences]
  );

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
    if (page !== "traceability" || !isAdminUser(currentUser)) return;
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
    const intervalId = window.setInterval(() => {
      refreshActionDeadlineAlerts();
    }, 3000);
    return () => window.clearInterval(intervalId);
  }, [currentUser]);

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
      getPhaseValidations(requestId)
    ]).then(([requestData, checklistData, actionData, validationData]) => {
      if (requestSequence !== selectedDetailsRequestId.current) {
        return actionData;
      }
      setRequests(requestData);
      setChecklist(checklistData);
      setActions(actionData);
      setPhaseValidations(validationData);
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
      ? Promise.all([getChecklist(requestId, stage), getActions(requestId, stage), getPhaseValidations(requestId)])
          .then(([checklistData, actionData, validationData]) => {
            setChecklist(checklistData);
            setActions(actionData);
            setPhaseValidations(validationData);
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
    const events = new EventSource(planningEventsUrl(authSession.token));
    events.addEventListener("planning-updated", () => {
      window.clearTimeout(realtimeRefreshTimer.current);
      realtimeRefreshTimer.current = window.setTimeout(refreshRealtimeData, 250);
    });
    events.onerror = () => {};
    return () => {
      window.clearTimeout(realtimeRefreshTimer.current);
      events.close();
    };
  }, [authSession?.token, currentUser, selectedId, selectedStage, requestArchiveView, page]);

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
    if (!selectedId) {
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
    setEcrForm((form) => updateEcrFormState(form, field, value, projects));
  }

  function updateEcrEditForm(field, value) {
    setEcrEditForm((form) => updateEcrFormState(form, field, value, projects));
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
    if (parseSelectedProducts(ecrForm.product).length === 0) {
      const message = "Selectionnez au moins un produit.";
      setError(message);
      warningAlert("Produit requis", message);
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
    if (parseSelectedProducts(ecrEditForm.product).length === 0) {
      const message = "Selectionnez au moins un produit.";
      setError(message);
      warningAlert("Produit requis", message);
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

  function openRequest(request) {
    setSelectedId(request.id);
    setSelectedStage(safeStage(request.currentStage, Boolean(request.newVersion)));
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
            setSelectedId(nextRequest?.id ?? null);
            setSelectedStage(nextRequest ? safeStage(nextRequest.currentStage, Boolean(nextRequest.newVersion)) : "FEASIBILITY_VALIDATION");
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
            setSelectedId(nextRequest?.id ?? null);
            setSelectedStage(nextRequest ? safeStage(nextRequest.currentStage, Boolean(nextRequest.newVersion)) : "FEASIBILITY_VALIDATION");
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
    if (!isAdminUser(currentUser) && !isRequestPilot(currentUser, request)) {
      warningAlert("Action reservee", "Seul le chef de modification peut annuler cette modification.");
      return;
    }
    if (request.currentStage === "CANCELLED") {
      warningAlert("Modification annulée", "Cette modification est déjà annulée.");
      return;
    }
    const label = requestDisplayName(request);
    Swal.fire({
      ...swalButtons,
      title: "Annulér la modification ?",
      text: `La modification ${label} passera immediatement en phase Cancelled.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Annulér la modification",
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
    return filesFromValue(action?.proofDocumentFile).length > 0 || actionProofDocuments(action).length > 0;
  }

  function refreshCurrentActionsAndRequests() {
    if (!selectedRequest) return Promise.resolve([]);
    return refreshSelectedData(selectedRequest.id, selectedStage);
  }

  function handleCreateAction(event) {
    event.preventDefault();
    if (!selectedRequest) return Promise.resolve();
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
    if (requiresEvidence(actionForm) && isActionDone(actionForm) && evidenceFiles.length === 0) {
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
    const finalPayload = proofDocumentFiles.length > 0 ? { ...payload, evidenceRequired: true } : payload;
    const createBasePayload = proofDocumentFiles.length > 0 ? { ...payload, evidenceRequired: actionForm.evidenceRequired || isCriticalAction(actionForm) } : payload;
    const hasUploads = proofDocumentFiles.length > 0 || evidenceFiles.length > 0;
    const createPayload = hasUploads && isActionDone(finalPayload)
      ? { ...createBasePayload, checked: false, status: "TODO", closedDate: null, finalizationDate: null }
      : createBasePayload;
    return createAction(selectedRequest.id, createPayload)
      .then((savedAction) => {
        const proofUpload = proofDocumentFiles.length > 0 ? uploadActionProofDocumentFiles(savedAction.id, proofDocumentFiles) : Promise.resolve(savedAction);
        return proofUpload.then((actionWithProof) => {
          if (evidenceFiles.length > 0) {
            return uploadActionEvidenceFiles(actionWithProof.id, evidenceFiles)
              .then((actionWithEvidence) => (isActionDone(finalPayload) ? updateAction(actionWithEvidence.id, finalPayload) : actionWithEvidence));
          }
          return isActionDone(finalPayload) ? updateAction(actionWithProof.id, finalPayload) : actionWithProof;
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

  function refreshPhaseValidations(requestId = selectedId) {
    if (!requestId) return Promise.resolve([]);
    return getPhaseValidations(requestId).then((items) => {
      setPhaseValidations(items);
      return items;
    });
  }

  function handleDeleteActionAsset(action, asset) {
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
    if (isActionPhaseApproved(action, phaseValidations)) {
      warningAlert("Phase validée", "Impossible de supprimer une action dans une phase déjà validée. Reouvrez la phase avant de la modifier.");
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
            ? "Suppression impossible: vous devez être admin ou pilote de la modification, et la phase ne doit pas être validée."
            : "Suppression de l'action impossible. La phase est peut-être déjà validée.";
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
      cancelButtonText: "Annulér",
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
      cancelButtonText: "Annulér",
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
    request
      .then((savedClient) => {
        setClientReferences((items) => [...items.filter((item) => item.id !== savedClient.id), savedClient].sort((a, b) => a.name.localeCompare(b.name)));
        setClientReferenceForm({ name: "" });
        setEditingClientReference(null);
        successToast(isEdit ? "Client modifie" : "Client ajoute");
      })
      .catch(() => {
        const message = "Sauvegarde client impossible. Vérifiez le nom.";
        setError(message);
        errorAlert(message);
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
    request
      .then((savedProduct) => {
        setProductReferences((items) => [...items.filter((item) => item.id !== savedProduct.id), savedProduct].sort((a, b) => a.name.localeCompare(b.name)));
        setProductReferenceForm({ name: "" });
        setEditingProductReference(null);
        successToast(isEdit ? "Produit modifie" : "Produit ajoute");
      })
      .catch(() => {
        const message = "Sauvegarde produit impossible. Vérifiez le nom.";
        setError(message);
        errorAlert(message);
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
    request
      .then((savedRole) => {
        setRoleReferences((items) => [...items.filter((item) => item.id !== savedRole.id), savedRole].sort((a, b) => a.name.localeCompare(b.name)));
        setRoleReferenceForm({ name: "" });
        setEditingRoleReference(null);
        successToast(isEdit ? "Rôle modifié" : "Rôle ajouté");
      })
      .catch(() => {
        const message = "Sauvegarde rôle impossible. Vérifiez le nom.";
        setError(message);
        errorAlert(message);
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
    setSaving(true);
    setError("");
    const payload = {
      ...planningRuleForm,
      proofDocumentFile: undefined,
      actionTitle: planningRuleForm.actionTitle.trim(),
      topicRisk: planningRuleForm.topicRisk.trim() || null,
      responsible: planningRuleForm.responsible.trim() || null,
      validator: planningRuleForm.validator.trim() || null,
      expectedEvidence: planningRuleForm.expectedEvidence.trim() || null,
      evidenceRequired: planningRuleForm.evidenceRequired || proofDocumentFiles.length > 0 || hasPlanningRuleProofDocument(planningRuleForm),
      dependencyActionTitle: planningRuleForm.dependencyActionTitle.trim() || null,
      dependencyAnchor: "OUTPUT",
      durationDays: Number(planningRuleForm.durationDays) || 0
    };
    const isEdit = Boolean(editingPlanningRule);
    const request = isEdit ? updateActionPlanningRule(editingPlanningRule, payload) : createActionPlanningRule(payload);
    request
      .then((savedRule) => {
        if (proofDocumentFiles.length === 0) return savedRule;
        return uploadActionPlanningRuleProofDocumentFiles(savedRule.id, proofDocumentFiles);
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
    const request = isEdit ? updateUser(editingUser, payload) : createUser(payload);
    request
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
        successToast("Connexion reussie");
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
        successToast("Mot de passe modifie");
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
      title: "Se deconnecter ?",
      text: "Votre session active sera fermee.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Se deconnecter",
      cancelButtonText: "Annulér",
      ...swalButtons
    }).then((result) => {
      if (!result.isConfirmed) return;
      logout()
        .catch(() => clearSession())
        .finally(() => {
          setAuthSession(null);
          setCurrentUser(null);
          setRequests([]);
          setUsers([]);
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
            planningRules={planningRules}
            products={productReferences}
            projects={projects}
            requests={requests}
            roles={roleReferences}
            saving={saving}
            stats={dashboardStats}
            users={users}
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
            checklist={checklist}
            completion={completion}
            doneCount={doneCount}
            filteredRequests={filteredRequests}
            currentUser={currentUser}
            lateActions={lateActions}
            phaseValidations={phaseValidations}
            projectFilter={projectFilter}
            projectOptions={projectOptions}
            query={query}
            requestSearchSuggestions={requestSearchSuggestions}
            requestArchiveView={requestArchiveView}
            saving={saving}
            selectedId={selectedId}
            selectedRequest={selectedRequest}
            selectedStages={visibleStages}
            selectedStage={selectedStage}
            setQuery={setQuery}
            setProjectFilter={setProjectFilter}
            setSelectedId={setSelectedId}
            setSelectedStage={setSelectedStage}
            setShowCreateForm={setShowCreateForm}
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
            removeActionProofDocumentFile={removeActionProofDocumentFile}
            handleApprovePhase={handleApprovePhase}
            handleApproveActionValidation={handleApproveActionValidation}
            handleRejectActionValidation={handleRejectActionValidation}
            handleRequestActionValidation={handleRequestActionValidation}
            handleRejectPhase={handleRejectPhase}
            handleReopenPhase={handleReopenPhase}
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

function DashboardPage({ clients = [], currentUser, planningRules = [], products = [], projects, requests, roles = [], saving, stats, users = [], onCreateRequest, onOpenRequest }) {
  const allProjectsValue = "__ALL__";
  const [dossierProject, setDossierProject] = useState(allProjectsValue);
  const adminView = isAdminUser(currentUser);
  const dashboardRequests = requests.filter((request) => !request.archived);
  const activeRequests = dashboardRequests.filter((request) => request.currentStage !== "CLOSED" && request.currentStage !== "CANCELLED");
  const closedRequests = dashboardRequests.filter((request) => request.currentStage === "CLOSED");
  const cancelledRequests = dashboardRequests.filter((request) => request.currentStage === "CANCELLED");
  const lateRequests = activeRequests.filter((request) => {
    const sopDate = parseDateOnly(request.sopDate);
    return sopDate && sopDate < new Date();
  });
  const newProjectRequests = dashboardRequests.filter((request) => request.newVersion);
  const stageEntries = getStages(true).map(([stage, label]) => {
    const count = dashboardRequests.filter((request) => request.currentStage === stage).length;
    return { stage, label, count };
  }).filter((entry) => entry.count > 0);
  const stageStatusMatrix = stageEntries.map((entry) => {
    const phaseRequests = dashboardRequests.filter((request) => request.currentStage === entry.stage);
    const phaseLate = phaseRequests.filter((request) => {
      const sopDate = parseDateOnly(request.sopDate);
      return sopDate && sopDate < new Date() && request.currentStage !== "CLOSED" && request.currentStage !== "CANCELLED";
    }).length;
    const phaseClosed = phaseRequests.filter((request) => request.currentStage === "CLOSED" || request.currentStage === "CANCELLED").length;
    return { ...entry, active: Math.max(0, phaseRequests.length - phaseLate - phaseClosed), late: phaseLate, closed: phaseClosed };
  });
  const maxStageCount = Math.max(1, ...stageEntries.map((entry) => entry.count));
  const projectLoad = Array.from(dashboardRequests.reduce((map, request) => {
    const projectName = request.modificationProject || "Projet non renseigne";
    const item = map.get(projectName) || { name: projectName, total: 0, active: 0, late: 0, representative: request };
    item.total += 1;
    if (request.currentStage !== "CLOSED" && request.currentStage !== "CANCELLED") {
      item.active += 1;
      item.representative = request;
    }
    const sopDate = parseDateOnly(request.sopDate);
    if (sopDate && sopDate < new Date() && request.currentStage !== "CLOSED" && request.currentStage !== "CANCELLED") item.late += 1;
    map.set(projectName, item);
    return map;
  }, new Map()).values())
    .sort((first, second) => second.active - first.active || second.total - first.total || first.name.localeCompare(second.name))
    .slice(0, 6);
  const maxProjectLoad = Math.max(1, ...projectLoad.map((project) => project.active));
  const dueSoonRequests = activeRequests
    .map((request) => ({ request, sopDate: parseDateOnly(request.sopDate) }))
    .filter((item) => item.sopDate)
    .sort((first, second) => first.sopDate - second.sopDate)
    .slice(0, 6);
  const urgentRequests = [...lateRequests]
    .sort((first, second) => (parseDateOnly(first.sopDate) || new Date()) - (parseDateOnly(second.sopDate) || new Date()))
    .slice(0, 4);
  const clientImpact = dashboardDistribution(dashboardRequests, (request) => request.client || "Client non renseigne", 6);
  const productImpact = dashboardDistribution(dashboardRequests, (request) => request.product || "Produit non renseigne", 6);
  const pilotLoad = dashboardDistribution(dashboardRequests, (request) => request.pilot || "Pilote non renseigne", 6);
  const modificationTypes = [
    { label: "Nouveau projet", count: dashboardRequests.filter((request) => request.newVersion).length },
    { label: "Digit change", count: dashboardRequests.filter((request) => request.digitChange).length },
    { label: "Component change", count: dashboardRequests.filter((request) => request.componentChange).length },
    { label: "Process change", count: dashboardRequests.filter((request) => request.processChange).length },
    { label: "Supplier change", count: dashboardRequests.filter((request) => request.supplierChange).length }
  ].filter((item) => item.count > 0);
  const maxTypeCount = Math.max(1, ...modificationTypes.map((item) => item.count));
  const rulesByPhase = dashboardDistribution(planningRules, (rule) => stageLabel(rule.stage, Boolean(rule.newProject)), 6);
  const enabledUsers = users.filter((user) => user.enabled !== false);
  const roleCoverage = dashboardDistribution(enabledUsers, (user) => userRoleLabel(user.role), 6);
  const visibleRequests = dashboardRequests
    .filter((request) => request.currentStage !== "CLOSED" && request.currentStage !== "CANCELLED")
    .slice(0, 5);
  const recentRequests = visibleRequests.length > 0 ? visibleRequests : dashboardRequests.slice(0, 5);
  const projectOptions = useMemo(() => Array.from(new Set([
    ...projects.map((project) => project.name),
    ...dashboardRequests.map((request) => request.modificationProject)
  ].filter(Boolean))).sort((first, second) => first.localeCompare(second, "fr", { sensitivity: "base" })), [projects, dashboardRequests]);
  const exportingAllProjects = dossierProject === allProjectsValue;
  const dossierRequests = exportingAllProjects ? dashboardRequests : dashboardRequests.filter((request) => request.modificationProject === dossierProject);
  const dossierExportLabel = exportingAllProjects ? "Tous les projets" : dossierProject;

  function exportProjectDossierReviews(format) {
    if (!dossierProject) {
      warningAlert("Projet requis", "Selectionnez un projet avant de lancer l'extraction.");
      return;
    }
    if (dossierRequests.length === 0) {
      warningAlert("Aucune modification", "Aucune modification trouvee pour ce projet.");
      return;
    }
    const fileBaseName = `revues-dossier-${exportingAllProjects ? "toutes-modifications" : `projet-${fileNameToken(dossierProject)}`}`;
    if (format === "pdf") {
      const win = window.open("", "_blank");
      if (!win) return;
      win.document.write(projectDossierReviewsExportHtml(dossierExportLabel, dossierRequests).replace("</body></html>", "<script>window.onload=function(){window.print();};</script></body></html>"));
      win.document.close();
    } else if (format === "excel") {
      downloadBlobFile(
        `${fileBaseName}.xls`,
        projectDossierReviewsExportExcel(dossierExportLabel, dossierRequests),
        "application/vnd.ms-excel;charset=utf-8"
      );
    } else {
      downloadTextFile(
        `${fileBaseName}.txt`,
        projectDossierReviewsExportText(dossierExportLabel, dossierRequests)
      );
    }
    successToast("Extraction revue dossier generee");
  }

  return (
    <section className="page-content">
      <PageHeader
        eyebrow={adminView ? "Vue globale" : "Votre périmètre"}
        title={adminView ? "Dashboard direction ECR" : "Dashboard personnel ECR"}
        subtitle={adminView ? "Pilotage de toutes les modifications, priorités et charges projet." : "Synthèse des modifications où vous intervenez comme membre, pilote, responsable ou validateur."}
      />
      <div className="stat-grid">
        <StatCard label={adminView ? "Modifications" : "Dans mon périmètre"} value={stats.requests} icon={ClipboardList} />
        <StatCard label="Actives" value={activeRequests.length} icon={Gauge} />
        <StatCard label="En retard SOP" value={lateRequests.length} icon={CircleAlert} />
        <StatCard label="Clôturées" value={closedRequests.length} icon={CheckCircle2} />
      </div>
      <section className="dashboard-grid">
        <article className="panel dashboard-health-panel">
          <div className="section-title">
            <div>
              <h2>Santé du portefeuille</h2>
              <span>{adminView ? "Tous les dossiers visibles admin" : "Vos dossiers accessibles"}</span>
            </div>
          </div>
          <div className="dashboard-health-content">
            <DashboardDonut active={activeRequests.length} closed={closedRequests.length} cancelled={cancelledRequests.length} late={lateRequests.length} />
            <div className="dashboard-health-copy">
              <strong>{lateRequests.length === 0 ? "Aucun retard SOP détecté" : `${lateRequests.length} modification${lateRequests.length > 1 ? "s" : ""} à surveiller`}</strong>
              <span>{newProjectRequests.length} nouveau{newProjectRequests.length > 1 ? "x" : ""} projet{newProjectRequests.length > 1 ? "s" : ""} dans le périmètre.</span>
              <span>{activeRequests.length} modification{activeRequests.length > 1 ? "s" : ""} encore active{activeRequests.length > 1 ? "s" : ""}.</span>
            </div>
          </div>
        </article>
        <article className="panel dashboard-chart-panel">
          <div className="section-title">
            <div>
              <h2>Répartition par phase</h2>
              <span>{stageEntries.length} phase{stageEntries.length > 1 ? "s" : ""} active{stageEntries.length > 1 ? "s" : ""}</span>
            </div>
          </div>
          <div className="dashboard-bars">
            {stageEntries.length === 0 ? (
              <EmptyState title="Aucune phase" text="Les phases apparaîtront dès qu'une modification sera créée." compact />
            ) : stageEntries.map(({ stage, label, count }) => (
              <div className="dashboard-bar-row" key={stage}>
                <span>{label}</span>
                <div><i className={stageColorClass(stage, true)} style={{ width: `${Math.max(8, (count / maxStageCount) * 100)}%` }} /></div>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </article>
        <article className="panel dashboard-chart-panel">
          <div className="section-title">
            <div>
              <h2>Charge par projet</h2>
              <span>Top projets actifs</span>
            </div>
          </div>
          <div className="dashboard-project-load">
            {projectLoad.length === 0 ? (
              <EmptyState title="Aucun projet" text="La charge projet apparaîtra ici." compact />
            ) : projectLoad.map((project) => (
              <button className="dashboard-project-row" key={project.name} type="button" onClick={() => onOpenRequest(project.representative)}>
                <span>{project.name}</span>
                <div><i style={{ width: `${Math.max(8, (project.active / maxProjectLoad) * 100)}%` }} /></div>
                <strong>{project.active} actif{project.active > 1 ? "s" : ""}</strong>
                {project.late > 0 && <em>{project.late} retard</em>}
              </button>
            ))}
          </div>
        </article>
        <article className="panel dashboard-risk-panel">
          <div className="section-title">
            <div>
              <h2>Priorités</h2>
              <span>Retards et prochaines SOP</span>
            </div>
          </div>
          <div className="dashboard-risk-list">
            {(urgentRequests.length > 0 ? urgentRequests : dueSoonRequests.map((item) => item.request)).map((request) => (
              <button className="dashboard-risk-item" key={request.id} type="button" onClick={() => onOpenRequest(request)}>
                <span className={lateRequests.some((item) => item.id === request.id) ? "risk-dot late" : "risk-dot"} />
                <strong>{requestDisplayName(request)}</strong>
                <small>{request.modificationProject || "-"} | SOP {formatDateOnly(request.sopDate)}</small>
              </button>
            ))}
            {urgentRequests.length === 0 && dueSoonRequests.length === 0 && (
              <EmptyState title="Rien d'urgent" text="Aucune échéance SOP renseignée à court terme." compact />
            )}
          </div>
        </article>
      </section>
      <section className="panel dashboard-matrix-panel">
        <div className="section-title">
          <div>
            <h2>Matrice phase / statut</h2>
            <span>Lecture croisée du portefeuille</span>
          </div>
        </div>
        <DashboardStatusMatrix entries={stageStatusMatrix} />
      </section>
      <section className="dashboard-entity-grid">
        <DashboardTilesCard title="Clients impactés" subtitle={`${clients.length} client${clients.length > 1 ? "s" : ""} référencé${clients.length > 1 ? "s" : ""}`} items={clientImpact} />
        <DashboardBubbleCard title="Produits concernés" subtitle={`${products.length} produit${products.length > 1 ? "s" : ""} référencé${products.length > 1 ? "s" : ""}`} items={productImpact} />
        <article className="panel dashboard-chart-panel">
          <div className="section-title">
            <div>
              <h2>Nature des modifications</h2>
              <span>Types déclarés</span>
            </div>
          </div>
          <div className="dashboard-bars">
            {modificationTypes.length === 0 ? (
              <EmptyState title="Aucun type" text="Les types apparaîtront selon les dossiers créés." compact />
            ) : modificationTypes.map((item) => (
              <div className="dashboard-bar-row" key={item.label}>
                <span>{item.label}</span>
                <div><i style={{ width: `${Math.max(8, (item.count / maxTypeCount) * 100)}%` }} /></div>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </article>
        <DashboardRankingCard title="Pilotes de modification" subtitle="Charge nominative" items={pilotLoad} />
        {adminView && (
          <>
            <DashboardDistributionCard title="Utilisateurs par rôle" subtitle={`${enabledUsers.length} compte${enabledUsers.length > 1 ? "s" : ""} actif${enabledUsers.length > 1 ? "s" : ""}`} items={roleCoverage} />
            <DashboardDistributionCard title="Actions standard par phase" subtitle={`${planningRules.length} action${planningRules.length > 1 ? "s" : ""} standard`} items={rulesByPhase} />
            <article className="panel dashboard-referential-panel">
              <div className="section-title">
                <div>
                  <h2>Couverture référentiel</h2>
                  <span>Entités configurées</span>
                </div>
              </div>
              <div className="dashboard-entity-metrics">
                <span><strong>{projects.length}</strong>Projets</span>
                <span><strong>{clients.length}</strong>Clients</span>
                <span><strong>{products.length}</strong>Produits</span>
                <span><strong>{roles.length}</strong>Rôles action</span>
                <span><strong>{users.length}</strong>Utilisateurs</span>
                <span><strong>{planningRules.length}</strong>Actions standard</span>
              </div>
            </article>
          </>
        )}
      </section>
      {isAdminUser(currentUser) && (
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>Extraction revue dossier par projet</h2>
              <span>{dossierRequests.length} modification{dossierRequests.length > 1 ? "s" : ""}</span>
            </div>
            <div className="button-row compact-export-row">
              <button className="secondary-action" type="button" onClick={() => exportProjectDossierReviews("txt")} disabled={!dossierProject || dossierRequests.length === 0}>
                <FileText size={16} />
                TXT
              </button>
              <button className="secondary-action" type="button" onClick={() => exportProjectDossierReviews("pdf")} disabled={!dossierProject || dossierRequests.length === 0}>
                <FileText size={16} />
                PDF
              </button>
              <button className="secondary-action" type="button" onClick={() => exportProjectDossierReviews("excel")} disabled={!dossierProject || dossierRequests.length === 0}>
                <FileText size={16} />
                Excel
              </button>
            </div>
          </div>
          <div className="modifications-toolbar dashboard-extraction-toolbar">
            <label className="project-filter">
              <FolderKanban size={16} />
              <select value={dossierProject} onChange={(event) => setDossierProject(event.target.value)}>
                <option value={allProjectsValue}>Tous les projets</option>
                {projectOptions.map((projectName) => (
                  <option key={projectName} value={projectName}>{projectName}</option>
                ))}
              </select>
            </label>
          </div>
        </section>
      )}
      <section className="panel">
        <div className="section-title">
          <div>
            <h2>{adminView ? "Dernières modifications" : "Mes modifications à suivre"}</h2>
            <span>{recentRequests.length} affichée{recentRequests.length > 1 ? "s" : ""}</span>
          </div>
          <button className="secondary-action" disabled={!adminView} onClick={onCreateRequest}>
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
                  <small className={`stage-pill ${stageColorClass(request.currentStage, Boolean(request.newVersion))}`}>{stageLabel(request.currentStage, Boolean(request.newVersion))}</small>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </section>
  );
}

function DashboardDonut({ active, closed, cancelled, late }) {
  const total = Math.max(1, active + closed + cancelled);
  const lateAngle = (late / total) * 360;
  const healthyActiveAngle = (Math.max(0, active - late) / total) * 360;
  const closedAngle = (closed / total) * 360;
  const activeEnd = lateAngle + healthyActiveAngle;
  const closedEnd = activeEnd + closedAngle;
  const background = `conic-gradient(#dc2626 0deg ${lateAngle}deg, #2563eb ${lateAngle}deg ${activeEnd}deg, #16a34a ${activeEnd}deg ${closedEnd}deg, #64748b ${closedEnd}deg 360deg)`;
  return (
    <div className="dashboard-donut" style={{ background }}>
      <div>
        <strong>{Math.round(((closed + cancelled) / total) * 100)}%</strong>
        <span>clos</span>
      </div>
    </div>
  );
}

function dashboardDistribution(items, labelFor, limit = 6) {
  return Array.from(items.reduce((map, item) => {
    const label = labelFor(item);
    map.set(label, (map.get(label) || 0) + 1);
    return map;
  }, new Map()).entries())
    .map(([label, count]) => ({ label, count }))
    .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label, "fr", { sensitivity: "base" }))
    .slice(0, limit);
}

function DashboardDistributionCard({ title, subtitle, items = [] }) {
  const maxCount = Math.max(1, ...items.map((item) => item.count));
  return (
    <article className="panel dashboard-chart-panel">
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          <span>{subtitle}</span>
        </div>
      </div>
      <div className="dashboard-bars">
        {items.length === 0 ? (
          <EmptyState title="Aucune donnée" text="Les données apparaîtront selon les dossiers accessibles." compact />
        ) : items.map((item) => (
          <div className="dashboard-bar-row" key={item.label}>
            <span>{item.label}</span>
            <div><i style={{ width: `${Math.max(8, (item.count / maxCount) * 100)}%` }} /></div>
            <strong>{item.count}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function DashboardTilesCard({ title, subtitle, items = [] }) {
  const maxCount = Math.max(1, ...items.map((item) => item.count));
  return (
    <article className="panel dashboard-chart-panel">
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          <span>{subtitle}</span>
        </div>
      </div>
      {items.length === 0 ? (
        <EmptyState title="Aucune donnée" text="Les données apparaîtront selon les dossiers accessibles." compact />
      ) : (
        <div className="dashboard-tile-map">
          {items.map((item, index) => (
            <span className={`tile-${(index % 5) + 1}`} key={item.label} style={{ minHeight: `${46 + (item.count / maxCount) * 58}px` }}>
              <strong>{item.count}</strong>
              {item.label}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function DashboardBubbleCard({ title, subtitle, items = [] }) {
  const maxCount = Math.max(1, ...items.map((item) => item.count));
  return (
    <article className="panel dashboard-chart-panel">
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          <span>{subtitle}</span>
        </div>
      </div>
      {items.length === 0 ? (
        <EmptyState title="Aucune donnée" text="Les données apparaîtront selon les dossiers accessibles." compact />
      ) : (
        <div className="dashboard-bubbles">
          {items.map((item, index) => (
            <span className={`bubble-${(index % 5) + 1}`} key={item.label} style={{ width: `${68 + (item.count / maxCount) * 58}px`, height: `${68 + (item.count / maxCount) * 58}px` }}>
              <strong>{item.count}</strong>
              <em>{item.label}</em>
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function DashboardRankingCard({ title, subtitle, items = [] }) {
  return (
    <article className="panel dashboard-chart-panel">
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          <span>{subtitle}</span>
        </div>
      </div>
      <div className="dashboard-ranking">
        {items.length === 0 ? (
          <EmptyState title="Aucune donnée" text="Les données apparaîtront selon les dossiers accessibles." compact />
        ) : items.map((item, index) => (
          <div className="dashboard-rank-row" key={item.label}>
            <span>{index + 1}</span>
            <strong>{item.label}</strong>
            <em>{item.count}</em>
          </div>
        ))}
      </div>
    </article>
  );
}

function DashboardStatusMatrix({ entries = [] }) {
  const maxCount = Math.max(1, ...entries.flatMap((entry) => [entry.active, entry.late, entry.closed]));
  return (
    <div className="dashboard-status-matrix">
      <span className="matrix-head">Phase</span>
      <span className="matrix-head">Actif</span>
      <span className="matrix-head">Retard</span>
      <span className="matrix-head">Clos</span>
      {entries.length === 0 ? (
        <span className="matrix-empty">Aucune donnée de phase.</span>
      ) : entries.map((entry) => (
        <Fragment key={entry.stage}>
          <strong>{entry.label}</strong>
          <i className="matrix-cell active" style={{ opacity: 0.25 + (entry.active / maxCount) * 0.75 }}>{entry.active}</i>
          <i className="matrix-cell late" style={{ opacity: 0.25 + (entry.late / maxCount) * 0.75 }}>{entry.late}</i>
          <i className="matrix-cell closed" style={{ opacity: 0.25 + (entry.closed / maxCount) * 0.75 }}>{entry.closed}</i>
        </Fragment>
      ))}
    </div>
  );
}

function TraceabilityPage({ actionFilter, actionOptions, logs, query, total, onRefresh, setActionFilter, setQuery }) {
  return (
    <section className="page-content traceability-content">
      <PageHeader eyebrow="Suivi" title="Tracabilite" subtitle="Historique des changements importants effectues dans l'application." />
      <div className="modifications-toolbar">
        <label className="search">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une personne, un changement, un element..." />
        </label>
        <label className="project-filter">
          <ClipboardList size={16} />
          <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
            <option value="">Tous les types</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>{auditActionLabel(action)}</option>
            ))}
          </select>
        </label>
        <button className="secondary-action" type="button" onClick={onRefresh}>
          <ClipboardList size={16} />
          Actualiser
        </button>
        <span className="toolbar-count">{logs.length} changement{logs.length > 1 ? "s" : ""}</span>
      </div>

      <section className="panel traceability-panel">
        {logs.length === 0 ? (
          <EmptyState title="Aucune trace" text="Les operations apparaitront ici apres les prochaines actions." />
        ) : (
          <div className="traceability-table">
            <div className="traceability-row traceability-head">
              <span>Date</span>
              <span>Personne</span>
              <span>Type de modification</span>
              <span>Element concerne</span>
              <span>Resultat</span>
            </div>
            {logs.map((log) => (
              <article className="traceability-row" key={log.id}>
                <span>{formattedDateTime(log.occurredAt)}</span>
                <span>
                  <strong>{log.actorName || "-"}</strong>
                  <small>{userFriendlyRole(log.actorRole)}</small>
                </span>
                <span>
                  <strong>{auditActionLabel(log.actionType)}</strong>
                  <small>{auditFriendlyDetail(log)}</small>
                </span>
                <span>
                  <strong>{auditTargetSummary(log)}</strong>
                  <small>{auditTargetHint(log)}</small>
                </span>
                <span><small className={`status ${auditSucceeded(log) ? "done" : "late"}`}>{auditResultLabel(log)}</small></span>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function auditActionLabel(actionType) {
  const labels = {
    CREATION_MODIFICATION: "Création d'une modification",
    MODIFICATION_MODIFICATION: "Modification d'une modification",
    VALIDATION_PHASE: "Validation d'une phase",
    REOUVERTURE_PHASE: "Reouverture d'une phase",
    ANNULATION_MODIFICATION: "Annulation d'une modification",
    ACTION_TERMINEE: "Action marquée terminée",
    VALIDATION_ACTION: "Validation d'une action",
    REFUS_VALIDATION_ACTION: "Refus de validation d'une action",
    AJOUT_CLIENT: "Ajout d'un client",
    AJOUT_PRODUIT: "Ajout d'un produit",
    AJOUT_PROJET: "Ajout d'un projet",
    MODIFICATION_PROJET_EQUIPE: "Modification d'un projet ou de son equipe"
  };
  return labels[actionType] || actionType || "-";
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

function auditFriendlyDetail(log) {
  if (!auditSucceeded(log)) return "Le changement n'a pas été autorisé.";
  const storedDetail = userFriendlyStoredAuditDetail(log.details);
  if (storedDetail) return storedDetail;
  const target = auditTargetHint(log);
  const labels = {
    CREATION_MODIFICATION: `Nouvelle demande créée${target ? `: ${target}` : ""}.`,
    MODIFICATION_MODIFICATION: `Demande mise à jour${target ? `: ${target}` : ""}.`,
    ANNULATION_MODIFICATION: `Demande annulée${target ? `: ${target}` : ""}.`,
    VALIDATION_PHASE: `Phase validée${target ? ` pour ${target}` : ""}.`,
    REOUVERTURE_PHASE: `Phase rouverte${target ? ` pour ${target}` : ""}.`,
    ACTION_TERMINEE: `Action terminée${target ? `: ${target}` : ""}.`,
    VALIDATION_ACTION: `Action validée${target ? `: ${target}` : ""}.`,
    REFUS_VALIDATION_ACTION: `Action refusée${target ? `: ${target}` : ""}.`,
    AJOUT_CLIENT: "Nouveau client ajoute au referentiel.",
    AJOUT_PRODUIT: "Nouveau produit ajoute au referentiel.",
    AJOUT_PROJET: "Nouveau projet ajoute.",
    MODIFICATION_PROJET_EQUIPE: `Projet ou equipe mis a jour${target ? `: ${target}` : ""}.`
  };
  return labels[log.actionType] || "Un changement important a été effectué.";
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

function auditTargetHint(log) {
  const relatedModification = auditRelatedModification(log);
  if (relatedModification) return relatedModification;
  if (!log.targetId) return "";
  if (log.actionType === "AJOUT_PROJET" || log.actionType === "MODIFICATION_PROJET_EQUIPE") return log.targetId;
  return "";
}

function auditRelatedModification(log) {
  if (!["ACTION_TERMINEE", "VALIDATION_PHASE", "REOUVERTURE_PHASE", "REFUS_VALIDATION_ACTION"].includes(log.actionType)) return "";
  const detailModification = auditDetailSegment(log.details, "Modification");
  if (detailModification) return detailModification;
  return log.targetType === "modification" ? String(log.targetId || "").trim() : "";
}

function auditDetailSegment(detail, label) {
  const value = String(detail || "");
  const match = value.match(new RegExp(`(?:^| - )${label}:\\s*([^\\n]+?)(?= - [^:]+:|$)`));
  return match ? match[1].trim() : "";
}

function userFriendlyRole(role) {
  const value = String(role || "").trim();
  if (!value) return "-";
  if (value.toUpperCase() === "ADMIN") return "Administrateur";
  return userRoleLabel(value);
}

function userFriendlyStoredAuditDetail(detail) {
  const value = String(detail || "").trim();
  if (!value || value.includes("/api/") || value.includes("HTTP ")) return "";
  const allowedPrefixes = [
    "Création de la modification:",
    "Modification mise à jour:",
    "Validation de la phase:",
    "Phase rouverte:",
    "Action marquée terminée:",
    "Validation de l'action:",
    "Refus de validation de l'action:",
    "Ajout du client:",
    "Ajout du produit:",
    "Ajout du projet:",
    "Modification du projet ou de son equipe:"
  ];
  return allowedPrefixes.some((prefix) => value.startsWith(prefix)) ? value : "";
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
  const projectPilotOptions = projectLeadTeamMembers(selectedProject?.projectTeam, users);
  const canCreateModification = projects.length > 0 && projectPilotOptions.includes(ecrForm.pilot);
  const displayedClientOptions = includeCurrentOption(clientOptions, ecrForm.client);
  const selectedProducts = parseSelectedProducts(ecrForm.product);
  const displayedProductOptions = includeCurrentOptions(productOptions, selectedProducts);
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
          <button className="primary-action" disabled={saving || !canCreateModification} type="submit">
            <SubmitIcon size={16} />
            {submitLabel}
          </button>
          <button className="secondary-action" type="button" onClick={onCancel}>Annulér</button>
        </div>
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

function PreferentialsPage({
  clientForm,
  clients,
  editingClient,
  editingFinishedProduct,
  editingProduct,
  editingProject,
  editingRole,
  finishedProductForm,
  finishedProducts,
  productForm,
  products,
  projectForm,
  projects,
  roleForm,
  roles,
  saving,
  users,
  onCancelClientEdit,
  onCancelFinishedProductEdit,
  onCancelProductEdit,
  onCancelProjectEdit,
  onCancelRoleEdit,
  onDeleteClient,
  onDeleteFinishedProduct,
  onDeleteProduct,
  onDeleteProject,
  onDeleteRole,
  onEditClient,
  onEditFinishedProduct,
  onEditProduct,
  onEditProject,
  onEditRole,
  onSubmitClient,
  onSubmitFinishedProduct,
  onSubmitProduct,
  onSubmitProject,
  onSubmitRole,
  setClientForm,
  setFinishedProductForm,
  setProductForm,
  setProjectForm,
  setRoleForm
}) {
  const [activePreferential, setActivePreferential] = useState("projects");
  const preferentialEntities = [
    { key: "projects", label: "Projets", count: projects.length },
    { key: "clients", label: "Clients", count: clients.length },
    { key: "products", label: "Produits", count: products.length },
    { key: "finished-products", label: "Produits finis", count: finishedProducts.length },
    { key: "roles", label: "Rôles d'action", count: roles.length }
  ];

  return (
    <section className="page-content">
      <PageHeader eyebrow="Référentiel" title="Préférentiels" subtitle="Gérez les projets, clients, produits et rôles d'action utilisés dans les modifications." />
      <div className="preferentials-layout">
        <aside className="panel preferential-entity-list" aria-label="Entites du referentiel">
          {preferentialEntities.map((entity) => (
            <button
              className={activePreferential === entity.key ? "preferential-entity-button active" : "preferential-entity-button"}
              key={entity.key}
              type="button"
              onClick={() => setActivePreferential(entity.key)}
            >
              <span>{entity.label}</span>
              <strong>{entity.count}</strong>
            </button>
          ))}
        </aside>
        <div className="preferential-entity-content">
          {activePreferential === "projects" && (
      <ProjectPreferentialPanel
        editingProject={editingProject}
        projectForm={projectForm}
        projects={projects}
        saving={saving}
        users={users}
        onCancelEdit={onCancelProjectEdit}
        onDelete={onDeleteProject}
        onEdit={onEditProject}
        onSubmit={onSubmitProject}
        setProjectForm={setProjectForm}
      />
          )}
          {activePreferential === "clients" && (
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
          )}
          {activePreferential === "products" && (
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
          )}
          {activePreferential === "finished-products" && (
        <FinishedProductPreferentialPanel
          clients={clients}
          editing={editingFinishedProduct}
          form={finishedProductForm}
          products={products}
          projects={projects}
          references={finishedProducts}
          saving={saving}
          onCancelEdit={onCancelFinishedProductEdit}
          onDelete={onDeleteFinishedProduct}
          onEdit={onEditFinishedProduct}
          onSubmit={onSubmitFinishedProduct}
          setForm={setFinishedProductForm}
        />
          )}
          {activePreferential === "roles" && (
        <PreferentialPanel
          count={roles.length}
          editing={editingRole}
          emptyText="Ajoutez les rôles disponibles uniquement comme pilotes d'action."
          emptyTitle="Aucun rôle"
          form={roleForm}
          saving={saving}
          title="Rôles d'action"
          onCancelEdit={onCancelRoleEdit}
          onDelete={onDeleteRole}
          onEdit={onEditRole}
          onSubmit={onSubmitRole}
          references={roles}
          setForm={setRoleForm}
        />
          )}
        </div>
      </div>
    </section>
  );
}

function FinishedProductPreferentialPanel({ clients = [], editing, form, products, projects, references, saving, onCancelEdit, onDelete, onEdit, onSubmit, setForm }) {
  const [searchTerm, setSearchTerm] = useState("");
  const clientNames = uniqueSorted(clients.map((client) => client.name));
  const projectNames = uniqueSorted(projects.map((project) => project.name));
  const productNames = uniqueSorted(products.map((product) => product.name));
  const filteredReferences = useFilteredItems(references, searchTerm, (reference) => [
    reference.client,
    reference.project,
    reference.partNumber,
    reference.designation,
    reference.customerPn,
    reference.product,
    reference.coiffeIndex,
    reference.drawingIndex,
    reference.reducedCode,
    reference.comments
  ]);
  const { currentPage, pageCount, pagedItems, setCurrentPage } = usePaginatedItems(filteredReferences, PREFERENTIAL_PAGE_SIZE);

  return (
    <section className="panel preferential-panel">
      <form className="form-page compact-preferential-form finished-product-form" onSubmit={onSubmit}>
        <div className="section-title">
          <div>
            <h2>Produits finis</h2>
            <span>{references.length} element{references.length > 1 ? "s" : ""}</span>
          </div>
        </div>
        <div className="finished-product-grid">
          <label>
            Client
            <select required value={form.client} onChange={(event) => setForm((current) => ({ ...current, client: event.target.value }))}>
              <option value="">Selectionner un client</option>
              {includeCurrentOption(clientNames, form.client).map((client) => <option key={client} value={client}>{client}</option>)}
            </select>
          </label>
          <label>
            Projet
            <select required value={form.project} onChange={(event) => setForm((current) => ({ ...current, project: event.target.value }))}>
              <option value="">Selectionner un projet</option>
              {projectNames.map((project) => <option key={project} value={project}>{project}</option>)}
            </select>
          </label>
          <label>
            Part number
            <input required value={form.partNumber} onChange={(event) => setForm((current) => ({ ...current, partNumber: event.target.value }))} />
          </label>
          <label>
            Designation
            <input value={form.designation} onChange={(event) => setForm((current) => ({ ...current, designation: event.target.value }))} />
          </label>
          <label>
            Customer PN
            <input value={form.customerPn} onChange={(event) => setForm((current) => ({ ...current, customerPn: event.target.value }))} />
          </label>
          <label>
            Produit
            <select required value={form.product} onChange={(event) => setForm((current) => ({ ...current, product: event.target.value }))}>
              <option value="">Selectionner un produit</option>
              {productNames.map((product) => <option key={product} value={product}>{product}</option>)}
            </select>
          </label>
          <label>
            Indice coiffe
            <input value={form.coiffeIndex} onChange={(event) => setForm((current) => ({ ...current, coiffeIndex: event.target.value }))} />
          </label>
          <label>
            Indice drawing
            <input value={form.drawingIndex} onChange={(event) => setForm((current) => ({ ...current, drawingIndex: event.target.value }))} />
          </label>
          <label>
            Code réduit
            <input required value={form.reducedCode} onChange={(event) => setForm((current) => ({ ...current, reducedCode: event.target.value }))} />
          </label>
          <label>
            Prix vente
            <input min="0" step="0.001" type="number" value={form.salePrice} onChange={(event) => setForm((current) => ({ ...current, salePrice: event.target.value }))} />
          </label>
          <label>
            Date integration production
            <input type="date" value={form.productionIntegrationDate} onChange={(event) => setForm((current) => ({ ...current, productionIntegrationDate: event.target.value }))} />
          </label>
          <label className="finished-product-comments">
            Commentaires
            <textarea value={form.comments} onChange={(event) => setForm((current) => ({ ...current, comments: event.target.value }))} />
          </label>
        </div>
        <div className="button-row">
          <button className="primary-action" disabled={saving || clientNames.length === 0 || projectNames.length === 0 || productNames.length === 0} type="submit">
            <Save size={16} />
            Enregistrer
          </button>
          {editing && <button className="secondary-action" type="button" onClick={onCancelEdit}>Annulér</button>}
        </div>
        {clientNames.length === 0 && <p className="form-hint">Ajoutez d'abord au moins un client.</p>}
        {projectNames.length === 0 && <p className="form-hint">Ajoutez d'abord au moins un projet.</p>}
        {productNames.length === 0 && <p className="form-hint">Ajoutez d'abord au moins un produit.</p>}
      </form>
      <label className="preferential-search">
        Rechercher
        <div className="input-with-icon">
          <Search size={16} />
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Rechercher dans les produits finis" />
        </div>
      </label>
      <div className="table-list">
        {references.length === 0 ? (
          <EmptyState title="Aucun produit fini" text="Ajoutez les produits finis par projet et produit." compact />
        ) : filteredReferences.length === 0 ? (
          <EmptyState title="Aucun resultat" text="Essayez un autre terme de recherche." compact />
        ) : (
          <>
            {pagedItems.map((reference) => (
              <article className="project-table-row preferential-table-row finished-product-row" key={reference.id}>
                <div>
                  <strong>{reference.partNumber}</strong>
                  <span>{reference.project} | {reference.product} | Code réduit: {reference.reducedCode}</span>
                  <small>{[reference.client, reference.designation, reference.customerPn].filter(Boolean).join(" | ") || "Details non renseignes"}</small>
                </div>
                <div className="finished-product-meta">
                  <span>{reference.salePrice != null ? `${reference.salePrice} EUR` : "-"}</span>
                  <span>{reference.productionIntegrationDate || "-"}</span>
                </div>
                <div className="row-actions">
                  <button className="secondary-action compact-action icon-only-action" type="button" onClick={() => onEdit(reference)} aria-label={`Modifier ${reference.partNumber}`} title="Modifier">
                    <Pencil size={15} />
                  </button>
                  <button className="ghost-icon" type="button" onClick={() => onDelete(reference.id)} title="Supprimer">
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))}
            <PaginationControls
              currentPage={currentPage}
              pageCount={pageCount}
              totalCount={filteredReferences.length}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>
    </section>
  );
}

function PreferentialPanel({ count, editing, emptyText, emptyTitle, form, references, saving, title, onCancelEdit, onDelete, onEdit, onSubmit, setForm }) {
  const [searchTerm, setSearchTerm] = useState("");
  const filteredReferences = useFilteredItems(references, searchTerm, (reference) => [reference.name]);
  const { currentPage, pageCount, pagedItems, setCurrentPage } = usePaginatedItems(filteredReferences, PREFERENTIAL_PAGE_SIZE);

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
          {editing && <button className="secondary-action" type="button" onClick={onCancelEdit}>Annulér</button>}
        </div>
      </form>
      <label className="preferential-search">
        Rechercher
        <div className="input-with-icon">
          <Search size={16} />
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={`Rechercher dans ${title.toLowerCase()}`} />
        </div>
      </label>
      <div className="table-list">
        {references.length === 0 ? (
          <EmptyState title={emptyTitle} text={emptyText} compact />
        ) : filteredReferences.length === 0 ? (
          <EmptyState title="Aucun résultat" text="Essayez un autre terme de recherche." compact />
        ) : (
          <>
            {pagedItems.map((reference) => (
              <article className="project-table-row preferential-table-row" key={reference.id}>
                <div>
                  <strong>{reference.name}</strong>
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
            <PaginationControls
              currentPage={currentPage}
              pageCount={pageCount}
              totalCount={filteredReferences.length}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>
    </section>
  );
}

function ProjectPreferentialPanel({ editingProject, projectForm, projects, saving, users, onCancelEdit, onDelete, onEdit, onSubmit, setProjectForm }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const filteredProjects = useFilteredItems(projects, searchTerm, (project) => [
    project.name,
    project.projectTeam,
    formatProjectTeamWithRoles(project.projectTeam, users)
  ]);
  const { currentPage, pageCount, pagedItems, setCurrentPage } = usePaginatedItems(filteredProjects, PREFERENTIAL_PAGE_SIZE);

  useEffect(() => {
    if (editingProject) {
      setDialogOpen(true);
    }
  }, [editingProject]);

  function openCreateDialog() {
    onCancelEdit();
    setDialogOpen(true);
  }

  function closeDialog() {
    onCancelEdit();
    setDialogOpen(false);
  }

  function submitDialog(event) {
    const result = onSubmit(event);
    if (!result?.then) return result;
    return result
      .then(() => setDialogOpen(false))
      .catch(() => {});
  }

  return (
    <section className="panel project-preferential-panel">
      <div className="section-title">
        <div>
          <h2>Projets</h2>
          <span>{projects.length} projet{projects.length > 1 ? "s" : ""}</span>
        </div>
        <button className="primary-action compact-action" disabled={saving} type="button" onClick={openCreateDialog}>
          <Plus size={15} />
          Ajouter
        </button>
      </div>
      <label className="preferential-search">
        Rechercher
        <div className="input-with-icon">
          <Search size={16} />
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Rechercher dans projets" />
        </div>
      </label>
      <div className="table-list">
        {projects.length === 0 ? (
          <EmptyState title="Aucun projet créé" text="Ajoutez un premier projet pour débloquer la création des modifications." compact />
        ) : filteredProjects.length === 0 ? (
          <EmptyState title="Aucun resultat" text="Essayez un nom de projet ou un membre d'equipe." compact />
        ) : (
          <>
            {pagedItems.map((project) => (
              <article className="project-table-row" key={project.name}>
                <div>
                  <strong>{project.name}</strong>
                  <span className="project-team-list">{formatProjectTeamWithRoles(project.projectTeam, users)}</span>
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
            ))}
            <PaginationControls
              currentPage={currentPage}
              pageCount={pageCount}
              totalCount={filteredProjects.length}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>
      {dialogOpen && (
        <ProjectDialog
          editingProject={editingProject}
          projectForm={projectForm}
          saving={saving}
          users={users}
          onClose={closeDialog}
          onSubmit={submitDialog}
          setProjectForm={setProjectForm}
        />
      )}
    </section>
  );
}

function ProjectDialog({ editingProject, projectForm, saving, users, onClose, onSubmit, setProjectForm }) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        aria-labelledby="project-dialog-title"
        aria-modal="true"
        className="dialog-card project-dialog panel form-page"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
        role="dialog"
      >
        <div className="form-intro">
          <div>
            <p className="eyebrow">Projet</p>
            <h2 id="project-dialog-title">{editingProject ? "Modifier le projet" : "Ajouter un projet"}</h2>
          </div>
          <button className="ghost-icon" type="button" onClick={onClose} title="Fermer">
            <X size={18} />
          </button>
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
          <button className="secondary-action" type="button" onClick={onClose}>Annulér</button>
        </div>
      </form>
    </div>
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

function ProjectsPage({
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

function uploadActionProofDocumentFiles(actionId, files) {
  return files.reduce(
    (promise, file) => promise.then(() => uploadActionProofDocument(actionId, file)),
    Promise.resolve(null)
  );
}

function uploadActionPlanningRuleProofDocumentFiles(ruleId, files) {
  return files.reduce(
    (promise, file) => promise.then(() => uploadActionPlanningRuleProofDocument(ruleId, file)),
    Promise.resolve(null)
  );
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
  return actionAssets(action).length > 0;
}

function hasActionProofDocument(action) {
  return filesFromValue(action?.proofDocumentFile).length > 0 || actionProofDocuments(action).length > 0;
}

function actionAssetUrl(action, asset) {
  return asset?.legacy ? actionEvidenceUrl(action.id) : actionAssetDownloadUrl(asset.id);
}

function actionProofDocumentItemUrl(action, proofDocument) {
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
  const [previewImage, setPreviewImage] = useState(null);
  const [dossierDialogOpen, setDossierDialogOpen] = useState(false);
  const [detailsCollapsed, setDetailsCollapsed] = useState(false);
  const {
    actionForm,
    actionRoleOptions,
    actions,
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
    removeActionProofDocumentFile,
    handleApprovePhase,
    handleApproveActionValidation,
    handleRejectActionValidation,
    handleRequestActionValidation,
    handleRejectPhase,
    handleReopenPhase,
    handleRequestPhaseValidation,
    isCriticalAction,
    lateActions,
    phaseValidations,
    projectFilter,
    projectOptions,
    query,
    requestSearchSuggestions,
    requestArchiveView,
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
    requiresEvidence,
    updateActionForm
  } = props;
  const canAdmin = isAdminUser(currentUser);
  const canValidate = canValidatePhases(currentUser);
  const canRequestValidation = isRequestPilot(currentUser, selectedRequest);
  const canManageDossierReview = canAdmin || canRequestValidation;
  const canExportGantt = canAdmin || canRequestValidation;
  const canCancelRequest = (canAdmin || canRequestValidation) && selectedRequest?.currentStage !== "CANCELLED";
  const currentValidation = phaseValidations.find((validation) => validation.stage === selectedStage && validation.status === "PENDING");
  const latestStageValidation = phaseValidations.find((validation) => validation.stage === selectedStage);
  const stageActionsDone = actions.length > 0 && actions.every(isActionDone);
  const isCurrentStage = selectedRequest && selectedStage === selectedRequest.currentStage;
  const requestStatusOptions = [
    ...(canAdmin ? [["all", "Toutes"],
    ["active", "Actives"],
    ["closed", "Clôturées"],
    ["cancelled", "Annulées"],
    ["archived", "Archivées"]] : [])
  ];

  function selectRequest(request) {
    setShowCreateForm(false);
    setSelectedId(request.id);
    setSelectedStage(safeStage(request.currentStage, Boolean(request.newVersion)));
    setDetailsCollapsed(false);
    setListOpen(false);
  }

  function exportModificationGanttPdf() {
    if (!selectedRequest) return;
    getActions(selectedRequest.id)
      .then((requestActions) => {
        const win = window.open("", "_blank");
        if (!win) return;
        win.document.write(modificationGanttPdfHtml(selectedRequest, requestActions, selectedStages));
        win.document.close();
        successToast("Gantt PDF genere");
      })
      .catch(() => {
        errorAlert("Generation du diagramme de Gantt impossible.");
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
            placeholder="Rechercher une modification"
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
          <FolderKanban size={16} />
          <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
            <option value="">Tous les projets</option>
            {projectOptions.map((projectName) => (
              <option key={projectName} value={projectName}>{projectName}</option>
            ))}
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
          Nouvelle modification
        </button>
      </div>
      <div className="work-layout">
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
                  disabled={!canAdmin || saving}
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
                    title="Annulér la modification"
                    aria-label="Annulér la modification"
                  >
                    <XCircle size={18} />
                    <span>Annulér la modification</span>
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
                  <button className="dossier-review-card" type="button" onClick={exportModificationGanttPdf} title="Extraire le diagramme de Gantt">
                    <CalendarDays size={24} />
                    <span>Gantt PDF</span>
                  </button>
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
                  {selectedStages.map(([key, label]) => (
                    <button key={key} className={`tab ${stageColorClass(key, Boolean(selectedRequest.newVersion))}${selectedStage === key ? " active" : ""}`} onClick={() => (canAdmin ? handleStageChange(key) : setSelectedStage(key))}>
                      {label}
                    </button>
                  ))}
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
                  actions={actions}
                  currentUser={currentUser}
                  doneCount={doneCount}
                  handleCreateAction={handleCreateAction}
                  handleDeleteAction={handleDeleteAction}
                  handleToggleAction={handleToggleAction}
                  handleUpdateActionDuration={handleUpdateActionDuration}

                  handleApproveActionValidation={handleApproveActionValidation}
                  handleRejectActionValidation={handleRejectActionValidation}
                  handleRequestActionValidation={handleRequestActionValidation}
                  handleDeleteActionAsset={handleDeleteActionAsset}
                  handleUploadEvidence={handleUploadEvidence}
                  isCriticalAction={isCriticalAction}
                  canAdmin={canAdmin}
                  lateActions={lateActions}
                  requiresEvidence={requiresEvidence}
                  saving={saving}
                  selectedRequest={selectedRequest}
                  phaseValidation={currentValidation}
                  phaseValidations={phaseValidations}
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
          canManage={canManageDossierReview}
          request={selectedRequest}
          saving={saving}
          onClose={() => setDossierDialogOpen(false)}
          onSubmit={(value) => onUpdateDossierReview(selectedRequest, value)}
        />
      )}
    </section>
  );
}

function DossierReviewDialog({ canManage, request, saving, onClose, onSubmit }) {
  const [value, setValue] = useState(request.dossierReview || "");
  const fileBaseName = `revue-dossier-${fileNameToken(requestDisplayName(request))}`;

  function submit(event) {
    event.preventDefault();
    if (!canManage) {
      onClose();
      return;
    }
    onSubmit(value).then(() => onClose()).catch(() => {});
  }

  function exportTxt() {
    if (!canManage) return;
    downloadTextFile(`${fileBaseName}.txt`, dossierReviewExportText(request, value));
  }

  function exportPdf() {
    if (!canManage) return;
    const title = `Revue dossier - ${requestDisplayName(request)}`;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
      body{font-family:Arial,sans-serif;color:#111827;margin:32px;line-height:1.5}
      h1{font-size:22px;margin:0 0 8px}
      .meta{color:#475569;font-size:13px;margin-bottom:20px}
      pre{white-space:pre-wrap;border:1px solid #d7dee8;border-radius:8px;padding:16px;font-family:Arial,sans-serif;min-height:360px}
      @media print{body{margin:18mm}}
    </style></head><body><h1>${escapeHtml(title)}</h1><div class="meta">${escapeHtml(dossierReviewMetaLine(request))}</div><pre>${escapeHtml(value || "Revue dossier vide.")}</pre><script>window.onload=function(){window.print();};</script></body></html>`);
    win.document.close();
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        aria-labelledby="dossier-review-title"
        aria-modal="true"
        className="dossier-review-dialog panel form-page"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submit}
        role="dialog"
      >
        <header className="actions-dialog-header">
          <div>
            <p className="eyebrow">{canManage ? "Document modifiable" : "Lecture seule"}</p>
            <h2 id="dossier-review-title">Revue dossier</h2>
            <span>{dossierReviewMetaLine(request)}</span>
          </div>
          <button className="ghost-icon" type="button" onClick={onClose} title="Fermer">
            <X size={18} />
          </button>
        </header>
        <textarea className="dossier-review-editor" readOnly={!canManage} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Ajouter les notes de revue, décisions, points ouverts, actions à suivre..." />
        <div className="button-row dossier-review-actions">
          {canManage && (
            <>
              <button className="primary-action" disabled={saving} type="submit">
                <Save size={16} />
                Enregistrer
              </button>
              <button className="secondary-action" type="button" onClick={exportTxt}>
                <FileText size={16} />
                Export TXT
              </button>
              <button className="secondary-action" type="button" onClick={exportPdf}>
                <FileText size={16} />
                Export PDF
              </button>
            </>
          )}
          <button className="secondary-action" type="button" onClick={onClose}>{canManage ? "Annulér" : "Fermer"}</button>
        </div>
      </form>
    </div>
  );
}

function PhaseValidationPanel({ canAdmin, canRequestValidation, canValidate, isCurrentStage, latestValidation, saving, stageActionsDone, validation, validationRate, onApprove, onReject, onReopen, onRequest }) {
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
          <button className="secondary-action compact-action" disabled={!canRequestValidation || !isCurrentStage || !stageActionsDone || saving} type="button" onClick={onRequest}>
            Demander validation
          </button>
        )}
        {validation && canValidate && (
          <>
            <button className="secondary-action compact-action" disabled={!isCurrentStage || saving} type="button" onClick={() => onReject(validation)}>
              Refuser
            </button>
            <button className="primary-action compact-action" disabled={!isCurrentStage || !allActionsValidated || saving} type="button" onClick={() => onApprove(validation)}>
              Valider phase
            </button>
          </>
        )}
        {canAdmin && phaseApproved && !isCurrentStage && (
          <button className="primary-action compact-action" disabled={saving} type="button" onClick={() => onReopen(latestValidation)}>
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

function ActionsPanel({ actionForm, actionRoleOptions, actions, canAdmin, currentUser, doneCount, handleCreateAction, handleDeleteAction, handleToggleAction, handleUpdateActionDuration, handleApproveActionValidation, handleRejectActionValidation, handleRequestActionValidation, handleDeleteActionAsset, handleUploadEvidence, isCriticalAction, lateActions, phaseValidation, phaseValidations = [], requiresEvidence, saving, selectedRequest, selectedStages, selectedStage, stageNewProject, updateActionForm, removeActionProofDocumentFile }) {
  const [expanded, setExpanded] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const stageTitle = stageLabel(selectedStage, stageNewProject);
  const canCreateAction = canAdmin || isRequestPilot(currentUser, selectedRequest);

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
        canAdmin={canAdmin}
        isCriticalAction={isCriticalAction}
        requiresEvidence={requiresEvidence}
        phaseValidations={phaseValidations}
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
              canAdmin={canAdmin}
              isCriticalAction={isCriticalAction}
              requiresEvidence={requiresEvidence}
              phaseValidations={phaseValidations}
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

function ActionList({ actions, currentUser, expanded = false, phaseValidation, phaseValidations = [], handleToggleAction, handleUpdateActionDuration, handleApproveActionValidation, handleRejectActionValidation, handleRequestActionValidation, handleDeleteAction, handleDeleteActionAsset, handleUploadEvidence, requiresEvidence, saving, selectedRequest }) {
  const [durationValues, setDurationValues] = useState({});

  useEffect(() => {
    setDurationValues((current) => {
      const nextValues = {};
      actions.forEach((action) => {
        nextValues[action.id] = current[action.id] ?? String(action.workDurationDays ?? 1);
      });
      return nextValues;
    });
  }, [actions]);

  return (
    <>
      <div className={expanded ? "action-list expanded" : "action-list"}>
        {actions.length === 0 ? (
          <EmptyState title="Aucune action pour cette phase" text="Ajoutez une action ou utilisez les actions générées lors de la création ECR." />
        ) : (
          actions.map((action) => {
            const blockingAction = blockingActionFor(action, actions);
            const isBlocked = Boolean(action.dependsOnActionId && (!blockingAction || !isActionDone(blockingAction)));
            const canDeleteAction = canDeleteActionForUser(currentUser, action, selectedRequest, phaseValidations);
            const canEditDuration = canEditActionDurationForUser(currentUser, action, selectedRequest, phaseValidations);
            const canManageAction = canManageActionForUser(currentUser, action, phaseValidations);
            const canToggleAction = canToggleActionForUser(currentUser, action, selectedRequest, phaseValidations);

            return (
            <article className={action.late ? "action-row late" : "action-row"} key={action.id}>
              <label className="action-check" title={isActionDone(action) ? "Marquer non terminée" : "Marquer terminée"}>
                <input checked={isActionDone(action)} disabled={saving || !canToggleAction} onChange={(event) => handleToggleAction(action, event.target.checked)} type="checkbox" />
              </label>
              <div className="action-main">
                <h3>{action.title}</h3>
                <p>{action.topicRisk || "-"}</p>
              </div>
              <div className="action-meta">
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
                    {isActionAwaitingValidation(action, phaseValidation) && canValidateActionForUser(currentUser, action) && (
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
                    {canRequestRejectedActionValidationForUser(currentUser, action, selectedRequest) && phaseValidation?.status === "PENDING" && (
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
  const dependencyOptions = actions
    .filter((action) => action.stage === selectedActionStage)
    .filter((action) => action.id)
    .sort((first, second) => String(first.title || "").localeCompare(String(second.title || "")));

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
              {dependencyOptions.map((action) => (
                <option key={action.id} value={action.id}>{action.title}</option>
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
          </div>
          <label className="asset-required-field user-enabled-field">
            <input
              checked={actionForm.evidenceRequired || selectedProofDocumentFiles.length > 0 || isCriticalAction(actionForm)}
              disabled={selectedProofDocumentFiles.length > 0 || isCriticalAction(actionForm)}
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
          <button className="secondary-action" type="button" onClick={onClose}>Annulér</button>
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
