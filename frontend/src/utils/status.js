import { statusLabels } from "../constants/status";

export function readableStatus(status) {
  return statusLabels[status] || status || "-";
}

export function statusClass(status) {
  return String(status || "").toLowerCase();
}

export function criticalityClass(value) {
  if (String(value).startsWith("1")) return "critical";
  if (String(value).startsWith("2")) return "medium";
  return "low";
}
