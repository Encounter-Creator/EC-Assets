"use client";

import { AlertTriangle, CheckCircle2, Clock3, History, MapPin, PackageCheck, RefreshCcw, RotateCcw, ShieldCheck, ShoppingBasket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/contexts/auth-context";
import { useLocationScope } from "@/contexts/location-scope-context";
import { useToast } from "@/components/toast";
import { getAssetStatusLabel, getStatusBadgeClass, normalizeAssetStatus } from "@/lib/assets";
import {
  fallbackAssignedForReturn,
  fallbackRequestHistory,
  fallbackRequestableAssets,
  getSpecialRequestAssetHint,
  getRequestAssetHint,
  isSpecialRequestAssetCompatible,
  loadRequestsWorkspace,
  submitSpecialRequest,
  submitReturnRequest,
  submitAssetRequest,
  type RequestHistoryItem,
  type RequestsWorkspaceData,
  type SpecialRequestType,
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

type RequestDraftTab = "asset" | "special" | "returns";

type AssetRequestDraft = {
  assetSearch: string;
  selectedAssetIds: string[];
  sourceLocationId: string;
  neededDate: string;
  reason: string;
  duration: string;
  eventContext: string;
};

type SpecialRequestDraft = {
  specialType: SpecialRequestType;
  selectedSpecialAssetId: string;
  sourceLocationId: string;
  neededDate: string;
  reason: string;
  duration: string;
  eventContext: string;
};

type ReturnRequestDraft = {
  selectedReturnIds: string[];
  sourceLocationId: string;
  returnDate: string;
  preferredReturnLocationId: string;
  returnNote: string;
};

function isPastDateInput(value: string) {
  if (!value.trim()) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() < Date.now();
}

function getDraftStorageKey(userId: string, tab: RequestDraftTab) {
  return `assets-requests-draft:${userId}:${tab}`;
}

function readDraft<T>(userId: string, tab: RequestDraftTab): T | null {
  const raw = window.localStorage.getItem(getDraftStorageKey(userId, tab));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    window.localStorage.removeItem(getDraftStorageKey(userId, tab));
    return null;
  }
}

function writeDraft<T>(userId: string, tab: RequestDraftTab, value: T) {
  window.localStorage.setItem(getDraftStorageKey(userId, tab), JSON.stringify(value));
}

function clearDraft(userId: string, tab: RequestDraftTab) {
  window.localStorage.removeItem(getDraftStorageKey(userId, tab));
}

export default function RequestsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const requestedAssetId = searchParams.get("assetId");
  const { user, isAdmin, isAssetManager, isStaff, isConfigured } = useAuth();
  const { activeLocationId, selectedLocationName, locations } = useLocationScope();
  const { pushToast } = useToast();
  const activeTab: "asset" | "special" | "returns" | "history" =
    requestedTab === "returns" ? "returns" : requestedTab === "special" ? "special" : requestedTab === "history" ? "history" : "asset";
  const scopedActiveLocationId = activeLocationId === "unassigned" ? null : activeLocationId;
  const [workspace, setWorkspace] = useState<RequestsWorkspaceData>(() => ({
    ...fallbackWorkspace,
    warnings: [],
  }));
  const [loading, setLoading] = useState(true);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  useEffect(() => {
    if (!loading && !workspaceReady) setWorkspaceReady(true);
  }, [loading, workspaceReady]);
  const [assetSearch, setAssetSearch] = useState("");
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [neededDate, setNeededDate] = useState("");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("");
  const [eventContext, setEventContext] = useState("");
  const [specialType, setSpecialType] = useState<SpecialRequestType>("Stationed Use");
  const [selectedSpecialAssetId, setSelectedSpecialAssetId] = useState<string>("");
  const [selectedReturnIds, setSelectedReturnIds] = useState<string[]>([]);
  const [requestSourceLocationId, setRequestSourceLocationId] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [preferredReturnLocationId, setPreferredReturnLocationId] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [submittingAssetRequest, setSubmittingAssetRequest] = useState(false);
  const [submittingSpecialRequest, setSubmittingSpecialRequest] = useState(false);
  const [submittingReturnRequest, setSubmittingReturnRequest] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [draftHydratedTab, setDraftHydratedTab] = useState<RequestDraftTab | null>(null);

  useEffect(() => {
    if (!feedback) return;
    pushToast({
      tone: feedback.tone,
      title: feedback.tone === "error" ? "Error" : feedback.tone === "success" ? "Success" : "Info",
      message: feedback.message,
    });
  }, [feedback, pushToast]);

  const canUseRequests = isAdmin || isAssetManager || isStaff;
  const replaceRequestsRoute = (tab: "asset" | "special" | "returns" | "history", assetId?: string | null) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", tab);
    if (assetId) {
      nextParams.set("assetId", assetId);
    } else {
      nextParams.delete("assetId");
    }
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };
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
      const nextWorkspace = await loadRequestsWorkspace(supabase, user.id, scopedActiveLocationId);
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
        const nextWorkspace = await loadRequestsWorkspace(supabase, user.id, scopedActiveLocationId);
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
  }, [isConfigured, scopedActiveLocationId, user]);

  const effectiveSelectedAssetIds = useMemo(() => {
    const nextIds = new Set(selectedAssetIds);
    if ((requestedTab === "asset" || !requestedTab) && requestedAssetId && workspace.requestableAssets.some((asset) => asset.id === requestedAssetId)) {
      nextIds.add(requestedAssetId);
    }
    return [...nextIds];
  }, [requestedAssetId, requestedTab, selectedAssetIds, workspace.requestableAssets]);
  const resolvedRequestSourceLocationId = scopedActiveLocationId ?? requestSourceLocationId;
  const resolvedRequestSourceLocationName = useMemo(() => {
    if (!resolvedRequestSourceLocationId) return null;
    return locations.find((location) => location.id === resolvedRequestSourceLocationId)?.name ?? null;
  }, [locations, resolvedRequestSourceLocationId]);
  const constrainedSelectedAssetIds = useMemo(
    () =>
      !resolvedRequestSourceLocationName
        ? effectiveSelectedAssetIds
        : effectiveSelectedAssetIds.filter((id) =>
            workspace.requestableAssets.some((asset) => asset.id === id && asset.location === resolvedRequestSourceLocationName),
          ),
    [effectiveSelectedAssetIds, resolvedRequestSourceLocationName, workspace.requestableAssets],
  );
  const basketAssets = useMemo(
    () => workspace.requestableAssets.filter((asset) => constrainedSelectedAssetIds.includes(asset.id)),
    [constrainedSelectedAssetIds, workspace.requestableAssets],
  );

  const filteredAssets = useMemo(
    () =>
      workspace.requestableAssets.filter(
        (asset) =>
          (!resolvedRequestSourceLocationName || asset.location === resolvedRequestSourceLocationName) &&
          matchesSearchQuery(
            [asset.tag, asset.name, asset.serial, asset.location, asset.department, getAssetStatusLabel(asset.status)],
            assetSearch,
          ),
      ),
    [assetSearch, resolvedRequestSourceLocationName, workspace.requestableAssets],
  );

  const effectiveSelectedReturnIds = useMemo(() => {
    const nextIds = new Set(selectedReturnIds);
    if (requestedAssetId && workspace.assignedForReturn.some((asset) => asset.id === requestedAssetId)) {
      nextIds.add(requestedAssetId);
    }
    const nextValues = [...nextIds];
    if (!resolvedRequestSourceLocationName) return nextValues;
    return nextValues.filter((id) =>
      workspace.assignedForReturn.some((asset) => asset.id === id && asset.location === resolvedRequestSourceLocationName),
    );
  }, [requestedAssetId, resolvedRequestSourceLocationName, selectedReturnIds, workspace.assignedForReturn]);
  const selectedReturnAssets = useMemo(
    () => workspace.assignedForReturn.filter((asset) => effectiveSelectedReturnIds.includes(asset.id)),
    [effectiveSelectedReturnIds, workspace.assignedForReturn],
  );
  const specialRequestableAssets = useMemo(
    () =>
      workspace.requestableAssets.filter(
        (asset) =>
          (!resolvedRequestSourceLocationName || asset.location === resolvedRequestSourceLocationName) &&
          isSpecialRequestAssetCompatible(asset.status, specialType),
      ),
    [resolvedRequestSourceLocationName, specialType, workspace.requestableAssets],
  );
  const effectiveSpecialAssetId = useMemo(() => {
    if (requestedTab === "special" && requestedAssetId && specialRequestableAssets.some((asset) => asset.id === requestedAssetId)) {
      return requestedAssetId;
    }
    if (resolvedSpecialAssetId && specialRequestableAssets.some((asset) => asset.id === resolvedSpecialAssetId)) {
      return resolvedSpecialAssetId;
    }
    return specialRequestableAssets[0]?.id ?? "";
  }, [requestedAssetId, requestedTab, resolvedSpecialAssetId, specialRequestableAssets]);
  const resolvedPreferredReturnLocationId = preferredReturnLocationId || scopedActiveLocationId || "";

  useEffect(() => {
    if (!user || activeTab === "history") return;

    if (activeTab === "asset") {
      const draft = readDraft<AssetRequestDraft>(user.id, "asset");
      queueMicrotask(() => {
        setAssetSearch(draft?.assetSearch ?? "");
        setSelectedAssetIds(draft?.selectedAssetIds ?? []);
        setRequestSourceLocationId(draft?.sourceLocationId ?? "");
        setNeededDate(draft?.neededDate ?? "");
        setReason(draft?.reason ?? "");
        setDuration(draft?.duration ?? "");
        setEventContext(draft?.eventContext ?? "");
      });
    }

    if (activeTab === "special") {
      const draft = readDraft<SpecialRequestDraft>(user.id, "special");
      queueMicrotask(() => {
        setSpecialType(draft?.specialType ?? "Stationed Use");
        setSelectedSpecialAssetId(draft?.selectedSpecialAssetId ?? "");
        setRequestSourceLocationId(draft?.sourceLocationId ?? "");
        setNeededDate(draft?.neededDate ?? "");
        setReason(draft?.reason ?? "");
        setDuration(draft?.duration ?? "");
        setEventContext(draft?.eventContext ?? "");
      });
    }

    if (activeTab === "returns") {
      const draft = readDraft<ReturnRequestDraft>(user.id, "returns");
      queueMicrotask(() => {
        setSelectedReturnIds(draft?.selectedReturnIds ?? []);
        setRequestSourceLocationId(draft?.sourceLocationId ?? "");
        setReturnDate(draft?.returnDate ?? "");
        setPreferredReturnLocationId(draft?.preferredReturnLocationId ?? "");
        setReturnNote(draft?.returnNote ?? "");
      });
    }

    queueMicrotask(() => {
      setDraftHydratedTab(activeTab);
    });
  }, [activeTab, user]);

  useEffect(() => {
    if (!user || draftHydratedTab !== "asset" || activeTab !== "asset") return;
    writeDraft<AssetRequestDraft>(user.id, "asset", {
      assetSearch,
      selectedAssetIds: effectiveSelectedAssetIds,
      sourceLocationId: requestSourceLocationId,
      neededDate,
      reason,
      duration,
      eventContext,
    });
  }, [activeTab, assetSearch, draftHydratedTab, duration, effectiveSelectedAssetIds, eventContext, neededDate, reason, requestSourceLocationId, user]);

  useEffect(() => {
    if (!user || draftHydratedTab !== "special" || activeTab !== "special") return;
    writeDraft<SpecialRequestDraft>(user.id, "special", {
      specialType,
      selectedSpecialAssetId,
      sourceLocationId: requestSourceLocationId,
      neededDate,
      reason,
      duration,
      eventContext,
    });
  }, [activeTab, draftHydratedTab, duration, eventContext, neededDate, reason, requestSourceLocationId, selectedSpecialAssetId, specialType, user]);

  useEffect(() => {
    if (!user || draftHydratedTab !== "returns" || activeTab !== "returns") return;
    writeDraft<ReturnRequestDraft>(user.id, "returns", {
      selectedReturnIds,
      sourceLocationId: requestSourceLocationId,
      returnDate,
      preferredReturnLocationId,
      returnNote,
    });
  }, [activeTab, draftHydratedTab, preferredReturnLocationId, requestSourceLocationId, returnDate, returnNote, selectedReturnIds, user]);

  const discardDraft = (tab: RequestDraftTab) => {
    if (!user) return;
    clearDraft(user.id, tab);

    if (tab === "asset") {
      setAssetSearch("");
      setSelectedAssetIds([]);
      setRequestSourceLocationId("");
      setNeededDate("");
      setReason("");
      setDuration("");
      setEventContext("");
    }

    if (tab === "special") {
      setSpecialType("Stationed Use");
      setSelectedSpecialAssetId("");
      setRequestSourceLocationId("");
      setNeededDate("");
      setReason("");
      setDuration("");
      setEventContext("");
    }

    if (tab === "returns") {
      setSelectedReturnIds([]);
      setRequestSourceLocationId("");
      setReturnDate("");
      setPreferredReturnLocationId("");
      setReturnNote("");
    }

    setFeedback({ tone: "info", message: `${tab === "asset" ? "Asset" : tab === "special" ? "Special" : "Return"} draft discarded.` });
  };

  const submitLiveAssetRequest = async () => {
    if (!resolvedRequestSourceLocationId) {
      setFeedback({ tone: "error", message: "Choose a source location for this asset request first." });
      return;
    }

    if (effectiveSelectedAssetIds.length === 0) {
      setFeedback({ tone: "error", message: "Add at least one asset to the request basket first." });
      return;
    }
    if (resolvedRequestSourceLocationName && basketAssets.some((asset) => asset.location !== resolvedRequestSourceLocationName)) {
      setFeedback({ tone: "error", message: "All asset-request items must belong to the selected source location." });
      return;
    }
    if (!neededDate.trim()) {
      setFeedback({ tone: "error", message: "Need Date is required." });
      return;
    }
    if (isPastDateInput(neededDate)) {
      setFeedback({ tone: "error", message: "Need Date cannot be in the past." });
      return;
    }
    if (!reason.trim()) {
      setFeedback({ tone: "error", message: "Reason is required." });
      return;
    }
    if (!duration.trim()) {
      setFeedback({ tone: "error", message: "Duration is required." });
      return;
    }
    if (!eventContext.trim()) {
      setFeedback({ tone: "error", message: "Event / Use Context is required." });
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
        activeLocationId: resolvedRequestSourceLocationId,
        selectedAssetIds: effectiveSelectedAssetIds,
        neededFor: eventContext,
        neededBy: neededDate,
        note: [reason.trim(), duration.trim()].filter(Boolean).join(" | "),
      });

      if (error) throw error;

      setSelectedAssetIds([]);
      setRequestSourceLocationId("");
      setNeededDate("");
      setReason("");
      setDuration("");
      setEventContext("");
      if (user) clearDraft(user.id, "asset");
      setFeedback({ tone: "success", message: "Asset request submitted into the live request-bundle workflow." });
      replaceRequestsRoute("history");
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Asset request submission failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setSubmittingAssetRequest(false);
    }
  };

  const submitLiveReturnRequest = async () => {
    if (effectiveSelectedReturnIds.length === 0) {
      setFeedback({ tone: "error", message: "Add at least one assigned asset to the return basket first." });
      return;
    }
    if (!resolvedRequestSourceLocationId) {
      setFeedback({ tone: "error", message: "Choose a source location for this return request first." });
      return;
    }
    if (resolvedRequestSourceLocationName && selectedReturnAssets.some((asset) => asset.location !== resolvedRequestSourceLocationName)) {
      setFeedback({ tone: "error", message: "All return-request items must belong to the selected source location." });
      return;
    }
    if (!returnDate.trim()) {
      setFeedback({ tone: "error", message: "Return Date is required." });
      return;
    }
    if (isPastDateInput(returnDate)) {
      setFeedback({ tone: "error", message: "Return Date cannot be in the past." });
      return;
    }

    if (!resolvedPreferredReturnLocationId) {
      setFeedback({ tone: "error", message: "Choose a preferred return location first." });
      return;
    }
    if (!returnNote.trim()) {
      setFeedback({ tone: "error", message: "Return note is required." });
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
        activeLocationId: resolvedRequestSourceLocationId,
        selectedAssetIds: effectiveSelectedReturnIds,
        returnDate,
        preferredReturnLocationId: resolvedPreferredReturnLocationId,
        note: returnNote,
      });

      if (error) throw error;

      setSelectedReturnIds([]);
      setRequestSourceLocationId("");
      setReturnDate("");
      setPreferredReturnLocationId("");
      setReturnNote("");
      if (user) clearDraft(user.id, "returns");
      setFeedback({ tone: "success", message: "Return request submitted into the live return workflow." });
      replaceRequestsRoute("history");
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Return request submission failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setSubmittingReturnRequest(false);
    }
  };

  const submitLiveSpecialRequest = async () => {
    if (!effectiveSpecialAssetId) {
      setFeedback({ tone: "error", message: "Choose a target asset for the special request first." });
      return;
    }
    if (!resolvedRequestSourceLocationId) {
      setFeedback({ tone: "error", message: "Choose a source location for this special request first." });
      return;
    }
    const specialAsset = workspace.requestableAssets.find((asset) => asset.id === effectiveSpecialAssetId);
    if (!specialAsset) {
      setFeedback({ tone: "error", message: "The selected special-request asset is no longer available in this workspace." });
      return;
    }
    if (resolvedRequestSourceLocationName && specialAsset.location !== resolvedRequestSourceLocationName) {
      setFeedback({ tone: "error", message: "The selected special-request asset must belong to the chosen source location." });
      return;
    }
    if (!isSpecialRequestAssetCompatible(specialAsset.status, specialType)) {
      setFeedback({ tone: "error", message: getSpecialRequestAssetHint(specialAsset.status, specialType) });
      return;
    }
    if (!neededDate.trim()) {
      setFeedback({ tone: "error", message: "Need Date is required." });
      return;
    }
    if (isPastDateInput(neededDate)) {
      setFeedback({ tone: "error", message: "Need Date cannot be in the past." });
      return;
    }
    if (!duration.trim()) {
      setFeedback({ tone: "error", message: "Duration is required." });
      return;
    }
    if (!reason.trim()) {
      setFeedback({ tone: "error", message: "Reason is required." });
      return;
    }
    if (!eventContext.trim()) {
      setFeedback({ tone: "error", message: "Event / Use Context is required." });
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
        activeLocationId: resolvedRequestSourceLocationId,
        assetId: effectiveSpecialAssetId,
        requestType: specialType,
        neededBy: neededDate,
        duration,
        reason,
        eventContext,
      });

      if (error) throw error;

      setSelectedSpecialAssetId("");
      setRequestSourceLocationId("");
      setNeededDate("");
      setDuration("");
      setReason("");
      setEventContext("");
      if (user) clearDraft(user.id, "special");
      setFeedback({ tone: "success", message: `${specialType} submitted into the live special-request workflow.` });
      replaceRequestsRoute("history");
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
          <h1 className="app-title mt-2">This role does not create requests here.</h1>
          <p className="app-subtitle mt-3">Use `My Assets` for assigned items and personal actions.</p>
        </div>
      </SectionShell>
    );
  }



  return (
    <SectionShell title="Requests" kicker="Asset + Special + Returns + History">
      <div className="space-y-4 sm:space-y-6">
        <section className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="app-kicker">Requests</div>
              <h1 className="page-title mt-2">Requests</h1>
            </div>
            <div className="inline-flex items-center gap-2 text-sm text-primary/80">
              <ShoppingBasket size={15} />
              <span className="page-meta-item text-primary/80 normal-case tracking-normal">
                Basket: {basketAssets.length} item{basketAssets.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div className="page-meta-row">
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
            <span className="page-meta-item">
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
              <TabButton active={activeTab === "asset"} onClick={() => replaceRequestsRoute("asset", requestedAssetId)} label="Asset" />
              <TabButton active={activeTab === "special"} onClick={() => replaceRequestsRoute("special", requestedAssetId)} label="Special" />
              <TabButton active={activeTab === "returns"} onClick={() => replaceRequestsRoute("returns", requestedAssetId)} label="Returns" />
              <TabButton active={activeTab === "history"} onClick={() => replaceRequestsRoute("history")} label="History" />
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {activeTab === "asset" && (
              <div className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                  <div className="space-y-4 rounded-[1.35rem] border border-primary/12 bg-card/20 p-4">
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
                        const selected = effectiveSelectedAssetIds.includes(asset.id);
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

                  <div className="space-y-4 rounded-[1.35rem] border border-primary/12 bg-card/20 p-4">
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

                    {!scopedActiveLocationId && (
                      <SelectCard
                        label="Source location"
                        value={resolvedRequestSourceLocationId}
                        options={[
                          { label: "Choose source location", value: "" },
                          ...locations.map((location) => ({ label: location.name, value: location.id })),
                        ]}
                        onSelect={setRequestSourceLocationId}
                      />
                    )}

                    <FormField label="Need Date" placeholder="Choose date and time" value={neededDate} onChange={setNeededDate} inputType="datetime-local" />
                    <FormField label="Reason" placeholder="Why is this needed?" value={reason} onChange={setReason} />
                    <FormField label="Duration" placeholder="How long is it needed?" value={duration} onChange={setDuration} />
                    <FormField label="Event / Use Context" placeholder="Sunday service, conference, rehearsal..." value={eventContext} onChange={setEventContext} multiline />

                    <button
                      type="button"
                      onClick={() => discardDraft("asset")}
                      className="inline-flex h-11 w-full items-center justify-center rounded-[1rem] border border-primary/18 bg-card/55 px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary"
                    >
                      Discard Asset Draft
                    </button>

                    <button
                      type="button"
                      onClick={() => void submitLiveAssetRequest()}
                      disabled={submittingAssetRequest || effectiveSelectedAssetIds.length === 0 || !resolvedRequestSourceLocationId}
                      className="matrix-button inline-flex h-12 w-full items-center justify-center gap-2 rounded-[1.15rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CheckCircle2 size={16} />
                      {submittingAssetRequest ? "Submitting" : `Submit Asset Request${effectiveSelectedAssetIds.length > 0 ? ` (${effectiveSelectedAssetIds.length})` : ""}`}
                    </button>

                  </div>
                </div>
              </div>
            )}

            {activeTab === "special" && (
              <div className="space-y-4">
                <StepCard
                  title="Choose special request type and target asset"
                />

                <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  <div className="space-y-4">
                    <SelectCard
                      label="Request type"
                      value={specialType}
                      options={["Stationed Use", "Permanent Reassignment"]}
                      onSelect={(value) => setSpecialType(value as SpecialRequestType)}
                    />

                    <SelectCard
                      label="Target asset"
                      value={effectiveSpecialAssetId}
                      options={specialRequestableAssets.map((asset) => ({ label: `${asset.tag} · ${asset.name}`, value: asset.id }))}
                      onSelect={setSelectedSpecialAssetId}
                    />
                    {effectiveSpecialAssetId && (
                      <div className="rounded-[1rem] border border-primary/12 bg-card/40 px-4 py-3 text-sm text-muted-foreground">
                        {getSpecialRequestAssetHint(
                          workspace.requestableAssets.find((asset) => asset.id === effectiveSpecialAssetId)?.status ?? "",
                          specialType,
                        )}
                      </div>
                    )}
                    {specialRequestableAssets.length === 0 && (
                      <div className="rounded-[1rem] border border-dashed border-primary/14 px-4 py-6 text-sm text-muted-foreground">
                        No assets in the current scope are compatible with {specialType}.
                      </div>
                    )}
                  </div>

                  <div className="app-panel p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary/72">Dynamic form preview</div>
                    <div className="mt-3 font-display text-2xl text-foreground glow-soft">{specialType}</div>
                    {!scopedActiveLocationId && (
                      <div className="mt-3">
                        <SelectCard
                          label="Source location"
                          value={resolvedRequestSourceLocationId}
                          options={[
                            { label: "Choose source location", value: "" },
                            ...locations.map((location) => ({ label: location.name, value: location.id })),
                          ]}
                          onSelect={setRequestSourceLocationId}
                        />
                      </div>
                    )}
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <FormField label="Need Date" placeholder="Choose date and time" value={neededDate} onChange={setNeededDate} inputType="datetime-local" />
                      <FormField label="Duration" placeholder="Temporary use period" value={duration} onChange={setDuration} />
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <FormField label="Reason" placeholder="Why this special request is needed" value={reason} onChange={setReason} />
                      <FormField label="Event / Use Context" placeholder="Where and how it will be used" value={eventContext} onChange={setEventContext} />
                    </div>
                    <button
                      type="button"
                      onClick={() => discardDraft("special")}
                      className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-[1rem] border border-primary/18 bg-card/55 px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary"
                    >
                      Discard Special Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => void submitLiveSpecialRequest()}
                      disabled={submittingSpecialRequest || !effectiveSpecialAssetId || !resolvedRequestSourceLocationId}
                      className="matrix-button mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[1.15rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ShieldCheck size={15} />
                      {submittingSpecialRequest ? "Submitting Special Request" : `Submit ${specialType}`}
                    </button>
                    <div className="mt-3 text-sm text-muted-foreground">Managers and admins resolve submitted special requests in Approvals.</div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "returns" && (
              <div className="space-y-4">
                <StepCard
                  title="Build one shared return request"
                />

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                  <div className="space-y-3">
                    {workspace.assignedForReturn.map((asset) => {
                      const selected = effectiveSelectedReturnIds.includes(asset.id);
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

                    {!scopedActiveLocationId && (
                      <SelectCard
                        label="Source location"
                        value={resolvedRequestSourceLocationId}
                        options={[
                          { label: "Choose source location", value: "" },
                          ...locations.map((location) => ({ label: location.name, value: location.id })),
                        ]}
                        onSelect={setRequestSourceLocationId}
                      />
                    )}
                    <FormField label="Return Date" placeholder="Choose return date" value={returnDate} onChange={setReturnDate} inputType="date" />
                    <SelectCard
                      label="Preferred Return Location"
                      value={resolvedPreferredReturnLocationId}
                      options={locations.map((location) => ({ label: location.name, value: location.id }))}
                      placeholder="Select a preferred return location"
                      onSelect={setPreferredReturnLocationId}
                    />
                    <FormField label="Note" placeholder="Return note for the receiving team" value={returnNote} onChange={setReturnNote} multiline />
                    <button
                      type="button"
                      onClick={() => discardDraft("returns")}
                      className="inline-flex h-11 w-full items-center justify-center rounded-[1rem] border border-primary/18 bg-card/55 px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary"
                    >
                      Discard Return Draft
                    </button>

                    <button
                      type="button"
                      onClick={() => void submitLiveReturnRequest()}
                        disabled={submittingReturnRequest || effectiveSelectedReturnIds.length === 0 || !resolvedPreferredReturnLocationId || !resolvedRequestSourceLocationId}
                      className="matrix-button inline-flex h-12 w-full items-center justify-center gap-2 rounded-[1.15rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RotateCcw size={15} />
                      {submittingReturnRequest ? "Submitting Return Request" : `Submit Return Request${effectiveSelectedReturnIds.length > 0 ? ` (${effectiveSelectedReturnIds.length})` : ""}`}
                    </button>

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
        "inline-flex items-center gap-2 text-sm",
        source === "live" && "text-primary/80",
        source === "mixed" && "text-amber-200",
        source === "fallback" && "text-sky-200",
      )}
    >
      <ShoppingBasket size={13} />
      <span className="page-meta-item normal-case tracking-normal" style={{ color: "inherit" }}>{label}</span>
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
  title,
}: {
  title: string;
}) {
  return (
    <div className="app-panel p-4">
      <div className="mt-2 font-display text-2xl text-foreground glow-soft">{title}</div>
    </div>
  );
}

function FormField({
  label,
  placeholder,
  value,
  onChange,
  multiline = false,
  inputType = "text",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  inputType?: "text" | "date" | "datetime-local";
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
          type={inputType}
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
  placeholder,
}: {
  label: string;
  value: string;
  options: string[] | Array<{ label: string; value: string }>;
  onSelect: (value: string) => void;
  placeholder?: string;
}) {
  const normalizedOptions = options.map((option) => (typeof option === "string" ? { label: option, value: option } : option));
  return (
    <label className="space-y-2">
      <span className="font-mono text-xs uppercase tracking-[0.14em] text-primary/72">{label}</span>
      <div className="matrix-field rounded-[1.35rem] px-4">
        <select value={value} onChange={(event) => onSelect(event.target.value)} className="h-11 w-full bg-transparent text-sm text-foreground outline-none">
          {placeholder ? (
            <option value="" disabled className="bg-[hsl(var(--card))] text-muted-foreground">
              {placeholder}
            </option>
          ) : null}
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
