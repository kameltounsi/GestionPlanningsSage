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
    role: user?.role || "CHEF_DE_PROJET",
    enabled: user?.enabled ?? true
  };
}
