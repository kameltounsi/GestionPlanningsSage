const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";
const SESSION_KEY = "gestionPlanningSession";

export function getStoredSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
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
  const { headers, ...requestOptions } = options;
  const response = await fetch(`${API_BASE}${path}`, {
    ...requestOptions,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(headers || {})
    }
  });
  if (!response.ok) {
    if (response.status === 401) {
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

async function errorMessage(response) {
  const fallback = `API error ${response.status}`;
  try {
    const text = await response.text();
    return text || fallback;
  } catch {
    return fallback;
  }
}

export function login(email, password) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export function logout() {
  return request("/auth/logout", {
    method: "POST"
  }).finally(clearSession);
}

export function getEcrRequests() {
  return request("/ecr-requests");
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

export function deleteEcrRequest(requestId) {
  return request(`/ecr-requests/${requestId}`, {
    method: "DELETE"
  });
}

export function updateEcrStage(requestId, stage) {
  return request(`/ecr-requests/${requestId}/stage?stage=${encodeURIComponent(stage)}`, {
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

export function uploadActionEvidence(actionId, file) {
  const formData = new FormData();
  formData.append("file", file);
  return multipartRequest(`/actions/${actionId}/evidence`, formData);
}

export function actionEvidenceUrl(actionId) {
  return `${API_BASE}/actions/${actionId}/evidence`;
}

export function uploadActionProofDocument(actionId, file) {
  const formData = new FormData();
  formData.append("file", file);
  return multipartRequest(`/actions/${actionId}/proof-document`, formData);
}

export function actionProofDocumentUrl(actionId) {
  return `${API_BASE}/actions/${actionId}/proof-document`;
}

export function uploadActionPlanningRuleProofDocument(ruleId, file) {
  const formData = new FormData();
  formData.append("file", file);
  return multipartRequest(`/action-planning-rules/${ruleId}/proof-document`, formData);
}

export function deleteActionPlanningRuleProofDocument(ruleId) {
  return request(`/action-planning-rules/${ruleId}/proof-document`, {
    method: "DELETE"
  });
}

export function actionPlanningRuleProofDocumentUrl(ruleId) {
  return `${API_BASE}/action-planning-rules/${ruleId}/proof-document`;
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
  return request("/auth/me");
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
