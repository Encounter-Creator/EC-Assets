"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { DecypherText } from "@/components/decypher-text";
import { MatrixRain } from "@/components/matrix-rain";
import { useAuth } from "@/contexts/auth-context";

export default function ApprovalPendingPage() {
  const { accessState, authStatus, isConfigured, isApproved, retryAccessLoad } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isConfigured || authStatus !== "signed_in" || accessState !== "pending_approval") return;

    const refresh = () => {
      void retryAccessLoad();
    };

    refresh();
    const interval = window.setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [accessState, authStatus, isConfigured, retryAccessLoad]);

  useEffect(() => {
    if (isApproved) {
      router.replace("/dashboard");
    }
  }, [isApproved, router]);

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <MatrixRain interactive className="opacity-95" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.1),transparent_24%)]" />

      <section className="scanlines relative z-10 w-full max-w-xl overflow-hidden rounded-[2rem] border border-primary/20 bg-background/95 p-8 text-center shadow-[var(--shadow-strong)] sm:p-10">
        <div className="absolute inset-x-0 top-0 h-px bg-primary/30" />
        <div className="mx-auto flex size-16 items-center justify-center rounded-[1.5rem] border border-primary/25 bg-primary/10 text-primary shadow-[0_0_32px_rgba(34,197,94,0.18)]">
          <ShieldAlert className="size-8" />
        </div>

        <div className="mt-6 space-y-4">
          <div className="app-kicker">Operator queue</div>
          <h1 className="font-display text-4xl text-foreground glow-soft sm:text-5xl">Waiting for approval</h1>
        </div>

        <div className="mt-8 rounded-[1.5rem] border border-primary/20 bg-primary/8 px-5 py-4">
          <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-primary/70">{"// deciphering code //"}</div>
          <div className="mt-3 font-display text-lg uppercase tracking-[0.18em] text-primary glow">
            <DecypherText />
          </div>
        </div>

        <div className="mt-6 text-sm text-muted-foreground">
          This screen will poll for approval automatically once the real auth layer is connected.
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-[1rem] border border-primary/30 bg-background/40 px-5 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            Login Operator Access
          </Link>
        </div>
      </section>
    </div>
  );
}
