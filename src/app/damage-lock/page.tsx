"use client";

import Link from "next/link";
import { AlertTriangle, Send, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { DecypherText } from "@/components/decypher-text";
import { MatrixRain } from "@/components/matrix-rain";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/components/toast";
import { submitDamageLockStatement } from "@/lib/damage-lock";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export default function DamageLockPage() {
  const { accessState, authStatus, damageLockCase, isConfigured, retryAccessLoad } = useAuth();
  const router = useRouter();
  const { pushToast } = useToast();
  const [statement, setStatement] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "error" | "success" | "info"; message: string } | null>(null);

  useEffect(() => {
    if (!feedback) return;
    pushToast({
      tone: feedback.tone,
      title: feedback.tone === "error" ? "Error" : feedback.tone === "success" ? "Success" : "Info",
      message: feedback.message,
    });
  }, [feedback, pushToast]);

  useEffect(() => {
    if (!isConfigured || authStatus !== "signed_in") return;
    if (accessState === "approved") {
      router.replace("/dashboard");
      return;
    }
    if (accessState === "pending_approval") {
      router.replace("/approval-pending");
    }
  }, [accessState, authStatus, isConfigured, router]);

  const handleSubmit = async () => {
    if (!damageLockCase) {
      setFeedback({ tone: "error", message: "No active damage lock case was found for this account." });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so damage-form submission is unavailable." });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await submitDamageLockStatement(supabase, {
        caseId: damageLockCase.id,
        statement,
      });

      if (error) throw error;

      setFeedback({
        tone: "success",
        message: "Damage form submitted. Your access will refresh automatically once the lock state clears.",
      });
      setStatement("");
      await retryAccessLoad();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Damage form submission failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <MatrixRain interactive className="opacity-95" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.1),transparent_24%)]" />

      <section className="scanlines relative z-10 w-full max-w-3xl overflow-hidden rounded-[2rem] border border-destructive/25 bg-background/95 p-8 shadow-[var(--shadow-strong)] sm:p-10">
        <div className="absolute inset-x-0 top-0 h-px bg-destructive/40" />
        <div className="mx-auto flex size-16 items-center justify-center rounded-[1.5rem] border border-destructive/25 bg-destructive/10 text-destructive shadow-[0_0_32px_rgba(239,68,68,0.18)]">
          <ShieldAlert className="size-8" />
        </div>

        <div className="mt-6 text-center">
          <div className="app-kicker text-destructive/80">Damage lock</div>
          <h1 className="mt-2 font-display text-4xl text-foreground sm:text-5xl">Operator access is locked</h1>
          <div className="mt-4 rounded-[1.5rem] border border-primary/20 bg-primary/8 px-5 py-4">
            <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-primary/70">{"// incident intake //"}</div>
            <div className="mt-3 font-display text-lg uppercase tracking-[0.18em] text-primary glow">
              <DecypherText />
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-4">
            <div className="rounded-[1.2rem] border border-destructive/20 bg-destructive/8 p-4 text-sm text-destructive">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                <div>
                  Normal workflows are blocked until you submit the damage statement for the affected asset.
                </div>
              </div>
            </div>

            <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 p-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary/72">Affected asset</div>
              <div className="mt-3 font-display text-2xl text-foreground glow-soft">{damageLockCase?.assetName ?? "Damage case pending"}</div>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <div>Tag: {damageLockCase?.assetTag ?? "-"}</div>
                <div>Location: {damageLockCase?.locationName ?? "Unknown location"}</div>
                <div>Opened: {formatDateTime(damageLockCase?.openedAt)}</div>
                <div>Status: {damageLockCase?.status ?? "Locked"}</div>
              </div>
            </div>

            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-[1rem] border border-primary/30 bg-background/40 px-5 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              Back To Login
            </Link>
          </div>

          <div className="space-y-4">
            <div className="app-panel p-5">
              <div className="app-kicker">Damage form</div>
              <h2 className="mt-2 font-display text-3xl text-foreground glow-soft">Submit your incident statement</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Describe what happened, what condition the asset is in now, and any immediate context the review team needs.
              </p>

              <textarea
                value={statement}
                onChange={(event) => setStatement(event.target.value)}
                placeholder="Explain the damage incident, timeline, and current condition..."
                className="matrix-field mt-4 min-h-48 w-full rounded-[1.15rem] px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />

              {feedback && (
                <div
                  className={`mt-4 rounded-[1rem] border px-4 py-3 text-sm ${
                    feedback.tone === "success"
                      ? "border-primary/20 bg-primary/8 text-primary"
                      : feedback.tone === "error"
                        ? "border-destructive/20 bg-destructive/8 text-destructive"
                        : "border-primary/12 bg-card/45 text-muted-foreground"
                  }`}
                >
                  {feedback.message}
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting || !statement.trim() || !damageLockCase}
                className="matrix-button mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[1.15rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send size={16} />
                {submitting ? "Submitting Damage Form" : "Submit Damage Form"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
