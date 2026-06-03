import type { AppRole } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminEnv } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const adminRoles: AppRole[] = ["admin", "main_admin"];

export function isAppRole(value: string): value is AppRole {
  return ["admin", "main_admin", "asset_manager", "staff", "volunteer"].includes(value);
}

export function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const values = crypto.getRandomValues(new Uint32Array(18));
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}

export async function requireAdminContext() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return { error: "Supabase is not configured for server auth.", status: 503 as const };
  }

  const {
    data: { user: currentUser },
    error: currentUserError,
  } = await supabase.auth.getUser();

  if (currentUserError) {
    return { error: currentUserError.message, status: 401 as const };
  }

  if (!currentUser) {
    return { error: "You must be signed in.", status: 401 as const };
  }

  const { data: roleRows, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", currentUser.id);
  if (roleError) {
    return { error: roleError.message, status: 500 as const };
  }

  const currentRoles = ((roleRows ?? []) as Array<{ role: AppRole }>).map((row) => row.role);
  if (!currentRoles.some((role) => adminRoles.includes(role))) {
    return { error: "Only admins can manage users.", status: 403 as const };
  }

  if (!hasSupabaseAdminEnv()) {
    return {
      error: "User admin actions need `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in the server environment.",
      status: 500 as const,
    };
  }

  const adminSupabase = getSupabaseAdminClient();
  if (!adminSupabase) {
    return { error: "Supabase admin client could not be initialized.", status: 500 as const };
  }

  return { supabase, adminSupabase, currentUser };
}

