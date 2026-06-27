"use client";

import { AlertTriangle, ArrowLeftRight, CheckCircle2, PackageCheck, RefreshCcw, RotateCcw, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/components/toast";
import { getAssetStatusLabel, getStatusBadgeClass, normalizeAssetStatus } from "@/lib/assets";
import {
  fallbackAssignedAssets,
  fallbackDamageRecords,
  fallbackPendingItems,
  loadHandoverRecipients,
  loadMyAssetsWorkspace,
  submitDamageReport,
  submitHandoverRequest,
  type AssignedAsset,
  type DamageRecord,
  type HandoverRecipient,
  type MyAssetsWorkspaceData,
  type PendingItem,
} from "@/lib/my-assets";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { WorkspaceLoader } from "@/components/workspace-loader";

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

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function isMyAssetsTab(value: string | null): value is "assigned" | "pending" | "damage" {
  return value === "assigned" || value === "pending" || value === "damage";
}

export default function MyAssetsPage() {
  const { damageLockCase, isConfigured, isDamageLocked, retryAccessLoad, user } = useAuth();
  const { pushToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedTabValue = searchParams.get("tab");
  const requestedTab: "assigned" | "pending" | "damage" | null = isMyAssetsTab(requestedTabValue) ? requestedTabValue : null;
  const [tabState, setTabState] = useState<"assigned" | "pending" | "damage">(requestedTab ?? "assigned");
  const activeTab = tabState;
  const [workspace, setWorkspace] = useState<MyAssetsWorkspaceData>(() => ({
    ...fallbackWorkspace,
    warnings: [],
  }));
  const [loading, setLoading] = useState(true);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  useEffect(() => {
    if (!loading && !workspaceReady) setWorkspaceReady(true);
  }, [loading, workspaceReady]);
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);
  const [busyPendingIds, setBusyPendingIds] = useState<string[]>([]);
  const [declineReason, setDeclineReason] = useState("");
  const [handoverAsset, setHandoverAsset] = useState<AssignedAsset | null>(null);
  const [handoverRecipients, setHandoverRecipients] = useState<HandoverRecipient[]>([]);
  const [selectedHandoverRecipientId, setSelectedHandoverRecipientId] = useState("");
  const [handoverNote, setHandoverNote] = useState("");
  const [loadingHandoverRecipients, setLoadingHandoverRecipients] = useState(false);
  const [submittingHandover, setSubmittingHandover] = useState(false);
  const [damageAssetId, setDamageAssetId] = useState("");
  const [damageType, setDamageType] = useState("Physical damage");
  const [damageDescription, setDamageDescription] = useState("");
  const [submittingDamage, setSubmittingDamage] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  useEffect(() => {
    if (!feedback) return;
    pushToast({
      tone: feedback.tone,
      title: feedback.tone === "error" ? "Error" : feedback.tone === "success" ? "Success" : "Info",
      message: feedback.message,
    });
  }, [feedback, pushToast]);

  useEffect(() => {
    if (workspace.pendingItems.length === 0) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [workspace.pendingItems.length]);
  const validSelectedPendingIds = useMemo(
    () => selectedPendingIds.filter((id) => workspace.pendingItems.some((item) => item.id === id)),
    [selectedPendingIds, workspace.pendingItems],
  );
  const damageAssetOptions = useMemo(
    () => workspace.assignedAssets.filter((asset) => normalizeAssetStatus(asset.status) !== "damaged"),
    [workspace.assignedAssets],
  );
  const selectedDamageAssetId =
    (damageAssetId && damageAssetOptions.some((asset) => asset.id === damageAssetId) ? damageAssetId : "") || damageAssetOptions[0]?.id || "";

  const summary = useMemo(
    () => ({
      assigned: workspace.assignedAssets.length,
      pending: workspace.pendingItems.length,
      damage: workspace.damageRecords.length + (damageLockCase ? 1 : 0),
    }),
    [damageLockCase, workspace],
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

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", activeTab);
    const nextQuery = nextParams.toString();
    if (nextQuery !== searchParams.toString()) {
      router.replace(`${pathname}?${nextQuery}`, { scroll: false });
    }
  }, [activeTab, pathname, router, searchParams]);

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

    if (!accept && !declineReason.trim()) {
      setFeedback({
        tone: "error",
        message: "Decline reason is required before rejecting a pending item.",
      });
      return false;
    }

    setBusyPendingIds((current) => [...current, item.id]);
    try {
      if (item.type === "assignment") {
        const { error } = await supabase.rpc(accept ? "approve_recipient_signout_approval" : "decline_recipient_signout_approval", {
          target_approval_id: item.id,
          ...(accept ? {} : { decline_notes: declineReason.trim() }),
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
      if (!accept) {
        setDeclineReason("");
      }
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
    if (action === "Request Return") {
      router.push(`/requests?tab=returns&assetId=${encodeURIComponent(asset.id)}`);
      return;
    }

    if (action === "Request Handover") {
      if (!user) {
        setFeedback({ tone: "error", message: "You must be signed in to request a handover." });
        return;
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setFeedback({ tone: "error", message: "Supabase is not configured yet, so handover requests are unavailable." });
        return;
      }

      setHandoverAsset(asset);
      setSelectedHandoverRecipientId("");
      setHandoverNote("");
      setLoadingHandoverRecipients(true);
      void loadHandoverRecipients(supabase, user.id)
        .then((rows) => setHandoverRecipients(rows))
        .catch((error) => {
          const message = error instanceof Error ? error.message : "Handover recipients could not be loaded.";
          setFeedback({ tone: "error", message });
          setHandoverRecipients([]);
        })
        .finally(() => setLoadingHandoverRecipients(false));
      return;
    }

    if (action === "Report Damage") {
      setTabState("damage");
      setDamageAssetId(asset.id);
      setDamageType("Physical damage");
      setDamageDescription("");
      setFeedback({
        tone: "info",
        message: `Damage reporting opened for ${asset.tag}. Submit the incident here to move it into review.`,
      });
      return;
    }

    setFeedback({
      tone: "info",
      message: `${action} for ${asset.tag} is the next live form to wire. The assigned and pending data are now connected first.`,
    });
  };

  const submitHandover = async () => {
    if (!user || !handoverAsset) {
      setFeedback({ tone: "error", message: "Choose an assigned asset first." });
      return;
    }
    if (!selectedHandoverRecipientId) {
      setFeedback({ tone: "error", message: "Choose the receiving user first." });
      return;
    }
    if (!handoverNote.trim()) {
      setFeedback({ tone: "error", message: "Handover note is required." });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so handover requests are unavailable." });
      return;
    }

    setSubmittingHandover(true);
    try {
      await submitHandoverRequest(supabase, {
        fromUserId: user.id,
        toUserId: selectedHandoverRecipientId,
        assetIds: [handoverAsset.id],
        notes: handoverNote,
      });
      setFeedback({ tone: "success", message: `Handover request sent for ${handoverAsset.tag}.` });
      setHandoverAsset(null);
      setSelectedHandoverRecipientId("");
      setHandoverNote("");
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Handover request failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setSubmittingHandover(false);
    }
  };

  const submitDamage = async () => {
    if (!user) {
      setFeedback({ tone: "error", message: "You must be signed in to submit a damage report." });
      return;
    }
    if (isDamageLocked) {
      setFeedback({ tone: "info", message: "An active damage lock already exists for this account. Continue in the dedicated damage workflow." });
      return;
    }

    const selectedDamageAsset = workspace.assignedAssets.find((asset) => asset.id === selectedDamageAssetId);
    if (!selectedDamageAsset) {
      setFeedback({ tone: "error", message: "Choose the affected asset first." });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so damage reporting is unavailable." });
      return;
    }

    setSubmittingDamage(true);
    try {
      const result = await submitDamageReport(supabase, {
        userId: user.id,
        assetId: selectedDamageAsset.id,
        assetTag: selectedDamageAsset.tag,
        assetName: selectedDamageAsset.name,
        damageType,
        description: damageDescription,
      });

      setFeedback({
        tone: "success",
        message:
          result.target === "damage_cases"
            ? `Damage report submitted for ${selectedDamageAsset.tag}. The account lock workflow will refresh now.`
            : `Damage report submitted for ${selectedDamageAsset.tag}. The legacy damage queue recorded the incident.`,
      });
      setDamageType("Physical damage");
      setDamageDescription("");
      await retryAccessLoad();
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Damage report submission failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setSubmittingDamage(false);
    }
  };

  if (!workspaceReady) {
    return <WorkspaceLoader subtitle="Loading your assets" />;
  }

  return (
    <SectionShell title="My Assets" kicker="Assigned + Pending + Damage">
      {workspace.pendingItems.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 px-4 py-6 backdrop-blur-xl">
          <div className="w-full max-w-5xl rounded-[2rem] border border-primary/20 bg-[hsl(var(--background))]/98 p-4 shadow-[var(--shadow-strong)] sm:p-6">
            <div className="flex flex-col gap-3 border-b border-primary/12 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="app-kicker">Pending approvals</div>
                <h2 className="mt-2 font-display text-3xl text-foreground glow-soft">Confirm incoming sign-outs</h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  These requests are blocking until you approve or decline them. You can review each incoming sign-out here before continuing.
                </p>
              </div>
              <div className="rounded-full border border-primary/12 bg-card/45 px-3 py-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                {workspace.pendingItems.length} pending
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
              <div className="space-y-3">
                <label className="space-y-2">
                  <span className="font-mono text-xs uppercase tracking-[0.14em] text-primary/72">Shared decline reason</span>
                  <textarea
                    value={declineReason}
                    onChange={(event) => setDeclineReason(event.target.value)}
                    placeholder="Required if you decline any pending approval."
                    className="matrix-field min-h-24 w-full rounded-[1.15rem] px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </label>
                <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 px-4 py-3 text-sm text-muted-foreground">
                  Approving a sign-out immediately finalizes the incoming item. Declining returns the asset to the sender and requires the shared reason.
                </div>
              </div>

              <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
                {workspace.pendingItems.map((item) => {
                  const busy = busyPendingIds.includes(item.id);
                  return (
                    <div key={`modal-${item.id}`} className={cn("rounded-[1.35rem] border border-primary/12 bg-card/35 p-4", busy && "opacity-75")}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                                item.type === "assignment"
                                  ? "border-sky-500/35 bg-sky-500/12 text-sky-300"
                                  : "border-violet-500/35 bg-violet-500/12 text-violet-300",
                              )}
                            >
                              {item.type === "assignment" ? <PackageCheck size={13} /> : <ArrowLeftRight size={13} />}
                              {item.type === "assignment" ? "Incoming sign-out" : "Incoming handover"}
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
                            disabled={busy || (item.type === "assignment" && !declineReason.trim())}
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
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-4 sm:space-y-6">
        <section className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="app-kicker">My Assets</div>
              <h1 className="page-title mt-2">My Assets</h1>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-[18rem]">
              <SummaryCard label="Assigned" value={summary.assigned} />
              <SummaryCard label="Pending" value={summary.pending} />
              <SummaryCard label="Damage" value={summary.damage} />
            </div>
          </div>

          <div className="page-meta-row">
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
              <TabButton active={activeTab === "assigned"} onClick={() => setTabState("assigned")} label="Assigned" count={summary.assigned} />
              <TabButton active={activeTab === "pending"} onClick={() => setTabState("pending")} label="Pending" count={summary.pending} />
              <TabButton active={activeTab === "damage"} onClick={() => setTabState("damage")} label="Damage" count={summary.damage} />
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {activeTab === "assigned" && (
              <div className="space-y-4">
                {handoverAsset && (
                  <div className="app-panel p-4 sm:p-5">
                    <div className="app-kicker">Handover request</div>
                    <div className="mt-2 font-display text-2xl text-foreground glow-soft">{handoverAsset.tag} | {handoverAsset.name}</div>
                    <div className="mt-3 text-sm text-muted-foreground">
                      Pending handover keeps the asset assigned while the recipient decides. Use this to transfer responsibility without leaving `My Assets`.
                    </div>
                    <div className="mt-4 space-y-3">
                      <label className="space-y-2">
                        <span className="font-mono text-xs uppercase tracking-[0.14em] text-primary/72">Receiving user</span>
                        <div className="matrix-field rounded-[1.35rem] px-4">
                          <select
                            value={selectedHandoverRecipientId}
                            onChange={(event) => setSelectedHandoverRecipientId(event.target.value)}
                            className="h-11 w-full bg-transparent text-sm text-foreground outline-none"
                            disabled={loadingHandoverRecipients || submittingHandover}
                          >
                            <option value="" className="bg-[hsl(var(--card))] text-foreground">
                              {loadingHandoverRecipients ? "Loading recipients..." : "Choose recipient"}
                            </option>
                            {handoverRecipients.map((recipient) => (
                            <option key={recipient.id} value={recipient.id} className="bg-[hsl(var(--card))] text-foreground">
                                {recipient.fullName} | {recipient.homeBase ?? "Unassigned"} | {recipient.role}
                            </option>
                          ))}
                          </select>
                        </div>
                      </label>
                      <label className="space-y-2">
                        <span className="font-mono text-xs uppercase tracking-[0.14em] text-primary/72">Handover note</span>
                        <textarea
                          value={handoverNote}
                          onChange={(event) => setHandoverNote(event.target.value)}
                          placeholder="Explain why this handover is needed and any context the recipient should see."
                          className="matrix-field min-h-28 w-full rounded-[1.15rem] px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void submitHandover()}
                          disabled={submittingHandover || loadingHandoverRecipients || !selectedHandoverRecipientId || !handoverNote.trim()}
                          className="matrix-button inline-flex h-11 items-center justify-center gap-2 rounded-[1rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <ArrowLeftRight size={15} />
                          {submittingHandover ? "Sending Handover" : "Send Handover Request"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setHandoverAsset(null)}
                          disabled={submittingHandover}
                          className="inline-flex h-11 items-center justify-center rounded-[1rem] border border-primary/18 bg-card/55 px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

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

              </div>
            )}

            {activeTab === "pending" && (
              <div className="space-y-4">
                <label className="space-y-2">
                  <span className="font-mono text-xs uppercase tracking-[0.14em] text-primary/72">Shared decline reason</span>
                  <textarea
                    value={declineReason}
                    onChange={(event) => setDeclineReason(event.target.value)}
                    placeholder="Required for decline actions. Bulk decline uses one shared reason."
                    className="matrix-field min-h-24 w-full rounded-[1.15rem] px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </label>

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
                    disabled={validSelectedPendingIds.length === 0 || busyPendingIds.length > 0 || !declineReason.trim()}
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
                            disabled={busy || !declineReason.trim()}
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
                {damageLockCase && (
                  <div className="app-panel p-4 sm:p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm uppercase tracking-[0.14em] text-primary">{damageLockCase.assetTag}</span>
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                              isDamageLocked
                                ? "border-destructive/30 bg-destructive/10 text-destructive"
                                : "border-amber-500/30 bg-amber-500/10 text-amber-300",
                            )}
                          >
                            {damageLockCase.status}
                          </span>
                        </div>
                        <div className="mt-2 font-display text-2xl text-foreground glow-soft">{damageLockCase.assetName}</div>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span>Location: {damageLockCase.locationName ?? "Unknown location"}</span>
                          <span>Opened: {formatDateTime(damageLockCase.openedAt)}</span>
                        </div>
                        <div className="mt-3 rounded-[1rem] border border-destructive/18 bg-destructive/8 px-4 py-3 text-sm text-muted-foreground">
                          {isDamageLocked
                            ? "This incident is actively blocking normal workflows until you submit the required damage statement."
                            : "This incident is still active and should be completed through the dedicated damage workflow."}
                        </div>
                      </div>

                      <div className="grid gap-2 sm:min-w-[15rem]">
                        <button
                          type="button"
                          onClick={() => router.push("/damage-lock")}
                          className="matrix-button inline-flex h-11 items-center justify-center gap-2 rounded-[1rem] px-4 text-sm font-semibold uppercase tracking-[0.14em]"
                        >
                          <ShieldAlert size={15} />
                          {isDamageLocked ? "Open Damage Form" : "Open Damage Workflow"}
                        </button>
                        <div className="text-sm text-muted-foreground">Historical incidents stay below.</div>
                      </div>
                    </div>
                  </div>
                )}

                {!isDamageLocked && (
                  <div className="app-panel p-4 sm:p-5">
                    <div className="app-kicker">Damage report</div>
                    <div className="mt-2 font-display text-2xl text-foreground glow-soft">Start a new incident from My Assets</div>
                    <div className="mt-3 text-sm text-muted-foreground">Submit the affected asset, incident type, and statement.</div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <label className="space-y-2">
                        <span className="font-mono text-xs uppercase tracking-[0.14em] text-primary/72">Affected asset</span>
                        <div className="matrix-field rounded-[1.35rem] px-4">
                          <select
                            value={selectedDamageAssetId}
                            onChange={(event) => setDamageAssetId(event.target.value)}
                            className="h-11 w-full bg-transparent text-sm text-foreground outline-none"
                            disabled={submittingDamage || damageAssetOptions.length === 0}
                          >
                            <option value="" className="bg-[hsl(var(--card))] text-foreground">
                              {damageAssetOptions.length === 0 ? "No assigned assets available" : "Choose assigned asset"}
                            </option>
                            {damageAssetOptions.map((asset) => (
                              <option key={asset.id} value={asset.id} className="bg-[hsl(var(--card))] text-foreground">
                                {asset.tag} | {asset.name} | {asset.location}
                              </option>
                            ))}
                          </select>
                        </div>
                      </label>

                      <label className="space-y-2">
                        <span className="font-mono text-xs uppercase tracking-[0.14em] text-primary/72">Damage type</span>
                        <div className="matrix-field rounded-[1.35rem] px-4">
                          <select
                            value={damageType}
                            onChange={(event) => setDamageType(event.target.value)}
                            className="h-11 w-full bg-transparent text-sm text-foreground outline-none"
                            disabled={submittingDamage}
                          >
                            {["Physical damage", "Missing parts", "Functional fault", "Loss / theft", "Other"].map((option) => (
                              <option key={option} value={option} className="bg-[hsl(var(--card))] text-foreground">
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                      </label>
                    </div>

                    <label className="mt-3 block space-y-2">
                      <span className="font-mono text-xs uppercase tracking-[0.14em] text-primary/72">Incident statement</span>
                      <textarea
                        value={damageDescription}
                        onChange={(event) => setDamageDescription(event.target.value)}
                        placeholder="Describe what happened, the current condition, and any immediate operational risk."
                        className="matrix-field min-h-32 w-full rounded-[1.15rem] px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                        disabled={submittingDamage}
                      />
                    </label>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void submitDamage()}
                        disabled={submittingDamage || !selectedDamageAssetId || !damageDescription.trim()}
                        className="matrix-button inline-flex h-11 items-center justify-center gap-2 rounded-[1rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <ShieldAlert size={15} />
                        {submittingDamage ? "Submitting Damage" : "Submit Damage Report"}
                      </button>
                      <div className="text-sm text-muted-foreground">The damage-lock workflow opens automatically when required.</div>
                    </div>
                  </div>
                )}

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
                  <EmptyState title="No damage history" body="Resolved or reviewed incidents will appear here." />
                )}

                <div className="text-sm text-muted-foreground">Active damage locks route through the dedicated form flow.</div>
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
        "inline-flex items-center gap-2 text-sm",
        source === "live" && "text-primary/80",
        source === "mixed" && "text-amber-200",
        source === "fallback" && "text-sky-200",
      )}
    >
      <RotateCcw size={13} />
      <span className="page-meta-item normal-case tracking-normal" style={{ color: "inherit" }}>{label}</span>
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
    <div className="rounded-[0.9rem] border border-primary/10 bg-card/30 px-3 py-2 text-center">
      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl text-foreground">{value}</div>
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
