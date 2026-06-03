export function comparePlanningRules(a, b) {
  const stageCompare = String(a.stage).localeCompare(String(b.stage));
  if (stageCompare !== 0) return stageCompare;
  return String(a.actionTitle || "").localeCompare(String(b.actionTitle || ""));
}
