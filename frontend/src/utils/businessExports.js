import { userRoleLabel, parseUserRoles } from "./users";
import { readableStatus } from "./status";

const text = (label, key, width = 28) => ({ label, width, value: typeof key === "function" ? key : (row) => row[key] });
function stageLabel(stage, newProject) {
  const common = { PROCESS_DEVELOPMENT: "Développement du processus", CUSTOMER_VALIDATION: "Validation du client", LAUNCH: "Lancement", CLOSURE_STATUS: "Préparation de la clôture", CLOSED: "Clôturée", CANCELLED: "Annulée" };
  const specific = newProject
    ? { FEASIBILITY_VALIDATION: "Calendrier du projet", PROJECT_MANAGEMENT: "Gestion du projet", PRODUCT_DEVELOPMENT: "Développement du produit", PPAP_SOP_PREPARATION: "Mise en place de la production et préséries" }
    : { FEASIBILITY_VALIDATION: "Validation de la faisabilité", PROJECT_MANAGEMENT: "Validation interne", PRODUCT_DEVELOPMENT: "Validation interne du produit", PPAP_SOP_PREPARATION: "Validation des pièces de production et préparation du démarrage" };
  return specific[stage] || common[stage] || "Phase non renseignée";
}
export function excelDate(value) {
  if (!value) return null;
  const date = new Date(String(value).slice(0, 10) + "T00:00:00Z");
  return Number.isNaN(date.getTime()) ? null : date;
}
const date = (label, key) => text(label, (row) => excelDate(row[key]), 19);
export function excelDateTime(value) {
  if (!value) return null;
  // Preserve local server date-times; convert explicit offsets to Tunis wall time.
  const source = String(value);
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(source)) {
    const date = new Date(source + "Z");
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const instant = new Date(source);
  if (Number.isNaN(instant.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Tunis", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(instant).map(({ type, value }) => [type, value]));
  return new Date(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
}
export function messagesSheet(rows, conversation, currentUser) {
  return { name: "Conversation", rows, columns: [text("Conversation", () => conversation, 30), { ...text("Date et heure", (m) => excelDateTime(m.createdAt), 23), format: "dd/mm/yyyy hh:mm" }, text("Auteur", (m) => m.senderName || (m.senderId === currentUser?.id ? currentUser.fullName : "Personne non renseignée"), 30), text("Message", "content", 80), text("Nom de la pièce jointe", "attachmentFileName", 42)] };
}
export function dossierSheet(rows, users = []) {
  const sheet = requestsSheet(rows, users);
  return { ...sheet, name: "Revues de dossier", columns: [...sheet.columns, text("Documents joints (noms des fichiers)", (r) => (r.dossierReviewAssets || []).map((d) => d.fileName || d.name).filter(Boolean).join("\n"), 55)] };
}
export function personName(value, users = []) {
  if (!value) return "";
  const key = String(value).trim().toLowerCase();
  const person = users.find((user) => [user.id, user.username, user.email, user.fullName].some((item) => item != null && String(item).trim().toLowerCase() === key));
  return person?.fullName || (/^\d+$/.test(key) ? "Personne non renseignée" : userRoleLabel(value).replaceAll("_", " "));
}
export function usersSheet(rows, users = rows) {
  return { name: "Utilisateurs", rows, columns: [text("Nom complet", "fullName"), text("Nom de connexion", "username"), text("Adresse e-mail", "email", 36), text("Poste", "jobTitle"), text("Matricule", "matricule"), text("Téléphone", "phone"), text("Rôles", (u) => parseUserRoles(u.role).map(userRoleLabel).join("\n"), 38), text("Responsable hiérarchique 1", (u) => personName(u.chef1, users)), text("Responsable hiérarchique 2", (u) => personName(u.chef2, users)), text("Compte actif", "enabled", 18)] };
}
export function referenceSheet(name, rows) {
  return { name, rows, columns: [text(name === "Clients" ? "Nom du client" : name === "Produits" ? "Nom du produit" : "Nom du rôle", "name", 48)] };
}
export function projectsSheet(rows, users = []) {
  return { name: "Projets", rows, columns: [text("Nom du projet", "name", 32), text("Équipe du projet (personne et rôles)", (p) => String(p.projectTeam || "").split(/[;\n]+/).flatMap((entry) => entry.includes("::") ? [entry] : entry.split(",")).filter(Boolean).map((entry) => { const [name, roles] = entry.split("::"); return `${personName(name.trim(), users)}${roles ? ` — ${roles.split(/[|,]+/).map(userRoleLabel).join(", ")}` : ""}`; }).join("\n"), 64)] };
}
export function finishedProductsSheet(rows) {
  return { name: "Produits finis", rows, columns: [text("Client", "client"), text("Projet", "project"), text("Référence du produit fini", "partNumber"), text("Désignation", "designation", 42), text("Référence chez le client", "customerPn"), text("Famille de produit", "product"), text("Indice de coiffe", "coiffeIndex"), text("Indice du plan", "drawingIndex"), text("Code réduit", "reducedCode"), { ...text("Prix de vente (devise non précisée)", "salePrice"), format: "#,##0.00" }, date("Intégration en production", "productionIntegrationDate"), text("Commentaires", "comments", 55)] };
}
export function requestsSheet(rows, users = []) {
  return { name: "Modifications", rows, columns: [text("Référence de la modification", "modificationNumber"), text("Projet", "modificationProject"), text("Client", "client"), text("Produit", "product"), text("Produits finis concernés", "finishedProducts", 38), text("Pilote", (r) => personName(r.pilot, users)), text("Type de demande", (r) => r.newVersion ? "Nouveau projet" : "Modification"), text("Phase actuelle", (r) => stageLabel(r.currentStage, Boolean(r.newVersion))), date("Date de réception", "receptionDate"), date("Début de production prévu", "sopDate"), text("Motif", "modificationReason", 45), text("Description de la modification", "modificationDetail", 60), text("Archivée", "archived", 15), text("Clôturée", "closureStatus", 15), date("Date de clôture", "closureDate"), text("Annulée", "cancelledStatus", 15), date("Date d’annulation", "cancelledDate"), text("Revue du dossier", "dossierReview", 65)] };
}
export function actionsSheet(rows, request, users = [], allActions = rows) {
  return { name: "Actions", rows, note: "Durée en jours calendaires. La date de fin correspond à la date de début + la durée. Une dépendance désigne l’action à terminer avant celle-ci.", columns: [text("Modification", () => request?.modificationNumber || "Non renseignée"), text("Projet", () => request?.modificationProject), text("Client", () => request?.client), text("Phase", (a) => stageLabel(a.stage, Boolean(request?.newVersion))), text("Action", "title", 50), text("Description", "description", 55), text("Nature de l’action", (a) => a.routineAction ? "Action de routine" : "Action normale"), text("Pilote de l’action", (a) => personName(a.responsible, users)), text("Validateur", (a) => personName(a.validator, users)), text("État", (a) => readableStatus(a.status)), date("Date de début", "startDate"), date("Date de fin", "endDate"), text("Durée (jours)", "workDurationDays", 18), date("Date de finalisation", "finalizationDate"), text("Action préalable", (a) => a.dependsOnActionId ? allActions.find((other) => other.id === a.dependsOnActionId)?.title || "Action préalable non disponible dans ce périmètre" : "Aucune", 45), text("Criticité", "criticality"), text("Risque / sujet", "topicRisk", 40), text("Preuve attendue", "expectedEvidence", 50), text("Preuve obligatoire", "evidenceRequired"), text("Validation", (a) => ({ APPROVED: "Approuvée", REJECTED: "Refusée", PENDING: "En attente", NOT_REQUESTED: "Non demandée" }[a.validationStatus] || "Non demandée")), text("Commentaire", "comment", 55)] };
}
export function rulesSheet(rows) {
  return { name: "Actions standard", rows, columns: [text("Action standard", "actionTitle", 50), text("Phase", (r) => stageLabel(r.stage, r.appliesToNewProject && !r.appliesToModification)), text("Applicable aux modifications", "appliesToModification"), text("Applicable aux nouveaux projets", "appliesToNewProject"), text("Rôle du pilote", (r) => personName(r.responsible)), text("Rôle du validateur", (r) => personName(r.validator)), text("Durée (jours)", "durationDays", 18), text("Action de routine", "routineAction"), text("Intervalle de répétition (jours)", "recurrenceIntervalDays"), text("Action préalable", "dependencyActionTitle", 45), text("Criticité", "criticality"), text("Risque / sujet", "topicRisk", 40), text("Preuve attendue", "expectedEvidence", 50), text("Preuve obligatoire", "evidenceRequired")] };
}

export function actionRowsSheet(rows, users = []) {
  const byRequest = new Map();
  for (const row of rows) {
    if (!byRequest.has(row.request)) byRequest.set(row.request, []);
    byRequest.get(row.request).push(row.action);
  }
  const templates = new Map([...byRequest].map(([request, actions]) => [request, actionsSheet(actions, request, users)]));
  const base = actionsSheet([], null, users);
  return { ...base, rows, columns: base.columns.map((column, index) => ({ ...column, value: (row) => templates.get(row.request).columns[index].value(row.action) })) };
}
