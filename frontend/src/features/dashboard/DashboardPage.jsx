import React, {Fragment, useEffect, useMemo, useRef, useState} from "react";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, ClipboardList, FileText, FolderKanban, Gauge, Plus, X, XCircle } from "lucide-react";
import { getActions } from "../../api";
import { EmptyState } from "../../components/common/EmptyState";
import { PageHeader } from "../../components/common/PageHeader";
import {getStages, stageColorClass, stageLabel} from "../../utils/stages";
import { userRoleLabel } from "../../utils/users";
import {
  loadDossierAssetsForRequests,
  projectDossierReviewsExportExcel,
  projectDossierReviewsExportHtml,
  projectDossierReviewsExportText
} from "../modifications/dossierReviewExports";

function normalizeRoleToken(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function hasApplicationRole(user, code, label) {
  const role = normalizeRoleToken(user?.role);
  return role === normalizeRoleToken(code) || role === normalizeRoleToken(label);
}

function isAdminUser(user) {
  const role = normalizeRoleToken(user?.role);
  return hasApplicationRole(user, "ADMIN", "Admin")
    || role === "administrateur"
    || normalizeRoleToken(user?.username) === "fchelbi"
    || normalizeRoleToken(user?.email) === "f.chalbi@sagetunisia.com";
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

function workflowCompletionRate(request, actions = []) {
  if (!request) return 0;
  if (request.currentStage === "CLOSED" || request.closureStatus) return 100;
  if (request.currentStage === "CANCELLED") return cancelledCompletionRate(request, actions) ?? 0;
  const stages = getStages(Boolean(request.newVersion)).filter(([stage]) => stage !== "CANCELLED");
  const currentIndex = stages.findIndex(([stage]) => stage === request.currentStage);
  if (currentIndex < 0 || stages.length <= 1) return 0;
  return Math.round((currentIndex / (stages.length - 1)) * 100);
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

function parseSelectedProducts(value) {
  if (!value) return [];
  return String(value)
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
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

export function DashboardPage({
  clients = [],
  currentUser,
  downloadBlobFile,
  downloadHtmlAsPdf,
  downloadTextFile,
  errorAlert,
  planningRules = [],
  products = [],
  projects,
  requests,
  roles = [],
  saving,
  stats,
  successToast,
  users = [],
  warningAlert,
  onCreateRequest,
  onOpenRequest
}) {
  const allProjectsValue = "__ALL__";
  const [dossierProject, setDossierProject] = useState(allProjectsValue);
  const [modificationProgressPage, setModificationProgressPage] = useState(0);
  const [cancelledActionsByRequestId, setCancelledActionsByRequestId] = useState({});
  const [dashboardActionsByRequestId, setDashboardActionsByRequestId] = useState({});
  const [dashboardDialog, setDashboardDialog] = useState(null);
  const adminView = isAdminUser(currentUser);
  const dashboardRequests = requests.filter((request) => !request.archived);
  const dashboardRequestIds = dashboardRequests.map((request) => request.id).filter(Boolean).sort((first, second) => Number(first) - Number(second));
  const dashboardRequestIdsKey = dashboardRequestIds.join("|");
  const activeRequests = dashboardRequests.filter((request) => request.currentStage !== "CLOSED" && request.currentStage !== "CANCELLED");
  const closedRequests = dashboardRequests.filter((request) => request.currentStage === "CLOSED");
  const cancelledRequests = dashboardRequests.filter((request) => request.currentStage === "CANCELLED");
  const cancelledRequestIds = cancelledRequests.map((request) => request.id).filter(Boolean).sort((first, second) => String(first).localeCompare(String(second)));
  const cancelledRequestIdsKey = cancelledRequestIds.join("|");
  const progressForRequest = (request) => workflowCompletionRate(
    request,
    request?.currentStage === "CANCELLED" ? (cancelledActionsByRequestId[request.id] || []) : []
  );

  useEffect(() => {
    if (!cancelledRequestIds.length) {
      setCancelledActionsByRequestId({});
      return undefined;
    }
    let active = true;
    Promise.all(cancelledRequestIds.map((requestId) =>
      getActions(requestId, "CANCELLED")
        .then((items) => [requestId, Array.isArray(items) ? items : []])
        .catch(() => [requestId, []])
    )).then((entries) => {
      if (!active) return;
      setCancelledActionsByRequestId(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
  }, [cancelledRequestIdsKey]);

  useEffect(() => {
    if (!dashboardRequestIds.length) {
      setDashboardActionsByRequestId({});
      return undefined;
    }
    let active = true;
    Promise.all(dashboardRequestIds.map((requestId) =>
      getActions(requestId)
        .then((items) => [requestId, Array.isArray(items) ? items : []])
        .catch(() => [requestId, []])
    )).then((entries) => {
      if (!active) return;
      setDashboardActionsByRequestId(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
  }, [dashboardRequestIdsKey]);

  const lateRequests = activeRequests.filter((request) => {
    const sopDate = parseDateOnly(request.sopDate);
    return sopDate && sopDate < new Date();
  });
  const today = startOfLocalDay(new Date());
  const inThreeDays = addDays(today, 3);
  const dashboardActionRows = dashboardRequests.flatMap((request) => (
    dashboardActionsByRequestId[request.id] || []
  ).map((action) => ({ action, request })));
  const cancelledActionRows = cancelledRequests.flatMap((request) => (
    cancelledActionsByRequestId[request.id] || []
  ).map((action) => ({ action, request })));
  const openActionRows = dashboardActionRows.filter(({ action, request }) => (
    request.currentStage !== "CLOSED" &&
    request.currentStage !== "CANCELLED" &&
    !isActionDone(action)
  ));
  const lateActionRows = openActionRows
    .filter(({ action }) => isDashboardActionLate(action, today))
    .sort((first, second) => dashboardActionDueTime(first.action) - dashboardActionDueTime(second.action));
  const dueSoonActionRows = openActionRows
    .filter(({ action }) => {
      const dueDate = dashboardActionDueDate(action);
      return dueDate && dueDate >= today && dueDate <= inThreeDays;
    })
    .sort((first, second) => dashboardActionDueTime(first.action) - dashboardActionDueTime(second.action));
  const lateOwners = dashboardLateOwners(lateActionRows, 6);
  const projectLateRates = dashboardProjectLateRates(dashboardActionRows, 6);
  const finishedByProject = dashboardFinishedProductGroups(dashboardRequests, "project", 6);
  const finishedByClient = dashboardFinishedProductGroups(dashboardRequests, "client", 6);
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
  const projectProgress = dashboardProgressGroups(dashboardRequests, (request) => request.modificationProject || "Projet non renseigne", 5, progressForRequest);
  const pilotProgress = dashboardProgressGroups(dashboardRequests, (request) => request.pilot || "Pilote non renseigne", 5, progressForRequest);
  const clientProgress = dashboardProgressGroups(dashboardRequests, (request) => request.client || "Client non renseigne", 5, progressForRequest);
  const portfolioProgress = dashboardRequests.length
    ? Math.round(dashboardRequests.reduce((total, request) => total + progressForRequest(request), 0) / dashboardRequests.length)
    : 0;
  const modificationProgressRows = [...dashboardRequests]
    .map((request) => ({ request, progress: progressForRequest(request) }))
    .sort((first, second) => {
      const firstActive = first.request.currentStage !== "CLOSED" && first.request.currentStage !== "CANCELLED";
      const secondActive = second.request.currentStage !== "CLOSED" && second.request.currentStage !== "CANCELLED";
      return Number(secondActive) - Number(firstActive)
        || first.progress - second.progress
        || requestDisplayName(first.request).localeCompare(requestDisplayName(second.request), "fr", { sensitivity: "base" });
    });
  const modificationProgressPageSize = 5;
  const modificationProgressPageCount = Math.max(1, Math.ceil(modificationProgressRows.length / modificationProgressPageSize));
  const visibleModificationProgressRows = modificationProgressRows.slice(
    modificationProgressPage * modificationProgressPageSize,
    modificationProgressPage * modificationProgressPageSize + modificationProgressPageSize
  );
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

  useEffect(() => {
    setModificationProgressPage((page) => Math.min(page, modificationProgressPageCount - 1));
  }, [modificationProgressPageCount]);

  function openDashboardDialog(title, subtitle, type, items) {
    setDashboardDialog({ title, subtitle, type, items });
  }

  function handleDashboardDialogOpen(item) {
    if (!dashboardDialog) return;
    if (dashboardDialog.type === "actions") {
      onOpenRequest(item.request, item.action?.stage);
    } else {
      onOpenRequest(item);
    }
    setDashboardDialog(null);
  }

  async function exportProjectDossierReviews(format) {
    if (!dossierProject) {
      warningAlert("Projet requis", "Sélectionnez un projet avant de lancer l'extraction.");
      return;
    }
    if (dossierRequests.length === 0) {
      warningAlert("Aucune modification", "Aucune modification trouvée pour ce projet.");
      return;
    }
    const fileBaseName = `revues-dossier-${exportingAllProjects ? "toutes-modifications" : `projet-${fileNameToken(dossierProject)}`}`;
    const dossierRequestsWithAssets = await loadDossierAssetsForRequests(dossierRequests);
    if (format === "pdf") {
      try {
        await downloadHtmlAsPdf(
          `${fileBaseName}.pdf`,
          projectDossierReviewsExportHtml(dossierExportLabel, dossierRequestsWithAssets),
          {
            orientation: "portrait",
            width: "900px",
            backgroundColor: "#f7f9f1"
          }
        );
        successToast("Extraction revue dossier generee");
      } catch (error) {
        console.error(error);
        errorAlert("Export PDF indisponible", "Impossible de generer le PDF de revue dossier projet.");
      }
      return;
    } else if (format === "excel") {
      downloadBlobFile(
        `${fileBaseName}.xls`,
        projectDossierReviewsExportExcel(dossierExportLabel, dossierRequestsWithAssets),
        "application/vnd.ms-excel;charset=utf-8"
      );
    } else {
      downloadTextFile(
        `${fileBaseName}.txt`,
        projectDossierReviewsExportText(dossierExportLabel, dossierRequestsWithAssets)
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
      <div className="stat-grid">
        <DashboardStatCard
          label={adminView ? "Nombre de modifications" : "Dans mon perimetre"}
          value={dashboardRequests.length}
          icon={ClipboardList}
          onClick={() => openDashboardDialog("Modifications", `${dashboardRequests.length} modification${dashboardRequests.length > 1 ? "s" : ""} affichee${dashboardRequests.length > 1 ? "s" : ""}`, "requests", dashboardRequests)}
        />
        <DashboardStatCard
          label="Actives"
          value={activeRequests.length}
          icon={Gauge}
          onClick={() => openDashboardDialog("Modifications actives", `${activeRequests.length} modification${activeRequests.length > 1 ? "s" : ""} en cours`, "requests", activeRequests)}
        />
        <DashboardStatCard
          label="Actions en retard"
          value={lateActionRows.length}
          icon={CircleAlert}
          onClick={() => openDashboardDialog("Actions en retard", `${lateActionRows.length} action${lateActionRows.length > 1 ? "s" : ""} a traiter`, "actions", lateActionRows)}
        />
        <DashboardStatCard
          label="Cloturees"
          value={closedRequests.length}
          icon={CheckCircle2}
          onClick={() => openDashboardDialog("Modifications cloturees", `${closedRequests.length} modification${closedRequests.length > 1 ? "s" : ""} cloturee${closedRequests.length > 1 ? "s" : ""}`, "requests", closedRequests)}
        />
        <DashboardStatCard
          label="Modifications cancelled"
          value={cancelledRequests.length}
          icon={XCircle}
          onClick={() => openDashboardDialog("Modifications cancelled", `${cancelledRequests.length} modification${cancelledRequests.length > 1 ? "s" : ""} annulee${cancelledRequests.length > 1 ? "s" : ""}`, "requests", cancelledRequests)}
        />
      </div>
      <section className="dashboard-ops-grid">
        <DashboardActionWatchCard
          title="Actions deja en retard"
          subtitle={`${lateActionRows.length} action${lateActionRows.length > 1 ? "s" : ""} a traiter`}
          items={lateActionRows.slice(0, 8)}
          mode="late"
          onOpenRequest={onOpenRequest}
        />
        <DashboardActionWatchCard
          title="Actions qui expirent dans 3 jours"
          subtitle={`${dueSoonActionRows.length} echeance${dueSoonActionRows.length > 1 ? "s" : ""} proche${dueSoonActionRows.length > 1 ? "s" : ""}`}
          items={dueSoonActionRows.slice(0, 8)}
          mode="soon"
          onOpenRequest={onOpenRequest}
        />
        <DashboardLateOwnersCard items={lateOwners} totalLate={lateActionRows.length} />
      </section>
      <section className="dashboard-ops-grid secondary">
        <DashboardProjectLateRateCard items={projectLateRates} />
        <DashboardFinishedProductsCard title="Produits finis par projet" subtitle="Distribution depuis les modifications" items={finishedByProject} />
        <DashboardFinishedProductsCard title="Produits finis par client" subtitle="Distribution depuis les modifications" items={finishedByClient} />
      </section>
      <section className="dashboard-progress-grid">
        <DashboardProgressCard
          title="Avancement par projet"
          subtitle={`Portefeuille global ${portfolioProgress}%`}
          items={projectProgress}
        />
        <DashboardProgressCard
          title="Avancement par pilote"
          subtitle="Moyenne des modifications suivies"
          items={pilotProgress}
        />
        <DashboardProgressCard
          title="Avancement par client"
          subtitle="Progression moyenne dossier"
          items={clientProgress}
        />
      </section>
      <DashboardModificationProgressCard
        page={modificationProgressPage}
        pageCount={modificationProgressPageCount}
        rows={visibleModificationProgressRows}
        total={modificationProgressRows.length}
        onNext={() => setModificationProgressPage((page) => Math.min(page + 1, modificationProgressPageCount - 1))}
        onOpenRequest={onOpenRequest}
        onPrevious={() => setModificationProgressPage((page) => Math.max(page - 1, 0))}
      />
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
              <DashboardHealthLegend />
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
        <DashboardImpactCard title="Clients impactés" subtitle={`${clients.length} client${clients.length > 1 ? "s" : ""} référencé${clients.length > 1 ? "s" : ""}`} items={clientImpact} tone="client" />
        <DashboardImpactCard title="Produits concernés" subtitle={`${products.length} produit${products.length > 1 ? "s" : ""} référencé${products.length > 1 ? "s" : ""}`} items={productImpact} tone="product" />
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

function DashboardStatCard({ icon: Icon, label, value, onClick }) {
  const openedRef = useRef(false);

  function open(event) {
    if (openedRef.current) return;
    openedRef.current = true;
    window.setTimeout(() => {
      openedRef.current = false;
    }, 250);
    if (event) event.preventDefault();
    onClick();
  }

  return (
    <button className="stat-card clickable" type="button" onClick={open} onPointerDown={open}>
      <Icon size={20} />
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  );
}

function DashboardHealthLegend() {
  return (
    <div className="dashboard-health-legend" aria-label="Legende sante portefeuille">
      <span><i className="late" />Retard SOP</span>
      <span><i className="active" />Active sans retard</span>
      <span><i className="closed" />Cloturee</span>
      <span><i className="cancelled" />Cancelled</span>
    </div>
  );
}

function DashboardDrilldownDialog({ dialog, onClose, onOpen }) {
  const items = Array.isArray(dialog?.items) ? dialog.items : [];
  const isActions = dialog?.type === "actions";
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="dashboard-drilldown-title"
        aria-modal="true"
        className="dialog-card dashboard-drilldown-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="actions-dialog-header">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h2 id="dashboard-drilldown-title">{dialog.title}</h2>
            <span>{dialog.subtitle}</span>
          </div>
          <button className="ghost-icon" type="button" onClick={onClose} title="Fermer">
            <X size={18} />
          </button>
        </header>
        <div className="dashboard-drilldown-list">
          {items.length === 0 ? (
            <EmptyState title="Aucun element" text="Aucune donnee disponible pour ce filtre." compact />
          ) : isActions ? items.map((item) => (
            <button className="dashboard-drilldown-row action" key={`${item.request?.id}-${item.action?.id}`} type="button" onClick={() => onOpen(item)}>
              <span className={isDashboardActionLate(item.action) ? "drilldown-dot late" : "drilldown-dot"} />
              <strong>{item.action?.title || "Action sans titre"}</strong>
              <small>{requestDisplayName(item.request)} | {item.request?.modificationProject || "-"} | {stageLabel(item.action?.stage, Boolean(item.request?.newVersion))}</small>
              <em>{dashboardActionDueDate(item.action) ? formatDateOnly(dashboardActionDueDate(item.action)) : "-"}</em>
            </button>
          )) : items.map((request) => (
            <button className="dashboard-drilldown-row" key={request.id} type="button" onClick={() => onOpen(request)}>
              <span className={`drilldown-dot ${request.currentStage === "CLOSED" ? "closed" : request.currentStage === "CANCELLED" ? "cancelled" : ""}`} />
              <strong>{requestDisplayName(request)}</strong>
              <small>{request.modificationProject || "-"} | {request.client || "-"} | {request.product || "-"}</small>
              <em>{stageLabel(request.currentStage, Boolean(request.newVersion))}</em>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function dashboardActionDueDate(action) {
  return parseDateOnly(action?.endDate) || parseDateOnly(action?.deadline) || null;
}

function dashboardActionDueTime(action) {
  return dashboardActionDueDate(action)?.getTime() || Number.MAX_SAFE_INTEGER;
}

function isDashboardActionLate(action, today = startOfLocalDay(new Date())) {
  const dueDate = dashboardActionDueDate(action);
  return Boolean(action?.late) || Boolean(dueDate && dueDate < today);
}

function dashboardLateOwners(rows = [], limit = 6) {
  return Array.from(rows.reduce((map, { action }) => {
    const label = action.responsible || "Responsable non renseigne";
    const item = map.get(label) || { label, count: 0, critical: 0 };
    item.count += 1;
    if (String(action.criticality || "").startsWith("1")) item.critical += 1;
    map.set(label, item);
    return map;
  }, new Map()).values())
    .sort((first, second) => second.count - first.count || second.critical - first.critical || first.label.localeCompare(second.label, "fr", { sensitivity: "base" }))
    .slice(0, limit);
}

function dashboardProjectLateRates(rows = [], limit = 6) {
  return Array.from(rows.reduce((map, { action, request }) => {
    if (request.currentStage === "CLOSED" || request.currentStage === "CANCELLED") return map;
    const label = request.modificationProject || "Projet non renseigne";
    const item = map.get(label) || { label, total: 0, late: 0, rate: 0 };
    if (!isActionDone(action)) {
      item.total += 1;
      if (isDashboardActionLate(action)) item.late += 1;
    }
    map.set(label, item);
    return map;
  }, new Map()).values())
    .map((item) => ({ ...item, rate: item.total > 0 ? Math.round((item.late / item.total) * 100) : 0 }))
    .filter((item) => item.total > 0)
    .sort((first, second) => second.rate - first.rate || second.late - first.late || first.label.localeCompare(second.label, "fr", { sensitivity: "base" }))
    .slice(0, limit);
}

function dashboardFinishedProductGroups(requests = [], mode = "project", limit = 6) {
  return Array.from(requests.reduce((map, request) => {
    const group = mode === "client" ? request.client || "Client non renseigne" : request.modificationProject || "Projet non renseigne";
    const item = map.get(group) || { label: group, count: 0, modifications: 0, products: new Set() };
    item.modifications += 1;
    const selectedProducts = parseSelectedProducts(request.finishedProducts);
    selectedProducts.forEach((productKey) => {
      item.products.add(productKey);
    });
    item.count = item.products.size;
    map.set(group, item);
    return map;
    }, new Map()).values())
      .map((item) => ({ label: item.label, count: item.count, modifications: item.modifications }))
      .filter((item) => item.count > 0)
      .sort((first, second) => second.count - first.count || second.modifications - first.modifications || first.label.localeCompare(second.label, "fr", { sensitivity: "base" }))
      .slice(0, limit);
}

function DashboardActionWatchCard({ title, subtitle, items = [], mode = "late", onOpenRequest }) {
  return (
    <article className={`panel dashboard-action-watch ${mode}`}>
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          <span>{subtitle}</span>
        </div>
      </div>
      <div className="dashboard-action-watch-list">
        {items.length === 0 ? (
          <EmptyState title="Aucune action" text={mode === "late" ? "Aucun retard action detecte." : "Aucune action n'expire dans les 3 jours."} compact />
        ) : items.map(({ action, request }) => {
          const dueDate = dashboardActionDueDate(action);
          const dayDelta = dueDate ? daysBetween(startOfLocalDay(new Date()), dueDate) : null;
          return (
            <button className="dashboard-action-watch-row" key={`${request.id}-${action.id}`} type="button" onClick={() => onOpenRequest(request)}>
              <span className="watch-indicator" />
              <strong>{action.title || "Action sans titre"}</strong>
              <small>{requestDisplayName(request)} | {request.modificationProject || "-"} | {stageLabel(action.stage, Boolean(request.newVersion))}</small>
              <em>{dueDate ? mode === "late" ? `${Math.abs(dayDelta)} j retard` : `J-${Math.max(0, dayDelta)}` : "-"}</em>
            </button>
          );
        })}
      </div>
    </article>
  );
}

function DashboardLateOwnersCard({ items = [], totalLate = 0 }) {
  const maxCount = Math.max(1, ...items.map((item) => item.count));
  return (
    <article className="panel dashboard-late-owners">
      <div className="section-title">
        <div>
          <h2>Utilisateurs qui font le plus de retard</h2>
          <span>{totalLate} action{totalLate > 1 ? "s" : ""} en retard</span>
        </div>
      </div>
      <div className="dashboard-late-owner-list">
        {items.length === 0 ? (
          <EmptyState title="Aucun retard" text="Aucun responsable avec action en retard." compact />
        ) : items.map((item, index) => (
          <div className="dashboard-late-owner-row" key={item.label}>
            <span>{index + 1}</span>
            <strong>{item.label}</strong>
            <div className="dashboard-row-track"><i style={{ width: `${Math.max(8, (item.count / maxCount) * 100)}%` }} /></div>
            <em>{item.count}</em>
          </div>
        ))}
      </div>
    </article>
  );
}

function DashboardProjectLateRateCard({ items = [] }) {
  return (
    <article className="panel dashboard-project-rate">
      <div className="section-title">
        <div>
          <h2>Taux de retard par projet</h2>
          <span>Actions ouvertes en retard / total ouvert</span>
        </div>
      </div>
      <div className="dashboard-project-rate-list">
        {items.length === 0 ? (
          <EmptyState title="Aucun retard projet" text="Les taux apparaitront avec les actions ouvertes." compact />
        ) : items.map((item) => (
          <div className="dashboard-project-rate-row" key={item.label}>
            <strong>{item.label}</strong>
            <em>{item.rate}%</em>
            <span>{item.late}/{item.total} action{item.total > 1 ? "s" : ""}</span>
            <div className="dashboard-row-track"><i style={{ width: `${Math.max(4, item.rate)}%` }} /></div>
          </div>
        ))}
      </div>
    </article>
  );
}

function DashboardFinishedProductsCard({ title, subtitle, items = [] }) {
  const maxCount = Math.max(1, ...items.map((item) => item.count));
  return (
    <article className="panel dashboard-finished-products-card">
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          <span>{subtitle}</span>
        </div>
      </div>
      <div className="dashboard-finished-products-list">
        {items.length === 0 ? (
          <EmptyState title="Aucun produit fini" text="Les produits finis selectionnes dans les modifications apparaitront ici." compact />
        ) : items.map((item, index) => (
          <div className="dashboard-finished-product-row" key={item.label}>
            <span className={`impact-rank product-${(index % 4) + 1}`}>{item.count}</span>
            <strong>{item.label}</strong>
            <em>{item.modifications} modification{item.modifications > 1 ? "s" : ""}</em>
            <div className="dashboard-row-track"><i style={{ width: `${Math.max(8, (item.count / maxCount) * 100)}%` }} /></div>
          </div>
        ))}
      </div>
    </article>
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

function DashboardProgressCard({ title, subtitle, items = [] }) {
  return (
    <article className="panel dashboard-progress-card">
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          <span>{subtitle}</span>
        </div>
      </div>
      <div className="dashboard-progress-list">
        {items.length === 0 ? (
          <EmptyState title="Aucune donnee" text="Les taux apparaitront selon les modifications accessibles." compact />
        ) : items.map((item) => (
          <div className="dashboard-progress-row" key={item.label}>
            <div className="dashboard-progress-head">
              <strong>{item.label}</strong>
              <span>{item.progress}%</span>
            </div>
            <div className="dashboard-progress-track">
              <i style={{ width: `${Math.max(4, item.progress)}%` }} />
            </div>
            <small>
              {item.count} modification{item.count > 1 ? "s" : ""}
              {item.active > 0 ? ` | ${item.active} active${item.active > 1 ? "s" : ""}` : ""}
              {item.late > 0 ? ` | ${item.late} retard` : ""}
            </small>
          </div>
        ))}
      </div>
    </article>
  );
}

function DashboardModificationProgressCard({ page, pageCount, rows = [], total = 0, onNext, onOpenRequest, onPrevious }) {
  return (
    <article className="panel dashboard-modification-progress-panel">
      <div className="section-title">
        <div>
          <h2>Avancement par modification</h2>
          <span>{total} modification{total > 1 ? "s" : ""} | 5 par page</span>
        </div>
        <div className="dashboard-pager">
          <button className="icon-button" type="button" title="Page precedente" disabled={page <= 0} onClick={onPrevious}>
            <ChevronLeft size={17} />
          </button>
          <span>{page + 1} / {pageCount}</span>
          <button className="icon-button" type="button" title="Page suivante" disabled={page >= pageCount - 1} onClick={onNext}>
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <div className="dashboard-modification-progress-list">
        {rows.length === 0 ? (
          <EmptyState title="Aucune modification" text="Les taux apparaitront apres creation des modifications." compact />
        ) : rows.map(({ request, progress }) => (
          <button className="dashboard-modification-progress-row" key={request.id} type="button" onClick={() => onOpenRequest(request)}>
            <span>
              <strong>{requestDisplayName(request)}</strong>
              <small>{request.modificationProject || "-"} | {request.client || "-"} | {stageLabel(request.currentStage, Boolean(request.newVersion))}</small>
            </span>
            <div className="dashboard-progress-track">
              <i style={{ width: `${Math.max(4, progress)}%` }} />
            </div>
            <em>{progress}%</em>
          </button>
        ))}
      </div>
    </article>
  );
}

function DashboardImpactCard({ title, subtitle, items = [], tone = "client" }) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const maxCount = Math.max(1, ...items.map((item) => item.count));
  return (
    <article className="panel dashboard-impact-card">
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          <span>{subtitle}</span>
        </div>
      </div>
      <div className="dashboard-impact-list">
        {items.length === 0 ? (
          <EmptyState title="Aucune donnee" text="Les donnees apparaitront selon les dossiers accessibles." compact />
        ) : items.map((item, index) => {
          const share = Math.round((item.count / Math.max(1, total)) * 100);
          return (
            <div className="dashboard-impact-row" key={item.label}>
              <span className={`impact-rank ${tone}-${(index % 4) + 1}`}>{index + 1}</span>
              <span className="impact-label">
                <strong>{item.label}</strong>
                <small>{item.count} dossier{item.count > 1 ? "s" : ""} | {share}% du portefeuille visible</small>
              </span>
              <div><i className={`${tone}-${(index % 4) + 1}`} style={{ width: `${Math.max(8, (item.count / maxCount) * 100)}%` }} /></div>
            </div>
          );
        })}
      </div>
    </article>
  );
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

