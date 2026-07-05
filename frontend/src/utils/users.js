import { userRoleOptions } from "../constants/roles";

export function userRoleLabel(role) {
  const roles = parseUserRoles(role);
  if (roles.length === 0) return "-";
  return roles.map((item) => userRoleOptions.find(([value]) => value === item)?.[1] || item).join(", ");
}

export function parseUserRoles(role) {
  return String(role || "")
    .split(/[;,|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function userToForm(user) {
  return {
    fullName: user?.fullName || "",
    username: user?.username || "",
    jobTitle: user?.jobTitle || "",
    matricule: user?.matricule || "",
    email: user?.email || "",
    password: "",
    phone: user?.phone || "",
    chef1: user?.chef1 || "",
    chef2: user?.chef2 || "",
    role: user?.role || "CHEF_DE_PROJET",
    profilePhotoUrl: user?.profilePhotoUrl || "",
    profilePhotoFile: null,
    enabled: user?.enabled ?? true
  };
}
