export const stageDefinitions = [
  { key: "FEASIBILITY_VALIDATION", modificationLabel: "Feasability Validation", newProjectLabel: "Projet Time line", modification: true, newProject: true },
  { key: "PROJECT_MANAGEMENT", modificationLabel: "Validation interne status", newProjectLabel: "Project Management", modification: true, newProject: true },
  { key: "PRODUCT_DEVELOPMENT", modificationLabel: "VP interne valid", newProjectLabel: "Product Development", modification: true, newProject: true },
  { key: "PROCESS_DEVELOPMENT", modificationLabel: "Process Development", newProjectLabel: "Process Development", modification: false, newProject: true },
  { key: "CUSTOMER_VALIDATION", modificationLabel: "Customer validation", newProjectLabel: "Customer validation", modification: true, newProject: false },
  { key: "PPAP_SOP_PREPARATION", modificationLabel: "PPAP validation Preparation SOP", newProjectLabel: "Production Set-up & Pre-Series", modification: true, newProject: true },
  { key: "LAUNCH", modificationLabel: "Launch", newProjectLabel: "Launch", modification: false, newProject: true },
  { key: "CLOSED", modificationLabel: "Clôture Status", newProjectLabel: "Clôture Status", modification: true, newProject: true },
  { key: "CANCELLED", modificationLabel: "Cancelled", newProjectLabel: "Project Cancelled", modification: true, newProject: true }
];

export const stageColors = [
  "teal",
  "blue",
  "indigo",
  "violet",
  "amber",
  "orange",
  "green",
  "slate",
  "red"
];

export const stageColorByKey = {
  FEASIBILITY_VALIDATION: "teal",
  PROJECT_MANAGEMENT: "blue",
  PRODUCT_DEVELOPMENT: "indigo",
  PROCESS_DEVELOPMENT: "violet",
  CUSTOMER_VALIDATION: "violet",
  PPAP_SOP_PREPARATION: "amber",
  LAUNCH: "green",
  CLOSED: "green",
  CANCELLED: "red"
};

export const newProjectStageColorByKey = {
  ...stageColorByKey
};
