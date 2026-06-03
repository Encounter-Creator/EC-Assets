"use client";

import Link from "next/link";
import { Activity, AlertTriangle, ArrowRight, BadgeCheck, Package, RefreshCcw, RotateCcw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import { useLocationScope } from "@/contexts/location-scope-context";
import { getFallbackDashboardWorkspace, loadDashboardWorkspace, type DashboardCard, type DashboardFeedCard, type DashboardWorkspaceData } from "@/lib/dashboard";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { SectionShell } from "../layout";

type FeedbackState = {
  tone: "info" | "error";
  message: string;
};

const cardIcons: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Approvals: ShieldCheck,
  "Damage Locks": AlertTriangle,
  Transfers: ArrowRight,
  "Blocked Workflows": Activity,
  Returns: RotateCcw,
  "Sign-Outs": Package,
  "Damage Tasks": AlertTriangle,
  "Pending Approvals": ShieldCheck,
  "My Assigned Items": Package,
  "Return Requests": RotateCcw,
  "Damage Actions": AlertTriangle,
};

const dashboardCardLinks: Record<string, string> = {
  Approvals: "/approvals",
  "Damage Locks": "/approvals?tab=damage_locks",
  Transfers: "/requests?tab=history",
  "Blocked Workflows": "/approvals",
  Returns: "/check-out-in?tab=returns",
  "Sign-Outs": "/check-out-in?tab=standard&mode=sign_out",
  "Damage Tasks": "/approvals?tab=damage_locks",
  "Pending Approvals": "/my-assets?tab=pending",
  "My Assigned Items": "/my-assets?tab=assigned",
  "Return Requests": "/requests?tab=returns",
  "Damage Actions": "/my-assets?tab=damage",
};

const dashboardFeedLinks: Record<string, string> = {
  "Recent Asset Activity": "/inventory",
  "Recent Requests": "/requests?tab=history",
  "Recent Returns": "/check-out-in?tab=returns",
  "Recent Damage Reports": "/approvals?tab=damage_locks",
  "Location Snapshot": "/inventory",
  "Open Requests Snapshot": "/requests",
  "Returns in Progress": "/check-out-in?tab=returns",
  "Damage Workflow Updates": "/approvals?tab=damage_locks",
  "Location Inventory Snapshot": "/inventory",
  "My Recent Requests": "/requests?tab=history",
  "My Return Requests": "/requests?tab=returns",
  "My Pending Items": "/my-assets?tab=pending",
  "Home Base Inventory Highlights": "/inventory",
  "My Assigned Assets": "/my-assets?tab=assigned",
  "My Damage Actions": "/my-assets?tab=damage",
};

