export const emptyEcrForm = {
  accessInternalNumber: "",
  modificationNumber: "",
  client: "",
  product: "",
  modificationProject: "",
  modificationReason: "",
  modificationDetail: "",
  beforePhotoFile: null,
  afterPhotoFile: null,
  mixability: "",
  dossierReview: "",
  receptionDate: "",
  sopDate: "",
  pilot: "",
  digitChange: false,
  componentChange: false,
  processChange: false,
  supplierChange: false,
  newVersion: false,
  currentStage: "FEASIBILITY_VALIDATION",
  initialActions: []
};

export const emptyActionForm = {
  topicRisk: "",
  title: "",
  responsible: "",
  criticality: "3-faible",
  expectedEvidence: "",
  evidence: "",
  evidenceFile: null,
  deadline: "",
  date1: "",
  date2: "",
  date3: "",
  startDate: "",
  endDate: "",
  workDurationDays: 1,
  status: "TODO",
  evidenceRequired: false,
  comment: "",
  dossierReview: ""
};

export const emptyPlanningRuleForm = {
  stage: "FEASIBILITY_VALIDATION",
  appliesToModification: true,
  appliesToNewProject: true,
  actionTitle: "",
  topicRisk: "",
  responsible: "",
  criticality: "3-faible",
  expectedEvidence: "",
  evidenceRequired: false,
  dependencyActionTitle: "",
  dependencyAnchor: "OUTPUT",
  durationDays: 1
};

export const emptyUserForm = {
  fullName: "",
  username: "",
  jobTitle: "",
  email: "",
  password: "",
  phone: "",
  role: "CHEF_DE_PROJET",
  profilePhotoUrl: "",
  profilePhotoFile: null,
  enabled: true
};
