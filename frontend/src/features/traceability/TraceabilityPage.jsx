import React, { useEffect, useState } from "react";
import { ClipboardList, Search } from "lucide-react";
import { EmptyState } from "../../components/common/EmptyState";
import { PageHeader } from "../../components/common/PageHeader";
import { userRoleLabel } from "../../utils/users";

const TRACEABILITY_PAGE_SIZE = 30;

function formattedDateTime(value) {
  if (!value) return "-";
  return String(value).replace("T", " ").slice(0, 16);
}

function usePaginatedItems(items, pageSize) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(currentPage, pageCount);
  const start = (safePage - 1) * pageSize;
  return {
    currentPage: safePage,
    pageCount,
    pagedItems: items.slice(start, start + pageSize),
    setCurrentPage
  };
}

function PaginationControls({ currentPage, pageCount, totalCount, onPageChange }) {
  if (pageCount <= 1) {
    return null;
  }
  return (
    <div className="pagination-actions">
      <button className="secondary-action compact-action" type="button" onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}>
        Precedent
      </button>
      <span>Page {currentPage} / {pageCount} - {totalCount} element{totalCount > 1 ? "s" : ""}</span>
      <button className="secondary-action compact-action" type="button" onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))} disabled={currentPage >= pageCount}>
        Suivant
      </button>
    </div>
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

function auditSucceeded(log) {
  return Number(log.responseStatus) < 400;
}

function auditResultLabel(log) {
  return auditSucceeded(log) ? "Effectue" : "Non effectue";
}

function auditFriendlyDetail(log) {
  if (!auditSucceeded(log)) return "Le changement n'a pas ete autorise.";
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
    AJOUT_CLIENT: "Nouveau client ajoute au référentiel.",
    AJOUT_PRODUIT: "Nouveau produit ajouté au référentiel.",
    AJOUT_PROJET: "Nouveau projet ajouté.",
    MODIFICATION_PROJET_EQUIPE: `Projet ou équipe mis à jour${target ? `: ${target}` : ""}.`
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

export function TraceabilityPage({ actionFilter, actionOptions, logs, query, onRefresh, setActionFilter, setQuery }) {
  const { currentPage, pageCount, pagedItems: pagedLogs, setCurrentPage } = usePaginatedItems(logs, TRACEABILITY_PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [actionFilter, query, setCurrentPage]);

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
            {pagedLogs.map((log) => (
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
      <PaginationControls
        currentPage={currentPage}
        pageCount={pageCount}
        totalCount={logs.length}
        onPageChange={setCurrentPage}
      />
    </section>
  );
}
