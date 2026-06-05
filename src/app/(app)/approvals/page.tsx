"use client";

import { AlertTriangle, ArrowRightLeft, ClipboardCheck, PackageCheck, RefreshCcw, RotateCcw, Search, ShieldAlert, UserCheck, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/contexts/auth-context";
import { useLocationScope } from "@/contexts/location-scope-context";
import {
  acceptReturnApproval,
  fallbackApprovalsWorkspace,
  loadApprovalsWorkspace,
  resolveDamageCaseItem,
  resolveDamageCaseLost,
  reviewApprovalItem,
  sendRecipientReminder,
  type ApprovalAction,
  type ApprovalQueueItem,
  type ApprovalTab,
  type ApprovalsWorkspaceData,
} from "@/lib/approvals";
import { matchesSearchQuery } from "@/lib/search";
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

type QueueStatusFilter = "all" | "pending" | "awaiting" | "review" | "approved" | "declined";

function isApprovalTab(value: string | null): value is ApprovalTab {
  return value === "recipient" || value === "asset_requests" || value === "special_requests" || value === "returns" || value === "damage_locks";
}

export default function ApprovalsPage() {
  const { isAdmin, isAssetManager, isConfigured } = useAuth();
  const { activeLocationId, selectedLocationName } = useLocationScope();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedTabValue = searchParams.get("tab");
  const requestedTab: ApprovalTab | null = isApprovalTab(requestedTabValue) ? requestedTabValue : null;
  const requestedItemId = searchParams.get("itemId");
  const [workspace, setWorkspace] = useState<ApprovalsWorkspaceData>(() => ({
    ...fallbackApprovalsWorkspace,
    warnings: [],
  }));
  const [loading, setLoading] = useState(true);
  const [selectedQueueItemIds, setSelectedQueueItemIds] = useState<string[]>([]);
  const [reviewNotesByItemId, setReviewNotesByItemId] = useState<Record<string, string>>({});
  const [returnLocationByItemId, setReturnLocationByItemId] = useState<Record<string, string>>({});
  const [busyAction, setBusyAction] = useState<ApprovalAction | null>(null);
  const [bulkNote, setBulkNote] = useState("");
  const [bulkReturnLocationId, setBulkReturnLocationId] = useState("");
  const [queueQuery, setQueueQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<QueueStatusFilter>("all");
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const activeTab: ApprovalTab = requestedTab ?? "recipient";
  const queueItems = workspace.queues[activeTab];
  const filteredQueueItems = useMemo(
    () =>
      queueItems.filter((item) => {
        const normalizedStatus = item.status.trim().toLowerCase();
        const matchesQuery = matchesSearchQuery([item.summary, item.requester, item.meta, item.status, item.reviewTitle, item.note], queueQuery);
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "pending" && normalizedStatus.includes("pending")) ||
          (statusFilter === "awaiting" && normalizedStatus.includes("awaiting")) ||
          (statusFilter === "review" && normalizedStatus.includes("review")) ||
          (statusFilter === "approved" && (normalizedStatus.includes("approved") || normalizedStatus.includes("accepted"))) ||
          (statusFilter === "declined" && (normalizedStatus.includes("declined") || normalizedStatus.includes("lost") || normalizedStatus.includes("damaged")));

        return matchesQuery && matchesStatus;
      }),
    [queueItems, queueQuery, statusFilter],
  );
  const validSelectedQueueItemIds = useMemo(
    () => selectedQueueItemIds.filter((id) => filteredQueueItems.some((item) => item.id === id)),
    [filteredQueueItems, selectedQueueItemIds],
  );
  const selectedItemId = requestedItemId && filteredQueueItems.some((item) => item.id === requestedItemId) ? requestedItemId : filteredQueueItems[0]?.id ?? null;
  const selectedItem = useMemo(
    () => filteredQueueItems.find((item) => item.id === selectedItemId) ?? filteredQueueItems[0] ?? null,
    [filteredQueueItems, selectedItemId],
  );
  const reviewNote = selectedItem ? reviewNotesByItemId[selectedItem.id] ?? selectedItem.note ?? "" : "";
  const effectiveBulkReturnLocationId = bulkReturnLocationId || workspace.locations[0]?.id || "";
  const selectedReturnLocationId = selectedItem ? returnLocationByItemId[selectedItem.id] ?? workspace.locations[0]?.id ?? "" : "";
  const selectedQueueItems = useMemo(
    () => filteredQueueItems.filter((item) => validSelectedQueueItemIds.includes(item.id)),
    [filteredQueueItems, validSelectedQueueItemIds],
  );
  const queueStatusSummary = useMemo(
    () => ({
      total: queueItems.length,
      visible: filteredQueueItems.length,
      pending: queueItems.filter((item) => item.status.toLowerCase().includes("pending")).length,
      awaiting: queueItems.filter((item) => item.status.toLowerCase().includes("awaiting")).length,
      review: queueItems.filter((item) => item.status.toLowerCase().includes("review")).length,
      actionable: queueItems.filter((item) => item.actions.length > 0).length,
    }),
    [filteredQueueItems.length, queueItems],
  );
  const availableBulkActions = useMemo(() => {
    if (selectedQueueItems.length === 0) return [] as ApprovalAction[];

    const sharedActions = selectedQueueItems.reduce<ApprovalAction[] | null>((acc, item) => {
      if (!acc) {
        return item.actions.filter((action) => activeTab === "returns" || action !== "accept_return");
      }
      return acc.filter((action) => item.actions.includes(action) && (activeTab === "returns" || action !== "accept_return"));
    }, null);

    if (!sharedActions) return [] as ApprovalAction[];
    return sharedActions;
  }, [activeTab, selectedQueueItems]);

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

      try {
        const nextWorkspace = await loadApprovalsWorkspace(supabase, activeLocationId);
        if (!cancelled) {
          setWorkspace(nextWorkspace);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Approvals could not be loaded right now.";
        if (!cancelled) {
          setWorkspace({
            ...fallbackApprovalsWorkspace,
            warnings: [...fallbackApprovalsWorkspace.warnings, message],
          });
          setFeedback({ tone: "error", message });
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
  }, [activeLocationId, isConfigured]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", activeTab);
    if (selectedItemId) {
      nextParams.set("itemId", selectedItemId);
    } else {
      nextParams.delete("itemId");
    }

    const nextQuery = nextParams.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery !== currentQuery) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }
  }, [activeTab, pathname, router, searchParams, selectedItemId]);

  const replaceQueueRoute = (tab: ApprovalTab, itemId?: string | null) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", tab);
    if (itemId) {
      nextParams.set("itemId", itemId);
    } else {
      nextParams.delete("itemId");
    }
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };

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
    try {
      const nextWorkspace = await loadApprovalsWorkspace(supabase, activeLocationId);
      setWorkspace(nextWorkspace);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Approvals could not be refreshed right now.";
      setWorkspace({
        ...fallbackApprovalsWorkspace,
        warnings: [...fallbackApprovalsWorkspace.warnings, message],
      });
      setFeedback({ tone: "error", message });
    } finally {
      setLoading(false);
    }
  };

  const executeAction = async (
    item: ApprovalQueueItem,
    action: ApprovalAction,
    input?: {
      note?: string;
      finalLocationId?: string;
    },
  ) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so live approval actions are unavailable." });
      return false;
    }

    setBusyAction(action);
    try {
      if (action === "send_reminder") {
        if (item.target.kind !== "approval") {
          setFeedback({ tone: "info", message: "This reminder row is preview-only because the live approval target is unavailable." });
          return false;
        }

        const { error } = await sendRecipientReminder(supabase, {
          approvalId: item.target.id,
          note: input?.note ?? reviewNotesByItemId[item.id] ?? item.note ?? "",
        });
        if (error) throw error;

        setFeedback({
          tone: "success",
          message: "Recipient reminder recorded on the approval item.",
        });
        await refreshWorkspace();
        return true;
      }

      if (item.target.kind === "approval") {
        if (action === "accept_return") {
          const finalLocationId = input?.finalLocationId ?? returnLocationByItemId[item.id] ?? workspace.locations[0]?.id ?? "";
          if (!finalLocationId) {
            setFeedback({ tone: "error", message: "Choose the final sign-in location before accepting the return." });
            return false;
          }

          const { error } = await acceptReturnApproval(supabase, {
            approvalId: item.target.id,
            finalLocationId,
            reviewNotes: input?.note ?? reviewNotesByItemId[item.id] ?? item.note ?? "",
          });

          if (error) throw error;

          setFeedback({
            tone: "success",
            message: "Return request accepted and signed back into the selected final location.",
          });
          await refreshWorkspace();
          return true;
        }

        const nextNote = input?.note ?? reviewNotesByItemId[item.id] ?? item.note ?? "";
        if ((action === "decline" || action === "request_changes") && !nextNote.trim()) {
          setFeedback({ tone: "error", message: `${action === "decline" ? "Decline" : "Request Changes"} requires a review note.` });
          return false;
        }

        const status =
          action === "approve"
            ? "Approved"
            : action === "decline"
              ? "Declined"
              : "Request Changes";

        const { error } = await reviewApprovalItem(supabase, {
          approvalId: item.target.id,
          status,
          reviewNotes: nextNote,
        });

        if (error) throw error;

        setFeedback({
          tone: "success",
          message:
            action === "approve"
              ? "Approval completed."
              : action === "decline"
                ? "Approval declined."
                : "Request marked for changes.",
        });
        await refreshWorkspace();
        return true;
      }

      if (item.target.kind === "damage_case") {
        if (action === "resolve_lost") {
          const { error } = await resolveDamageCaseLost(supabase, {
            caseId: item.target.id,
          });

          if (error) throw error;

          setFeedback({ tone: "success", message: "Damage case resolved to Lost." });
          await refreshWorkspace();
          return true;
        }

        const { error } = await resolveDamageCaseItem(supabase, {
          caseId: item.target.id,
          resolvedState: action === "resolve_available" ? "Available" : "Damaged",
          conditionNote: input?.note ?? reviewNotesByItemId[item.id] ?? item.note ?? "",
        });

        if (error) throw error;

        setFeedback({
          tone: "success",
          message: action === "resolve_available" ? "Damage case resolved to Available." : "Damage case resolved to Damaged.",
        });
        await refreshWorkspace();
        return true;
      }

      setFeedback({ tone: "info", message: "This queue is visible now, but its write-side workflow is not wired against the active backend surface yet." });
      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : "The approval action failed.";
      setFeedback({ tone: "error", message });
      return false;
    } finally {
      setBusyAction(null);
    }
  };

  const runAction = async (item: ApprovalQueueItem, action: ApprovalAction) => {
    await executeAction(item, action, {
      note: reviewNote,
      finalLocationId: selectedReturnLocationId,
    });
  };

  const toggleQueueItem = (itemId: string) => {
    setSelectedQueueItemIds((current) => (current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]));
  };

  const toggleAllVisibleQueueItems = () => {
    const visibleIds = filteredQueueItems.map((item) => item.id);
    if (visibleIds.length === 0) {
      setFeedback({ tone: "info", message: "No visible queue items match the current filters." });
      return;
    }

    const allVisibleSelected = visibleIds.every((id) => selectedQueueItemIds.includes(id));
    setSelectedQueueItemIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleIds.includes(id));
      }
      return [...new Set([...current, ...visibleIds])];
    });
  };

  const runBulkAction = async (action: ApprovalAction) => {
    if (selectedQueueItems.length === 0) {
      setFeedback({ tone: "info", message: "Select at least one queue item first." });
      return;
    }

    if ((action === "decline" || action === "request_changes") && !bulkNote.trim()) {
      setFeedback({ tone: "error", message: "Bulk decline and request-changes actions require a shared note." });
      return;
    }

    if (action === "accept_return" && !effectiveBulkReturnLocationId) {
      setFeedback({ tone: "error", message: "Choose the shared final sign-in location before accepting returns in bulk." });
      return;
    }

    let successCount = 0;
    for (const item of selectedQueueItems) {
      const succeeded = await executeAction(item, action, {
        note: bulkNote,
        finalLocationId: action === "accept_return" ? effectiveBulkReturnLocationId : undefined,
      });
      if (succeeded) {
        successCount += 1;
      }
    }

    if (successCount > 0) {
      setFeedback({
        tone: "success",
        message: `${successCount} queue item${successCount === 1 ? "" : "s"} processed with ${getActionLabel(action)}.`,
      });
      setSelectedQueueItemIds([]);
      setBulkNote("");
      await refreshWorkspace();
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
        <section className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="app-kicker">Approvals</div>
              <h1 className="page-title mt-2">Approvals</h1>
            </div>
            <div className="inline-flex items-center gap-2 text-sm text-primary/80">
              <Users size={15} />
              <span className="page-meta-item text-primary/80 normal-case tracking-normal">
                {workspace.source === "live" ? "Live data" : workspace.source === "mixed" ? "Mixed data" : "Fallback preview"}
              </span>
            </div>
          </div>

          <div className="page-meta-row">
            <span className="page-meta-item">
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
            <span className="page-meta-item">
              Selected: {validSelectedQueueItemIds.length}
            </span>
            <span className="page-meta-item">
              Visible: {filteredQueueItems.length} / {queueItems.length}
            </span>
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
                    replaceQueueRoute(tab.id, workspace.queues[tab.id][0]?.id ?? null);
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

            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
              <label className="space-y-2">
                <span className="font-mono text-xs uppercase tracking-[0.14em] text-primary/72">Search queue</span>
                <div className="matrix-field flex h-12 items-center gap-2 rounded-[1.15rem] px-4">
                  <Search size={16} className="text-primary/72" />
                  <input
                    value={queueQuery}
                    onChange={(event) => setQueueQuery(event.target.value)}
                    placeholder="Search by requester, summary, status, note..."
                    className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </label>

              <FilterSelect
                label="Status"
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as QueueStatusFilter)}
                options={["all", "pending", "awaiting", "review", "approved", "declined"]}
                getLabel={(value) => {
                  switch (value) {
                    case "pending":
                      return "Pending";
                    case "awaiting":
                      return "Awaiting";
                    case "review":
                      return "Under review";
                    case "approved":
                      return "Approved / accepted";
                    case "declined":
                      return "Declined / blocked";
                    default:
                      return "All statuses";
                  }
                }}
              />

              <div className="grid grid-cols-2 gap-2 rounded-[1.15rem] border border-primary/12 bg-card/35 p-3">
                <Metric label="Pending" value={queueStatusSummary.pending} />
                <Metric label="Awaiting" value={queueStatusSummary.awaiting} />
                <Metric label="Review" value={queueStatusSummary.review} />
                <Metric label="Actionable" value={queueStatusSummary.actionable} />
              </div>
            </div>
          </div>

          <div className="grid gap-0 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="border-b border-primary/12 xl:border-b-0 xl:border-r">
              <div className="p-4 sm:p-5">
                <div className="app-kicker">Queue list</div>
                <div className="mt-2 text-sm text-muted-foreground">Review the current queue and select items.</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={toggleAllVisibleQueueItems}
                    className="rounded-full border border-primary/18 bg-card/55 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary"
                  >
                    {filteredQueueItems.length > 0 && filteredQueueItems.every((item) => selectedQueueItemIds.includes(item.id)) ? "Clear Visible" : "Select Visible"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedQueueItemIds([])}
                    disabled={validSelectedQueueItemIds.length === 0}
                    className="rounded-full border border-primary/12 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Clear Selection
                  </button>
                  <span className="rounded-full border border-primary/12 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    {queueStatusSummary.visible} visible of {queueStatusSummary.total}
                  </span>
                </div>
                {availableBulkActions.length > 0 && (
                  <div className="mt-4 space-y-3 rounded-[1rem] border border-primary/12 bg-card/45 p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary/72">Bulk actions</div>
                    <textarea
                      value={bulkNote}
                      onChange={(event) => setBulkNote(event.target.value)}
                      placeholder="Shared bulk note for declines, request changes, reminders, or resolution context"
                      className="matrix-field min-h-24 w-full rounded-[1rem] px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                    {activeTab === "returns" && availableBulkActions.includes("accept_return") && (
                      <label className="space-y-2">
                        <span className="font-mono text-xs uppercase tracking-[0.14em] text-primary/72">Shared final sign-in location</span>
                        <div className="matrix-field rounded-[1rem] px-4">
                          <select
                            value={effectiveBulkReturnLocationId}
                            onChange={(event) => setBulkReturnLocationId(event.target.value)}
                            className="h-12 w-full bg-transparent text-sm text-foreground outline-none"
                          >
                            {workspace.locations.map((location) => (
                              <option key={location.id} value={location.id} className="bg-[hsl(var(--card))] text-foreground">
                                {location.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </label>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {availableBulkActions.map((action) => (
                        <button
                          key={`bulk-${action}`}
                          type="button"
                          onClick={() => void runBulkAction(action)}
                          disabled={busyAction !== null}
                          className={cn(
                            "rounded-[1rem] border px-4 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                            action.includes("decline") || action.includes("lost") || action === "resolve_damaged"
                              ? "border-destructive/20 bg-card/55 text-destructive hover:bg-destructive/10"
                              : "border-primary/18 bg-card/55 text-foreground hover:bg-primary/8 hover:text-primary",
                          )}
                        >
                          Bulk {getActionLabel(action)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">
                {filteredQueueItems.length === 0 ? (
                  <div className="rounded-[1.2rem] border border-dashed border-primary/14 px-4 py-12 text-center text-sm text-muted-foreground">
                    No queue items matched the current tab, scope, and filters.
                  </div>
                ) : (
                  filteredQueueItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => replaceQueueRoute(activeTab, item.id)}
                      className={cn("matrix-dashboard-bubble w-full p-4 text-left", selectedItem?.id === item.id && "border-primary/34")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="mb-2">
                            <span
                              className={cn(
                                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                                selectedQueueItemIds.includes(item.id)
                                  ? "border-primary/28 bg-primary/12 text-primary"
                                  : "border-primary/12 text-muted-foreground",
                              )}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleQueueItem(item.id);
                              }}
                            >
                              {selectedQueueItemIds.includes(item.id) ? "Selected" : "Select"}
                            </span>
                          </div>
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

                  {activeTab === "returns" && (
                    <label className="space-y-2">
                      <span className="font-mono text-xs uppercase tracking-[0.14em] text-primary/72">Final sign-in location</span>
                      <div className="matrix-field rounded-[1.15rem] px-4">
                        <select
                          value={selectedReturnLocationId}
                          onChange={(event) =>
                            selectedItem &&
                            setReturnLocationByItemId((current) => ({
                              ...current,
                              [selectedItem.id]: event.target.value,
                            }))
                          }
                          className="h-12 w-full bg-transparent text-sm text-foreground outline-none"
                        >
                          {workspace.locations.map((location) => (
                            <option key={location.id} value={location.id} className="bg-[hsl(var(--card))] text-foreground">
                              {location.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>
                  )}

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
                    <InlineNote icon={PackageCheck} text="Recipient queue supports reminders only." />
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

function FilterSelect({
  label,
  value,
  onChange,
  options,
  getLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  getLabel?: (value: string) => string;
}) {
  return (
    <label className="space-y-2">
      <span className="font-mono text-xs uppercase tracking-[0.14em] text-primary/72">{label}</span>
      <div className="matrix-field rounded-[1.15rem] px-4">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 w-full bg-transparent text-sm text-foreground outline-none"
        >
          {options.map((option) => (
            <option key={option} value={option} className="bg-[hsl(var(--card))] text-foreground">
              {getLabel ? getLabel(option) : option}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[1rem] border border-primary/12 bg-card/40 px-3 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-2xl text-foreground">{value}</div>
    </div>
  );
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
