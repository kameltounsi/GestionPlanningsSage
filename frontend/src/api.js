const API_BASE = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:3001/api`;
const SESSION_KEY = "gestionPlanningSession";

export function getStoredSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

export function planningEventsUrl(token) {
  return `${API_BASE}/events?token=${encodeURIComponent(token || "")}`;
}

export function planningWebSocketUrl(token) {
  const base = API_BASE.replace(/^http/i, "ws").replace(/\/api$/, "");
  return `${base}/ws/events?token=${encodeURIComponent(token || "")}`;
}

export function storeSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function authHeaders() {
  const session = getStoredSession();
  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
}

async function request(path, options = {}) {
  const { clearSessionOnUnauthorized = false, ...fetchOptions } = options;
  const { headers, ...requestOptions } = fetchOptions;
  const response = await fetch(`${API_BASE}${path}`, {
    ...requestOptions,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(headers || {})
    }
  });
  if (!response.ok) {
    if (response.status === 401 && (clearSessionOnUnauthorized || path !== "/auth/login")) {
      clearSession();
    }
    throw new Error(await errorMessage(response));
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

async function multipartRequest(path, formData) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      ...authHeaders()
    },
    body: formData
  });
  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
    }
    throw new Error(await errorMessage(response));
  }
  return response.json();
}

async function downloadRequest(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...authHeaders()
    }
  });
  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
    }
    throw new Error(await errorMessage(response));
  }
  const disposition = response.headers.get("Content-Disposition") || "";
  const fileNameMatch = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  return {
    blob: await response.blob(),
    fileName: fileNameMatch ? decodeURIComponent(fileNameMatch[1].replace(/"/g, "")) : "export.xlsx",
    type: response.headers.get("Content-Type") || "application/octet-stream"
  };
}

async function errorMessage(response) {
  const fallback = userMessageForStatus(response.status);
  try {
    const text = await response.text();
    return cleanErrorText(text, response.status) || fallback;
  } catch {
    return fallback;
  }
}

function userMessageForStatus(status) {
  if (status === 400) return "Les donnees saisies sont invalides.";
  if (status === 401) return "Session expirée. Connectez-vous à nouveau.";
  if (status === 403) return "Vous n'avez pas les droits pour effectuer cette action.";
  if (status === 404) return "Element introuvable.";
  if (status === 409) return "Cette référence existe déjà.";
  if (status >= 500) return "Une erreur serveur est survenue. Réessayez plus tard.";
  return "Une erreur est survenue.";
}

function cleanErrorText(text, status) {
  const value = String(text || "").trim();
  if (!value) return "";
  if (value.startsWith("{") || value.startsWith("[")) {
    try {
      const payload = JSON.parse(value);
      if (payload.message && !isTechnicalMessage(payload.message)) return payload.message;
      return userMessageForStatus(Number(payload.status) || status);
    } catch {
      return userMessageForStatus(status);
    }
  }
  if (isTechnicalMessage(value)) return userMessageForStatus(status);
  return value;
}

function isTechnicalMessage(value) {
  const text = String(value || "").toLowerCase();
  return text.includes("exception")
    || text.includes("constraint")
    || text.includes("sql")
    || text.includes("internal server error")
    || text.includes("api error")
    || text.includes("\"timestamp\"")
    || text.includes("\"path\"");
}

export function login(email, password) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export function requestPasswordReset(email) {
  return request("/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email })
  });
}

export function verifyPasswordResetCode(email, code) {
  return request("/auth/password-reset/verify", {
    method: "POST",
    body: JSON.stringify({ email, code })
  });
}

export function confirmPasswordReset(email, code, password) {
  return request("/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify({ email, code, password })
  });
}

export function logout() {
  return request("/auth/logout", {
    method: "POST"
  }).finally(clearSession);
}

export function getChatUsers() {
  return request("/chat/users");
}

export function getChatConversations() {
  return request("/chat/conversations");
}

export function getChatMessages(peerId) {
  return request(`/chat/messages/${peerId}`);
}

export function getChatGroupMessages(groupId) {
  return request(`/chat/groups/${groupId}/messages`);
}

export function sendChatMessage(recipientId, content, file) {
  const formData = new FormData();
  formData.append("recipientId", recipientId);
  if (content) formData.append("content", content);
  if (file) formData.append("file", file);
  return multipartRequest("/chat/messages", formData);
}

export function sendChatGroupMessage(groupId, content, file) {
  const formData = new FormData();
  if (content) formData.append("content", content);
  if (file) formData.append("file", file);
  return multipartRequest(`/chat/groups/${groupId}/messages`, formData);
}

export function createChatGroup(name, memberIds, projectName = "") {
  return request("/chat/groups", {
    method: "POST",
    body: JSON.stringify({ name, memberIds, projectName })
  });
}

export function addChatGroupMember(groupId, userId) {
  return request(`/chat/groups/${groupId}/members`, {
    method: "POST",
    body: JSON.stringify({ userId })
  });
}

export function chatTyping(targetType, targetId, active = true) {
  return request("/chat/typing", {
    method: "POST",
    body: JSON.stringify({ targetType, targetId, active })
  });
}

export function chatHeartbeat() {
  return request("/chat/presence/heartbeat", { method: "POST" });
}

export function chatOffline() {
  return request("/chat/presence/offline", { method: "POST" });
}

export function chatAttachmentUrl(messageId) {
  return `${API_BASE}/chat/messages/${messageId}/attachment`;
}

export function getEcrRequests(options = {}) {
  const params = new URLSearchParams();
  if (typeof options === "boolean") {
    if (options) params.set("includeArchived", "true");
  } else {
    if (options.includeArchived) params.set("includeArchived", "true");
    if (options.view) params.set("view", options.view);
    if (options.scope) params.set("scope", options.scope);
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  return request(`/ecr-requests${query}`);
}

export function createEcrRequest(payload) {
  return request("/ecr-requests", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateEcrRequest(requestId, payload) {
  return request(`/ecr-requests/${requestId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function uploadEcrRequestImage(requestId, type, file) {
  const formData = new FormData();
  formData.append("file", file);
  return multipartRequest(`/ecr-requests/${requestId}/images/${type}`, formData);
}

export function ecrRequestFileDownloadUrl(requestId, type) {
  return `${API_BASE}/ecr-requests/${requestId}/files/${type}/download`;
}

export function archiveEcrRequest(requestId, archived = true) {
  return request(`/ecr-requests/${requestId}/archive?archived=${encodeURIComponent(archived)}`, {
    method: "PATCH"
  });
}

export function updateEcrStage(requestId, stage) {
  return request(`/ecr-requests/${requestId}/stage?stage=${encodeURIComponent(stage)}`, {
    method: "PATCH"
  });
}

export function cancelEcrRequest(requestId) {
  return request(`/ecr-requests/${requestId}/cancel`, {
    method: "PATCH"
  });
}

export function requestEcrClosure(requestId) {
  return request(`/ecr-requests/${requestId}/request-closure`, {
    method: "PATCH"
  });
}

export function closeEcrRequest(requestId) {
  return request(`/ecr-requests/${requestId}/close`, {
    method: "PATCH"
  });
}

export function getPhaseValidations(requestId) {
  return request(`/ecr-requests/${requestId}/phase-validations`);
}

export function requestPhaseValidation(requestId, stage) {
  return request(`/ecr-requests/${requestId}/phase-validations`, {
    method: "POST",
    body: JSON.stringify({ stage })
  });
}

export function approvePhaseValidation(requestId, validationId) {
  return request(`/ecr-requests/${requestId}/phase-validations/${validationId}/approve`, {
    method: "POST"
  });
}

export function rejectPhaseValidation(requestId, validationId, payload) {
  return request(`/ecr-requests/${requestId}/phase-validations/${validationId}/reject`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function approveActionValidation(requestId, validationId, actionId) {
  return request(`/ecr-requests/${requestId}/phase-validations/${validationId}/actions/${actionId}/approve`, {
    method: "POST"
  });
}

export function rejectActionValidation(requestId, validationId, actionId, payload) {
  return request(`/ecr-requests/${requestId}/phase-validations/${validationId}/actions/${actionId}/reject`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function requestActionValidation(requestId, validationId, actionId) {
  return request(`/ecr-requests/${requestId}/phase-validations/${validationId}/actions/${actionId}/request`, {
    method: "POST"
  });
}

export function getChecklist(requestId, stage) {
  const query = stage ? `?stage=${stage}` : "";
  return request(`/ecr-requests/${requestId}/checklist${query}`);
}

export function getPilots() {
  return request("/pilots");
}

export function getProjects() {
  return request("/projects");
}

export function createProject(payload) {
  return request("/projects", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateProject(name, payload) {
  return request(`/projects/${encodeURIComponent(name)}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteProject(name) {
  return request(`/projects/${encodeURIComponent(name)}`, {
    method: "DELETE"
  });
}

export function getClientReferences() {
  return request("/preferentials/clients");
}

export function createClientReference(payload) {
  return request("/preferentials/clients", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateClientReference(id, payload) {
  return request(`/preferentials/clients/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteClientReference(id) {
  return request(`/preferentials/clients/${id}`, {
    method: "DELETE"
  });
}

export function getProductReferences() {
  return request("/preferentials/products");
}

export function createProductReference(payload) {
  return request("/preferentials/products", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateProductReference(id, payload) {
  return request(`/preferentials/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteProductReference(id) {
  return request(`/preferentials/products/${id}`, {
    method: "DELETE"
  });
}

export function getFinishedProductReferences() {
  return request("/preferentials/finished-products");
}

export function importFinishedProductReferences(file) {
  const formData = new FormData();
  formData.append("file", file);
  return multipartRequest("/preferentials/finished-products/import", formData);
}

export function exportFinishedProductReferences(projects = []) {
  const params = new URLSearchParams();
  projects.filter(Boolean).forEach((project) => params.append("projects", project));
  const query = params.toString() ? `?${params.toString()}` : "";
  return downloadRequest(`/preferentials/finished-products/export${query}`);
}

export function exportFinishedProductReferencesWithModifications(projects = []) {
  const params = new URLSearchParams();
  projects.filter(Boolean).forEach((project) => params.append("projects", project));
  const query = params.toString() ? `?${params.toString()}` : "";
  return downloadRequest(`/preferentials/finished-products/export-with-modifications${query}`);
}

export function createFinishedProductReference(payload) {
  return request("/preferentials/finished-products", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateFinishedProductReference(id, payload) {
  return request(`/preferentials/finished-products/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteFinishedProductReference(id) {
  return request(`/preferentials/finished-products/${id}`, {
    method: "DELETE"
  });
}

export function getRoleReferences() {
  return request("/preferentials/roles");
}

export function createRoleReference(payload) {
  return request("/preferentials/roles", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateRoleReference(id, payload) {
  return request(`/preferentials/roles/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteRoleReference(id) {
  return request(`/preferentials/roles/${id}`, {
    method: "DELETE"
  });
}

export function getActionPlanningRules() {
  return request("/action-planning-rules");
}

export function createActionPlanningRule(payload) {
  return request("/action-planning-rules", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateActionPlanningRule(id, payload) {
  return request(`/action-planning-rules/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteActionPlanningRule(id) {
  return request(`/action-planning-rules/${id}`, {
    method: "DELETE"
  });
}

export function getActions(requestId, stage) {
  const query = stage ? `?stage=${stage}` : "";
  return request(`/ecr-requests/${requestId}/actions${query}`);
}

export function getEcrRequestProgress(requestId) {
  return request(`/ecr-requests/${requestId}/progress`);
}

export function createAction(requestId, payload) {
  return request(`/ecr-requests/${requestId}/actions`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateAction(actionId, payload) {
  return request(`/actions/${actionId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteAction(actionId) {
  return request(`/actions/${actionId}`, {
    method: "DELETE"
  });
}

export function deleteActionAsset(assetId) {
  return request(`/action-assets/${assetId}`, {
    method: "DELETE"
  });
}

export function deleteActionProofDocument(actionId) {
  return request(`/actions/${actionId}/proof-document`, {
    method: "DELETE"
  });
}

export function deleteActionProofDocumentItem(proofDocumentId) {
  return request(`/action-proof-documents/${proofDocumentId}`, {
    method: "DELETE"
  });
}

export function uploadActionEvidence(actionId, file) {
  const formData = new FormData();
  formData.append("file", file);
  return multipartRequest(`/actions/${actionId}/evidence`, formData);
}

export function addActionEvidenceLink(actionId, payload) {
  return request(`/actions/${actionId}/evidence-link`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function actionEvidenceUrl(actionId) {
  return `${API_BASE}/actions/${actionId}/evidence`;
}

export function uploadActionProofDocument(actionId, file) {
  const formData = new FormData();
  formData.append("file", file);
  return multipartRequest(`/actions/${actionId}/proof-document`, formData);
}

export function addActionProofDocumentLink(actionId, payload) {
  return request(`/actions/${actionId}/proof-document-link`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function actionProofDocumentUrl(actionId) {
  return `${API_BASE}/actions/${actionId}/proof-document`;
}

export function actionProofDocumentDownloadUrl(proofDocumentId) {
  return `${API_BASE}/action-proof-documents/${proofDocumentId}/download`;
}

export function uploadActionPlanningRuleProofDocument(ruleId, file) {
  const formData = new FormData();
  formData.append("file", file);
  return multipartRequest(`/action-planning-rules/${ruleId}/proof-document`, formData);
}

export function addActionPlanningRuleProofDocumentLink(ruleId, payload) {
  return request(`/action-planning-rules/${ruleId}/proof-document-link`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function deleteActionPlanningRuleProofDocument(ruleId) {
  return request(`/action-planning-rules/${ruleId}/proof-document`, {
    method: "DELETE"
  });
}

export function deleteActionPlanningRuleProofDocumentItem(proofDocumentId) {
  return request(`/action-planning-rules/proof-documents/${proofDocumentId}`, {
    method: "DELETE"
  });
}

export function actionPlanningRuleProofDocumentUrl(ruleId) {
  return `${API_BASE}/action-planning-rules/${ruleId}/proof-document`;
}

export function actionPlanningRuleProofDocumentDownloadUrl(proofDocumentId) {
  return `${API_BASE}/action-planning-rules/proof-documents/${proofDocumentId}/download`;
}

export function getActionStandardSuggestions() {
  return request("/action-standard-suggestions");
}

export function addActionSuggestionToDefaults(id) {
  return request(`/action-standard-suggestions/${id}/add-to-defaults`, {
    method: "POST"
  });
}

export function ignoreActionSuggestion(id) {
  return request(`/action-standard-suggestions/${id}/ignore`, {
    method: "POST"
  });
}

export function getPendingActionDeadlineAlerts() {
  return request("/action-deadline-alerts/pending-sound");
}

export function acknowledgeActionDeadlineAlerts(ids) {
  return request("/action-deadline-alerts/ack-sound", {
    method: "POST",
    body: JSON.stringify(ids)
  });
}

export function getPendingPhaseSoundAlerts() {
  return request("/phase-sound-alerts/pending-sound");
}

export function acknowledgePhaseSoundAlerts(ids) {
  return request("/phase-sound-alerts/ack-sound", {
    method: "POST",
    body: JSON.stringify(ids)
  });
}

export function actionAssetDownloadUrl(assetId) {
  return `${API_BASE}/action-assets/${assetId}/download`;
}

export function getEcrDocuments(requestId) {
  return request(`/ecr-requests/${requestId}/documents`);
}

export function uploadEcrDocument(requestId, file, uploadedBy = "") {
  const formData = new FormData();
  formData.append("file", file);
  if (uploadedBy) {
    formData.append("uploadedBy", uploadedBy);
  }
  return multipartRequest(`/ecr-requests/${requestId}/documents/upload`, formData);
}

export function deleteEcrDocument(documentId) {
  return request(`/documents/${documentId}`, {
    method: "DELETE"
  });
}

export function ecrDocumentDownloadUrl(documentId) {
  return `${API_BASE}/documents/${documentId}/download`;
}

export function getUsers() {
  return request("/users");
}

export function getCurrentUser() {
  return request("/auth/me", { clearSessionOnUnauthorized: true });
}

export function createUser(payload) {
  return request("/users", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateUser(userId, payload) {
  return request(`/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteUser(userId) {
  return request(`/users/${userId}`, {
    method: "DELETE"
  });
}

export function updateUserProfile(userId, payload) {
  return request(`/users/${userId}/profile`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function changeUserPassword(userId, password) {
  return request(`/users/${userId}/password`, {
    method: "PUT",
    body: JSON.stringify({ password })
  });
}

export function uploadUserPhoto(userId, file) {
  const formData = new FormData();
  formData.append("file", file);
  return multipartRequest(`/users/${userId}/photo`, formData);
}

export function getAuditLogs() {
  return request("/audit");
}

export function getDashboardActions() {
  return request("/dashboard/actions");
}
