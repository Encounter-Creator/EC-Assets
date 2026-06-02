"use client";

import { ShieldAlert } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { DecypherLoader } from "@/components/decypher-loader";
import { useAuth } from "@/contexts/auth-context";
import { canAccessRoute } from "@/lib/auth";

export function ProtectedApp({ children }: { children: React.ReactNode }) {
  const { accessState, authError, authStatus, isConfigured, loading, roles } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && isConfigured && authStatus === "signed_out") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [authStatus, isConfigured, loading, pathname, router]);

  if (!isConfigured) {
    return (
      <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
        <div className="app-panel max-w-xl p-8 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-[1.5rem] border border-primary/25 bg-primary/10 text-primary shadow-[0_0_32px_rgba(34,197,94,0.18)]">
            <ShieldAlert className="size-8" />
          </div>
          <div className="app-kicker mt-6">Auth setup required</div>
          <h1 className="mt-2 font-display text-3xl text-foreground glow-soft">Supabase environment variables are not configured.</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`) to `.env.local` to enable real auth and protected routing.
          </p>
        </div>
      </div>
    );
  }

  if (loading || authStatus === "loading") {
    return <DecypherLoader isReady={true} onComplete={() => undefined} />;
  }

  if (accessState === "pending_approval") {
    router.replace("/approval-pending");
    return null;
  }

  if (accessState === "damage_locked") {
    router.replace("/damage-lock");
    return null;
  }

  if (accessState === "error") {
    return (
      <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
        <div className="app-panel max-w-xl p-8 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-[1.5rem] border border-primary/25 bg-primary/10 text-primary shadow-[0_0_32px_rgba(34,197,94,0.18)]">
            <ShieldAlert className="size-8" />
          </div>
          <div className="app-kicker mt-6">Access check failed</div>
          <h1 className="mt-2 font-display text-3xl text-foreground glow-soft">The app could not verify your role access.</h1>
          <p className="mt-4 text-sm text-muted-foreground">{authError ?? "Try signing out and back in once the backend is ready."}</p>
        </div>
      </div>
    );
  }

  if (authStatus !== "signed_in") {
    return null;
  }

  if (!canAccessRoute(pathname, roles)) {
    router.replace("/dashboard");
    return null;
  }

  return <>{children}</>;
}
