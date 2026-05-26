const API_BASE = "http://localhost:8088/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  if (!response.ok) {
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
    body: formData
  });
  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }
  return response.json();
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

export function uploadActionEvidence(actionId, file) {
  const formData = new FormData();
  formData.append("file", file);
  return multipartRequest(`/actions/${actionId}/evidence`, formData);
}

export function actionEvidenceUrl(actionId) {
  return `${API_BASE}/actions/${actionId}/evidence`;
}
