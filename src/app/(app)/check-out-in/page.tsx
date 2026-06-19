"use client";

import { AlertTriangle, ArrowRightLeft, Boxes, CheckCircle2, QrCode, RefreshCcw, RotateCcw, ScanLine, ShieldCheck, UserCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useAuth } from "@/contexts/auth-context";
import {
  deploySundayKit,
  getFallbackCheckOperationsWorkspace,
  loadCheckOperationsWorkspace,
  loadSundayKitDeploymentItems,
  resolveOperationalAssetsByCodes,
  returnSundayKitDeployment,
  returnSundayKitDeploymentItems,
  runPermanentAssignment,
  runStationedCheckIn,
  runStationedCheckout,
  runStandardSignIn,
  runStandardSignOut,
  type CheckOperationsWorkspaceData,
  type SundayKitDeploymentItemRecord,
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

function isOpsTab(value: string | null): value is OpsTab {
  return tabMeta.some((tab) => tab.id === value);
}

function parseQrCodes(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((code) => code.trim())
    .filter(Boolean);
}

function mergeQrCodes(currentValue: string, nextCodes: string[]) {
  const merged = [...new Set([...parseQrCodes(currentValue), ...nextCodes.map((code) => code.trim()).filter(Boolean)])];
  return merged.join("\n");
}

export default function CheckOutInPage() {
  const searchParams = useSearchParams();
  const requestedTabValue = searchParams.get("tab");
  const requestedTab: OpsTab | null = isOpsTab(requestedTabValue) ? requestedTabValue : null;
  const requestedMode = searchParams.get("mode");
  const requestedAssetId = searchParams.get("assetId");
  const { isAdmin, isAssetManager, isConfigured } = useAuth();
  const [workspace, setWorkspace] = useState<CheckOperationsWorkspaceData>(() => ({
    ...getFallbackCheckOperationsWorkspace(),
    warnings: [],
  }));
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<OpsTab>(requestedTab ?? "standard");
  const [standardMode, setStandardMode] = useState<"sign_out" | "sign_in">(requestedTab === "standard" && requestedMode === "sign_in" ? "sign_in" : "sign_out");
  const [permanentMode, setPermanentMode] = useState<"direct_issue" | "reassign">(requestedTab === "permanent" && requestedMode === "reassign" ? "reassign" : "direct_issue");
  const [stationedMode, setStationedMode] = useState<"temporary_use" | "return_to_site">(
    requestedTab === "stationed" && requestedMode === "return_to_site" ? "return_to_site" : "temporary_use",
  );
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
  const [stationedOutcome, setStationedOutcome] = useState<"Stationed" | "Available" | "Damaged">("Stationed");
  const [qrCodesInput, setQrCodesInput] = useState("");
  const [resolvedQrAssets, setResolvedQrAssets] = useState<StandardAssetRecord[]>([]);
  const [unresolvedQrInputs, setUnresolvedQrInputs] = useState<string[]>([]);
  const [selectedQrRecipientId, setSelectedQrRecipientId] = useState("");
  const [selectedQrLocationId, setSelectedQrLocationId] = useState("");
  const [qrSignInOutcome, setQrSignInOutcome] = useState<"Available" | "Damaged">("Available");
  const [qrCameraActive, setQrCameraActive] = useState(false);
  const [qrCameraError, setQrCameraError] = useState<string | null>(null);
  const [qrCameraStatus, setQrCameraStatus] = useState("Camera scan is ready when supported by this browser.");
  const [selectedSundayKitId, setSelectedSundayKitId] = useState("");
  const [selectedSundayKitRecipientId, setSelectedSundayKitRecipientId] = useState("");
  const [selectedSundayKitLocationId, setSelectedSundayKitLocationId] = useState("");
  const [selectedSundayDeploymentId, setSelectedSundayDeploymentId] = useState("");
  const [sundayReturnedCount, setSundayReturnedCount] = useState("0");
  const [sundayDamagedCount, setSundayDamagedCount] = useState("0");
  const [sundayDeploymentItems, setSundayDeploymentItems] = useState<SundayKitDeploymentItemRecord[]>([]);
  const [sundayDeploymentItemsSource, setSundayDeploymentItemsSource] = useState<"live" | "fallback">("fallback");
  const [sundayDeploymentItemWarnings, setSundayDeploymentItemWarnings] = useState<string[]>([]);
  const [loadingSundayDeploymentItems, setLoadingSundayDeploymentItems] = useState(false);
  const [sundayReturnOutcomes, setSundayReturnOutcomes] = useState<Record<string, "Available" | "Damaged">>({});
  const [operationNote, setOperationNote] = useState("");
  const [permanentNote, setPermanentNote] = useState("");
  const [stationedNote, setStationedNote] = useState("");
  const [qrNote, setQrNote] = useState("");
  const [sundayKitsNote, setSundayKitsNote] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [busy, setBusy] = useState<"sign_out" | "sign_in" | "permanent" | "stationed" | "qr" | "sunday_kits" | null>(null);
  const qrVideoRef = useRef<HTMLVideoElement | null>(null);
  const qrImportInputRef = useRef<HTMLInputElement | null>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);
  const qrAnimationFrameRef = useRef<number | null>(null);
  const qrDetectedCodesRef = useRef<Set<string>>(new Set());
  const qrDetectingRef = useRef(false);
  const qrCameraSupported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "mediaDevices" in navigator &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    "BarcodeDetector" in window;

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
        if (requestedAssetId) {
          if (requestedTab === "standard") {
            if (requestedMode === "sign_in") {
              if (nextWorkspace.signInAssets.some((asset) => asset.id === requestedAssetId)) {
                setSelectedSignInAssetIds((current) => (current.includes(requestedAssetId) ? current : [...current, requestedAssetId]));
              }
            } else if (nextWorkspace.signOutAssets.some((asset) => asset.id === requestedAssetId)) {
              setSelectedSignOutAssetIds((current) => (current.includes(requestedAssetId) ? current : [...current, requestedAssetId]));
            }
          } else if (requestedTab === "stationed") {
            if (requestedMode === "return_to_site") {
              if (nextWorkspace.stationedActiveAssets.some((asset) => asset.id === requestedAssetId)) {
                setSelectedStationedCheckInAssetIds((current) => (current.includes(requestedAssetId) ? current : [...current, requestedAssetId]));
              }
            } else if (nextWorkspace.stationedReadyAssets.some((asset) => asset.id === requestedAssetId)) {
              setSelectedStationedCheckoutAssetIds((current) => (current.includes(requestedAssetId) ? current : [...current, requestedAssetId]));
            }
          } else if (requestedTab === "permanent") {
            if (requestedMode === "reassign") {
              if (nextWorkspace.signInAssets.some((asset) => asset.id === requestedAssetId)) {
                setSelectedPermanentReassignAssetIds((current) => (current.includes(requestedAssetId) ? current : [...current, requestedAssetId]));
              }
            } else if (nextWorkspace.signOutAssets.some((asset) => asset.id === requestedAssetId)) {
              setSelectedPermanentIssueAssetIds((current) => (current.includes(requestedAssetId) ? current : [...current, requestedAssetId]));
            }
          }
        }
      }
    };

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [isConfigured, requestedAssetId, requestedMode, requestedTab]);

  useEffect(() => {
    const video = qrVideoRef.current;

    return () => {
      if (qrAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(qrAnimationFrameRef.current);
      }
      qrStreamRef.current?.getTracks().forEach((track) => track.stop());
      qrStreamRef.current = null;
      if (video) {
        video.srcObject = null;
      }
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "qr_scan" && qrCameraActive) {
      stopQrCamera();
    }
  }, [activeTab, qrCameraActive]);

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
  const pendingSundayDeploymentItems = useMemo(
    () => sundayDeploymentItems.filter((item) => item.return_status === "Pending"),
    [sundayDeploymentItems],
  );
  const resolvedSundayDeploymentItems = useMemo(
    () => sundayDeploymentItems.filter((item) => item.return_status !== "Pending"),
    [sundayDeploymentItems],
  );
  const selectedSundayItemResolutions = useMemo(
    () =>
      pendingSundayDeploymentItems
        .filter((item) => sundayReturnOutcomes[item.id])
        .map((item) => ({
          itemId: item.id,
          outcome: sundayReturnOutcomes[item.id],
        })),
    [pendingSundayDeploymentItems, sundayReturnOutcomes],
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

  useEffect(() => {
    let cancelled = false;

    const loadItems = async () => {
      if (sundayKitsMode !== "returns" || !resolvedSundayDeploymentId) {
        if (!cancelled) {
          setSundayDeploymentItems([]);
          setSundayDeploymentItemWarnings([]);
          setSundayReturnOutcomes({});
          setLoadingSundayDeploymentItems(false);
        }
        return;
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase || !isConfigured) {
        if (!cancelled) {
          setSundayDeploymentItems([]);
          setSundayDeploymentItemsSource("fallback");
          setSundayDeploymentItemWarnings(["Sunday kit item-level returns are unavailable until Supabase is configured."]);
          setSundayReturnOutcomes({});
          setLoadingSundayDeploymentItems(false);
        }
        return;
      }

      if (!cancelled) {
        setLoadingSundayDeploymentItems(true);
      }

      try {
        const result = await loadSundayKitDeploymentItems(supabase, resolvedSundayDeploymentId);
        if (!cancelled) {
          setSundayDeploymentItems(result.items);
          setSundayDeploymentItemsSource(result.source);
          setSundayDeploymentItemWarnings(result.warnings);
          setSundayReturnOutcomes({});
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Sunday kit deployment items could not be loaded.";
          setSundayDeploymentItems([]);
          setSundayDeploymentItemsSource("fallback");
          setSundayDeploymentItemWarnings([message]);
          setSundayReturnOutcomes({});
        }
      } finally {
        if (!cancelled) {
          setLoadingSundayDeploymentItems(false);
        }
      }
    };

    void loadItems();

    return () => {
      cancelled = true;
    };
  }, [isConfigured, resolvedSundayDeploymentId, sundayKitsMode]);

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

  function stopQrCamera() {
    if (qrAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(qrAnimationFrameRef.current);
      qrAnimationFrameRef.current = null;
    }
    qrStreamRef.current?.getTracks().forEach((track) => track.stop());
    qrStreamRef.current = null;
    if (qrVideoRef.current) {
      qrVideoRef.current.srcObject = null;
    }
    qrDetectingRef.current = false;
    setQrCameraActive(false);
    setQrCameraStatus("Camera stopped. You can still paste or scan codes into the batch field.");
  }

  const startQrCamera = async () => {
    if (!qrCameraSupported) {
      setQrCameraError("This browser does not support in-tab camera barcode detection. Use the manual batch field instead.");
      return;
    }

    const BarcodeDetectorCtor = (window as Window & typeof globalThis & {
      BarcodeDetector?: new (options?: { formats?: string[] }) => {
        detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
      };
    }).BarcodeDetector;

    if (!BarcodeDetectorCtor) {
      setQrCameraError("Barcode detection is not available in this browser. Use the manual batch field instead.");
      return;
    }

    try {
      stopQrCamera();
      setQrCameraError(null);
      setQrCameraStatus("Starting camera scan...");
      qrDetectedCodesRef.current = new Set(parseQrCodes(qrCodesInput));

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });

      qrStreamRef.current = stream;

      if (qrVideoRef.current) {
        qrVideoRef.current.srcObject = stream;
        await qrVideoRef.current.play();
      }

      const detector = new BarcodeDetectorCtor({
        formats: ["qr_code"],
      });

      setQrCameraActive(true);
      setQrCameraStatus("Camera is live. New QR codes will be appended to the batch field.");

      const scanFrame = async () => {
        if (!qrVideoRef.current || !qrStreamRef.current) {
          return;
        }

        if (!qrDetectingRef.current && qrVideoRef.current.readyState >= 2) {
          qrDetectingRef.current = true;
          try {
            const codes = await detector.detect(qrVideoRef.current);
            const nextCodes = codes
              .map((code) => code.rawValue?.trim() ?? "")
              .filter(Boolean)
              .filter((code) => !qrDetectedCodesRef.current.has(code));

            if (nextCodes.length > 0) {
              nextCodes.forEach((code) => qrDetectedCodesRef.current.add(code));
              setQrCodesInput((current) => mergeQrCodes(current, nextCodes));
              setResolvedQrAssets([]);
              setUnresolvedQrInputs([]);
              setQrCameraStatus(`Camera captured ${qrDetectedCodesRef.current.size} unique code${qrDetectedCodesRef.current.size === 1 ? "" : "s"} in this batch.`);
            }
          } catch {
            // Ignore per-frame detection errors and keep the camera session alive.
          } finally {
            qrDetectingRef.current = false;
          }
        }

        qrAnimationFrameRef.current = window.requestAnimationFrame(() => {
          void scanFrame();
        });
      };

      qrAnimationFrameRef.current = window.requestAnimationFrame(() => {
        void scanFrame();
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Camera scan could not start.";
      stopQrCamera();
      setQrCameraError(message);
    }
  };

  const resolveQrBatch = async () => {
    const codes = parseQrCodes(qrCodesInput);

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
      const result = await resolveOperationalAssetsByCodes(supabase, { codes });
      setResolvedQrAssets(result.assets);
      setUnresolvedQrInputs(result.unresolvedInputs);
      if (result.assets.length === 0) {
        setFeedback({
          tone: "error",
          message:
            result.unresolvedInputs.length > 0
              ? `No assets matched this batch. ${result.unresolvedInputs.length} scan${result.unresolvedInputs.length === 1 ? "" : "s"} did not resolve.`
              : "No assets matched this batch.",
        });
        return;
      }
      setFeedback({
        tone: result.unresolvedInputs.length > 0 ? "info" : "success",
        message:
          result.unresolvedInputs.length > 0
            ? `Resolved ${result.assets.length} asset item${result.assets.length === 1 ? "" : "s"}. ${result.unresolvedInputs.length} scan${result.unresolvedInputs.length === 1 ? "" : "s"} did not resolve and will be skipped.`
            : `Resolved ${result.assets.length} asset item${result.assets.length === 1 ? "" : "s"} from the QR/manual batch.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "QR batch resolution failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusy(null);
    }
  };

  const importQrBatchFile = async (file: File | null) => {
    if (!file) return;

    try {
      const rawText = await file.text();
      const importedCodes = parseQrCodes(rawText);

      if (importedCodes.length === 0) {
        setFeedback({ tone: "error", message: "The selected file did not contain any usable QR or asset-code entries." });
        return;
      }

      setQrCodesInput((current) => mergeQrCodes(current, importedCodes));
      setResolvedQrAssets([]);
      setUnresolvedQrInputs([]);
      setQrCameraStatus(`Imported ${importedCodes.length} code${importedCodes.length === 1 ? "" : "s"} from ${file.name}.`);
      setFeedback({
        tone: "success",
        message: `Imported ${importedCodes.length} QR or asset-code entr${importedCodes.length === 1 ? "y" : "ies"} from ${file.name}. Resolve the batch to continue.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The selected batch file could not be read.";
      setFeedback({ tone: "error", message });
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
      setUnresolvedQrInputs([]);
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
        if (!resolvedSundayDeploymentId) {
          setFeedback({ tone: "error", message: "Choose a deployment first." });
          return;
        }
        if (sundayDeploymentItemsSource === "live") {
          if (pendingSundayDeploymentItems.length === 0) {
            setFeedback({ tone: "info", message: "All Sunday kit items on this deployment are already resolved." });
            return;
          }
          if (selectedSundayItemResolutions.length === 0) {
            setFeedback({ tone: "error", message: "Choose at least one pending Sunday kit item outcome first." });
            return;
          }

          const { error } = await returnSundayKitDeploymentItems(supabase, {
            deploymentId: resolvedSundayDeploymentId,
            itemResolutions: selectedSundayItemResolutions,
            note: sundayKitsNote,
          });
          if (error) throw error;

          setFeedback({
            tone: "success",
            message: `${selectedSundayItemResolutions.length} Sunday kit item${selectedSundayItemResolutions.length === 1 ? "" : "s"} resolved in the live deployment ledger.`,
          });
          setSundayReturnOutcomes({});
        } else {
          const returnedCount = Number.parseInt(sundayReturnedCount, 10);
          const damagedCount = Number.parseInt(sundayDamagedCount, 10);
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
            message: "Sunday kit partial return recorded into the legacy deployment ledger.",
          });
          setSundayReturnedCount("0");
          setSundayDamagedCount("0");
        }
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
        <section className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="app-kicker">Check-out/In</div>
              <h1 className="page-title mt-2">Check-out/In</h1>
            </div>
            <div className="inline-flex items-center gap-2 text-sm text-primary/80">
              <ArrowRightLeft size={15} />
              <span className="page-meta-item text-primary/80 normal-case tracking-normal">
                {workspace.source === "live" ? "Live data" : workspace.source === "mixed" ? "Mixed data" : "Fallback preview"}
              </span>
            </div>
          </div>

          <div className="page-meta-row">
            <button
              type="button"
              onClick={() => void refreshWorkspace()}
              disabled={loading || busy !== null}
              className="inline-flex items-center gap-2 rounded-full border border-primary/18 bg-card/55 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw size={14} className={cn(loading && "animate-spin")} />
              {loading ? "Refreshing" : "Refresh"}
            </button>
            <span className="page-meta-item">
              Sign-out pool: {workspace.signOutAssets.length}
            </span>
            <span className="page-meta-item">
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
                    <div className="space-y-4 rounded-[1.35rem] border border-primary/12 bg-card/20 p-4">
                      <AssetSelectionList
                        assets={workspace.signOutAssets}
                        selectedIds={selectedSignOutAssetIds}
                        onToggle={(id) => toggleAsset(id, "sign_out")}
                        emptyTitle="No assets ready for sign out"
                        emptyBody="Available assets will appear here once the standard sign-out pool loads."
                      />
                    </div>

                    <div className="space-y-4 rounded-[1.35rem] border border-primary/12 bg-card/20 p-4">
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
                    <div className="space-y-4 rounded-[1.35rem] border border-primary/12 bg-card/20 p-4">
                      <AssetSelectionList
                        assets={workspace.signInAssets}
                        selectedIds={selectedSignInAssetIds}
                        onToggle={(id) => toggleAsset(id, "sign_in")}
                        emptyTitle="No assets ready for sign in"
                        emptyBody="Assigned assets eligible for standard intake will appear here."
                      />
                    </div>

                    <div className="space-y-4 rounded-[1.35rem] border border-primary/12 bg-card/20 p-4">
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
                    <div className="text-sm text-muted-foreground">Use Standard for temporary assignments and Sign In for final returns.</div>
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
                          onChange={(value) => setStationedOutcome(value as "Stationed" | "Available" | "Damaged")}
                          options={[
                            { label: "Stationed", value: "Stationed" },
                            { label: "Available", value: "Available" },
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
                      Stationed now runs as its own site-resting workflow. Temporary use pushes assets into Traveling, and return intake can resolve them back to Stationed, Available, or into the damage path.
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
                        {loadingSundayDeploymentItems ? (
                          <div className="rounded-[1rem] border border-primary/12 bg-card/45 px-4 py-3 text-sm text-muted-foreground">
                            Loading deployment items...
                          </div>
                        ) : sundayDeploymentItemsSource === "live" ? (
                          <div className="space-y-4">
                            {sundayDeploymentItemWarnings.length > 0 && (
                              <div className="rounded-[1rem] border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-100/85">
                                {sundayDeploymentItemWarnings.map((warning) => (
                                  <div key={warning}>{warning}</div>
                                ))}
                              </div>
                            )}
                            <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 p-4">
                              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary/72">Pending return items</div>
                              <div className="mt-3 space-y-3">
                                {pendingSundayDeploymentItems.length === 0 ? (
                                  <div className="rounded-[1rem] border border-dashed border-primary/14 px-4 py-8 text-center text-sm text-muted-foreground">
                                    No pending Sunday kit items remain on this deployment.
                                  </div>
                                ) : (
                                  pendingSundayDeploymentItems.map((item) => (
                                    <div key={item.id} className="rounded-[1rem] border border-primary/12 bg-card/35 p-4">
                                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0">
                                          <div className="font-mono text-xs uppercase tracking-[0.14em] text-primary">{item.asset_code ?? `Item ${item.sort_order}`}</div>
                                          <div className="mt-1 text-sm text-foreground">{item.asset_name}</div>
                                          <div className="mt-1 text-xs text-muted-foreground">
                                            {item.serial_number ?? "No serial"} | Item {item.sort_order}
                                          </div>
                                        </div>
                                        <SelectField
                                          label="Outcome"
                                          value={sundayReturnOutcomes[item.id] ?? ""}
                                          onChange={(value) =>
                                            setSundayReturnOutcomes((current) => ({
                                              ...current,
                                              [item.id]: value as "Available" | "Damaged",
                                            }))
                                          }
                                          options={[
                                            { label: "Choose outcome", value: "" },
                                            { label: "Available", value: "Available" },
                                            { label: "Damaged", value: "Damaged" },
                                          ]}
                                        />
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                            <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 p-4">
                              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary/72">Resolved items</div>
                              <div className="mt-3 space-y-3">
                                {resolvedSundayDeploymentItems.length === 0 ? (
                                  <div className="rounded-[1rem] border border-dashed border-primary/14 px-4 py-8 text-center text-sm text-muted-foreground">
                                    No resolved Sunday kit items yet.
                                  </div>
                                ) : (
                                  resolvedSundayDeploymentItems.map((item) => (
                                    <div key={item.id} className="rounded-[1rem] border border-primary/12 bg-card/35 p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <div className="font-mono text-xs uppercase tracking-[0.14em] text-primary">{item.asset_code ?? `Item ${item.sort_order}`}</div>
                                          <div className="mt-1 text-sm text-foreground">{item.asset_name}</div>
                                        </div>
                                        <span className={cn(
                                          "inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                                          item.return_status === "Available"
                                            ? "border-primary/26 bg-primary/12 text-primary"
                                            : "border-destructive/20 bg-destructive/10 text-destructive",
                                        )}>
                                          {item.return_status}
                                        </span>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {sundayDeploymentItemWarnings.length > 0 && (
                              <div className="rounded-[1rem] border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-100/85">
                                {sundayDeploymentItemWarnings.map((warning) => (
                                  <div key={warning}>{warning}</div>
                                ))}
                              </div>
                            )}
                            <div className="grid gap-3 sm:grid-cols-2">
                              <NumberField label="Returned count" value={sundayReturnedCount} onChange={setSundayReturnedCount} />
                              <NumberField label="Damaged count" value={sundayDamagedCount} onChange={setSundayDamagedCount} />
                            </div>
                          </div>
                        )}
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
                          : !resolvedSundayDeploymentId || (sundayDeploymentItemsSource === "live" && selectedSundayItemResolutions.length === 0))
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
                      Sunday kit returns now prefer item-level resolution through the live deployment ledger. Count-based return capture remains only as a fallback for older or incomplete backend surfaces.
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
                    <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary/72">Camera scan</div>
                          <div className="mt-2 text-sm text-muted-foreground">{qrCameraStatus}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void startQrCamera()}
                            disabled={busy !== null || qrCameraActive}
                            className="inline-flex h-10 items-center justify-center rounded-[0.9rem] border border-primary/18 px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Start Camera
                          </button>
                          <button
                            type="button"
                            onClick={stopQrCamera}
                            disabled={busy !== null || !qrCameraActive}
                            className="inline-flex h-10 items-center justify-center rounded-[0.9rem] border border-primary/18 px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Stop Camera
                          </button>
                          <button
                            type="button"
                            onClick={() => qrImportInputRef.current?.click()}
                            disabled={busy !== null}
                            className="inline-flex h-10 items-center justify-center rounded-[0.9rem] border border-primary/18 px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Import Batch File
                          </button>
                        </div>
                      </div>
                      <input
                        ref={qrImportInputRef}
                        type="file"
                        accept=".txt,.csv,text/plain,text/csv"
                        className="hidden"
                        onChange={(event) => {
                          void importQrBatchFile(event.target.files?.[0] ?? null);
                          event.currentTarget.value = "";
                        }}
                      />
                      <div className="mt-4 overflow-hidden rounded-[1rem] border border-primary/12 bg-background/40">
                        <video ref={qrVideoRef} autoPlay muted playsInline className="aspect-video w-full bg-black/60 object-cover" />
                      </div>
                      {qrCameraError && (
                        <div className="mt-3 rounded-[1rem] border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-100/85">
                          {qrCameraError}
                        </div>
                      )}
                      {!qrCameraSupported && (
                        <div className="mt-3 rounded-[1rem] border border-primary/12 bg-card/35 px-4 py-3 text-sm text-muted-foreground">
                          Camera detection is not supported in this browser, so use the manual batch field below.
                        </div>
                      )}
                    </div>
                    <textarea
                      value={qrCodesInput}
                      onChange={(event) => {
                        setQrCodesInput(event.target.value);
                        setResolvedQrAssets([]);
                        setUnresolvedQrInputs([]);
                      }}
                      placeholder="Paste or scan one asset QR value or asset code per line, or separate entries with commas"
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
                    <div className="text-sm text-muted-foreground">Camera, file import, and manual entry all feed the same batch.</div>
                    {unresolvedQrInputs.length > 0 && (
                      <div className="rounded-[1rem] border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-100/85">
                        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-amber-300">Unresolved scans</div>
                        <div className="mt-2">
                          These entries did not match a live asset by QR UUID or asset tag and will not be included in execution.
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {unresolvedQrInputs.map((input) => (
                            <span key={input} className="rounded-full border border-amber-400/20 px-3 py-1 font-mono text-[11px] text-amber-200">
                              {input}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
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