export default function DashboardPage() {
  const { isAdmin, isAssetManager, isVolunteer, isConfigured, user } = useAuth();
  const { activeLocationId, selectedLocationName } = useLocationScope();
  const role = isAdmin ? "admin" : isAssetManager ? "asset_manager" : isVolunteer ? "volunteer" : "staff";
  const roleTitle = isAdmin ? "Admin" : isAssetManager ? "Asset Manager" : isVolunteer ? "Volunteer" : "Staff";
  const [workspace, setWorkspace] = useState<DashboardWorkspaceData>(getFallbackDashboardWorkspace(role));
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadWorkspace = async () => {
      if (!isConfigured || !user) {
        if (!cancelled) {
          setWorkspace(getFallbackDashboardWorkspace(role));
          setLoading(false);
        }
        return;
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (!cancelled) {
          setWorkspace(getFallbackDashboardWorkspace(role));
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setLoading(true);
      }

      const nextWorkspace = await loadDashboardWorkspace(supabase, {
        role,
        userId: user.id,
        activeLocationId,
      });

      if (!cancelled) {
        setWorkspace(nextWorkspace);
        setLoading(false);
      }
    };

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [activeLocationId, isConfigured, role, user]);

  const refreshWorkspace = async () => {
    if (!isConfigured || !user) {
      setWorkspace(getFallbackDashboardWorkspace(role));
      setLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setWorkspace(getFallbackDashboardWorkspace(role));
      setLoading(false);
      return;
    }

    setLoading(true);
    setFeedback(null);
    try {
      const nextWorkspace = await loadDashboardWorkspace(supabase, {
        role,
        userId: user.id,
        activeLocationId,
      });
      setWorkspace(nextWorkspace);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Dashboard could not be refreshed.";
      setFeedback({ tone: "error", message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SectionShell title="Operations overview" kicker="Dashboard">
      <div className="space-y-4 animate-fade-in sm:space-y-6">
        <section className="app-panel p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="app-kicker">Action hub</div>
              <h1 className="app-title mt-2 glow-soft">{roleTitle} dashboard</h1>
              <p className="app-subtitle mt-3">Jump straight into approvals, returns, inventory, and your current workflow queues.</p>
            </div>
            <div className="rounded-[1.2rem] border border-primary/18 bg-primary/8 px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/72">Dashboard source</div>
              <div className="mt-2 flex items-center gap-2 text-sm text-primary">
                <BadgeCheck size={15} />
                {workspace.source === "live" ? "Live data" : workspace.source === "mixed" ? "Mixed data" : "Fallback preview"}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void refreshWorkspace()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full border border-primary/18 bg-card/55 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw size={14} className={cn(loading && "animate-spin")} />
              {loading ? "Refreshing" : "Refresh"}
            </button>
            <span className="rounded-full border border-primary/12 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Scope: {selectedLocationName}
            </span>
          </div>

          {feedback && (
            <div
              className={cn(
                "mt-4 rounded-[1.2rem] border px-4 py-3 text-sm",
                feedback.tone === "error" ? "border-destructive/20 bg-destructive/8 text-destructive" : "border-primary/12 bg-card/45 text-muted-foreground",
              )}
            >
              {feedback.message}
            </div>
          )}

          {workspace.warnings.length > 0 && (
            <div className="mt-4 rounded-[1.2rem] border border-amber-500/20 bg-amber-500/8 px-4 py-4 text-sm text-amber-100/85">
              <div className="flex items-start gap-3">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" />
                <div className="space-y-1">
                  {workspace.warnings.map((warning) => (
                    <div key={warning}>{warning}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {workspace.topCards.map((card) => (
            <TopCard key={card.label} card={card} href={dashboardCardLinks[card.label]} />
          ))}
        </section>

        <section className={cn("grid gap-4", workspace.lowerCards.length >= 5 ? "lg:grid-cols-2 xl:grid-cols-3" : "lg:grid-cols-2")}>
          {workspace.lowerCards.map((card) => (
            <FeedCard key={card.title} card={card} href={dashboardFeedLinks[card.title]} />
          ))}
        </section>
      </div>
    </SectionShell>
  );
}

function TopCard({ card, href }: { card: DashboardCard; href?: string }) {
  const Icon = cardIcons[card.label] ?? Package;
  const content = (
    <>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/24 bg-primary/10 text-primary">
          <Icon size={18} />
        </div>
        <ArrowRight size={16} className="text-muted-foreground" />
      </div>
      <div className="font-display text-3xl text-foreground glow-soft">{card.value}</div>
      <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:text-sm">{card.label}</div>
    </>
  );

  if (!href) {
    return <div className="matrix-dashboard-bubble p-4 sm:p-5">{content}</div>;
  }

  return <Link href={href} prefetch={false} className="matrix-dashboard-bubble block p-4 transition-transform hover:-translate-y-0.5 sm:p-5">{content}</Link>;
}

function FeedCard({ card, href }: { card: DashboardFeedCard; href?: string }) {
  const content = (
    <>
      <div className="app-kicker">Recent + Open + Snapshot</div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl text-foreground glow-soft">{card.title}</h2>
        {href ? <ArrowRight size={15} className="shrink-0 text-primary/70" /> : null}
      </div>
      <div className="mt-4 space-y-2">
        {card.rows.length === 0 ? (
          <div className="rounded-[1rem] border border-dashed border-primary/14 px-4 py-8 text-center text-sm text-muted-foreground">
            No rows available.
          </div>
        ) : (
          card.rows.map((row, index) => (
            <div key={`${card.title}-${index}`} className="rounded-[1rem] border border-primary/12 bg-card/40 px-3 py-3">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Package size={14} className="text-primary" />
                <span>{row}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );

  if (!href) {
    return <div className="matrix-dashboard-bubble p-5">{content}</div>;
  }

  return (
    <Link href={href} prefetch={false} className="matrix-dashboard-bubble block p-5 transition-transform hover:-translate-y-0.5">
      {content}
    </Link>
  );
}
