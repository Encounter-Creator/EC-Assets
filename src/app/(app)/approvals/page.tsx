"use client";

import { AlertTriangle, ArrowRightLeft, ClipboardCheck, PackageCheck, RefreshCcw, RotateCcw, ShieldAlert, UserCheck, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import { useLocationScope } from "@/contexts/location-scope-context";
import {
  fallbackApprovalsWorkspace,
  loadApprovalsWorkspace,
  resolveDamageCaseItem,
  reviewApprovalItem,
  type ApprovalAction,
  type ApprovalQueueItem,
  type ApprovalTab,
  type ApprovalsWorkspaceData,
} from "@/lib/approvals";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { SectionShell } from "../layout";

const tabMeta = [
  { id: "recipient", label: "Recipient", icon: UserCheck },
  { id: "asset_requests", label: "Asset Requests", icon: ClipboardCheck },
  { id: "special_requests", label: "Special Requests", icon: ArrowRightLeft },
  { id: "returns", label: "Returns", icon: RotateCcw },
  { id: "damage_locks", label: "Damage Locks", icon: ShieldAlert },
] as const satisfies ReadonlyArray<{
  id: ApprovalTab;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}>;

type FeedbackState = {
  tone: "success" | "error" | "info";
  message: string;
};

export default function ApprovalsPage() {
  const { isAdmin, isAssetManager, isConfigured } = useAuth();
  const { activeLocationId, selectedLocationName } = useLocationScope();
  const [workspace, setWorkspace] = useState<ApprovalsWorkspaceData>(fallbackApprovalsWorkspace);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ApprovalTab>("recipient");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [reviewNotesByItemId, setReviewNotesByItemId] = useState<Record<string, string>>({});
  const [busyAction, setBusyAction] = useState<ApprovalAction | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const queueItems = workspace.queues[activeTab];
  const selectedItem = useMemo(
    () => queueItems.find((item) => item.id === selectedItemId) ?? queueItems[0] ?? null,
    [queueItems, selectedItemId],
  );
  const reviewNote = selectedItem ? reviewNotesByItemId[selectedItem.id] ?? selectedItem.note ?? "" : "";

  useEffect(() => {
    let cancelled = false;

    const loadWorkspace = async () => {
      if (!isConfigured) {
        if (!cancelled) {
          setWorkspace(fallbackApprovalsWorkspace);
          setLoading(false);
        }
        return;
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (!cancelled) {
          setWorkspace(fallbackApprovalsWorkspace);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setLoading(true);
      }

      const nextWorkspace = await loadApprovalsWorkspace(supabase, activeLocationId);
      if (!cancelled) {
        setWorkspace(nextWorkspace);
        setLoading(false);
      }
    };

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [activeLocationId, isConfigured]);

  const refreshWorkspace = async () => {
    if (!isConfigured) {
      setWorkspace(fallbackApprovalsWorkspace);
      setLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setWorkspace(fallbackApprovalsWorkspace);
      setLoading(false);
      return;
    }

    setLoading(true);
    const nextWorkspace = await loadApprovalsWorkspace(supabase, activeLocationId);
    setWorkspace(nextWorkspace);
    setLoading(false);
  };

  const runAction = async (item: ApprovalQueueItem, action: ApprovalAction) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so live approval actions are unavailable." });
      return;
    }

    setBusyAction(action);
    try {
      if (action === "send_reminder") {
        setFeedback({ tone: "info", message: "Recipient reminders are still a manager-facing scaffold. The queue is now live, but reminder delivery is not wired yet." });
        return;
      }

      if (item.target.kind === "approval") {
        const status =
          action === "accept_return" || action === "approve"
            ? "Approved"
            : action === "decline"
              ? "Declined"
              : "Request Changes";

        const { error } = await reviewApprovalItem(supabase, {
          approvalId: item.target.id,
          status,
          reviewNotes: reviewNote,
        });

        if (error) throw error;

        setFeedback({
          tone: "success",
          message:
            action === "accept_return"
              ? "Return request accepted."
              : action === "approve"
                ? "Approval completed."
                : action === "decline"
                  ? "Approval declined."
                  : "Request marked for changes.",
        });
        await refreshWorkspace();
        return;
      }

      if (item.target.kind === "damage_case") {
        if (action === "resolve_lost") {
          setFeedback({ tone: "info", message: "Resolve Lost is still waiting on explicit backend support. Available and Damaged resolutions are wired first." });
          return;
        }

        const { error } = await resolveDamageCaseItem(supabase, {
          caseId: item.target.id,
          resolvedState: action === "resolve_available" ? "Available" : "Damaged",
          conditionNote: reviewNote,
        });

        if (error) throw error;

        setFeedback({
          tone: "success",
          message: action === "resolve_available" ? "Damage case resolved to Available." : "Damage case resolved to Damaged.",
        });
        await refreshWorkspace();
        return;
      }

      setFeedback({ tone: "info", message: "This queue is visible now, but its write-side workflow is not wired against the active backend surface yet." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The approval action failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusyAction(null);
    }
  };

  if (!isAdmin && !isAssetManager) {
    return (
      <SectionShell title="Approvals" kicker="Access restricted">
        <div className="app-panel p-5">
          <div className="app-kicker">Approvals</div>
          <h1 className="app-title mt-2">This workspace is reserved for admin and asset-manager roles.</h1>
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell title="Approvals" kicker="Queue + review panel">
      <div className="space-y-4 sm:space-y-6">
        <section className="app-panel p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="app-kicker">Approvals</div>
              <h1 className="app-title mt-2">Queue list plus review panel rebuilt into the live shell.</h1>
              <p className="app-subtitle mt-3">
                This page now loads live approval and damage queues where the backend surface exists, keeps the locked v2 tab layout, and falls back cleanly where write-side workflows are still incomplete.
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-primary/18 bg-primary/8 px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/72">Queue source</div>
              <div className="mt-2 flex items-center gap-2 text-sm text-primary">
                <Users size={15} />
                {workspace.source === "live" ? "Live data" : workspace.source === "mixed" ? "Mixed data" : "Fallback preview"}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-primary/12 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Scope: {selectedLocationName}
            </span>
            <button
              type="button"
              onClick={() => void refreshWorkspace()}
              disabled={loading || busyAction !== null}
              className="inline-flex items-center gap-2 rounded-full border border-primary/18 bg-card/55 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
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
              {tabMeta.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSelectedItemId(workspace.queues[tab.id][0]?.id ?? null);
                  }}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                    activeTab === tab.id ? "border-primary/26 bg-primary/12 text-primary" : "border-primary/12 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <tab.icon size={15} />
                  <span>{tab.label}</span>
                  <span className="rounded-full border border-current/20 px-2 py-0.5 font-mono text-[11px]">
                    {workspace.queues[tab.id].length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-0 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="border-b border-primary/12 xl:border-b-0 xl:border-r">
              <div className="p-4 sm:p-5">
                <div className="app-kicker">Queue list</div>
                <div className="mt-2 text-sm text-muted-foreground">Rows now reflect live queues when the backend surface exists for the selected scope.</div>
              </div>

              <div className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">
                {queueItems.length === 0 ? (
                  <div className="rounded-[1.2rem] border border-dashed border-primary/14 px-4 py-12 text-center text-sm text-muted-foreground">
                    No queue items found for this tab and location scope.
                  </div>
                ) : (
                  queueItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedItemId(item.id)}
                      className={cn("matrix-dashboard-bubble w-full p-4 text-left", selectedItem?.id === item.id && "border-primary/34")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-display text-xl text-foreground glow-soft">{item.summary}</div>
                          <div className="mt-1 text-sm text-muted-foreground">{item.requester}</div>
                          <div className="mt-2 text-sm text-muted-foreground">{item.meta}</div>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="p-4 sm:p-5">
              {!selectedItem ? (
                <div className="rounded-[1.2rem] border border-dashed border-primary/14 px-4 py-12 text-center text-sm text-muted-foreground">
                  No queue item selected.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="app-kicker">Review panel</div>
                  <div className="font-display text-3xl text-foreground glow-soft">{selectedItem.reviewTitle}</div>
                  <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 p-4 text-sm text-muted-foreground">
                    {selectedItem.reviewBody}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <ReviewMetric label="Requester" value={selectedItem.requester} />
                    <ReviewMetric label="Status" value={selectedItem.status} />
                    <ReviewMetric label="Queue Summary" value={selectedItem.summary} />
                    <ReviewMetric label="Context" value={selectedItem.meta} />
                  </div>

                  <label className="space-y-2">
                    <span className="font-mono text-xs uppercase tracking-[0.14em] text-primary/72">
                      {activeTab === "damage_locks" ? "Resolution note" : "Review note"}
                    </span>
                    <textarea
                      value={reviewNote}
                      onChange={(event) =>
                        selectedItem &&
                        setReviewNotesByItemId((current) => ({
                          ...current,
                          [selectedItem.id]: event.target.value,
                        }))
                      }
                      placeholder={activeTab === "recipient" ? "Optional reminder or review context" : "Add decision context or handoff note"}
                      className="matrix-field min-h-28 w-full rounded-[1.15rem] px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                  </label>

                  <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary/72">Inline actions</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedItem.actions.map((action) => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => void runAction(selectedItem, action)}
                          disabled={busyAction !== null}
                          className={cn(
                            "rounded-[1rem] border px-4 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                            action.includes("decline") || action.includes("lost") || action === "resolve_damaged"
                              ? "border-destructive/20 bg-card/55 text-destructive hover:bg-destructive/10"
                              : "border-primary/18 bg-card/55 text-foreground hover:bg-primary/8 hover:text-primary",
                          )}
                        >
                          {busyAction === action ? "Working..." : getActionLabel(action)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedItem.note && (
                    <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 px-4 py-4 text-sm text-muted-foreground">
                      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary/72">Existing context</div>
                      <div className="mt-2">{selectedItem.note}</div>
                    </div>
                  )}

                  {activeTab === "recipient" && (
                    <InlineNote icon={PackageCheck} text="Recipient supports bulk reminders only. Bulk approve/decline override does not belong in this queue." />
                  )}
                  {activeTab === "returns" && (
                    <InlineNote icon={RotateCcw} text="Accept Return remains the terminal action and auto-signs items back in using the approver-selected final sign-in location." />
                  )}
                  {activeTab === "damage_locks" && (
                    <InlineNote icon={AlertTriangle} text="Damage review stays decision-complete here and remains the manager/admin resolution surface for the full damage lock lifecycle." />
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </SectionShell>
  );
}

function getActionLabel(action: ApprovalAction) {
  switch (action) {
    case "send_reminder":
      return "Send Reminder";
    case "approve":
      return "Approve";
    case "decline":
      return "Decline";
    case "request_changes":
      return "Request Changes";
    case "accept_return":
      return "Accept Return";
    case "resolve_available":
      return "Resolve: Available";
    case "resolve_damaged":
      return "Resolve: Damaged";
    case "resolve_lost":
      return "Resolve: Lost";
  }
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const className =
    normalized.includes("approved") || normalized.includes("accepted")
      ? "border-primary/18 bg-primary/10 text-primary"
      : normalized.includes("declined") || normalized.includes("lost") || normalized.includes("damaged")
        ? "border-destructive/20 bg-destructive/10 text-destructive"
        : normalized.includes("review") || normalized.includes("awaiting") || normalized.includes("pending")
          ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
          : "border-primary/18 bg-primary/10 text-primary";

  return <span className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]", className)}>{status}</span>;
}

function ReviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-primary/12 bg-card/45 px-4 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm text-foreground">{value}</div>
    </div>
  );
}

function InlineNote({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  text: string;
}) {
  return (
    <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 px-4 py-4 text-sm text-muted-foreground">
      <div className="flex items-start gap-3">
        <Icon size={16} className="mt-0.5 shrink-0 text-primary" />
        <span>{text}</span>
      </div>
    </div>
  );
}
