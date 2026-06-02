export type AppRole = "admin" | "main_admin" | "asset_manager" | "staff" | "volunteer";
export type AccessState = "loading" | "approved" | "pending_approval" | "error" | "unconfigured";

export function getPrimaryRoleLabel(roles: AppRole[]) {
  if (roles.includes("main_admin")) return "Main Admin";
  if (roles.includes("admin")) return "Admin";
  if (roles.includes("asset_manager")) return "Asset Manager";
  if (roles.includes("staff")) return "Staff";
  if (roles.includes("volunteer")) return "Volunteer";
  return "Operator";
}

export function canAccessRoute(pathname: string, roles: AppRole[]) {
  const isAdmin = roles.includes("admin") || roles.includes("main_admin");
  const isManager = roles.includes("asset_manager");
  const isStaff = roles.includes("staff");
  const isVolunteer = roles.includes("volunteer");

  if (pathname.startsWith("/approvals")) return isAdmin || isManager;
  if (pathname.startsWith("/check-out-in")) return isAdmin || isManager;
  if (pathname.startsWith("/inventory")) return isAdmin || isManager || isStaff;
  if (pathname.startsWith("/requests")) return isAdmin || isStaff;
  if (pathname.startsWith("/settings")) return true;
  if (pathname.startsWith("/my-assets")) return true;
  if (pathname.startsWith("/dashboard")) return true;

  return isAdmin || isManager || isStaff || isVolunteer;
}
