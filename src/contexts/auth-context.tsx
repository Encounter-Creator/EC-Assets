"use client";

import type { Session, User } from "@supabase/supabase-js";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { AccessState, AppRole } from "@/lib/auth";
import { getSupabaseBrowserClient, hasSupabaseEnv } from "@/lib/supabase/client";

type AuthStatus = "loading" | "signed_in" | "signed_out" | "unconfigured";

type AccessContextRow = {
  approved: boolean;
  roles: AppRole[] | null;
  asset_manager_location_id: string | null;
  assigned_location_id: string | null;
  profile_exists: boolean;
  display_name?: string | null;
  surname?: string | null;
};

type AuthContextValue = {
  authStatus: AuthStatus;
  accessState: AccessState;
  isConfigured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  authError: string | null;
  profileName: string;
  assetManagerLocationId: string | null;
  assignedLocationId: string | null;
  isApproved: boolean;
  isAdmin: boolean;
  isMainAdmin: boolean;
  isAssetManager: boolean;
  isStaff: boolean;
  isVolunteer: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  retryAccessLoad: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const isConfigured = hasSupabaseEnv();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>(isConfigured ? "loading" : "unconfigured");
  const [accessState, setAccessState] = useState<AccessState>(isConfigured ? "loading" : "unconfigured");
  const [loading, setLoading] = useState(isConfigured);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [assetManagerLocationId, setAssetManagerLocationId] = useState<string | null>(null);
  const [assignedLocationId, setAssignedLocationId] = useState<string | null>(null);

  const clearAccessState = useCallback(() => {
    setRoles([]);
    setProfileName("");
    setAssetManagerLocationId(null);
    setAssignedLocationId(null);
  }, []);

  const applyAccessContext = useCallback((access: AccessContextRow) => {
    const nextRoles = access.roles ?? [];
    setRoles(nextRoles);
    setAssetManagerLocationId(access.asset_manager_location_id ?? null);
    setAssignedLocationId(access.assigned_location_id ?? access.asset_manager_location_id ?? null);
    setProfileName(
      [access.display_name?.trim(), access.surname?.trim()].filter(Boolean).join(" ") ||
        user?.email?.split("@")[0] ||
        "Operator",
    );
    setAccessState(access.approved ? "approved" : "pending_approval");
    setAuthError(null);
  }, [user]);

  const handleAccessError = useCallback((message: string) => {
    clearAccessState();
    setAccessState("error");
    setAuthError(message);
  }, [clearAccessState]);

  const loadLegacyAccessContext = useCallback(async (userId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

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
    if (approvedError) throw approvedError;

    applyAccessContext({
      approved: Boolean(approvedData),
      roles: ((rolesData ?? []) as Array<{ role: AppRole }>).map((row) => row.role),
      asset_manager_location_id: profileData?.asset_manager_location_id ?? null,
      assigned_location_id: profileData?.assigned_location_id ?? profileData?.asset_manager_location_id ?? null,
      profile_exists: Boolean(profileData),
      display_name: profileData?.display_name ?? null,
      surname: profileData?.surname ?? null,
    });
  }, [applyAccessContext]);

  const loadAccessContext = useCallback(async (userId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const { data, error } = await supabase.rpc("get_my_access_context").single();
    if (!error && data) {
      applyAccessContext(data as AccessContextRow);
      return;
    }

    const message = error?.message ?? "";
    const missingFunction =
      message.includes("Could not find the function public.get_my_access_context without parameters in the schema cache") ||
      message.includes("function public.get_my_access_context() does not exist") ||
      message.includes("Could not find the function");

    if (!missingFunction) {
      throw error;
    }

    await loadLegacyAccessContext(userId);
  }, [applyAccessContext, loadLegacyAccessContext]);

  useEffect(() => {
    if (!isConfigured) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setAuthStatus(data.session ? "signed_in" : "signed_out");
      if (!data.session?.user) {
        clearAccessState();
        setAccessState("loading");
        setAuthError(null);
        setLoading(false);
        return;
      }

      void loadAccessContext(data.session.user.id)
        .catch((error: { message?: string }) => handleAccessError(error?.message ?? "We could not verify your access right now."))
        .finally(() => setLoading(false));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setAuthStatus(nextSession ? "signed_in" : "signed_out");
      if (!nextSession?.user) {
        clearAccessState();
        setAccessState("loading");
        setAuthError(null);
        setLoading(false);
        return;
      }

      setAccessState("loading");
      setLoading(true);
      void loadAccessContext(nextSession.user.id)
        .catch((error: { message?: string }) => handleAccessError(error?.message ?? "We could not verify your access right now."))
        .finally(() => setLoading(false));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [clearAccessState, handleAccessError, isConfigured, loadAccessContext]);

  const retryAccessLoad = useCallback(async () => {
    if (!user) return;
    setAccessState("loading");
    setAuthError(null);
    try {
      await loadAccessContext(user.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "We could not verify your access right now.";
      handleAccessError(message);
    }
  }, [handleAccessError, loadAccessContext, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      authStatus,
      accessState,
      isConfigured,
      loading,
      session,
      user,
      roles,
      authError,
      profileName,
      assetManagerLocationId,
      assignedLocationId,
      isApproved: accessState === "approved",
      isAdmin: roles.includes("admin") || roles.includes("main_admin"),
      isMainAdmin: roles.includes("main_admin"),
      isAssetManager: roles.includes("asset_manager"),
      isStaff: roles.includes("staff") || roles.includes("admin") || roles.includes("main_admin") || roles.includes("asset_manager"),
      isVolunteer: roles.includes("volunteer"),
      signIn: async (email, password) => {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) {
          return { error: "Supabase environment variables are not configured yet." };
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        return { error: error?.message ?? null };
      },
      signOut: async () => {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) return;
        await supabase.auth.signOut();
        clearAccessState();
      },
      requestPasswordReset: async (email) => {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) {
          return { error: "Supabase environment variables are not configured yet." };
        }

        const origin = window.location.origin.replace(/\/$/, "");
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: `${origin}/login?reset=true`,
        });

        return { error: error?.message ?? null };
      },
      retryAccessLoad,
    }),
    [accessState, assetManagerLocationId, assignedLocationId, authError, authStatus, clearAccessState, isConfigured, loading, profileName, retryAccessLoad, roles, session, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
