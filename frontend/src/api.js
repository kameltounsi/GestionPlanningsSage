const API_BASE = "http://localhost:8088/api";
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
    throw new Error(`API error ${response.status}`);
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
    throw new Error(`API error ${response.status}`);
  }
  return response.json();
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

export function uploadActionEvidence(actionId, file) {
  const formData = new FormData();
  formData.append("file", file);
  return multipartRequest(`/actions/${actionId}/evidence`, formData);
}

export function actionEvidenceUrl(actionId) {
  return `${API_BASE}/actions/${actionId}/evidence`;
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
