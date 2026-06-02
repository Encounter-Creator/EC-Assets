"use client";

import type { Session, User } from "@supabase/supabase-js";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { resolveAccessContext, type AccessContextRow } from "@/lib/access-context";
import type { AccessState, AppRole } from "@/lib/auth";
import type { DamageLockCase } from "@/lib/damage-lock";
import { getSupabaseBrowserClient, hasSupabaseEnv } from "@/lib/supabase/client";

type AuthStatus = "loading" | "signed_in" | "signed_out" | "unconfigured";

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
  damageLockCase: DamageLockCase | null;
  isApproved: boolean;
  isDamageLocked: boolean;
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

function isTransientAccessError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("load failed") ||
    normalized.includes("insufficient resources") ||
    normalized.includes("fetch")
  );
}

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
  const [damageLockCase, setDamageLockCase] = useState<DamageLockCase | null>(null);
  const lastResolvedUserIdRef = useRef<string | null>(null);

  const clearAccessState = useCallback(() => {
    setRoles([]);
    setProfileName("");
    setAssetManagerLocationId(null);
    setAssignedLocationId(null);
    setDamageLockCase(null);
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
    setAuthError(null);
  }, [user]);

  const handleAccessError = useCallback((message: string) => {
    if (isTransientAccessError(message) && (roles.length > 0 || accessState === "approved" || accessState === "pending_approval" || accessState === "damage_locked")) {
      setAuthError(message);
      return;
    }
    clearAccessState();
    setAccessState("error");
    setAuthError(message);
  }, [accessState, clearAccessState, roles.length]);

  const loadAccessContext = useCallback(async (userId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const resolved = await resolveAccessContext(supabase, {
      userId,
      allowApprovalFallback: true,
    });

    applyAccessContext(resolved.accessContext);
    setDamageLockCase(resolved.damageLockCase);
    setAccessState(resolved.accessState);
    setAuthError(resolved.warning);
    lastResolvedUserIdRef.current = userId;
  }, [applyAccessContext]);

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
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
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

      const shouldReloadAccess =
        event === "SIGNED_IN" ||
        event === "USER_UPDATED" ||
        lastResolvedUserIdRef.current !== nextSession.user.id ||
        roles.length === 0 ||
        accessState === "loading";

      if (!shouldReloadAccess) {
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
  }, [accessState, clearAccessState, handleAccessError, isConfigured, loadAccessContext, roles.length]);

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
      damageLockCase,
      isApproved: accessState === "approved",
      isDamageLocked: accessState === "damage_locked",
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
    [accessState, assetManagerLocationId, assignedLocationId, authError, authStatus, clearAccessState, damageLockCase, isConfigured, loading, profileName, retryAccessLoad, roles, session, user],
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
