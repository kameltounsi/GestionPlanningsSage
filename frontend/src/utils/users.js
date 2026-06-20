import { userRoleOptions } from "../constants/roles";

export function userRoleLabel(role) {
  return userRoleOptions.find(([value]) => value === role)?.[1] || role || "-";
}

export function userToForm(user) {
  return {
    fullName: user?.fullName || "",
    username: user?.username || "",
    jobTitle: user?.jobTitle || "",
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
