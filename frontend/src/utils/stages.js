import { newProjectStageColorByKey, stageColorByKey, stageDefinitions } from "../constants/stages";

export function getStages(newProject) {
  return stageDefinitions
    .filter((stage) => (newProject ? stage.newProject : stage.modification))
    .map((stage) => [stage.key, newProject ? stage.newProjectLabel : stage.modificationLabel]);
}

export function firstStage(newProject) {
  return getStages(newProject)[0][0];
}

export function isStageAllowed(stage, newProject) {
  return getStages(newProject).some(([key]) => key === stage);
}

export function safeStage(stage, newProject) {
  return isStageAllowed(stage, newProject) ? stage : firstStage(newProject);
}

export function stageLabel(stage, newProject = false) {
  const definition = stageDefinitions.find(({ key }) => key === stage);
  if (!definition) return stage;
  return newProject ? definition.newProjectLabel : definition.modificationLabel;
}

export function stageColorClass(stage, newProject = false) {
  const colors = newProject ? newProjectStageColorByKey : stageColorByKey;
  return colors[stage] || "teal";
}
