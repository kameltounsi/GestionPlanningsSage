import { modificationTimelines } from "./timelines.js";

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

export function timelineGanttHeader(request) {
  const items = modificationTimelines(request);
  if (!items.length) return "";
  return `<div class="gantt-header-timelines"><strong class="gantt-timelines-label">Timelines</strong><div class="gantt-timelines-grid">${items.map((item) => `<div class="gantt-timeline-item"><strong>${escape(item.name)}</strong><span>${escape(item.comment || "Aucun commentaire associé.")}</span></div>`).join("")}</div></div>`;
}

export function timelineExcelRows(request) {
  const items = modificationTimelines(request);
  if (!items.length) return "";
  return `<tr><td colspan="12" class="footer-title">Timelines de la modification</td></tr>`
    + items.map((item) => `<tr><td colspan="3" style="vertical-align:top;white-space:pre-wrap">${escape(item.name)}</td><td colspan="9" style="vertical-align:top;white-space:pre-wrap;mso-number-format:'\\@'">${escape(item.comment || "Aucun commentaire associé.").replace(/\r?\n/g, "<br>")}</td></tr>`).join("");
}
