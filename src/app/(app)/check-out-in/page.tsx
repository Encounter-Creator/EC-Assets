"use client";

import { AlertTriangle, ArrowRightLeft, Boxes, CheckCircle2, QrCode, RefreshCcw, RotateCcw, ScanLine, ShieldCheck, UserCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import {
  deploySundayKit,
  getFallbackCheckOperationsWorkspace,
  loadCheckOperationsWorkspace,
  resolveOperationalAssetsByCodes,
  returnSundayKitDeployment,
  runPermanentAssignment,
  runStationedCheckIn,
  runStationedCheckout,
  runStandardSignIn,
  runStandardSignOut,
  type CheckOperationsWorkspaceData,
  type ReturnRequestMonitorRecord,
  type SundayKitDeploymentRecord,
  type SundayKitRecord,
  type StandardAssetRecord,
} from "@/lib/check-operations";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { SectionShell } from "../layout";

type OpsTab = "standard" | "permanent" | "stationed" | "sunday_kits" | "returns" | "qr_scan";

type FeedbackState = {
  tone: "success" | "error" | "info";
  message: string;
};

const tabMeta = [
  { id: "standard", label: "Standard", icon: ScanLine },
  { id: "permanent", label: "Permanent", icon: UserCheck },
  { id: "stationed", label: "Stationed", icon: ShieldCheck },
  { id: "sunday_kits", label: "Sunday Kits", icon: Boxes },
  { id: "returns", label: "Returns", icon: RotateCcw },
  { id: "qr_scan", label: "QR Scan", icon: QrCode },
] as const;

export default function CheckOutInPage() {
  const { isAdmin, isAssetManager, isConfigured } = useAuth();
  const [workspace, setWorkspace] = useState<CheckOperationsWorkspaceData>(getFallbackCheckOperationsWorkspace());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<OpsTab>("standard");
  const [standardMode, setStandardMode] = useState<"sign_out" | "sign_in">("sign_out");
  const [permanentMode, setPermanentMode] = useState<"direct_issue" | "reassign">("direct_issue");
  const [stationedMode, setStationedMode] = useState<"temporary_use" | "return_to_site">("temporary_use");
  const [qrMode, setQrMode] = useState<"sign_out" | "sign_in">("sign_out");
  const [sundayKitsMode, setSundayKitsMode] = useState<"deploy" | "returns">("deploy");
  const [selectedSignOutAssetIds, setSelectedSignOutAssetIds] = useState<string[]>([]);
  const [selectedSignInAssetIds, setSelectedSignInAssetIds] = useState<string[]>([]);
  const [selectedPermanentIssueAssetIds, setSelectedPermanentIssueAssetIds] = useState<string[]>([]);
  const [selectedPermanentReassignAssetIds, setSelectedPermanentReassignAssetIds] = useState<string[]>([]);
  const [selectedStationedCheckoutAssetIds, setSelectedStationedCheckoutAssetIds] = useState<string[]>([]);
  const [selectedStationedCheckInAssetIds, setSelectedStationedCheckInAssetIds] = useState<string[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState("");
  const [selectedPermanentRecipientId, setSelectedPermanentRecipientId] = useState("");
  const [selectedStationedRecipientId, setSelectedStationedRecipientId] = useState("");
  const [selectedFinalLocationId, setSelectedFinalLocationId] = useState("");
  const [selectedPermanentHomeBaseId, setSelectedPermanentHomeBaseId] = useState("");
  const [selectedStationedLocationId, setSelectedStationedLocationId] = useState("");
  const [signInOutcome, setSignInOutcome] = useState<"Available" | "Damaged">("Available");
  const [stationedOutcome, setStationedOutcome] = useState<"Stationed" | "Damaged">("Stationed");
  const [qrCodesInput, setQrCodesInput] = useState("");
  const [resolvedQrAssets, setResolvedQrAssets] = useState<StandardAssetRecord[]>([]);
  const [selectedQrRecipientId, setSelectedQrRecipientId] = useState("");
  const [selectedQrLocationId, setSelectedQrLocationId] = useState("");
  const [qrSignInOutcome, setQrSignInOutcome] = useState<"Available" | "Damaged">("Available");
  const [selectedSundayKitId, setSelectedSundayKitId] = useState("");
  const [selectedSundayKitRecipientId, setSelectedSundayKitRecipientId] = useState("");
  const [selectedSundayKitLocationId, setSelectedSundayKitLocationId] = useState("");
  const [selectedSundayDeploymentId, setSelectedSundayDeploymentId] = useState("");
  const [sundayReturnedCount, setSundayReturnedCount] = useState("0");
  const [sundayDamagedCount, setSundayDamagedCount] = useState("0");
  const [operationNote, setOperationNote] = useState("");
  const [permanentNote, setPermanentNote] = useState("");
  const [stationedNote, setStationedNote] = useState("");
  const [qrNote, setQrNote] = useState("");
  const [sundayKitsNote, setSundayKitsNote] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [busy, setBusy] = useState<"sign_out" | "sign_in" | "permanent" | "stationed" | "qr" | "sunday_kits" | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadWorkspace = async () => {
      if (!isConfigured) {
        if (!cancelled) {
          setWorkspace(getFallbackCheckOperationsWorkspace());
          setLoading(false);
        }
        return;
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (!cancelled) {
          setWorkspace(getFallbackCheckOperationsWorkspace());
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setLoading(true);
      }

      const nextWorkspace = await loadCheckOperationsWorkspace(supabase);
      if (!cancelled) {
        setWorkspace(nextWorkspace);
        setLoading(false);
      }
    };

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [isConfigured]);

  const refreshWorkspace = async () => {
    if (!isConfigured) {
      setWorkspace(getFallbackCheckOperationsWorkspace());
      setLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setWorkspace(getFallbackCheckOperationsWorkspace());
      setLoading(false);
      return;
    }

    setLoading(true);
    const nextWorkspace = await loadCheckOperationsWorkspace(supabase);
    setWorkspace(nextWorkspace);
    setLoading(false);
  };

  const selectedSignOutAssets = useMemo(
    () => workspace.signOutAssets.filter((asset) => selectedSignOutAssetIds.includes(asset.id)),
    [selectedSignOutAssetIds, workspace.signOutAssets],
  );
  const selectedSignInAssets = useMemo(
    () => workspace.signInAssets.filter((asset) => selectedSignInAssetIds.includes(asset.id)),
    [selectedSignInAssetIds, workspace.signInAssets],
  );
  const selectedPermanentIssueAssets = useMemo(
    () => workspace.signOutAssets.filter((asset) => selectedPermanentIssueAssetIds.includes(asset.id)),
    [selectedPermanentIssueAssetIds, workspace.signOutAssets],
  );
  const selectedPermanentReassignAssets = useMemo(
    () => workspace.signInAssets.filter((asset) => selectedPermanentReassignAssetIds.includes(asset.id)),
    [selectedPermanentReassignAssetIds, workspace.signInAssets],
  );
  const selectedStationedCheckoutAssets = useMemo(
    () => workspace.stationedReadyAssets.filter((asset) => selectedStationedCheckoutAssetIds.includes(asset.id)),
    [selectedStationedCheckoutAssetIds, workspace.stationedReadyAssets],
  );
  const selectedStationedCheckInAssets = useMemo(
    () => workspace.stationedActiveAssets.filter((asset) => selectedStationedCheckInAssetIds.includes(asset.id)),
    [selectedStationedCheckInAssetIds, workspace.stationedActiveAssets],
  );
  const returnSummary = useMemo(() => summarizeReturns(workspace.returnMonitor), [workspace.returnMonitor]);
  const selectedSundayKit = useMemo(
    () => workspace.sundayKits.find((kit) => kit.id === (selectedSundayKitId || workspace.sundayKits[0]?.id)) ?? null,
    [selectedSundayKitId, workspace.sundayKits],
  );
  const selectedSundayDeployment = useMemo(
    () => workspace.sundayKitDeployments.find((deployment) => deployment.id === (selectedSundayDeploymentId || workspace.sundayKitDeployments[0]?.id)) ?? null,
    [selectedSundayDeploymentId, workspace.sundayKitDeployments],
  );
  const resolvedRecipientId = selectedRecipientId || workspace.recipients[0]?.id || "";
  const resolvedFinalLocationId = selectedFinalLocationId || workspace.locations[0]?.id || "";
  const resolvedPermanentRecipientId = selectedPermanentRecipientId || workspace.recipients[0]?.id || "";
  const resolvedPermanentHomeBaseId = selectedPermanentHomeBaseId || workspace.locations[0]?.id || "";
  const resolvedStationedRecipientId = selectedStationedRecipientId || workspace.recipients[0]?.id || "";
  const resolvedStationedLocationId = selectedStationedLocationId || workspace.locations[0]?.id || "";
  const resolvedQrRecipientId = selectedQrRecipientId || workspace.recipients[0]?.id || "";
  const resolvedQrLocationId = selectedQrLocationId || workspace.locations[0]?.id || "";
  const resolvedSundayKitId = selectedSundayKitId || workspace.sundayKits[0]?.id || "";
  const resolvedSundayKitRecipientId = selectedSundayKitRecipientId || workspace.recipients[0]?.id || "";
  const resolvedSundayKitLocationId = selectedSundayKitLocationId || workspace.locations[0]?.id || "";
  const resolvedSundayDeploymentId = selectedSundayDeploymentId || workspace.sundayKitDeployments[0]?.id || "";

  const toggleAsset = (assetId: string, mode: "sign_out" | "sign_in") => {
    const setter = mode === "sign_out" ? setSelectedSignOutAssetIds : setSelectedSignInAssetIds;
    setter((current) => (current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId]));
  };

  const togglePermanentAsset = (assetId: string, mode: "direct_issue" | "reassign") => {
    const setter = mode === "direct_issue" ? setSelectedPermanentIssueAssetIds : setSelectedPermanentReassignAssetIds;
    setter((current) => (current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId]));
  };

  const toggleStationedAsset = (assetId: string, mode: "temporary_use" | "return_to_site") => {
    const setter = mode === "temporary_use" ? setSelectedStationedCheckoutAssetIds : setSelectedStationedCheckInAssetIds;
    setter((current) => (current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId]));
  };

  const handleSignOut = async () => {
    if (selectedSignOutAssetIds.length === 0) {
      setFeedback({ tone: "error", message: "Select at least one asset to sign out." });
      return;
    }
    if (!selectedRecipientId) {
      setFeedback({ tone: "error", message: "Choose a recipient first." });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so live sign-out is unavailable." });
      return;
    }

    setBusy("sign_out");
    try {
      const { error } = await runStandardSignOut(supabase, {
        assetIds: selectedSignOutAssetIds,
        holderId: resolvedRecipientId,
        note: operationNote,
      });
      if (error) throw error;

      setFeedback({ tone: "success", message: `${selectedSignOutAssetIds.length} asset item${selectedSignOutAssetIds.length === 1 ? "" : "s"} signed out.` });
      setSelectedSignOutAssetIds([]);
      setOperationNote("");
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Standard sign-out failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusy(null);
    }
  };

  const handleSignIn = async () => {
    if (selectedSignInAssetIds.length === 0) {
      setFeedback({ tone: "error", message: "Select at least one assigned asset to sign in." });
      return;
    }
    if (!selectedFinalLocationId) {
      setFeedback({ tone: "error", message: "Choose a final sign-in location." });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so live sign-in is unavailable." });
      return;
    }

    setBusy("sign_in");
    try {
      const { error } = await runStandardSignIn(supabase, {
        assetIds: selectedSignInAssetIds,
        finalLocationId: resolvedFinalLocationId,
        outcome: signInOutcome,
        note: operationNote,
      });
      if (error) throw error;

      setFeedback({ tone: "success", message: `${selectedSignInAssetIds.length} asset item${selectedSignInAssetIds.length === 1 ? "" : "s"} signed in as ${signInOutcome}.` });
      setSelectedSignInAssetIds([]);
      setOperationNote("");
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Standard sign-in failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusy(null);
    }
  };

  const handlePermanentAssignment = async () => {
    const assetIds = permanentMode === "direct_issue" ? selectedPermanentIssueAssetIds : selectedPermanentReassignAssetIds;
    if (assetIds.length === 0) {
      setFeedback({ tone: "error", message: `Select at least one asset to ${permanentMode === "direct_issue" ? "issue permanently" : "reassign permanently"}.` });
      return;
    }
    if (!resolvedPermanentRecipientId) {
      setFeedback({ tone: "error", message: "Choose the receiving user first." });
      return;
    }
    if (!resolvedPermanentHomeBaseId) {
      setFeedback({ tone: "error", message: "Choose the receiving home-base location first." });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so permanent assignment is unavailable." });
      return;
    }

    setBusy("permanent");
    try {
      const { error } = await runPermanentAssignment(supabase, {
        assetIds,
        holderId: resolvedPermanentRecipientId,
        homeBaseLocationId: resolvedPermanentHomeBaseId,
        mode: permanentMode,
        note: permanentNote,
      });
      if (error) throw error;

      setFeedback({
        tone: "success",
        message: `${assetIds.length} asset item${assetIds.length === 1 ? "" : "s"} ${permanentMode === "direct_issue" ? "issued" : "reassigned"} through the permanent workflow.`,
      });
      setSelectedPermanentIssueAssetIds([]);
      setSelectedPermanentReassignAssetIds([]);
      setPermanentNote("");
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Permanent assignment failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusy(null);
    }
  };

  const handleStationedOperation = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so stationed operations are unavailable." });
      return;
    }

    setBusy("stationed");
    try {
      if (stationedMode === "temporary_use") {
        if (selectedStationedCheckoutAssetIds.length === 0) {
          setFeedback({ tone: "error", message: "Select at least one stationed asset first." });
          return;
        }
        if (!resolvedStationedRecipientId) {
          setFeedback({ tone: "error", message: "Choose the responsible user first." });
          return;
        }

        const { error } = await runStationedCheckout(supabase, {
          assetIds: selectedStationedCheckoutAssetIds,
          holderId: resolvedStationedRecipientId,
          note: stationedNote,
        });
        if (error) throw error;

        setFeedback({
          tone: "success",
          message: `${selectedStationedCheckoutAssetIds.length} stationed asset item${selectedStationedCheckoutAssetIds.length === 1 ? "" : "s"} moved into temporary use.`,
        });
        setSelectedStationedCheckoutAssetIds([]);
      } else {
        if (selectedStationedCheckInAssetIds.length === 0) {
          setFeedback({ tone: "error", message: "Select at least one traveling stationed asset first." });
          return;
        }
        if (!resolvedStationedLocationId) {
          setFeedback({ tone: "error", message: "Choose the return site first." });
          return;
        }

        const { error } = await runStationedCheckIn(supabase, {
          assetIds: selectedStationedCheckInAssetIds,
          finalLocationId: resolvedStationedLocationId,
          outcome: stationedOutcome,
          note: stationedNote,
        });
        if (error) throw error;

        setFeedback({
          tone: "success",
          message: `${selectedStationedCheckInAssetIds.length} stationed-traveling asset item${selectedStationedCheckInAssetIds.length === 1 ? "" : "s"} checked back in as ${stationedOutcome}.`,
        });
        setSelectedStationedCheckInAssetIds([]);
      }

      setStationedNote("");
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stationed operation failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusy(null);
    }
  };

  const resolveQrBatch = async () => {
    const codes = qrCodesInput
      .split(/\r?\n|,/)
      .map((code) => code.trim())
      .filter(Boolean);

    if (codes.length === 0) {
      setFeedback({ tone: "error", message: "Paste or scan at least one asset code first." });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so QR batch resolution is unavailable." });
      return;
    }

    setBusy("qr");
    try {
      const rows = await resolveOperationalAssetsByCodes(supabase, { codes });
      setResolvedQrAssets(rows);
      setFeedback({
        tone: "success",
        message: `Resolved ${rows.length} asset item${rows.length === 1 ? "" : "s"} from the QR/manual batch.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "QR batch resolution failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusy(null);
    }
  };

  const runQrBatch = async () => {
    if (resolvedQrAssets.length === 0) {
      setFeedback({ tone: "error", message: "Resolve a batch before running the QR operation." });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so QR batch execution is unavailable." });
      return;
    }

    setBusy("qr");
    try {
      if (qrMode === "sign_out") {
        if (!resolvedQrRecipientId) {
          setFeedback({ tone: "error", message: "Choose a recipient first." });
          return;
        }

        const { error } = await runStandardSignOut(supabase, {
          assetIds: resolvedQrAssets.map((asset) => asset.id),
          holderId: resolvedQrRecipientId,
          note: qrNote,
        });
        if (error) throw error;
      } else {
        if (!resolvedQrLocationId) {
          setFeedback({ tone: "error", message: "Choose a final location first." });
          return;
        }

        const { error } = await runStandardSignIn(supabase, {
          assetIds: resolvedQrAssets.map((asset) => asset.id),
          finalLocationId: resolvedQrLocationId,
          outcome: qrSignInOutcome,
          note: qrNote,
        });
        if (error) throw error;
      }

      setFeedback({
        tone: "success",
        message: `${resolvedQrAssets.length} asset item${resolvedQrAssets.length === 1 ? "" : "s"} processed through the QR batch ${qrMode === "sign_out" ? "sign-out" : "sign-in"} flow.`,
      });
      setResolvedQrAssets([]);
      setQrCodesInput("");
      setQrNote("");
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "QR batch execution failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusy(null);
    }
  };

  const handleSundayKitsOperation = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so Sunday Kits is unavailable." });
      return;
    }

    setBusy("sunday_kits");
    try {
      if (sundayKitsMode === "deploy") {
        if (!selectedSundayKit) {
          setFeedback({ tone: "error", message: "Choose a saved kit first." });
          return;
        }
        if (!resolvedSundayKitRecipientId) {
          setFeedback({ tone: "error", message: "Choose the responsible user first." });
          return;
        }
        if (!resolvedSundayKitLocationId) {
          setFeedback({ tone: "error", message: "Choose the deployment location first." });
          return;
        }

        const { error } = await deploySundayKit(supabase, {
          kitId: selectedSundayKit.id,
          kitName: selectedSundayKit.name,
          itemCount: selectedSundayKit.item_count,
          responsibleUserId: resolvedSundayKitRecipientId,
          locationId: resolvedSundayKitLocationId,
          note: sundayKitsNote,
        });
        if (error) throw error;

        setFeedback({
          tone: "success",
          message: `${selectedSundayKit.name} deployed into the live Sunday Kits workflow.`,
        });
      } else {
        const returnedCount = Number.parseInt(sundayReturnedCount, 10);
        const damagedCount = Number.parseInt(sundayDamagedCount, 10);
        if (!resolvedSundayDeploymentId) {
          setFeedback({ tone: "error", message: "Choose a deployment first." });
          return;
        }
        if (Number.isNaN(returnedCount) || Number.isNaN(damagedCount) || returnedCount < 0 || damagedCount < 0 || returnedCount + damagedCount === 0) {
          setFeedback({ tone: "error", message: "Enter valid returned and/or damaged item counts first." });
          return;
        }

        const { error } = await returnSundayKitDeployment(supabase, {
          deploymentId: resolvedSundayDeploymentId,
          returnedCount,
          damagedCount,
          note: sundayKitsNote,
        });
        if (error) throw error;

        setFeedback({
          tone: "success",
          message: "Sunday kit partial return recorded into the live deployment ledger.",
        });
        setSundayReturnedCount("0");
        setSundayDamagedCount("0");
      }

      setSundayKitsNote("");
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sunday Kits operation failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusy(null);
    }
  };

  if (!isAdmin && !isAssetManager) {
    return (
      <SectionShell title="Check-out/In" kicker="Access restricted">
        <div className="app-panel p-5">
          <div className="app-kicker">Check-out/In</div>
          <h1 className="app-title mt-2">This operational workspace is reserved for admin and asset-manager roles.</h1>
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell title="Check-out/In" kicker="Standard + Permanent + Stationed + Kits">
      <div className="space-y-4 sm:space-y-6">
        <section className="app-panel p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="app-kicker">Check-out/In</div>
              <h1 className="app-title mt-2">Operational workspace rebuilt around the live standard workflow.</h1>
              <p className="app-subtitle mt-3">
                `Standard`, `Permanent`, and `Stationed` now have dedicated live paths. `Returns` loads the real monitoring feed, while the remaining tabs keep the approved v2 structure until their workflow paths are connected.
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-primary/18 bg-primary/8 px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/72">Workspace source</div>
              <div className="mt-2 flex items-center gap-2 text-sm text-primary">
                <ArrowRightLeft size={15} />
                {workspace.source === "live" ? "Live data" : workspace.source === "mixed" ? "Mixed data" : "Fallback preview"}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void refreshWorkspace()}
              disabled={loading || busy !== null}
              className="inline-flex items-center gap-2 rounded-full border border-primary/18 bg-card/55 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw size={14} className={cn(loading && "animate-spin")} />
              {loading ? "Refreshing" : "Refresh"}
            </button>
            <span className="rounded-full border border-primary/12 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Sign-out pool: {workspace.signOutAssets.length}
            </span>
            <span className="rounded-full border border-primary/12 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Sign-in pool: {workspace.signInAssets.length}
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
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                    activeTab === tab.id ? "border-primary/26 bg-primary/12 text-primary" : "border-primary/12 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <tab.icon size={15} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {activeTab === "standard" && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setStandardMode("sign_out")}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                      standardMode === "sign_out" ? "border-primary/26 bg-primary/12 text-primary" : "border-primary/12 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Sign Out
                  </button>
                  <button
                    type="button"
                    onClick={() => setStandardMode("sign_in")}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                      standardMode === "sign_in" ? "border-primary/26 bg-primary/12 text-primary" : "border-primary/12 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Sign In
                  </button>
                </div>

                {standardMode === "sign_out" ? (
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                    <div className="space-y-4">
                      <WorkspaceCard
                        title="Asset-first sign out"
                        body="Select available assets first, then assign them to one recipient in a single operation. This uses the live standard sign-out RPC and creates recipient approvals automatically."
                      />
                      <AssetSelectionList
                        assets={workspace.signOutAssets}
                        selectedIds={selectedSignOutAssetIds}
                        onToggle={(id) => toggleAsset(id, "sign_out")}
                        emptyTitle="No assets ready for sign out"
                        emptyBody="Available assets will appear here once the standard sign-out pool loads."
                      />
                    </div>

                    <div className="space-y-4">
                      <SelectionSummary
                        title="Selected sign-out batch"
                        items={selectedSignOutAssets}
                        emptyBody="No assets selected yet."
                      />
                      <SelectField
                        label="Recipient"
                        value={resolvedRecipientId}
                        onChange={setSelectedRecipientId}
                        options={workspace.recipients.map((recipient) => ({
                          label: `${recipient.full_name} | ${recipient.home_base ?? "No home base"} | ${recipient.role}`,
                          value: recipient.id,
                        }))}
                      />
                      <textarea
                        value={operationNote}
                        onChange={(event) => setOperationNote(event.target.value)}
                        placeholder="Optional sign-out note for history and recipient context"
                        className="matrix-field min-h-28 w-full rounded-[1.15rem] px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                      />
                      <button
                        type="button"
                        onClick={() => void handleSignOut()}
                        disabled={busy !== null || selectedSignOutAssetIds.length === 0 || !resolvedRecipientId}
                        className="matrix-button inline-flex h-12 w-full items-center justify-center gap-2 rounded-[1.15rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <CheckCircle2 size={16} />
                        {busy === "sign_out" ? "Signing Out" : `Run Standard Sign Out${selectedSignOutAssetIds.length > 0 ? ` (${selectedSignOutAssetIds.length})` : ""}`}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                    <div className="space-y-4">
                      <WorkspaceCard
                        title="Assigned-asset-first sign in"
                        body="Select assigned assets that are returning, then resolve them back into a final location as Available or Damaged. Damaged sign-ins follow the live damage-lock path."
                      />
                      <AssetSelectionList
                        assets={workspace.signInAssets}
                        selectedIds={selectedSignInAssetIds}
                        onToggle={(id) => toggleAsset(id, "sign_in")}
                        emptyTitle="No assets ready for sign in"
                        emptyBody="Assigned assets eligible for standard intake will appear here."
                      />
                    </div>

                    <div className="space-y-4">
                      <SelectionSummary
                        title="Selected sign-in batch"
                        items={selectedSignInAssets}
                        emptyBody="No assets selected yet."
                      />
                      <SelectField
                        label="Final location"
                        value={resolvedFinalLocationId}
                        onChange={setSelectedFinalLocationId}
                        options={workspace.locations.map((location) => ({
                          label: location.name,
                          value: location.id,
                        }))}
                      />
                      <SelectField
                        label="Outcome"
                        value={signInOutcome}
                        onChange={(value) => setSignInOutcome(value as "Available" | "Damaged")}
                        options={[
                          { label: "Available", value: "Available" },
                          { label: "Damaged", value: "Damaged" },
                        ]}
                      />
                      <textarea
                        value={operationNote}
                        onChange={(event) => setOperationNote(event.target.value)}
                        placeholder="Optional sign-in note for history and receiving context"
                        className="matrix-field min-h-28 w-full rounded-[1.15rem] px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                      />
                      <button
                        type="button"
                        onClick={() => void handleSignIn()}
                        disabled={busy !== null || selectedSignInAssetIds.length === 0 || !resolvedFinalLocationId}
                        className="matrix-button inline-flex h-12 w-full items-center justify-center gap-2 rounded-[1.15rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <CheckCircle2 size={16} />
                        {busy === "sign_in" ? "Signing In" : `Run Standard Sign In${selectedSignInAssetIds.length > 0 ? ` (${selectedSignInAssetIds.length})` : ""}`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "returns" && (
              <div className="space-y-4">
                <WorkspaceCard
                  title="Read-only returns monitoring surface"
                  body="This tab now loads the live return-request monitor feed where available. Decision-making still belongs in Approvals > Returns, while direct intake still belongs in Standard > Sign In."
                />
                <div className="grid gap-4 lg:grid-cols-3">
                  <MetricPanel label="Pending" value={String(returnSummary.pending)} />
                  <MetricPanel label="Accepted" value={String(returnSummary.accepted)} />
                  <MetricPanel label="Completed" value={String(returnSummary.completed)} />
                </div>
                <div className="space-y-3">
                  {workspace.returnMonitor.length === 0 ? (
                    <div className="rounded-[1rem] border border-dashed border-primary/14 px-4 py-10 text-center text-sm text-muted-foreground">
                      No return-monitor rows found.
                    </div>
                  ) : (
                    workspace.returnMonitor.map((row) => <ReturnMonitorCard key={row.id} row={row} />)
                  )}
                </div>
              </div>
            )}

            {activeTab === "permanent" && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPermanentMode("direct_issue")}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                      permanentMode === "direct_issue" ? "border-primary/26 bg-primary/12 text-primary" : "border-primary/12 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Direct Issue
                  </button>
                  <button
                    type="button"
                    onClick={() => setPermanentMode("reassign")}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                      permanentMode === "reassign" ? "border-primary/26 bg-primary/12 text-primary" : "border-primary/12 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Reassign
                  </button>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                  <div className="space-y-4">
                    <WorkspaceCard
                      title="Dedicated permanent-assignment workspace"
                      body={
                        permanentMode === "direct_issue"
                          ? "Issue available assets directly into a permanent holder relationship without routing them through the standard recipient-approval path."
                          : "Start from already assigned assets and move them to a different long-term holder with an explicit home-base target."
                      }
                    />
                    <AssetSelectionList
                      assets={permanentMode === "direct_issue" ? workspace.signOutAssets : workspace.signInAssets}
                      selectedIds={permanentMode === "direct_issue" ? selectedPermanentIssueAssetIds : selectedPermanentReassignAssetIds}
                      onToggle={(id) => togglePermanentAsset(id, permanentMode)}
                      emptyTitle={permanentMode === "direct_issue" ? "No assets ready for direct permanent issue" : "No assigned assets ready for permanent reassignment"}
                      emptyBody={
                        permanentMode === "direct_issue"
                          ? "Assets eligible for direct permanent issue will appear here."
                          : "Assigned assets eligible for permanent reassignment will appear here."
                      }
                    />
                  </div>

                  <div className="space-y-4">
                    <SelectionSummary
                      title={permanentMode === "direct_issue" ? "Selected permanent issue batch" : "Selected permanent reassignment batch"}
                      items={permanentMode === "direct_issue" ? selectedPermanentIssueAssets : selectedPermanentReassignAssets}
                      emptyBody="No assets selected yet."
                    />
                    <SelectField
                      label="Receiving user"
                      value={resolvedPermanentRecipientId}
                      onChange={setSelectedPermanentRecipientId}
                      options={workspace.recipients.map((recipient) => ({
                        label: `${recipient.full_name} | ${recipient.home_base ?? "No home base"} | ${recipient.role}`,
                        value: recipient.id,
                      }))}
                    />
                    <SelectField
                      label="Home base"
                      value={resolvedPermanentHomeBaseId}
                      onChange={setSelectedPermanentHomeBaseId}
                      options={workspace.locations.map((location) => ({
                        label: location.name,
                        value: location.id,
                      }))}
                    />
                    <textarea
                      value={permanentNote}
                      onChange={(event) => setPermanentNote(event.target.value)}
                      placeholder="Optional permanent-assignment note for audit and receiving context"
                      className="matrix-field min-h-28 w-full rounded-[1.15rem] px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => void handlePermanentAssignment()}
                      disabled={
                        busy !== null ||
                        (permanentMode === "direct_issue" ? selectedPermanentIssueAssetIds.length === 0 : selectedPermanentReassignAssetIds.length === 0) ||
                        !resolvedPermanentRecipientId ||
                        !resolvedPermanentHomeBaseId
                      }
                      className="matrix-button inline-flex h-12 w-full items-center justify-center gap-2 rounded-[1.15rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <UserCheck size={16} />
                      {busy === "permanent"
                        ? "Running Permanent Assignment"
                        : permanentMode === "direct_issue"
                          ? `Run Permanent Issue${selectedPermanentIssueAssetIds.length > 0 ? ` (${selectedPermanentIssueAssetIds.length})` : ""}`
                          : `Run Permanent Reassignment${selectedPermanentReassignAssetIds.length > 0 ? ` (${selectedPermanentReassignAssetIds.length})` : ""}`}
                    </button>
                    <div className="rounded-[1rem] border border-sky-500/18 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">
                      Permanent moves now run from this tab. Standard remains the shared temporary assignment flow, while sign-in still resolves the asset back into a final location later if needed.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "stationed" && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setStationedMode("temporary_use")}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                      stationedMode === "temporary_use" ? "border-primary/26 bg-primary/12 text-primary" : "border-primary/12 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Temporary Use
                  </button>
                  <button
                    type="button"
                    onClick={() => setStationedMode("return_to_site")}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                      stationedMode === "return_to_site" ? "border-primary/26 bg-primary/12 text-primary" : "border-primary/12 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Return To Site
                  </button>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                  <div className="space-y-4">
                    <WorkspaceCard
                      title="Site resting-state workspace"
                      body={
                        stationedMode === "temporary_use"
                          ? "Select stationed assets and assign them to a responsible user for temporary use. This moves them into the traveling state."
                          : "Bring traveling stationed assets back into a final site and resolve them as Stationed or Damaged."
                      }
                    />
                    <AssetSelectionList
                      assets={stationedMode === "temporary_use" ? workspace.stationedReadyAssets : workspace.stationedActiveAssets}
                      selectedIds={stationedMode === "temporary_use" ? selectedStationedCheckoutAssetIds : selectedStationedCheckInAssetIds}
                      onToggle={(id) => toggleStationedAsset(id, stationedMode)}
                      emptyTitle={stationedMode === "temporary_use" ? "No stationed assets ready for temporary use" : "No stationed-traveling assets ready for return"}
                      emptyBody={
                        stationedMode === "temporary_use"
                          ? "Assets currently resting at a site will appear here."
                          : "Traveling assets coming back into the stationed model will appear here."
                      }
                    />
                  </div>

                  <div className="space-y-4">
                    <SelectionSummary
                      title={stationedMode === "temporary_use" ? "Selected stationed checkout batch" : "Selected stationed return batch"}
                      items={stationedMode === "temporary_use" ? selectedStationedCheckoutAssets : selectedStationedCheckInAssets}
                      emptyBody="No assets selected yet."
                    />
                    {stationedMode === "temporary_use" ? (
                      <SelectField
                        label="Responsible user"
                        value={resolvedStationedRecipientId}
                        onChange={setSelectedStationedRecipientId}
                        options={workspace.recipients.map((recipient) => ({
                          label: `${recipient.full_name} | ${recipient.home_base ?? "No home base"} | ${recipient.role}`,
                          value: recipient.id,
                        }))}
                      />
                    ) : (
                      <>
                        <SelectField
                          label="Return site"
                          value={resolvedStationedLocationId}
                          onChange={setSelectedStationedLocationId}
                          options={workspace.locations.map((location) => ({
                            label: location.name,
                            value: location.id,
                          }))}
                        />
                        <SelectField
                          label="Outcome"
                          value={stationedOutcome}
                          onChange={(value) => setStationedOutcome(value as "Stationed" | "Damaged")}
                          options={[
                            { label: "Stationed", value: "Stationed" },
                            { label: "Damaged", value: "Damaged" },
                          ]}
                        />
                      </>
                    )}
                    <textarea
                      value={stationedNote}
                      onChange={(event) => setStationedNote(event.target.value)}
                      placeholder={
                        stationedMode === "temporary_use"
                          ? "Optional temporary-use note for audit and handoff context"
                          : "Optional return note for receiving context and damage audit"
                      }
                      className="matrix-field min-h-28 w-full rounded-[1.15rem] px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => void handleStationedOperation()}
                      disabled={
                        busy !== null ||
                        (stationedMode === "temporary_use"
                          ? selectedStationedCheckoutAssetIds.length === 0 || !resolvedStationedRecipientId
                          : selectedStationedCheckInAssetIds.length === 0 || !resolvedStationedLocationId)
                      }
                      className="matrix-button inline-flex h-12 w-full items-center justify-center gap-2 rounded-[1.15rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ShieldCheck size={16} />
                      {busy === "stationed"
                        ? "Running Stationed Operation"
                        : stationedMode === "temporary_use"
                          ? `Run Temporary Use${selectedStationedCheckoutAssetIds.length > 0 ? ` (${selectedStationedCheckoutAssetIds.length})` : ""}`
                          : `Run Return To Site${selectedStationedCheckInAssetIds.length > 0 ? ` (${selectedStationedCheckInAssetIds.length})` : ""}`}
                    </button>
                    <div className="rounded-[1rem] border border-sky-500/18 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">
                      Stationed now runs as its own site-resting workflow. Temporary use pushes assets into Traveling, and return intake can resolve them back to Stationed or into the damage path.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "sunday_kits" && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSundayKitsMode("deploy")}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                      sundayKitsMode === "deploy" ? "border-primary/26 bg-primary/12 text-primary" : "border-primary/12 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Deploy
                  </button>
                  <button
                    type="button"
                    onClick={() => setSundayKitsMode("returns")}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                      sundayKitsMode === "returns" ? "border-primary/26 bg-primary/12 text-primary" : "border-primary/12 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Returns
                  </button>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                  <div className="space-y-4">
                    <WorkspaceCard
                      title="Saved-kit deployment workspace"
                      body={
                        sundayKitsMode === "deploy"
                          ? "Deploy one saved Sunday kit at a time from the live kits list into a responsible-user workflow."
                          : "Record partial or complete returns against live Sunday kit deployments using returned and damaged item counts."
                      }
                    />

                    {sundayKitsMode === "deploy" ? (
                      <div className="space-y-3">
                        {workspace.sundayKits.length === 0 ? (
                          <div className="rounded-[1rem] border border-dashed border-primary/14 px-4 py-10 text-center text-sm text-muted-foreground">
                            No saved kits available.
                          </div>
                        ) : (
                          workspace.sundayKits.map((kit) => {
                            const selected = kit.id === resolvedSundayKitId;
                            return (
                              <button
                                key={kit.id}
                                type="button"
                                onClick={() => setSelectedSundayKitId(kit.id)}
                                className={cn("matrix-dashboard-bubble w-full p-4 text-left", selected && "border-primary/34")}
                              >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0">
                                    <div className="font-display text-xl text-foreground glow-soft">{kit.name}</div>
                                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                      <span>{kit.home_base ?? "No home base"}</span>
                                      <span>{kit.item_count} item{kit.item_count === 1 ? "" : "s"}</span>
                                    </div>
                                  </div>
                                  <span className={cn("inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]", selected ? "border-primary/26 bg-primary/12 text-primary" : "border-primary/12 text-muted-foreground")}>
                                    {selected ? "Selected" : kit.active ? "Active" : "Inactive"}
                                  </span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {workspace.sundayKitDeployments.length === 0 ? (
                          <div className="rounded-[1rem] border border-dashed border-primary/14 px-4 py-10 text-center text-sm text-muted-foreground">
                            No Sunday kit deployments found.
                          </div>
                        ) : (
                          workspace.sundayKitDeployments.map((deployment) => (
                            <button
                              key={deployment.id}
                              type="button"
                              onClick={() => setSelectedSundayDeploymentId(deployment.id)}
                              className={cn("matrix-dashboard-bubble w-full p-4 text-left", deployment.id === resolvedSundayDeploymentId && "border-primary/34")}
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <div className="font-display text-xl text-foreground glow-soft">{deployment.kit_name}</div>
                                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                    <span>{deployment.deployed_location}</span>
                                    <span>{deployment.responsible_user}</span>
                                    <span>{deployment.returned_count + deployment.damaged_count}/{deployment.item_count} returned</span>
                                  </div>
                                </div>
                                <span className="inline-flex rounded-full border border-primary/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                                  {deployment.status}
                                </span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {sundayKitsMode === "deploy" ? (
                      <>
                        <SundayKitSummaryCard kit={selectedSundayKit} />
                        <SelectField
                          label="Responsible user"
                          value={resolvedSundayKitRecipientId}
                          onChange={setSelectedSundayKitRecipientId}
                          options={workspace.recipients.map((recipient) => ({
                            label: `${recipient.full_name} | ${recipient.home_base ?? "No home base"} | ${recipient.role}`,
                            value: recipient.id,
                          }))}
                        />
                        <SelectField
                          label="Deployment location"
                          value={resolvedSundayKitLocationId}
                          onChange={setSelectedSundayKitLocationId}
                          options={workspace.locations.map((location) => ({
                            label: location.name,
                            value: location.id,
                          }))}
                        />
                      </>
                    ) : (
                      <>
                        <SundayDeploymentSummaryCard deployment={selectedSundayDeployment} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <NumberField label="Returned count" value={sundayReturnedCount} onChange={setSundayReturnedCount} />
                          <NumberField label="Damaged count" value={sundayDamagedCount} onChange={setSundayDamagedCount} />
                        </div>
                      </>
                    )}
                    <textarea
                      value={sundayKitsNote}
                      onChange={(event) => setSundayKitsNote(event.target.value)}
                      placeholder={sundayKitsMode === "deploy" ? "Optional deployment note" : "Optional partial-return note"}
                      className="matrix-field min-h-28 w-full rounded-[1.15rem] px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSundayKitsOperation()}
                      disabled={
                        busy !== null ||
                        (sundayKitsMode === "deploy"
                          ? !selectedSundayKit || !resolvedSundayKitRecipientId || !resolvedSundayKitLocationId
                          : !resolvedSundayDeploymentId)
                      }
                      className="matrix-button inline-flex h-12 w-full items-center justify-center gap-2 rounded-[1.15rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Boxes size={16} />
                      {busy === "sunday_kits"
                        ? "Running Sunday Kits Operation"
                        : sundayKitsMode === "deploy"
                          ? "Deploy Sunday Kit"
                          : "Record Sunday Kit Return"}
                    </button>
                    <div className="rounded-[1rem] border border-sky-500/18 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">
                      This first live pass tracks kit deployment and partial returns in a dedicated ledger. Full item-level return resolution is still intentionally deferred.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "qr_scan" && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setQrMode("sign_out")}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                      qrMode === "sign_out" ? "border-primary/26 bg-primary/12 text-primary" : "border-primary/12 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Sign Out
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrMode("sign_in")}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                      qrMode === "sign_in" ? "border-primary/26 bg-primary/12 text-primary" : "border-primary/12 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Sign In
                  </button>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                  <div className="space-y-4">
                    <WorkspaceCard
                      title="Bulk QR in-tab operations"
                      body="Camera integration is still deferred, but this tab now supports live manual scan batches: paste or scan multiple asset codes, resolve them against the live asset table, then run one compatible batch action."
                    />
                    <textarea
                      value={qrCodesInput}
                      onChange={(event) => setQrCodesInput(event.target.value)}
                      placeholder="Paste or scan one asset code per line, or separate codes with commas"
                      className="matrix-field min-h-36 w-full rounded-[1.15rem] px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => void resolveQrBatch()}
                      disabled={busy !== null || !qrCodesInput.trim()}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[1rem] border border-primary/18 bg-card/55 px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <QrCode size={15} />
                      {busy === "qr" ? "Resolving Batch" : "Resolve Batch"}
                    </button>
                    <div className="rounded-[1rem] border border-sky-500/18 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">
                      This first live pass uses manual scan input instead of camera capture, but still executes one real operational batch at a time.
                    </div>
                  </div>

                  <div className="space-y-4">
                    <SelectionSummary
                      title="Resolved QR batch"
                      items={resolvedQrAssets}
                      emptyBody="No resolved assets yet."
                    />
                    {qrMode === "sign_out" ? (
                      <SelectField
                        label="Recipient"
                        value={resolvedQrRecipientId}
                        onChange={setSelectedQrRecipientId}
                        options={workspace.recipients.map((recipient) => ({
                          label: `${recipient.full_name} | ${recipient.home_base ?? "No home base"} | ${recipient.role}`,
                          value: recipient.id,
                        }))}
                      />
                    ) : (
                      <>
                        <SelectField
                          label="Final location"
                          value={resolvedQrLocationId}
                          onChange={setSelectedQrLocationId}
                          options={workspace.locations.map((location) => ({
                            label: location.name,
                            value: location.id,
                          }))}
                        />
                        <SelectField
                          label="Outcome"
                          value={qrSignInOutcome}
                          onChange={(value) => setQrSignInOutcome(value as "Available" | "Damaged")}
                          options={[
                            { label: "Available", value: "Available" },
                            { label: "Damaged", value: "Damaged" },
                          ]}
                        />
                      </>
                    )}
                    <textarea
                      value={qrNote}
                      onChange={(event) => setQrNote(event.target.value)}
                      placeholder="Optional batch note for QR/manual scan execution"
                      className="matrix-field min-h-28 w-full rounded-[1.15rem] px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => void runQrBatch()}
                      disabled={
                        busy !== null ||
                        resolvedQrAssets.length === 0 ||
                        (qrMode === "sign_out" ? !resolvedQrRecipientId : !resolvedQrLocationId)
                      }
                      className="matrix-button inline-flex h-12 w-full items-center justify-center gap-2 rounded-[1.15rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ScanLine size={16} />
                      {busy === "qr"
                        ? "Running QR Batch"
                        : qrMode === "sign_out"
                          ? `Run QR Sign Out${resolvedQrAssets.length > 0 ? ` (${resolvedQrAssets.length})` : ""}`
                          : `Run QR Sign In${resolvedQrAssets.length > 0 ? ` (${resolvedQrAssets.length})` : ""}`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </SectionShell>
  );
}

function AssetSelectionList({
  assets,
  selectedIds,
  onToggle,
  emptyTitle,
  emptyBody,
}: {
  assets: StandardAssetRecord[];
  selectedIds: string[];
  onToggle: (assetId: string) => void;
  emptyTitle: string;
  emptyBody: string;
}) {
  if (assets.length === 0) {
    return (
      <div className="rounded-[1rem] border border-dashed border-primary/14 px-4 py-10 text-center">
        <div className="font-display text-2xl text-foreground glow-soft">{emptyTitle}</div>
        <div className="mt-3 text-sm text-muted-foreground">{emptyBody}</div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {assets.map((asset) => {
        const selected = selectedIds.includes(asset.id);
        return (
          <button
            key={asset.id}
            type="button"
            onClick={() => onToggle(asset.id)}
            className={cn("matrix-dashboard-bubble p-4 text-left", selected && "border-primary/34")}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="font-mono text-sm uppercase tracking-[0.14em] text-primary">{asset.tag}</div>
                <div className="mt-1 font-display text-xl text-foreground glow-soft">{asset.name}</div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>{asset.serial_number}</span>
                  <span>{asset.current_location ?? "No location"}</span>
                  <span>{asset.department ?? "No department"}</span>
                  {asset.holder && <span>{asset.holder}</span>}
                </div>
              </div>
              <span
                className={cn(
                  "inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                  selected ? "border-primary/26 bg-primary/12 text-primary" : "border-primary/12 text-muted-foreground",
                )}
              >
                {selected ? "Selected" : asset.state}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function SelectionSummary({
  title,
  items,
  emptyBody,
}: {
  title: string;
  items: StandardAssetRecord[];
  emptyBody: string;
}) {
  return (
    <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 p-4">
      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary/72">{title}</div>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <div className="rounded-[1rem] border border-dashed border-primary/14 px-4 py-8 text-center text-sm text-muted-foreground">{emptyBody}</div>
        ) : (
          items.map((asset) => (
            <div key={asset.id} className="rounded-[1rem] border border-primary/12 bg-card/35 px-3 py-3">
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-primary">{asset.tag}</div>
              <div className="mt-1 text-sm text-foreground">{asset.name}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SundayKitSummaryCard({ kit }: { kit: SundayKitRecord | null }) {
  return (
    <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 p-4">
      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary/72">Selected Sunday kit</div>
      {kit ? (
        <div className="mt-3 space-y-2">
          <div className="font-display text-xl text-foreground glow-soft">{kit.name}</div>
          <div className="text-sm text-muted-foreground">{kit.home_base ?? "No home base"} | {kit.item_count} item{kit.item_count === 1 ? "" : "s"}</div>
        </div>
      ) : (
        <div className="mt-3 rounded-[1rem] border border-dashed border-primary/14 px-4 py-8 text-center text-sm text-muted-foreground">
          No kit selected yet.
        </div>
      )}
    </div>
  );
}

function SundayDeploymentSummaryCard({ deployment }: { deployment: SundayKitDeploymentRecord | null }) {
  return (
    <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 p-4">
      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary/72">Selected deployment</div>
      {deployment ? (
        <div className="mt-3 space-y-2">
          <div className="font-display text-xl text-foreground glow-soft">{deployment.kit_name}</div>
          <div className="text-sm text-muted-foreground">
            {deployment.deployed_location} | {deployment.responsible_user} | {deployment.returned_count + deployment.damaged_count}/{deployment.item_count} returned
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-[1rem] border border-dashed border-primary/14 px-4 py-8 text-center text-sm text-muted-foreground">
          No deployment selected yet.
        </div>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <label className="space-y-2">
      <span className="font-mono text-xs uppercase tracking-[0.14em] text-primary/72">{label}</span>
      <div className="matrix-field rounded-[1.15rem] px-4">
        <select value={value} onChange={(event) => onChange(event.target.value)} className="h-12 w-full bg-transparent text-sm text-foreground outline-none">
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-[hsl(var(--card))] text-foreground">
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="font-mono text-xs uppercase tracking-[0.14em] text-primary/72">{label}</span>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="matrix-field h-12 w-full rounded-[1.15rem] px-4 text-sm text-foreground outline-none"
      />
    </label>
  );
}

function ReturnMonitorCard({ row }: { row: ReturnRequestMonitorRecord }) {
  const statusClass =
    row.status === "Completed"
      ? "border-primary/26 bg-primary/10 text-primary"
      : row.status === "Accepted"
        ? "border-sky-500/26 bg-sky-500/10 text-sky-300"
        : row.status === "Declined"
          ? "border-destructive/20 bg-destructive/10 text-destructive"
          : "border-amber-500/24 bg-amber-500/10 text-amber-300";

  return (
    <div className="app-panel p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="font-display text-2xl text-foreground glow-soft">{row.preferred_return_location ?? "Unknown return location"}</div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>Workflow: {row.workflow_status ?? "-"}</span>
            <span>Created: {new Date(row.created_at).toLocaleString()}</span>
            <span>Request ID: {row.request_id ?? "-"}</span>
          </div>
          {row.note && <div className="mt-3 rounded-[1rem] border border-primary/10 bg-card/40 px-4 py-3 text-sm text-muted-foreground">{row.note}</div>}
        </div>
        <span className={cn("inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]", statusClass)}>{row.status}</span>
      </div>
    </div>
  );
}

function WorkspaceCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="app-panel p-4">
      <div className="app-kicker">Workspace intent</div>
      <div className="mt-2 font-display text-2xl text-foreground glow-soft">{title}</div>
      <p className="mt-3 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function MetricPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-primary/12 bg-card/45 px-4 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm text-foreground">{value}</div>
    </div>
  );
}

function summarizeReturns(rows: ReturnRequestMonitorRecord[]) {
  return rows.reduce(
    (summary, row) => {
      if (row.status === "Pending") summary.pending += 1;
      if (row.status === "Accepted") summary.accepted += 1;
      if (row.status === "Completed") summary.completed += 1;
      return summary;
    },
    { pending: 0, accepted: 0, completed: 0 },
  );
}
