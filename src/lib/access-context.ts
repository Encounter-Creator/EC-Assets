import type { SupabaseClient } from "@supabase/supabase-js";

import type { AccessState, AppRole } from "@/lib/auth";
import { loadActiveDamageLockCase, type DamageLockCase } from "@/lib/damage-lock";

export type AccessContextRow = {
  approved: boolean;
  roles: AppRole[] | null;
  asset_manager_location_id: string | null;
  assigned_location_id: string | null;
  profile_exists: boolean;
  display_name?: string | null;
  surname?: string | null;
};

type ResolveAccessContextOptions = {
  userId: string;
  allowApprovalFallback?: boolean;
};

export type ResolvedAccessContext = {
  accessContext: AccessContextRow;
  accessState: Exclude<AccessState, "loading" | "error" | "unconfigured">;
  damageLockCase: DamageLockCase | null;
  warning: string | null;
};

export function isMissingSchemaError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("does not exist") ||
    normalized.includes("could not find the function") ||
    normalized.includes("schema cache") ||
    normalized.includes("relation") ||
    normalized.includes("column")
  );
}

async function loadLegacyAccessContext(
  supabase: SupabaseClient,
  { userId, allowApprovalFallback = false }: ResolveAccessContextOptions,
) {
  const [
    { data: rolesData, error: rolesError },
    { data: profileData, error: profileError },
    { data: approvedData, error: approvedError },
  ] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase
      .from("profiles")
      .select("asset_manager_location_id, assigned_location_id, display_name, surname")
      .eq("id", userId)
      .maybeSingle(),
    supabase.rpc("is_approved", { _user_id: userId }),
  ]);

  if (rolesError) throw rolesError;
  if (profileError) throw profileError;

  const approvalRpcMissing = approvedError ? isMissingSchemaError(approvedError.message ?? "") : false;
  if (approvedError && !approvalRpcMissing) throw approvedError;

  const nextRoles = ((rolesData ?? []) as Array<{ role: AppRole }>).map((row) => row.role);
  const legacyFallbackApproved = Boolean(profileData) && nextRoles.length > 0;

  const accessContext: AccessContextRow = {
    approved: approvalRpcMissing ? (allowApprovalFallback ? legacyFallbackApproved : false) : Boolean(approvedData),
    roles: nextRoles,
    asset_manager_location_id: profileData?.asset_manager_location_id ?? null,
    assigned_location_id: profileData?.assigned_location_id ?? profileData?.asset_manager_location_id ?? null,
    profile_exists: Boolean(profileData),
    display_name: profileData?.display_name ?? null,
    surname: profileData?.surname ?? null,
  };

  return {
    accessContext,
    warning: approvalRpcMissing
      ? allowApprovalFallback
        ? "Approval-state RPC is unavailable, so access is using profile-and-role fallback."
        : "Approval-state RPC is unavailable, so access remains blocked until the backend approval surface is restored."
      : null,
  };
}

export async function resolveAccessContext(
  supabase: SupabaseClient,
  options: ResolveAccessContextOptions,
): Promise<ResolvedAccessContext> {
  let accessContext: AccessContextRow;
  let warning: string | null = null;

  const { data, error } = await supabase.rpc("get_my_access_context").single();
  if (!error && data) {
    accessContext = data as AccessContextRow;
  } else {
    const message = error?.message ?? "";
    if (!isMissingSchemaError(message)) {
      throw error;
    }

    const legacy = await loadLegacyAccessContext(supabase, options);
    accessContext = legacy.accessContext;
    warning = legacy.warning;
  }

  const damageLockCase = await loadActiveDamageLockCase(supabase, options.userId);
  const accessState = !accessContext.approved ? "pending_approval" : damageLockCase ? "damage_locked" : "approved";

  return {
    accessContext,
    accessState,
    damageLockCase,
    warning,
  };
}
