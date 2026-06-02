"use client";

import { AlertTriangle, CheckCircle2, Clock3, History, MapPin, PackageCheck, RefreshCcw, RotateCcw, ShieldCheck, ShoppingBasket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import { useLocationScope } from "@/contexts/location-scope-context";
import { getAssetStatusLabel, getStatusBadgeClass, normalizeAssetStatus } from "@/lib/assets";
import {
  fallbackAssignedForReturn,
  fallbackRequestHistory,
  fallbackRequestableAssets,
  getRequestAssetHint,
  loadRequestsWorkspace,
  submitSpecialRequest,
  submitReturnRequest,
  submitAssetRequest,
  type RequestHistoryItem,
  type RequestsWorkspaceData,
} from "@/lib/requests";
import { matchesSearchQuery } from "@/lib/search";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { SectionShell } from "../layout";

const historyBadgeClass: Record<RequestHistoryItem["status"], string> = {
  Draft: "border-primary/35 bg-primary/12 text-primary",
  Pending: "border-amber-500/35 bg-amber-500/12 text-amber-300",
  Approved: "border-sky-500/35 bg-sky-500/12 text-sky-300",
  Declined: "border-rose-500/35 bg-rose-500/12 text-rose-300",
  Completed: "border-primary/35 bg-primary/12 text-primary",
};

const fallbackWorkspace: RequestsWorkspaceData = {
  requestableAssets: fallbackRequestableAssets,
  assignedForReturn: fallbackAssignedForReturn,
  requestHistory: fallbackRequestHistory,
  source: "fallback",
  warnings: ["Supabase is not configured yet, so Requests is using the rebuild preview dataset."],
};

type FeedbackState = {
  tone: "success" | "error" | "info";
  message: string;
};

export default function RequestsPage() {
  const { user, isAdmin, isStaff, isConfigured } = useAuth();
  const { activeLocationId, selectedLocationName, locations } = useLocationScope();
  const [activeTab, setActiveTab] = useState<"asset" | "special" | "returns" | "history">("asset");
  const [workspace, setWorkspace] = useState<RequestsWorkspaceData>(fallbackWorkspace);
  const [loading, setLoading] = useState(true);
  const [assetSearch, setAssetSearch] = useState("");
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [neededDate, setNeededDate] = useState("");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("");
  const [eventContext, setEventContext] = useState("");
  const [specialType, setSpecialType] = useState<"Stationed Use" | "Permanent Reassignment">("Stationed Use");
  const [selectedSpecialAssetId, setSelectedSpecialAssetId] = useState<string>("");
  const [selectedReturnIds, setSelectedReturnIds] = useState<string[]>([]);
  const [returnDate, setReturnDate] = useState("");
  const [preferredReturnLocationId, setPreferredReturnLocationId] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [submittingAssetRequest, setSubmittingAssetRequest] = useState(false);
  const [submittingSpecialRequest, setSubmittingSpecialRequest] = useState(false);
  const [submittingReturnRequest, setSubmittingReturnRequest] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const canUseRequests = isAdmin || isStaff;
  const resolvedSpecialAssetId = useMemo(() => {
    if (selectedSpecialAssetId && workspace.requestableAssets.some((asset) => asset.id === selectedSpecialAssetId)) {
      return selectedSpecialAssetId;
    }
    return workspace.requestableAssets[0]?.id ?? "";
  }, [selectedSpecialAssetId, workspace.requestableAssets]);

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
      const nextWorkspace = await loadRequestsWorkspace(supabase, user.id, activeLocationId);
      setWorkspace(nextWorkspace);
    } catch (error) {
      const message = error instanceof Error ? error.message : "We could not load Requests right now.";
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
        const nextWorkspace = await loadRequestsWorkspace(supabase, user.id, activeLocationId);
        if (!cancelled) {
          setWorkspace(nextWorkspace);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "We could not load Requests right now.";
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
  }, [activeLocationId, isConfigured, user]);

  const basketAssets = useMemo(
    () => workspace.requestableAssets.filter((asset) => selectedAssetIds.includes(asset.id)),
    [selectedAssetIds, workspace.requestableAssets],
  );

  const filteredAssets = useMemo(
    () =>
      workspace.requestableAssets.filter((asset) =>
        matchesSearchQuery(
          [asset.tag, asset.name, asset.serial, asset.location, asset.department, getAssetStatusLabel(asset.status)],
          assetSearch,
        ),
      ),
    [assetSearch, workspace.requestableAssets],
  );

  const selectedReturnAssets = useMemo(
    () => workspace.assignedForReturn.filter((asset) => selectedReturnIds.includes(asset.id)),
    [selectedReturnIds, workspace.assignedForReturn],
  );
  const resolvedPreferredReturnLocationId = preferredReturnLocationId || locations[0]?.id || "";

  const submitLiveAssetRequest = async () => {
    if (!activeLocationId) {
      setFeedback({ tone: "error", message: "Choose a specific location scope before submitting an asset request." });
      return;
    }

    if (selectedAssetIds.length === 0) {
      setFeedback({ tone: "error", message: "Add at least one asset to the request basket first." });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so live request submission is unavailable." });
      return;
    }

    setSubmittingAssetRequest(true);
    try {
      const { error } = await submitAssetRequest(supabase, {
        activeLocationId,
        selectedAssetIds,
        neededFor: eventContext,
        neededBy: neededDate,
        note: [reason.trim(), duration.trim()].filter(Boolean).join(" | "),
      });

      if (error) throw error;

      setSelectedAssetIds([]);
      setNeededDate("");
      setReason("");
      setDuration("");
      setEventContext("");
      setFeedback({ tone: "success", message: "Asset request submitted into the live request-bundle workflow." });
      setActiveTab("history");
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Asset request submission failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setSubmittingAssetRequest(false);
    }
  };

  const submitLiveReturnRequest = async () => {
    if (selectedReturnIds.length === 0) {
      setFeedback({ tone: "error", message: "Add at least one assigned asset to the return basket first." });
      return;
    }

    if (!resolvedPreferredReturnLocationId) {
      setFeedback({ tone: "error", message: "Choose a preferred return location first." });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so live return-request submission is unavailable." });
      return;
    }

    setSubmittingReturnRequest(true);
    try {
      const { error } = await submitReturnRequest(supabase, {
        activeLocationId,
        selectedAssetIds: selectedReturnIds,
        returnDate,
        preferredReturnLocationId: resolvedPreferredReturnLocationId,
        note: returnNote,
      });

      if (error) throw error;

      setSelectedReturnIds([]);
      setReturnDate("");
      setPreferredReturnLocationId("");
      setReturnNote("");
      setFeedback({ tone: "success", message: "Return request submitted into the live return workflow." });
      setActiveTab("history");
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Return request submission failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setSubmittingReturnRequest(false);
    }
  };

  const submitLiveSpecialRequest = async () => {
    if (!resolvedSpecialAssetId) {
      setFeedback({ tone: "error", message: "Choose a target asset for the special request first." });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so live special-request submission is unavailable." });
      return;
    }

    setSubmittingSpecialRequest(true);
    try {
      const { error } = await submitSpecialRequest(supabase, {
        activeLocationId,
        assetId: resolvedSpecialAssetId,
        requestType: specialType,
        neededBy: neededDate,
        duration,
        reason,
        eventContext,
      });

      if (error) throw error;

      setSelectedSpecialAssetId("");
      setNeededDate("");
      setDuration("");
      setReason("");
      setEventContext("");
      setFeedback({ tone: "success", message: `${specialType} submitted into the live special-request workflow.` });
      setActiveTab("history");
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Special request submission failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setSubmittingSpecialRequest(false);
    }
  };

  if (!canUseRequests) {
    return (
      <SectionShell title="Requests" kicker="Access restricted">
        <div className="app-panel p-5">
          <div className="app-kicker">Requests</div>
          <h1 className="app-title mt-2">This role does not create request workflows from the general request workspace.</h1>
          <p className="app-subtitle mt-3">
            Volunteer-style access remains centered on `My Assets` and incoming decisions, which matches the baseline.
          </p>
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell title="Requests" kicker="Asset + Special + Returns + History">
      <div className="space-y-4 sm:space-y-6">
        <section className="app-panel p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="app-kicker">Requests</div>
              <h1 className="app-title mt-2">Guided request workspace rebuilt around the baseline basket model.</h1>
              <p className="app-subtitle mt-3">
                `Asset`, `Special`, and `Returns` now load live data and submit into real workflows where the backend surface exists, while still degrading cleanly when one or more request surfaces are missing.
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-primary/18 bg-primary/8 px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/72">Current basket</div>
              <div className="mt-2 flex items-center gap-2 text-sm text-primary">
                <ShoppingBasket size={15} />
                {basketAssets.length} asset item{basketAssets.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <DataSourceBadge source={workspace.source} />
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
              <TabButton active={activeTab === "asset"} onClick={() => setActiveTab("asset")} label="Asset" />
              <TabButton active={activeTab === "special"} onClick={() => setActiveTab("special")} label="Special" />
              <TabButton active={activeTab === "returns"} onClick={() => setActiveTab("returns")} label="Returns" />
              <TabButton active={activeTab === "history"} onClick={() => setActiveTab("history")} label="History" />
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {activeTab === "asset" && (
              <div className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                  <div className="space-y-4">
                    <StepCard
                      step="Step 1"
                      title="Browse and build one shared asset basket"
                      body="This pass now loads real requestable assets from the live inventory shape, filtered by the currently selected location scope when one is locked or selected."
                    />

                    <div className="matrix-field flex h-12 items-center gap-2 rounded-[1.15rem] px-4">
                      <PackageCheck size={16} className="text-primary/72" />
                      <input
                        value={assetSearch}
                        onChange={(event) => setAssetSearch(event.target.value)}
                        placeholder="Search by tag, name, serial, location, department..."
                        className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                      />
                    </div>

                    <div className="grid gap-3">
                      {filteredAssets.map((asset) => {
                        const normalizedStatus = normalizeAssetStatus(asset.status);
                        const selected = selectedAssetIds.includes(asset.id);
                        return (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() =>
                              setSelectedAssetIds((current) =>
                                current.includes(asset.id) ? current.filter((id) => id !== asset.id) : [...current, asset.id],
                              )
                            }
                            className={cn("matrix-dashboard-bubble p-4 text-left", selected && "border-primary/34")}
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="font-mono text-sm uppercase tracking-[0.14em] text-primary">{asset.tag}</div>
                                <div className="mt-1 font-display text-xl text-foreground glow-soft">{asset.name}</div>
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                  <span>{asset.serial}</span>
                                  <span>{asset.location}</span>
                                  <span>{asset.department}</span>
                                </div>
                                <div className="mt-2 text-xs text-muted-foreground">{getRequestAssetHint(asset.status)}</div>
                              </div>
                              <span
                                className={cn(
                                  "inline-flex w-fit rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                                  getStatusBadgeClass(normalizedStatus),
                                )}
                              >
                                {getAssetStatusLabel(normalizedStatus)}
                              </span>
                            </div>
                          </button>
                        );
                      })}

                      {filteredAssets.length === 0 && (
                        <div className="rounded-[1rem] border border-dashed border-primary/14 px-4 py-8 text-center text-sm text-muted-foreground">
                          No requestable assets found for the current scope.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <StepCard
                      step="Step 2"
                      title="Shared basket details and live submit"
                      body="This tab now submits into the live grouped request-bundle workflow. The fields still follow the v2 structure even where the underlying RPC is simpler."
                    />

                    <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 p-4">
                      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary/72">Selected units</div>
                      <div className="mt-3 space-y-2">
                        {basketAssets.length === 0 ? (
                          <div className="rounded-[1rem] border border-dashed border-primary/14 px-4 py-8 text-center text-sm text-muted-foreground">
                            No physical units added yet.
                          </div>
                        ) : (
                          basketAssets.map((asset) => (
                            <div key={asset.id} className="rounded-[1rem] border border-primary/12 bg-card/35 px-3 py-3">
                              <div className="font-mono text-xs uppercase tracking-[0.14em] text-primary">{asset.tag}</div>
                              <div className="mt-1 text-sm text-foreground">{asset.name}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <FormField label="Need Date" placeholder="Choose date and time" value={neededDate} onChange={setNeededDate} />
                    <FormField label="Reason" placeholder="Why is this needed?" value={reason} onChange={setReason} />
                    <FormField label="Duration" placeholder="How long is it needed?" value={duration} onChange={setDuration} />
                    <FormField label="Event / Use Context" placeholder="Sunday service, conference, rehearsal..." value={eventContext} onChange={setEventContext} multiline />

                    <button
                      type="button"
                      onClick={() => void submitLiveAssetRequest()}
                      disabled={submittingAssetRequest || selectedAssetIds.length === 0 || !activeLocationId}
                      className="matrix-button inline-flex h-12 w-full items-center justify-center gap-2 rounded-[1.15rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CheckCircle2 size={16} />
                      {submittingAssetRequest ? "Submitting" : `Submit Asset Request${selectedAssetIds.length > 0 ? ` (${selectedAssetIds.length})` : ""}`}
                    </button>

                    <div className="rounded-[1.2rem] border border-primary/18 bg-primary/8 px-4 py-3 text-sm text-primary/90">
                      Draft autosave, resume/discard, and one-active-draft-per-workflow behavior still remain to be added on top of the live request-bundle path.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "special" && (
              <div className="space-y-4">
                <StepCard
                  step="Step 1"
                  title="Choose special request type and target asset"
                  body="Choose the workflow type, select the target asset, and submit into the live special-request flow where the compatible backend surface exists."
                />

                <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  <div className="space-y-4">
                    <SelectCard
                      label="Request type"
                      value={specialType}
                      options={["Stationed Use", "Permanent Reassignment"]}
                      onSelect={(value) => setSpecialType(value as "Stationed Use" | "Permanent Reassignment")}
                    />

                    <SelectCard
                      label="Target asset"
                      value={resolvedSpecialAssetId}
                      options={workspace.requestableAssets.map((asset) => ({ label: `${asset.tag} · ${asset.name}`, value: asset.id }))}
                      onSelect={setSelectedSpecialAssetId}
                    />
                  </div>

                  <div className="app-panel p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary/72">Dynamic form preview</div>
                    <div className="mt-3 font-display text-2xl text-foreground glow-soft">{specialType}</div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <FormField label="Need Date" placeholder="Choose date and time" value={neededDate} onChange={setNeededDate} />
                      <FormField label="Duration" placeholder="Temporary use period" value={duration} onChange={setDuration} />
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <FormField label="Reason" placeholder="Why this special request is needed" value={reason} onChange={setReason} />
                      <FormField label="Event / Use Context" placeholder="Where and how it will be used" value={eventContext} onChange={setEventContext} />
                    </div>
                    <button
                      type="button"
                      onClick={() => void submitLiveSpecialRequest()}
                      disabled={submittingSpecialRequest || !resolvedSpecialAssetId}
                      className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[1rem] border border-primary/18 bg-card/55 px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ShieldCheck size={15} />
                      {submittingSpecialRequest ? "Submitting Special Request" : `Submit ${specialType}`}
                    </button>
                    <div className="mt-3 rounded-[1rem] border border-sky-500/18 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">
                      Submitted special requests continue through Approvals &gt; Special Requests, where managers/admins resolve stationed-use and permanent-reassignment decisions.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "returns" && (
              <div className="space-y-4">
                <StepCard
                  step="Step 1"
                  title="Build one shared return request"
                  body="Assigned assets for return selection now load live from your current holdings, and the shared return-request submit path now creates the live workflow where the backend surface exists."
                />

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                  <div className="space-y-3">
                    {workspace.assignedForReturn.map((asset) => {
                      const selected = selectedReturnIds.includes(asset.id);
                      return (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() =>
                            setSelectedReturnIds((current) =>
                              current.includes(asset.id) ? current.filter((id) => id !== asset.id) : [...current, asset.id],
                            )
                          }
                          className={cn("matrix-dashboard-bubble w-full p-4 text-left", selected && "border-primary/34")}
                        >
                          <div className="font-mono text-sm uppercase tracking-[0.14em] text-primary">{asset.tag}</div>
                          <div className="mt-1 font-display text-xl text-foreground glow-soft">{asset.name}</div>
                          <div className="mt-2 text-sm text-muted-foreground">{[asset.serial, asset.location].join(" | ")}</div>
                        </button>
                      );
                    })}

                    {workspace.assignedForReturn.length === 0 && (
                      <div className="rounded-[1rem] border border-dashed border-primary/14 px-4 py-8 text-center text-sm text-muted-foreground">
                        No assigned assets available for return selection.
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 p-4">
                      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary/72">Shared return basket</div>
                      <div className="mt-3 text-sm text-foreground">{selectedReturnAssets.length} asset item{selectedReturnAssets.length === 1 ? "" : "s"} selected</div>
                    </div>

                    <FormField label="Return Date" placeholder="Choose return date" value={returnDate} onChange={setReturnDate} />
                    <SelectCard
                      label="Preferred Return Location"
                      value={resolvedPreferredReturnLocationId}
                      options={locations.map((location) => ({ label: location.name, value: location.id }))}
                      onSelect={setPreferredReturnLocationId}
                    />
                    <FormField label="Note" placeholder="Return note for the receiving team" value={returnNote} onChange={setReturnNote} multiline />

                    <button
                      type="button"
                      onClick={() => void submitLiveReturnRequest()}
                      disabled={submittingReturnRequest || selectedReturnIds.length === 0 || !resolvedPreferredReturnLocationId}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[1rem] border border-primary/18 bg-card/55 px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RotateCcw size={15} />
                      {submittingReturnRequest ? "Submitting Return Request" : `Submit Return Request${selectedReturnIds.length > 0 ? ` (${selectedReturnIds.length})` : ""}`}
                    </button>

                    <div className="rounded-[1.2rem] border border-sky-500/18 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">
                      This submit path creates the return workflow. Approvals &gt; Returns remains the terminal acceptance surface where the approver confirms the receiving path.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "history" && (
              <div className="space-y-4">
                {workspace.requestHistory.map((item) => (
                  <div key={item.id} className="app-panel p-4 sm:p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                              item.type === "asset"
                                ? "border-primary/25 bg-primary/10 text-primary"
                                : item.type === "special"
                                  ? "border-violet-500/28 bg-violet-500/12 text-violet-300"
                                  : "border-sky-500/28 bg-sky-500/12 text-sky-300",
                            )}
                          >
                            {item.type === "asset" ? <PackageCheck size={13} /> : item.type === "special" ? <ShieldCheck size={13} /> : <RotateCcw size={13} />}
                            {item.type}
                          </span>
                          <span className={cn("inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]", historyBadgeClass[item.status])}>
                            {item.status}
                          </span>
                        </div>
                        <div className="mt-3 font-display text-2xl text-foreground glow-soft">{item.title}</div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin size={14} />
                            {item.location}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 size={14} />
                            {item.date}
                          </span>
                        </div>
                        <div className="mt-3 rounded-[1rem] border border-primary/10 bg-card/40 px-4 py-3 text-sm text-muted-foreground">
                          {item.note}
                        </div>
                      </div>
                      <div className="rounded-[1rem] border border-primary/12 bg-card/35 px-4 py-3 text-sm text-muted-foreground">
                        Drafts remain user-only and do not enter manager/admin queues until submitted.
                      </div>
                    </div>
                  </div>
                ))}

                {workspace.requestHistory.length === 0 && (
                  <div className="rounded-[1rem] border border-dashed border-primary/14 px-4 py-10 text-center text-sm text-muted-foreground">
                    No request history found yet.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </SectionShell>
  );
}

function DataSourceBadge({ source }: { source: RequestsWorkspaceData["source"] }) {
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
      <ShoppingBasket size={13} />
      {label}
    </span>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
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
      {label === "Asset" ? <PackageCheck size={15} /> : label === "Special" ? <ShieldCheck size={15} /> : label === "Returns" ? <RotateCcw size={15} /> : <History size={15} />}
      <span>{label}</span>
    </button>
  );
}

function StepCard({
  step,
  title,
  body,
}: {
  step: string;
  title: string;
  body: string;
}) {
  return (
    <div className="app-panel p-4">
      <div className="app-kicker">{step}</div>
      <div className="mt-2 font-display text-2xl text-foreground glow-soft">{title}</div>
      <p className="mt-3 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function FormField({
  label,
  placeholder,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="space-y-2">
      <span className="font-mono text-xs uppercase tracking-[0.14em] text-primary/72">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="matrix-field min-h-28 w-full rounded-[1.15rem] px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="matrix-field h-12 w-full rounded-[1.15rem] px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      )}
    </label>
  );
}

function SelectCard({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: string[] | Array<{ label: string; value: string }>;
  onSelect: (value: string) => void;
}) {
  const normalizedOptions = options.map((option) => (typeof option === "string" ? { label: option, value: option } : option));
  return (
    <label className="space-y-2">
      <span className="font-mono text-xs uppercase tracking-[0.14em] text-primary/72">{label}</span>
      <div className="matrix-field rounded-[1.15rem] px-4">
        <select value={value} onChange={(event) => onSelect(event.target.value)} className="h-12 w-full bg-transparent text-sm text-foreground outline-none">
          {normalizedOptions.map((option) => (
            <option key={option.value} value={option.value} className="bg-[hsl(var(--card))] text-foreground">
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}
