import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { DEFAULT_ROLE } from "../domain/mockData";
import { AppRole, UserProfile } from "../domain/types";
import { getMyAccessContext } from "../lib/api";
import { deleteItem, getItem, setItem } from "../lib/storage";
import { isSupabaseEnabled, supabase } from "../lib/supabase";

const STORAGE_KEY = "assets-app-session";

type AuthState = {
  loading: boolean;
  user: UserProfile | null;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  signUp: (payload: { fullName: string; surname: string; email: string; password: string }) => Promise<{ ok: boolean; pendingApproval: boolean; message?: string }>;
  signOut: () => Promise<void>;
  completeDamageForm: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
});

function roleFromEmail(email: string): AppRole {
  if (email.startsWith("admin")) return "admin";
  if (email.startsWith("manager")) return "asset_manager";
  if (email.startsWith("volunteer")) return "volunteer";
  return DEFAULT_ROLE;
}

function mockUser(email: string, approved = true): UserProfile {
  const role = roleFromEmail(email);
  const namePart = email.split("@")[0] ?? email;
  return {
    id: email,
    email,
    fullName: namePart.replace(/[._-]/g, " "),
    role,
    homeBase: role === "admin" ? "Office" : role === "asset_manager" ? "Centurion" : "Lanseria",
    approved,
    locked: false,
    department: role === "volunteer" ? "Prophet" : "Production",
  };
}

async function resolveUserProfile(email: string, approvedFallback = true): Promise<UserProfile> {
  const fallback = mockUser(email, approvedFallback);

  if (!isSupabaseEnabled) {
    return fallback;
  }

  const access = await getMyAccessContext().catch(() => null);
  if (!access) {
    return fallback;
  }

  return {
    id: email,
    email: access.email || email,
    fullName: access.full_name || fallback.fullName,
    role: access.role,
    homeBase: (access.home_base as UserProfile["homeBase"] | null) ?? fallback.homeBase,
    department: access.department ?? fallback.department,
    approved: access.approved,
    locked: access.locked,
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          setUser(JSON.parse(raw) as UserProfile);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn: AuthState["signIn"] = async (email, password) => {
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid credentials" };
    }

    if (isSupabaseEnabled && supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password });
      if (error) {
        return { ok: false, message: error.message };
      }
    }

    const nextUser = await resolveUserProfile(parsed.data.email, true);
    setUser(nextUser);
    await setItem(STORAGE_KEY, JSON.stringify(nextUser));
    return { ok: true };
  };

  const signUp: AuthState["signUp"] = async ({ fullName, surname, email, password }) => {
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success || !fullName.trim() || !surname.trim()) {
      return { ok: false, pendingApproval: false, message: "Complete all required fields." };
    }

    if (isSupabaseEnabled && supabase) {
      const { error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password,
        options: {
          data: {
            display_name: fullName.trim(),
            surname: surname.trim(),
          },
        },
      });

      if (error) {
        return { ok: false, pendingApproval: false, message: error.message };
      }
    }

    const nextUser: UserProfile = {
      ...(await resolveUserProfile(parsed.data.email, false)),
      fullName: `${fullName.trim()} ${surname.trim()}`,
    };
    setUser(nextUser);
    await setItem(STORAGE_KEY, JSON.stringify(nextUser));
    return { ok: true, pendingApproval: true };
  };

  const signOut = async () => {
    if (isSupabaseEnabled && supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    await deleteItem(STORAGE_KEY);
  };

  const completeDamageForm = () => {
    setUser((current) => (current ? { ...current, locked: false } : current));
  };

  const value = useMemo(
    () => ({
      loading,
      user,
      signIn,
      signUp,
      signOut,
      completeDamageForm,
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
