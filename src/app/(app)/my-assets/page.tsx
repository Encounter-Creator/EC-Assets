"use client";

import { AlertTriangle, ArrowLeftRight, CheckCircle2, PackageCheck, RefreshCcw, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import { getAssetStatusLabel, getStatusBadgeClass, normalizeAssetStatus } from "@/lib/assets";
import {
  fallbackAssignedAssets,
  fallbackDamageRecords,
  fallbackPendingItems,
  loadMyAssetsWorkspace,
  type AssignedAsset,
  type DamageRecord,
  type MyAssetsWorkspaceData,
  type PendingItem,
} from "@/lib/my-assets";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { SectionShell } from "../layout";

const damageBadgeClass: Record<DamageRecord["status"], string> = {
  "Form Submitted": "border-primary/35 bg-primary/12 text-primary",
  "Under Review": "border-amber-500/35 bg-amber-500/12 text-amber-300",
  "Resolved: Available": "border-primary/35 bg-primary/12 text-primary",
  "Resolved: Damaged": "border-rose-500/35 bg-rose-500/12 text-rose-300",
};

const fallbackWorkspace: MyAssetsWorkspaceData = {
  assignedAssets: fallbackAssignedAssets,
  pendingItems: fallbackPendingItems,
  damageRecords: fallbackDamageRecords,
  source: "fallback",
  warnings: ["Supabase is not configured yet, so this page is showing the rebuild preview dataset."],
};

type FeedbackState = {
  tone: "success" | "error" | "info";
  message: string;
};

export default function MyAssetsPage() {
  const { user, isConfigured, isVolunteer } = useAuth();
  const [activeTab, setActiveTab] = useState<"assigned" | "pending" | "damage">("assigned");
  const [workspace, setWorkspace] = useState<MyAssetsWorkspaceData>(fallbackWorkspace);
  const [loading, setLoading] = useState(true);
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);
  const [busyPendingIds, setBusyPendingIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const validSelectedPendingIds = useMemo(
    () => selectedPendingIds.filter((id) => workspace.pendingItems.some((item) => item.id === id)),
    [selectedPendingIds, workspace.pendingItems],
  );

  const summary = useMemo(
    () => ({
      assigned: workspace.assignedAssets.length,
      pending: workspace.pendingItems.length,
      damage: workspace.damageRecords.length,
    }),
    [workspace],
  );

  const refreshWorkspace = async () => {
    if (!user || !isConfigured) {
      setWorkspace(fallbackWorkspace);
      setLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setWorkspace(fallbackWorkspace);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const nextWorkspace = await loadMyAssetsWorkspace(supabase, user.id);
      setWorkspace(nextWorkspace);
    } catch (error) {
      const message = error instanceof Error ? error.message : "We could not load My Assets right now.";
      setWorkspace({
        ...fallbackWorkspace,
        warnings: [...fallbackWorkspace.warnings, message],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadWorkspace = async () => {
      if (!user || !isConfigured) {
        if (!cancelled) {
          setWorkspace(fallbackWorkspace);
          setLoading(false);
        }
        return;
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (!cancelled) {
          setWorkspace(fallbackWorkspace);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setLoading(true);
      }

      try {
        const nextWorkspace = await loadMyAssetsWorkspace(supabase, user.id);
        if (!cancelled) {
          setWorkspace(nextWorkspace);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "We could not load My Assets right now.";
        if (!cancelled) {
          setWorkspace({
            ...fallbackWorkspace,
            warnings: [...fallbackWorkspace.warnings, message],
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [isConfigured, user]);

  const togglePending = (id: string) => {
    setSelectedPendingIds((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  };

  const runPendingAction = async (item: PendingItem, accept: boolean) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({
        tone: "error",
        message: "Supabase is not configured yet, so live pending responses are not available.",
      });
      return false;
    }

    setBusyPendingIds((current) => [...current, item.id]);
    try {
      if (item.type === "assignment") {
        const { error } = await supabase.rpc(accept ? "approve_recipient_signout_approval" : "decline_recipient_signout_approval", {
          target_approval_id: item.id,
          ...(accept ? {} : { decline_notes: null }),
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("respond_handover", {
          target_handover_id: item.id,
          accept_handover: accept,
        });
        if (error) throw error;
      }

      setFeedback({
        tone: "success",
        message:
          item.type === "assignment"
            ? accept
              ? "Assignment approved."
              : "Assignment declined."
            : accept
              ? "Handover accepted."
              : "Handover rejected.",
      });
      setSelectedPendingIds((current) => current.filter((entry) => entry !== item.id));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "The pending action failed.";
      setFeedback({ tone: "error", message });
      return false;
    } finally {
      setBusyPendingIds((current) => current.filter((entry) => entry !== item.id));
    }
  };

  const handlePendingAction = async (item: PendingItem, accept: boolean) => {
    const succeeded = await runPendingAction(item, accept);
    if (succeeded) {
      await refreshWorkspace();
    }
  };

  const handleBulkAction = async (accept: boolean) => {
    const selectedItems = workspace.pendingItems.filter((item) => validSelectedPendingIds.includes(item.id));
    if (selectedItems.length === 0) {
      setFeedback({ tone: "info", message: "Select at least one pending item first." });
      return;
    }

    let successCount = 0;
    for (const item of selectedItems) {
      const succeeded = await runPendingAction(item, accept);
      if (succeeded) successCount += 1;
    }

    if (successCount > 0) {
      setFeedback({
        tone: "success",
        message: `${successCount} pending item${successCount === 1 ? "" : "s"} ${accept ? "approved" : "declined"}.`,
      });
      await refreshWorkspace();
    }
  };

  const handleAssignedAction = (asset: AssignedAsset, action: string) => {
    setFeedback({
      tone: "info",
      message: `${action} for ${asset.tag} is the next live form to wire. The assigned and pending data are now connected first.`,
    });
  };

  return (
    <SectionShell title="My Assets" kicker="Assigned + Pending + Damage">
      <div className="space-y-4 sm:space-y-6">
        <section className="app-panel p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="app-kicker">My Assets</div>
              <h1 className="app-title mt-2">Action-oriented personal asset workspace rebuilt into the new shell.</h1>
              <p className="app-subtitle mt-3">
                This page now loads real assigned assets, pending recipient approvals, and pending handovers where the live schema supports them. `Damage` remains history-only.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-[22rem]">
              <SummaryCard label="Assigned" value={summary.assigned} />
              <SummaryCard label="Pending" value={summary.pending} />
              <SummaryCard label="Damage" value={summary.damage} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <DataSourceBadge source={workspace.source} />
            <button
              type="button"
              onClick={() => void refreshWorkspace()}
              className="inline-flex items-center gap-2 rounded-full border border-primary/18 bg-card/55 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              <RefreshCcw size={14} className={cn(loading && "animate-spin")} />
              {loading ? "Refreshing" : "Refresh"}
            </button>
          </div>

          {feedback && (
            <div
              className={cn(
                "mt-4 rounded-[1.2rem] border px-4 py-3 text-sm",
                feedback.tone === "success" && "border-primary/20 bg-primary/8 text-primary",
                feedback.tone === "error" && "border-destructive/20 bg-destructive/8 text-destructive",
                feedback.tone === "info" && "border-primary/12 bg-card/45 text-muted-foreground",
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

        <section className="app-panel overflow-hidden">
          <div className="border-b border-primary/12 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap gap-2">
              <TabButton active={activeTab === "assigned"} onClick={() => setActiveTab("assigned")} label="Assigned" count={summary.assigned} />
              <TabButton active={activeTab === "pending"} onClick={() => setActiveTab("pending")} label="Pending" count={summary.pending} />
              <TabButton active={activeTab === "damage"} onClick={() => setActiveTab("damage")} label="Damage" count={summary.damage} />
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {activeTab === "assigned" && (
              <div className="space-y-4">
                {workspace.assignedAssets.map((asset) => {
                  const normalizedStatus = normalizeAssetStatus(asset.status);
                  return (
                    <div key={asset.id} className="matrix-dashboard-bubble p-4 text-left">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm uppercase tracking-[0.14em] text-primary">{asset.tag}</span>
                            <span
                              className={cn(
                                "inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                                getStatusBadgeClass(normalizedStatus),
                              )}
                            >
                              {getAssetStatusLabel(normalizedStatus)}
                            </span>
                          </div>
                          <div className="mt-2 font-display text-2xl text-foreground glow-soft">{asset.name}</div>
                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span>Serial: {asset.serial}</span>
                            <span>Location: {asset.location}</span>
                            <span>Department: {asset.department}</span>
                            <span>Assigned by: {asset.assignedBy}</span>
                            <span>{asset.assignedAt}</span>
                          </div>
                        </div>

                        <div className="grid gap-2 sm:min-w-[13rem]">
                          {asset.availableActions.map((action) => (
                            <button
                              key={action}
                              type="button"
                              onClick={() => handleAssignedAction(asset, action)}
                              className="rounded-[1rem] border border-primary/18 bg-card/55 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary"
                            >
                              {action}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {workspace.assignedAssets.length === 0 && (
                  <EmptyState title="No assigned assets" body="Assigned assets will appear here once something has been issued to you." />
                )}

                <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 px-4 py-4 text-sm text-muted-foreground">
                  {isVolunteer
                    ? "Volunteer access stays tightly focused on assigned items, pending decisions, and return actions."
                    : "Handover is intentionally integrated into `My Assets` in v2 instead of living on a dedicated top-level page."}
                </div>
              </div>
            )}

            {activeTab === "pending" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 rounded-[1.2rem] border border-primary/12 bg-card/45 px-4 py-3">
                  <span className="font-mono text-xs uppercase tracking-[0.16em] text-primary/72">{validSelectedPendingIds.length} selected</span>
                  <button
                    type="button"
                    onClick={() => void handleBulkAction(true)}
                    disabled={validSelectedPendingIds.length === 0 || busyPendingIds.length > 0}
                    className="ml-auto rounded-full border border-primary/18 px-3 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Bulk Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleBulkAction(false)}
                    disabled={validSelectedPendingIds.length === 0 || busyPendingIds.length > 0}
                    className="rounded-full border border-destructive/20 px-3 py-1 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Bulk Decline
                  </button>
                </div>

                {workspace.pendingItems.map((item) => {
                  const selected = validSelectedPendingIds.includes(item.id);
                  const busy = busyPendingIds.includes(item.id);
                  return (
                    <div key={item.id} className={cn("app-panel p-4 sm:p-5", selected && "border-primary/28", busy && "opacity-75")}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => togglePending(item.id)}
                              className={cn(
                                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors",
                                selected ? "border-primary/28 bg-primary/12 text-primary" : "border-primary/14 text-muted-foreground hover:text-foreground",
                              )}
                            >
                              <ShieldCheck size={13} />
                              {selected ? "Selected" : "Select"}
                            </button>
                            <span
                              className={cn(
                                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                                item.type === "assignment"
                                  ? "border-sky-500/35 bg-sky-500/12 text-sky-300"
                                  : "border-violet-500/35 bg-violet-500/12 text-violet-300",
                              )}
                            >
                              {item.type === "assignment" ? <PackageCheck size={13} /> : <ArrowLeftRight size={13} />}
                              {item.type === "assignment" ? "Assignment" : "Handover"}
                            </span>
                          </div>

                          <div className="mt-3 font-display text-2xl text-foreground glow-soft">{item.title}</div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span>From: {item.requestedBy}</span>
                            <span>Location: {item.location}</span>
                            <span>{item.sentAt}</span>
                          </div>
                          {item.notes && <div className="mt-3 text-sm text-muted-foreground">{item.notes}</div>}
                        </div>

                        <div className="grid gap-2 sm:min-w-[12rem]">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handlePendingAction(item, true)}
                            className="matrix-button inline-flex h-11 items-center justify-center gap-2 rounded-[1rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <CheckCircle2 size={15} />
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handlePendingAction(item, false)}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-[1rem] border border-destructive/22 bg-card/55 px-4 text-sm font-semibold uppercase tracking-[0.14em] text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <XCircle size={15} />
                            Decline
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {item.items.map((asset) => (
                          <div key={`${item.id}-${asset.tag}`} className="rounded-[1.1rem] border border-primary/12 bg-card/40 p-4">
                            <div className="font-mono text-sm uppercase tracking-[0.14em] text-primary">{asset.tag}</div>
                            <div className="mt-1 font-display text-lg text-foreground">{asset.name}</div>
                            <div className="mt-2 text-sm text-muted-foreground">
                              {[asset.serial, asset.department].filter(Boolean).join(" | ")}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {workspace.pendingItems.length === 0 && (
                  <EmptyState title="No pending items" body="Incoming assignments and handovers will appear here for inline review." />
                )}
              </div>
            )}

            {activeTab === "damage" && (
              <div className="space-y-4">
                {workspace.damageRecords.map((record) => (
                  <div key={record.id} className="app-panel p-4 sm:p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm uppercase tracking-[0.14em] text-primary">{record.tag}</span>
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                              damageBadgeClass[record.status],
                            )}
                          >
                            {record.status}
                          </span>
                        </div>
                        <div className="mt-2 font-display text-2xl text-foreground glow-soft">{record.name}</div>
                        <div className="mt-2 text-sm text-muted-foreground">{record.recordedAt}</div>
                        <div className="mt-3 rounded-[1rem] border border-primary/10 bg-card/40 px-4 py-3 text-sm text-muted-foreground">
                          {record.note}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {workspace.damageRecords.length === 0 && (
                  <EmptyState title="No damage history" body="Damage incidents assigned to you will appear here after they move out of the initial form stage." />
                )}

                <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 px-4 py-4 text-sm text-muted-foreground">
                  This tab remains history-only in v2. The user damage-report workflow does not live here.
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </SectionShell>
  );
}

function DataSourceBadge({ source }: { source: MyAssetsWorkspaceData["source"] }) {
  const label = source === "live" ? "Live Data" : source === "mixed" ? "Mixed Data" : "Fallback Preview";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em]",
        source === "live" && "border-primary/26 bg-primary/12 text-primary",
        source === "mixed" && "border-amber-500/26 bg-amber-500/10 text-amber-200",
        source === "fallback" && "border-sky-500/26 bg-sky-500/10 text-sky-200",
      )}
    >
      <RotateCcw size={13} />
      {label}
    </span>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        active ? "border-primary/26 bg-primary/12 text-primary" : "border-primary/12 text-muted-foreground hover:text-foreground",
      )}
    >
      <span>{label}</span>
      <span className="rounded-full border border-current/20 px-2 py-0.5 font-mono text-[11px]">{count}</span>
    </button>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[1rem] border border-primary/12 bg-card/45 px-3 py-3 text-center">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-2xl text-foreground">{value}</div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[1.2rem] border border-dashed border-primary/14 px-4 py-10 text-center">
      <div className="font-display text-2xl text-foreground glow-soft">{title}</div>
      <div className="mt-3 text-sm text-muted-foreground">{body}</div>
    </div>
  );
}
