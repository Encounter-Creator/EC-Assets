"use client";

import { ArrowLeft, Archive, FileText, MapPin, Package, QrCode, RefreshCcw, Settings2, Shield, UserRound, Users, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/components/toast";
import {
  createDepartment,
  createConsumable,
  createKit,
  createLocation,
  getFallbackSettingsWorkspace,
  loadDuplicateComparison,
  loadSettingsKitAssetCandidates,
  loadSettingsKitMembers,
  loadSettingsWorkspace,
  resolveSettingsDuplicate,
  saveSettingsConfig,
  saveSettingsKitMembers,
  saveSettingsUser,
  setConsumableActiveState,
  setDepartmentActiveState,
  setKitActiveState,
  setLocationActiveState,
  updateMyProfile,
  type SettingsConfigRecord,
  type SettingsConsumableRecord,
  type SettingsDepartmentRecord,
  type DuplicateComparison,
  type SettingsKitAssetCandidateRecord,
  type SettingsKitMemberRecord,
  type SettingsKitRecord,
  type SettingsLocationRecord,
  type SettingsWorkspaceData,
} from "@/lib/settings";
import { buildCsv, exportPdfReport, exportXlsxReport, loadReportWorkspace, type ReportType, type ReportWorkspace } from "@/lib/reports";
import { generateQrExportPdf, loadQrExportAssets, type QrExportAsset } from "@/lib/qr-export";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { AssetIntakePanel } from "./asset-intake-panel";

type SettingsTab =
  | "profile"
  | "asset_intake"
  | "users"
  | "roles"
  | "locations"
  | "departments"
  | "kits"
  | "consumables"
  | "reports"
  | "duplicates"
  | "config";

const tabs = [
  { id: "profile", label: "Profile", icon: UserRound, show: () => true },
  { id: "asset_intake", label: "Asset Intake", icon: Package, show: (isAdmin: boolean) => isAdmin },
  { id: "users", label: "Users", icon: Users, show: (isAdmin: boolean, isAssetManager: boolean) => isAdmin || isAssetManager },
  { id: "roles", label: "Roles", icon: Shield, show: (isAdmin: boolean) => isAdmin },
  { id: "locations", label: "Locations", icon: MapPin, show: (isAdmin: boolean) => isAdmin },
  { id: "departments", label: "Departments", icon: Archive, show: (isAdmin: boolean) => isAdmin },
  { id: "kits", label: "Kits", icon: Package, show: (isAdmin: boolean) => isAdmin },
  { id: "consumables", label: "Consumables", icon: Wrench, show: (isAdmin: boolean, isAssetManager: boolean) => isAdmin || isAssetManager },
  { id: "reports", label: "Reports", icon: FileText, show: (isAdmin: boolean) => isAdmin },
  { id: "duplicates", label: "Duplicates", icon: Archive, show: (isAdmin: boolean) => isAdmin },
  { id: "config", label: "Config", icon: Settings2, show: (isAdmin: boolean) => isAdmin },
] as const;

export default function SettingsPage() {
  const router = useRouter();
  const { isAdmin, isAssetManager, profileName, roles, isConfigured, user, assignedLocationId, assetManagerLocationId } = useAuth();
  const { pushToast } = useToast();
  const [workspace, setWorkspace] = useState<SettingsWorkspaceData>(() => ({
    ...getFallbackSettingsWorkspace(),
    warnings: [],
  }));
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [feedback, setFeedback] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null);
  const [busyAction, setBusyAction] = useState<"profile" | "user" | "location" | "department" | "kit" | "consumable" | "config" | "duplicate" | null>(null);
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [profileSurname, setProfileSurname] = useState("");
  const [profileDirty, setProfileDirty] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userAccessFilter, setUserAccessFilter] = useState("all");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserDisplayName, setNewUserDisplayName] = useState("");
  const [newUserSurname, setNewUserSurname] = useState("");
  const [newUserRole, setNewUserRole] = useState("staff");
  const [newUserLocationId, setNewUserLocationId] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [createdUserPassword, setCreatedUserPassword] = useState<string | null>(null);
  const [userPasswordDraft, setUserPasswordDraft] = useState("");
  const [resetUserPassword, setResetUserPassword] = useState<string | null>(null);
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationIsHomeBase, setNewLocationIsHomeBase] = useState(true);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [userDisplayNameDraft, setUserDisplayNameDraft] = useState("");
  const [userSurnameDraft, setUserSurnameDraft] = useState("");
  const [userAssignedLocationDraft, setUserAssignedLocationDraft] = useState("");
  const [userRoleDraft, setUserRoleDraft] = useState("");
  const [userDraftDirty, setUserDraftDirty] = useState(false);
  const [newKitName, setNewKitName] = useState("");
  const [newKitHomeBase, setNewKitHomeBase] = useState("");
  const [newKitItemCount, setNewKitItemCount] = useState("0");
  const [selectedKitId, setSelectedKitId] = useState("");
  const [kitMembers, setKitMembers] = useState<SettingsKitMemberRecord[]>([]);
  const [kitMembersSource, setKitMembersSource] = useState<"live" | "fallback">("fallback");
  const [kitMemberWarnings, setKitMemberWarnings] = useState<string[]>([]);
  const [kitMemberDraftIds, setKitMemberDraftIds] = useState<string[]>([]);
  const [kitMemberDraftDirty, setKitMemberDraftDirty] = useState(false);
  const [kitMemberRefreshTick, setKitMemberRefreshTick] = useState(0);
  const [kitAssetCandidates, setKitAssetCandidates] = useState<SettingsKitAssetCandidateRecord[]>([]);
  const [kitAssetCandidatesSource, setKitAssetCandidatesSource] = useState<"live" | "fallback">("fallback");
  const [kitAssetCandidateWarnings, setKitAssetCandidateWarnings] = useState<string[]>([]);
  const [kitAssetSearch, setKitAssetSearch] = useState("");
  const [loadingKitMembers, setLoadingKitMembers] = useState(false);
  const [loadingKitAssets, setLoadingKitAssets] = useState(false);
  const [newConsumableName, setNewConsumableName] = useState("");
  const [newConsumableDepartment, setNewConsumableDepartment] = useState("");
  const [newConsumableUnit, setNewConsumableUnit] = useState("");
  const [newConsumableStock, setNewConsumableStock] = useState("0");
  const [newConsumableReorderLevel, setNewConsumableReorderLevel] = useState("0");
  const [qrExportLabelMm, setQrExportLabelMm] = useState("20");
  const [qrExportPageBorderMm, setQrExportPageBorderMm] = useState("5");
  const [qrExportFormat, setQrExportFormat] = useState("A4");
  const [qrExportDirty, setQrExportDirty] = useState(false);
  const [reportType, setReportType] = useState<ReportType>("damage");
  const [reportLocationId, setReportLocationId] = useState("");
  const [reportWorkspace, setReportWorkspace] = useState<ReportWorkspace>({ columns: [], rows: [], source: "fallback", warnings: [] });
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportRefreshTick, setReportRefreshTick] = useState(0);
  const [selectedDuplicateId, setSelectedDuplicateId] = useState("");
  const [duplicateComparison, setDuplicateComparison] = useState<DuplicateComparison | null>(null);
  const [loadingDuplicateComparison, setLoadingDuplicateComparison] = useState(false);
  const [duplicateResolutionStatus, setDuplicateResolutionStatus] = useState<"Merged" | "Not Duplicate">("Merged");
  const [duplicateSurvivor, setDuplicateSurvivor] = useState<"primary" | "duplicate">("primary");
  const [duplicateNote, setDuplicateNote] = useState("");
  const [qrFilterSearch, setQrFilterSearch] = useState("");
  const [qrFilterLocationId, setQrFilterLocationId] = useState("");
  const [qrFilterDepartmentId, setQrFilterDepartmentId] = useState("");
  const [qrFilterStatus, setQrFilterStatus] = useState("");
  const [qrCreatedFrom, setQrCreatedFrom] = useState("");
  const [qrCreatedTo, setQrCreatedTo] = useState("");
  const [qrPreviewAssets, setQrPreviewAssets] = useState<QrExportAsset[]>([]);
  const [loadingQrPreview, setLoadingQrPreview] = useState(false);

  useEffect(() => {
    if (!feedback) return;
    pushToast({
      tone: feedback.tone,
      title: feedback.tone === "error" ? "Error" : feedback.tone === "success" ? "Success" : "Info",
      message: feedback.message,
    });
  }, [feedback, pushToast]);

  const visibleTabs = useMemo(
    () => tabs.filter((tab) => tab.show(isAdmin, isAssetManager)),
    [isAdmin, isAssetManager],
  );

  const roleLabel = roles.includes("main_admin")
    ? "Main Admin"
    : roles.includes("admin")
      ? "Admin"
      : roles.includes("asset_manager")
        ? "Asset Manager"
        : roles.includes("staff")
          ? "Staff"
          : "Volunteer";

  const homeBaseName = useMemo(
    () =>
      workspace.locations.find((location) => location.id === assignedLocationId)?.name ??
      workspace.locations.find((location) => location.id === assetManagerLocationId)?.name ??
      "Unassigned",
    [assignedLocationId, assetManagerLocationId, workspace.locations],
  );
  const profileNameParts = useMemo(() => (profileName || "").trim().split(/\s+/).filter(Boolean), [profileName]);
  const resolvedProfileDisplayName = profileDirty ? profileDisplayName : (profileNameParts[0] ?? "");
  const resolvedProfileSurname = profileDirty ? profileSurname : profileNameParts.slice(1).join(" ");
  const visibleUsers = useMemo(() => {
    if (isAdmin || !assetManagerLocationId) return workspace.users;
    const managerLocationName = workspace.locations.find((location) => location.id === assetManagerLocationId)?.name ?? null;
    if (!managerLocationName) return workspace.users;
    return workspace.users.filter((entry) => entry.home_base === managerLocationName);
  }, [assetManagerLocationId, isAdmin, workspace.locations, workspace.users]);
  const roleSummaryRows = useMemo(
    () => [
      {
        role: "admin",
        label: "Admin",
        count: visibleUsers.filter((entry) => entry.role === "admin" || entry.role === "main_admin").length,
        capability: "Cross-location admin, approvals, settings, and reporting.",
        locationRule: "Not location-locked.",
      },
      {
        role: "asset_manager",
        label: "Asset Manager",
        count: visibleUsers.filter((entry) => entry.role === "asset_manager").length,
        capability: "One-location operational control across check-out/in and approvals.",
        locationRule: "Locked to assigned manager location.",
      },
      {
        role: "staff",
        label: "Staff",
        count: visibleUsers.filter((entry) => entry.role === "staff").length,
        capability: "Inventory browse plus request workflows.",
        locationRule: "Can browse broad scope, then submit per explicit source location.",
      },
      {
        role: "volunteer",
        label: "Volunteer",
        count: visibleUsers.filter((entry) => entry.role === "volunteer").length,
        capability: "Assigned items, pending responses, returns, and personal damage actions.",
        locationRule: "Locked to assigned location where applicable.",
      },
    ],
    [visibleUsers],
  );
  const filteredUsers = useMemo(() => {
    const search = userSearch.trim().toLowerCase();

    return visibleUsers.filter((entry) => {
      const matchesSearch =
        !search ||
        [entry.full_name, entry.email, entry.home_base, entry.department, entry.role]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(search));
      const matchesRole = userRoleFilter === "all" || entry.role === userRoleFilter;
      const matchesAccess =
        userAccessFilter === "all" ||
        (userAccessFilter === "approved" && entry.approved) ||
        (userAccessFilter === "pending" && !entry.approved) ||
        (userAccessFilter === "locked" && entry.locked) ||
        (userAccessFilter === "active" && entry.approved && !entry.locked);

      return matchesSearch && matchesRole && matchesAccess;
    });
  }, [userAccessFilter, userRoleFilter, userSearch, visibleUsers]);
  const selectedUser = useMemo(
    () => filteredUsers.find((entry) => entry.id === (selectedUserId || filteredUsers[0]?.id)) ?? null,
    [filteredUsers, selectedUserId],
  );
  const selectedUserHomeBaseId = useMemo(() => {
    if (!selectedUser?.home_base) return "";
    return workspace.locations.find((location) => location.name === selectedUser.home_base)?.id ?? "";
  }, [selectedUser, workspace.locations]);
  const resolvedUserDisplayName = userDraftDirty ? userDisplayNameDraft : (selectedUser?.full_name.split(" ")[0] ?? "");
  const resolvedUserSurname = userDraftDirty ? userSurnameDraft : (selectedUser?.full_name.split(" ").slice(1).join(" ") ?? "");
  const resolvedUserAssignedLocationId = userDraftDirty ? userAssignedLocationDraft : selectedUserHomeBaseId;
  const resolvedUserRole = userDraftDirty ? userRoleDraft : (selectedUser?.role ?? "staff");
  const qrExportConfig = useMemo(
    () => workspace.config.find((entry) => entry.key === "qr_export") ?? null,
    [workspace.config],
  );
  const qrExportDefaults = useMemo(() => {
    const value = qrExportConfig?.value ?? {};
    return {
      labelMm: String(typeof value.labelMm === "number" ? value.labelMm : 20),
      pageBorderMm: String(typeof value.pageBorderMm === "number" ? value.pageBorderMm : 5),
      format: typeof value.format === "string" ? value.format : "A4",
    };
  }, [qrExportConfig]);
  const resolvedQrExportLabelMm = qrExportDirty ? qrExportLabelMm : qrExportDefaults.labelMm;
  const resolvedQrExportPageBorderMm = qrExportDirty ? qrExportPageBorderMm : qrExportDefaults.pageBorderMm;
  const resolvedQrExportFormat = qrExportDirty ? qrExportFormat : qrExportDefaults.format;
  const resolvedReportLocationId = reportLocationId || "";
  const selectedDuplicate = useMemo(
    () => workspace.duplicates.find((entry) => entry.id === (selectedDuplicateId || workspace.duplicates[0]?.id)) ?? null,
    [selectedDuplicateId, workspace.duplicates],
  );
  const selectedKit = useMemo(
    () => workspace.kits.find((entry) => entry.id === (selectedKitId || workspace.kits[0]?.id)) ?? null,
    [selectedKitId, workspace.kits],
  );
  const resolvedKitMemberIds = useMemo(
    () => (kitMemberDraftDirty ? kitMemberDraftIds : kitMembers.map((entry) => entry.asset_id)),
    [kitMemberDraftDirty, kitMemberDraftIds, kitMembers],
  );
  const mergedKitAssetMap = useMemo(() => {
    const rows = new Map<
      string,
      {
        asset_id: string;
        asset_code: string;
        asset_name: string;
        serial_number: string | null;
        status: string;
        current_location: string | null;
        department: string | null;
      }
    >();

    for (const asset of kitAssetCandidates) {
      rows.set(asset.asset_id, asset);
    }
    for (const member of kitMembers) {
      rows.set(member.asset_id, {
        asset_id: member.asset_id,
        asset_code: member.asset_code,
        asset_name: member.asset_name,
        serial_number: member.serial_number,
        status: member.status,
        current_location: member.current_location,
        department: member.department,
      });
    }

    return rows;
  }, [kitAssetCandidates, kitMembers]);
  const selectedKitMemberAssets = useMemo(
    () =>
      resolvedKitMemberIds.map((assetId, index) => {
        const asset = mergedKitAssetMap.get(assetId);
        return {
          asset_id: assetId,
          asset_code: asset?.asset_code ?? "No tag",
          asset_name: asset?.asset_name ?? "Unnamed asset",
          serial_number: asset?.serial_number ?? null,
          status: asset?.status ?? "unknown",
          current_location: asset?.current_location ?? "No location",
          department: asset?.department ?? "No department",
          sort_order: index + 1,
        };
      }),
    [mergedKitAssetMap, resolvedKitMemberIds],
  );
  const filteredKitAssetCandidates = useMemo(() => {
    const search = kitAssetSearch.trim().toLowerCase();
    const selectedIds = new Set(resolvedKitMemberIds);

    return kitAssetCandidates
      .filter((asset) => !selectedIds.has(asset.asset_id))
      .filter((asset) => {
        if (!search) return true;
        return [asset.asset_code, asset.asset_name, asset.serial_number, asset.current_location, asset.department, asset.status]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(search));
      });
  }, [kitAssetCandidates, kitAssetSearch, resolvedKitMemberIds]);

  useEffect(() => {
    let cancelled = false;

    const loadWorkspace = async () => {
      if (!isConfigured || !user) {
        if (!cancelled) {
          setWorkspace(getFallbackSettingsWorkspace());
          setLoading(false);
        }
        return;
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (!cancelled) {
          setWorkspace(getFallbackSettingsWorkspace());
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setLoading(true);
      }

      const nextWorkspace = await loadSettingsWorkspace(supabase);
      if (!cancelled) {
        setWorkspace(nextWorkspace);
        setLoading(false);
      }
    };

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [isConfigured, user]);

  useEffect(() => {
    let cancelled = false;

    const loadReports = async () => {
      if (activeTab !== "reports" || !isAdmin) return;

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (!cancelled) {
          setReportWorkspace({ columns: [], rows: [], source: "fallback", warnings: ["Supabase is not configured yet, so reports export is unavailable."] });
        }
        return;
      }

      if (!cancelled) {
        setLoadingReports(true);
      }

      try {
        const nextWorkspace = await loadReportWorkspace(supabase, {
          type: reportType,
          locationId: resolvedReportLocationId || null,
        });
        if (!cancelled) {
          setReportWorkspace(nextWorkspace);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Report workspace could not be loaded.";
        if (!cancelled) {
          setReportWorkspace({ columns: [], rows: [], source: "fallback", warnings: [message] });
        }
      } finally {
        if (!cancelled) {
          setLoadingReports(false);
        }
      }
    };

    void loadReports();

    return () => {
      cancelled = true;
    };
  }, [activeTab, isAdmin, reportRefreshTick, reportType, resolvedReportLocationId]);

  useEffect(() => {
    let cancelled = false;

    const loadComparison = async () => {
      if (activeTab !== "duplicates" || !selectedDuplicate) return;

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (!cancelled) {
          setDuplicateComparison(null);
        }
        return;
      }

      if (!cancelled) {
        setLoadingDuplicateComparison(true);
      }

      try {
        const nextComparison = await loadDuplicateComparison(supabase, selectedDuplicate);
        if (!cancelled) {
          setDuplicateComparison(nextComparison);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Duplicate comparison could not be loaded.";
        if (!cancelled) {
          setDuplicateComparison({
            primary: null,
            duplicate: null,
            source: "fallback",
            warnings: [message],
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingDuplicateComparison(false);
        }
      }
    };

    void loadComparison();

    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedDuplicate]);

  useEffect(() => {
    let cancelled = false;

    const loadKitAssets = async () => {
      if (activeTab !== "kits" || !isAdmin) return;

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (!cancelled) {
          setKitAssetCandidates([]);
          setKitAssetCandidatesSource("fallback");
          setKitAssetCandidateWarnings(["Supabase is not configured yet, so kit asset candidates are unavailable."]);
        }
        return;
      }

      if (!cancelled) {
        setLoadingKitAssets(true);
      }

      try {
        const nextAssets = await loadSettingsKitAssetCandidates(supabase);
        if (!cancelled) {
          setKitAssetCandidates(nextAssets.assets);
          setKitAssetCandidatesSource(nextAssets.source);
          setKitAssetCandidateWarnings(nextAssets.warnings);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Kit asset candidates could not be loaded.";
        if (!cancelled) {
          setKitAssetCandidates([]);
          setKitAssetCandidatesSource("fallback");
          setKitAssetCandidateWarnings([message]);
        }
      } finally {
        if (!cancelled) {
          setLoadingKitAssets(false);
        }
      }
    };

    void loadKitAssets();

    return () => {
      cancelled = true;
    };
  }, [activeTab, isAdmin]);

  useEffect(() => {
    let cancelled = false;

    const loadKitMembersForSelectedKit = async () => {
      if (activeTab !== "kits" || !selectedKit) return;

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (!cancelled) {
          setKitMembers([]);
          setKitMembersSource("fallback");
          setKitMemberWarnings(["Supabase is not configured yet, so kit membership is unavailable."]);
          setKitMemberDraftIds([]);
          setKitMemberDraftDirty(false);
        }
        return;
      }

      if (!cancelled) {
        setLoadingKitMembers(true);
      }

      try {
        const nextMembers = await loadSettingsKitMembers(supabase, selectedKit.id);
        if (!cancelled) {
          setKitMembers(nextMembers.members);
          setKitMembersSource(nextMembers.source);
          setKitMemberWarnings(nextMembers.warnings);
          setKitMemberDraftIds(nextMembers.members.map((entry) => entry.asset_id));
          setKitMemberDraftDirty(false);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Kit membership could not be loaded.";
        if (!cancelled) {
          setKitMembers([]);
          setKitMembersSource("fallback");
          setKitMemberWarnings([message]);
          setKitMemberDraftIds([]);
          setKitMemberDraftDirty(false);
        }
      } finally {
        if (!cancelled) {
          setLoadingKitMembers(false);
        }
      }
    };

    void loadKitMembersForSelectedKit();

    return () => {
      cancelled = true;
    };
  }, [activeTab, kitMemberRefreshTick, selectedKit]);

  const loadQrPreview = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so QR export is unavailable." });
      return;
    }

    setLoadingQrPreview(true);
    try {
      const rows = await loadQrExportAssets(supabase, {
        search: qrFilterSearch,
        locationId: qrFilterLocationId || null,
        departmentId: qrFilterDepartmentId || null,
        status: qrFilterStatus || null,
        createdFrom: qrCreatedFrom || null,
        createdTo: qrCreatedTo || null,
      });
      setQrPreviewAssets(rows);
      setFeedback({ tone: "success", message: `QR export preview loaded with ${rows.length} asset${rows.length === 1 ? "" : "s"}.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "QR export preview could not be loaded.";
      setFeedback({ tone: "error", message });
    } finally {
      setLoadingQrPreview(false);
    }
  };

  const refreshWorkspace = async () => {
    if (!isConfigured || !user) {
      setWorkspace(getFallbackSettingsWorkspace());
      setLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setWorkspace(getFallbackSettingsWorkspace());
      setLoading(false);
      return;
    }

    setLoading(true);
    const nextWorkspace = await loadSettingsWorkspace(supabase);
    setWorkspace(nextWorkspace);
    setLoading(false);
  };

  const saveUser = async () => {
    if (!selectedUser) {
      setFeedback({ tone: "error", message: "Choose a user first." });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so user updates are unavailable." });
      return;
    }

    setBusyAction("user");
    try {
      const assignedLocationId = resolvedUserAssignedLocationId || null;
      const nextRole = isAdmin ? resolvedUserRole : selectedUser.role;
      const nextManagerLocationId = nextRole === "asset_manager" ? assignedLocationId : null;

      const { error } = await saveSettingsUser(supabase, {
        userId: selectedUser.id,
        displayName: resolvedUserDisplayName,
        surname: resolvedUserSurname,
        assignedLocationId,
        assetManagerLocationId: nextManagerLocationId,
        role: isAdmin ? nextRole : null,
      });

      if (error) throw error;

      const nextLocationName = assignedLocationId ? workspace.locations.find((location) => location.id === assignedLocationId)?.name ?? null : null;
      setWorkspace((current) => ({
        ...current,
        users: current.users.map((entry) =>
          entry.id === selectedUser.id
            ? {
                ...entry,
                full_name: [resolvedUserDisplayName, resolvedUserSurname].filter(Boolean).join(" ") || entry.full_name,
                role: isAdmin ? nextRole : entry.role,
                home_base: nextLocationName,
              }
            : entry,
        ),
      }));
      setUserDraftDirty(false);
      setFeedback({ tone: "success", message: "User settings saved." });
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "User update failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusyAction(null);
    }
  };

  const createUserAccount = async () => {
    if (!isAdmin) {
      setFeedback({ tone: "error", message: "Only admins can create users." });
      return;
    }

    if (!newUserEmail.trim()) {
      setFeedback({ tone: "error", message: "Enter an email address first." });
      return;
    }

    if (!newUserDisplayName.trim()) {
      setFeedback({ tone: "error", message: "Enter a first name first." });
      return;
    }

    setBusyAction("user");
    setCreatedUserPassword(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: newUserEmail,
          displayName: newUserDisplayName,
          surname: newUserSurname,
          role: newUserRole,
          locationId: newUserLocationId || null,
          password: newUserPassword,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        temporaryPassword?: string | null;
        user?: {
          id: string;
          email: string;
          full_name: string;
          role: string;
          home_base: string | null;
          approved: boolean;
          locked: boolean;
          department: string | null;
        };
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "User creation failed.");
      }

      const createdUser = payload.user;
      if (createdUser) {
        setWorkspace((current) => ({
          ...current,
          users: [...current.users, createdUser].sort((a, b) => a.full_name.localeCompare(b.full_name)),
        }));
        setSelectedUserId(createdUser.id);
      }

      setNewUserEmail("");
      setNewUserDisplayName("");
      setNewUserSurname("");
      setNewUserRole("staff");
      setNewUserLocationId("");
      setNewUserPassword("");
      setUserDraftDirty(false);
      setCreatedUserPassword(payload.temporaryPassword ?? null);
      setFeedback({
        tone: "success",
        message: payload.temporaryPassword
          ? `${payload.message ?? "User created."} Temporary password: ${payload.temporaryPassword}`
          : (payload.message ?? "User created."),
      });
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "User creation failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusyAction(null);
    }
  };

  const approveUserAccess = async () => {
    if (!isAdmin || !selectedUser) {
      setFeedback({ tone: "error", message: "Only admins can approve users." });
      return;
    }

    setBusyAction("user");
    setResetUserPassword(null);

    try {
      const assignedLocationId = resolvedUserAssignedLocationId || null;
      const nextRole = resolvedUserRole || "staff";
      const assetManagerLocationId = nextRole === "asset_manager" ? assignedLocationId : null;
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "approve",
          role: nextRole,
          displayName: resolvedUserDisplayName,
          surname: resolvedUserSurname,
          assignedLocationId,
          assetManagerLocationId,
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "User approval failed.");
      }

      setFeedback({ tone: "success", message: payload.message ?? "User access approved." });
      setUserDraftDirty(false);
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "User approval failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusyAction(null);
    }
  };

  const revokeUserAccess = async () => {
    if (!isAdmin || !selectedUser) {
      setFeedback({ tone: "error", message: "Only admins can revoke users." });
      return;
    }

    setBusyAction("user");
    setResetUserPassword(null);

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "revoke",
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "User revoke failed.");
      }

      setFeedback({ tone: "success", message: payload.message ?? "User access revoked." });
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "User revoke failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusyAction(null);
    }
  };

  const updateUserPassword = async () => {
    if (!isAdmin || !selectedUser) {
      setFeedback({ tone: "error", message: "Only admins can reset passwords." });
      return;
    }

    setBusyAction("user");
    setResetUserPassword(null);

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "password",
          password: userPasswordDraft,
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: string; temporaryPassword?: string | null };
      if (!response.ok) {
        throw new Error(payload.error ?? "Password update failed.");
      }

      setResetUserPassword(payload.temporaryPassword ?? null);
      setUserPasswordDraft("");
      setFeedback({
        tone: "success",
        message: payload.temporaryPassword
          ? `${payload.message ?? "Temporary password generated."} Temporary password: ${payload.temporaryPassword}`
          : (payload.message ?? "Password updated."),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Password update failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusyAction(null);
    }
  };

  const deleteUserAccount = async () => {
    if (!isAdmin || !selectedUser) {
      setFeedback({ tone: "error", message: "Only admins can delete users." });
      return;
    }

    const confirmed = window.confirm(`Delete ${selectedUser.full_name}? This also removes the sign-in account.`);
    if (!confirmed) return;

    setBusyAction("user");
    setResetUserPassword(null);

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "User delete failed.");
      }

      setWorkspace((current) => ({
        ...current,
        users: current.users.filter((entry) => entry.id !== selectedUser.id),
      }));
      setSelectedUserId("");
      setUserDraftDirty(false);
      setFeedback({ tone: "success", message: payload.message ?? "User deleted." });
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "User delete failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusyAction(null);
    }
  };

  const saveProfile = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so profile saving is unavailable." });
      return;
    }

    setBusyAction("profile");
    try {
      const { error } = await updateMyProfile(supabase, {
        displayName: resolvedProfileDisplayName,
        surname: resolvedProfileSurname,
      });

      if (error) throw error;

      setFeedback({ tone: "success", message: "Profile details saved." });
      setProfileDirty(false);
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Profile save failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusyAction(null);
    }
  };

  const addLocation = async () => {
    if (!newLocationName.trim()) {
      setFeedback({ tone: "error", message: "Enter a location name first." });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so location creation is unavailable." });
      return;
    }

    setBusyAction("location");
    try {
      const { error } = await createLocation(supabase, {
        name: newLocationName,
        isHomeBase: newLocationIsHomeBase,
      });

      if (error) throw error;

      setNewLocationName("");
      setNewLocationIsHomeBase(true);
      setFeedback({ tone: "success", message: "Location created." });
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Location creation failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusyAction(null);
    }
  };

  const toggleLocationActive = async (location: SettingsLocationRecord) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so location updates are unavailable." });
      return;
    }

    setBusyAction("location");
    try {
      const { error } = await setLocationActiveState(supabase, {
        locationId: location.id,
        active: !location.active,
      });

      if (error) throw error;

      setFeedback({ tone: "success", message: `${location.name} ${location.active ? "disabled" : "re-enabled"}.` });
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Location update failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusyAction(null);
    }
  };

  const addDepartment = async () => {
    if (!newDepartmentName.trim()) {
      setFeedback({ tone: "error", message: "Enter a department name first." });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so department creation is unavailable." });
      return;
    }

    setBusyAction("department");
    try {
      const { error } = await createDepartment(supabase, {
        name: newDepartmentName,
      });

      if (error) throw error;

      setNewDepartmentName("");
      setFeedback({ tone: "success", message: "Department created." });
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Department creation failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusyAction(null);
    }
  };

  const toggleDepartmentActive = async (department: SettingsDepartmentRecord) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so department updates are unavailable." });
      return;
    }

    setBusyAction("department");
    try {
      const { error } = await setDepartmentActiveState(supabase, {
        departmentId: department.id,
        active: !department.active,
      });

      if (error) throw error;

      setFeedback({ tone: "success", message: `${department.name} ${department.active ? "archived" : "re-enabled"}.` });
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Department update failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusyAction(null);
    }
  };

  const addKit = async () => {
    const itemCount = Number.parseInt(newKitItemCount, 10);

    if (!newKitName.trim()) {
      setFeedback({ tone: "error", message: "Enter a kit name first." });
      return;
    }
    if (Number.isNaN(itemCount) || itemCount < 0) {
      setFeedback({ tone: "error", message: "Enter a valid kit item count." });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so kit creation is unavailable." });
      return;
    }

    setBusyAction("kit");
    try {
      const { data, error } = await createKit(supabase, {
        name: newKitName,
        homeBase: newKitHomeBase,
        itemCount,
      });

      if (error) throw error;

      const optimisticRow: SettingsKitRecord = {
        id: `optimistic-kit-${Date.now()}`,
        name: newKitName.trim(),
        home_base: newKitHomeBase.trim() || null,
        active: true,
        item_count: itemCount,
      };

      setWorkspace((current) => ({
        ...current,
        kits: [optimisticRow, ...current.kits],
      }));
      setNewKitName("");
      setNewKitHomeBase("");
      setNewKitItemCount("0");
      setSelectedKitId(typeof data?.id === "string" ? data.id : optimisticRow.id);
      setFeedback({ tone: "success", message: "Kit definition created." });
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kit creation failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusyAction(null);
    }
  };

  const toggleKitActive = async (kit: SettingsKitRecord) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so kit updates are unavailable." });
      return;
    }

    setBusyAction("kit");
    try {
      const { error } = await setKitActiveState(supabase, {
        kitId: kit.id,
        active: !kit.active,
      });

      if (error) throw error;

      setWorkspace((current) => ({
        ...current,
        kits: current.kits.map((entry) => (entry.id === kit.id ? { ...entry, active: !entry.active } : entry)),
      }));
      setFeedback({ tone: "success", message: `${kit.name} ${kit.active ? "retired" : "re-enabled"}.` });
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kit update failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusyAction(null);
    }
  };

  const addAssetToKitDraft = (assetId: string) => {
    const currentIds = kitMemberDraftDirty ? kitMemberDraftIds : kitMembers.map((entry) => entry.asset_id);
    if (currentIds.includes(assetId)) return;

    setKitMemberDraftIds([...currentIds, assetId]);
    setKitMemberDraftDirty(true);
  };

  const removeAssetFromKitDraft = (assetId: string) => {
    const currentIds = kitMemberDraftDirty ? kitMemberDraftIds : kitMembers.map((entry) => entry.asset_id);
    setKitMemberDraftIds(currentIds.filter((entry) => entry !== assetId));
    setKitMemberDraftDirty(true);
  };

  const resetKitDraft = () => {
    setKitMemberDraftIds(kitMembers.map((entry) => entry.asset_id));
    setKitMemberDraftDirty(false);
  };

  const saveKitMembership = async () => {
    if (!selectedKit) {
      setFeedback({ tone: "error", message: "Choose a kit first." });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so kit membership updates are unavailable." });
      return;
    }

    setBusyAction("kit");
    try {
      const assetIds = [...resolvedKitMemberIds];
      const { error } = await saveSettingsKitMembers(supabase, {
        kitId: selectedKit.id,
        assetIds,
      });

      if (error) throw error;

      setWorkspace((current) => ({
        ...current,
        kits: current.kits.map((entry) => (entry.id === selectedKit.id ? { ...entry, item_count: assetIds.length } : entry)),
      }));
      setKitMemberDraftDirty(false);
      setFeedback({
        tone: "success",
        message: `${selectedKit.name} membership saved with ${assetIds.length} asset${assetIds.length === 1 ? "" : "s"}.`,
      });
      setKitMemberRefreshTick((current) => current + 1);
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kit membership save failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusyAction(null);
    }
  };

  const addConsumable = async () => {
    const stockOnHand = Number.parseInt(newConsumableStock, 10);
    const reorderLevel = Number.parseInt(newConsumableReorderLevel, 10);

    if (!newConsumableName.trim() || !newConsumableUnit.trim()) {
      setFeedback({ tone: "error", message: "Enter the consumable name and unit first." });
      return;
    }
    if (Number.isNaN(stockOnHand) || Number.isNaN(reorderLevel) || stockOnHand < 0 || reorderLevel < 0) {
      setFeedback({ tone: "error", message: "Enter valid stock and reorder values." });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so consumable creation is unavailable." });
      return;
    }

    setBusyAction("consumable");
    try {
      const { error } = await createConsumable(supabase, {
        name: newConsumableName,
        department: newConsumableDepartment,
        unit: newConsumableUnit,
        stockOnHand,
        reorderLevel,
      });

      if (error) throw error;

      const optimisticRow: SettingsConsumableRecord = {
        id: `optimistic-${Date.now()}`,
        name: newConsumableName.trim(),
        department: newConsumableDepartment.trim() || null,
        unit: newConsumableUnit.trim(),
        stock_on_hand: stockOnHand,
        reorder_level: reorderLevel,
        active: true,
      };

      setWorkspace((current) => ({
        ...current,
        consumables: [optimisticRow, ...current.consumables],
      }));
      setNewConsumableName("");
      setNewConsumableDepartment("");
      setNewConsumableUnit("");
      setNewConsumableStock("0");
      setNewConsumableReorderLevel("0");
      setFeedback({ tone: "success", message: "Consumable created." });
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Consumable creation failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusyAction(null);
    }
  };

  const toggleConsumableActive = async (consumable: SettingsConsumableRecord) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so consumable updates are unavailable." });
      return;
    }

    setBusyAction("consumable");
    try {
      const { error } = await setConsumableActiveState(supabase, {
        consumableId: consumable.id,
        active: !consumable.active,
      });

      if (error) throw error;

      setWorkspace((current) => ({
        ...current,
        consumables: current.consumables.map((entry) => (entry.id === consumable.id ? { ...entry, active: !entry.active } : entry)),
      }));
      setFeedback({ tone: "success", message: `${consumable.name} ${consumable.active ? "archived" : "re-enabled"}.` });
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Consumable update failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusyAction(null);
    }
  };

  const saveQrExportConfig = async () => {
    const labelMm = Number.parseInt(resolvedQrExportLabelMm, 10);
    const pageBorderMm = Number.parseInt(resolvedQrExportPageBorderMm, 10);

    if (Number.isNaN(labelMm) || Number.isNaN(pageBorderMm) || labelMm <= 0 || pageBorderMm < 0) {
      setFeedback({ tone: "error", message: "Enter valid QR label and page-border values." });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so config updates are unavailable." });
      return;
    }

    setBusyAction("duplicate");
    try {
      const value = {
        labelMm,
        pageBorderMm,
        format: qrExportFormat.trim() || "A4",
      };
      const { error } = await saveSettingsConfig(supabase, {
        key: "qr_export",
        value,
        description: "Bulk QR export defaults",
      });

      if (error) throw error;

      const optimisticRow: SettingsConfigRecord = {
        key: "qr_export",
        value,
        description: "Bulk QR export defaults",
        updated_at: new Date().toISOString(),
      };

      setWorkspace((current) => ({
        ...current,
        config: current.config.some((entry) => entry.key === "qr_export")
          ? current.config.map((entry) => (entry.key === "qr_export" ? optimisticRow : entry))
          : [optimisticRow, ...current.config],
      }));
      setFeedback({ tone: "success", message: "QR export config saved." });
      setQrExportDirty(false);
      await refreshWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Config save failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusyAction(null);
    }
  };

  const exportCurrentReportCsv = () => {
    if (reportWorkspace.rows.length === 0 || reportWorkspace.columns.length === 0) {
      setFeedback({ tone: "error", message: "Load report rows before exporting CSV." });
      return;
    }

    const csv = buildCsv(reportWorkspace.columns, reportWorkspace.rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `assets-${reportType}-${resolvedReportLocationId || "all-locations"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setFeedback({ tone: "success", message: "CSV export generated for the current report view." });
  };

  const exportCurrentReportXlsx = () => {
    if (reportWorkspace.rows.length === 0 || reportWorkspace.columns.length === 0) {
      setFeedback({ tone: "error", message: "Load report rows before exporting XLSX." });
      return;
    }

    exportXlsxReport(`assets-${reportType}-${resolvedReportLocationId || "all-locations"}.xlsx`, reportWorkspace.columns, reportWorkspace.rows);
    setFeedback({ tone: "success", message: "XLSX export generated for the current report view." });
  };

  const exportCurrentReportPdf = () => {
    if (reportWorkspace.rows.length === 0 || reportWorkspace.columns.length === 0) {
      setFeedback({ tone: "error", message: "Load report rows before exporting PDF." });
      return;
    }

    exportPdfReport(
      `assets-${reportType}-${resolvedReportLocationId || "all-locations"}.pdf`,
      `Assets ${reportType.replaceAll("_", " ")} report`,
      reportWorkspace.columns,
      reportWorkspace.rows,
    );
    setFeedback({ tone: "success", message: "PDF export generated for the current report view." });
  };

  const submitDuplicateResolution = async () => {
    if (!selectedDuplicate) {
      setFeedback({ tone: "error", message: "Choose a duplicate pair first." });
      return;
    }
    if (!duplicateNote.trim()) {
      setFeedback({ tone: "error", message: "Merge note is required." });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setFeedback({ tone: "error", message: "Supabase is not configured yet, so duplicate resolution is unavailable." });
      return;
    }

    setBusyAction("config");
    try {
      const survivorAsset =
        duplicateResolutionStatus === "Merged"
          ? duplicateSurvivor === "primary"
            ? selectedDuplicate.primary_asset
            : selectedDuplicate.duplicate_asset
          : null;

      const result = await resolveSettingsDuplicate(supabase, {
        duplicateId: selectedDuplicate.id,
        status: duplicateResolutionStatus,
        survivorAsset,
        note: duplicateNote,
      });

      if (result.error) throw result.error;

      setWorkspace((current) => ({
        ...current,
        duplicates: current.duplicates.map((entry) =>
          entry.id === selectedDuplicate.id
            ? {
                ...entry,
                status: duplicateResolutionStatus,
                notes: duplicateNote,
              }
            : entry,
        ),
      }));
      setFeedback({
        tone: "success",
        message: result.previewOnly
          ? "Duplicate resolution saved in the local review surface. Backend merge RPC is still missing."
          : `Duplicate pair marked as ${duplicateResolutionStatus}.`,
      });
      setDuplicateNote("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Duplicate resolution failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusyAction(null);
    }
  };

  const exportQrSheetPdf = async () => {
    if (qrPreviewAssets.length === 0) {
      setFeedback({ tone: "error", message: "Load QR export assets before generating the PDF sheet." });
      return;
    }

    const labelMm = Number.parseInt(resolvedQrExportLabelMm, 10);
    const pageBorderMm = Number.parseInt(resolvedQrExportPageBorderMm, 10);

    if (Number.isNaN(labelMm) || Number.isNaN(pageBorderMm) || labelMm <= 0 || pageBorderMm < 0) {
      setFeedback({ tone: "error", message: "Enter valid QR label and page-border values first." });
      return;
    }

    setBusyAction("config");
    try {
      await generateQrExportPdf(qrPreviewAssets, {
        labelMm,
        pageBorderMm,
      });
      setFeedback({ tone: "success", message: "QR sheet PDF generated from the current filtered asset set." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "QR PDF generation failed.";
      setFeedback({ tone: "error", message });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(44,84,61,0.2),_transparent_40%),_linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--background)))] text-foreground">
      <div className="flex min-h-screen flex-col xl:flex-row">
        <aside className="border-b border-primary/12 bg-[hsl(var(--sidebar-background))]/92 backdrop-blur-xl xl:sticky xl:top-0 xl:h-screen xl:w-[19rem] xl:border-b-0 xl:border-r">
          <div className="flex h-full flex-col">
            <div className="border-b border-primary/12 p-4">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="inline-flex items-center gap-2 rounded-full border border-primary/18 bg-card/70 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/8 hover:text-foreground"
              >
                <ArrowLeft size={15} className="shrink-0 text-primary/80" />
                Back
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              <div className="px-1 pb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-primary/72">Sections</div>
              <div className="space-y-2">
                {visibleTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[1.1rem] border px-4 py-3 text-left text-sm font-medium transition-colors",
                      activeTab === tab.id ? "border-primary/24 bg-primary/12 text-primary" : "border-transparent text-muted-foreground hover:bg-primary/6 hover:text-foreground",
                    )}
                  >
                    <tab.icon size={16} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="space-y-4 sm:space-y-6 px-4 py-4 sm:px-6 sm:py-6">
        <section className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="app-kicker">Settings</div>
              <h1 className="page-title mt-2">Settings</h1>
            </div>
            <div className="page-meta-item text-primary/80 normal-case tracking-normal">{profileName || "Operator"} | {roleLabel}</div>
          </div>

          <div className="page-meta-row">
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
              Source: {workspace.source === "live" ? "Live data" : workspace.source === "mixed" ? "Mixed data" : "Fallback preview"}
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
              <div className="space-y-1">
                {workspace.warnings.map((warning) => (
                  <div key={warning}>{warning}</div>
                ))}
              </div>
            </div>
          )}
        </section>

          <section className="app-panel overflow-hidden">
            <div className="p-4 sm:p-5">
                {activeTab === "profile" && (
                  <div className="space-y-4">
                  <div className="app-kicker">Profile</div>
                  <div className="font-display text-3xl text-foreground glow-soft">Personal operator profile</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FieldCard label="Name" value={profileName || "Operator"} />
                    <FieldCard label="Role" value={roleLabel} />
                    <FieldCard label="Email" value={user?.email ?? "No email available"} />
                    <FieldCard label="Home base" value={homeBaseName} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      label="First name"
                      value={resolvedProfileDisplayName}
                      onChange={(value) => {
                        setProfileDirty(true);
                        setProfileDisplayName(value);
                      }}
                      placeholder="Display name"
                    />
                    <TextField
                      label="Surname"
                      value={resolvedProfileSurname}
                      onChange={(value) => {
                        setProfileDirty(true);
                        setProfileSurname(value);
                      }}
                      placeholder="Surname"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void saveProfile()}
                    disabled={busyAction !== null}
                    className="matrix-button inline-flex h-11 items-center justify-center rounded-[1rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === "profile" ? "Saving Profile" : "Save Profile"}
                  </button>
                </div>
              )}

              {activeTab === "asset_intake" && (
                <AssetIntakePanel
                  isAdmin={isAdmin}
                  userId={user?.id ?? null}
                  workspace={workspace}
                  onRefresh={refreshWorkspace}
                  onFeedback={setFeedback}
                />
              )}

              {activeTab === "users" && (
                <div className="space-y-4">
                  <DataSection
                    title="Users"
                    body={
                      isAdmin
                        ? "Review and update user profile, home-base, and primary-role details."
                        : "Review and update users for your assigned location."
                    }
                    rows={[]}
                  />
                  {isAdmin && (
                    <div className="rounded-[1.2rem] border border-primary/12 bg-card/35 p-4">
                      <div className="app-kicker">Create user</div>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <TextField label="Email" value={newUserEmail} onChange={setNewUserEmail} placeholder="name@example.com" />
                        <TextField label="First name" value={newUserDisplayName} onChange={setNewUserDisplayName} placeholder="First name" />
                        <TextField label="Surname" value={newUserSurname} onChange={setNewUserSurname} placeholder="Surname" />
                        <SelectTextField
                          label="Primary role"
                          value={newUserRole}
                          onChange={setNewUserRole}
                          options={[
                            { label: "Admin", value: "admin" },
                            { label: "Asset Manager", value: "asset_manager" },
                            { label: "Staff", value: "staff" },
                            { label: "Volunteer", value: "volunteer" },
                          ]}
                        />
                        <SelectTextField
                          label="Home base"
                          value={newUserLocationId}
                          onChange={setNewUserLocationId}
                          options={[
                            { label: "Unassigned", value: "" },
                            ...workspace.locations.map((location) => ({ label: location.name, value: location.id })),
                          ]}
                        />
                        <TextField
                          label="Temporary password"
                          value={newUserPassword}
                          onChange={setNewUserPassword}
                          placeholder="Leave blank to auto-generate"
                        />
                      </div>
                      <div className="mt-3 text-sm text-muted-foreground">
                        Leave the password blank to generate a one-time temporary password.
                      </div>
                      {createdUserPassword ? (
                        <div className="mt-3 rounded-[1rem] border border-primary/18 bg-primary/8 px-4 py-3 text-sm text-primary">
                          Generated password: {createdUserPassword}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void createUserAccount()}
                        disabled={busyAction !== null}
                        className="matrix-button mt-4 inline-flex h-11 items-center justify-center rounded-[1rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyAction === "user" ? "Creating User" : "Create User"}
                      </button>
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <FieldCard label="Visible users" value={String(filteredUsers.length)} />
                    <FieldCard label="Approved" value={String(visibleUsers.filter((entry) => entry.approved).length)} />
                    <FieldCard label="Pending" value={String(visibleUsers.filter((entry) => !entry.approved).length)} />
                    <FieldCard label="Locked" value={String(visibleUsers.filter((entry) => entry.locked).length)} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <TextField label="Search users" value={userSearch} onChange={setUserSearch} placeholder="Name, email, role, location..." />
                    <SelectTextField
                      label="Role filter"
                      value={userRoleFilter}
                      onChange={setUserRoleFilter}
                      options={[
                        { label: "All roles", value: "all" },
                        { label: "Admin", value: "admin" },
                        { label: "Asset Manager", value: "asset_manager" },
                        { label: "Staff", value: "staff" },
                        { label: "Volunteer", value: "volunteer" },
                      ]}
                    />
                    <SelectTextField
                      label="Access filter"
                      value={userAccessFilter}
                      onChange={setUserAccessFilter}
                      options={[
                        { label: "All access states", value: "all" },
                        { label: "Approved", value: "approved" },
                        { label: "Pending approval", value: "pending" },
                        { label: "Locked", value: "locked" },
                        { label: "Active", value: "active" },
                      ]}
                    />
                  </div>
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                    <div className="space-y-2">
                      {filteredUsers.length === 0 ? (
                        <div className="rounded-[1rem] border border-dashed border-primary/14 px-4 py-10 text-center text-sm text-muted-foreground">
                          No users match the current filters.
                        </div>
                      ) : (
                        filteredUsers.map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => {
                              setSelectedUserId(entry.id);
                              setUserDraftDirty(false);
                            }}
                            className={cn(
                              "flex w-full flex-col gap-1 rounded-[1rem] border px-4 py-3 text-left transition-colors",
                              entry.id === (selectedUser?.id ?? "") ? "border-primary/24 bg-primary/10 text-primary" : "border-primary/12 bg-card/45 text-foreground",
                            )}
                          >
                            <span className="text-sm font-medium">{entry.full_name}</span>
                            <span className="text-sm text-muted-foreground">
                              {entry.role} | {entry.home_base ?? "Unassigned"} | {entry.locked ? "Locked" : entry.approved ? "Approved" : "Pending approval"}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                    <div className="space-y-4">
                      {selectedUser ? (
                        <>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <TextField
                              label="First name"
                              value={resolvedUserDisplayName}
                              onChange={(value) => {
                                setUserDraftDirty(true);
                                setUserDisplayNameDraft(value);
                              }}
                              placeholder="Display name"
                            />
                            <TextField
                              label="Surname"
                              value={resolvedUserSurname}
                              onChange={(value) => {
                                setUserDraftDirty(true);
                                setUserSurnameDraft(value);
                              }}
                              placeholder="Surname"
                            />
                            <SelectTextField
                              label="Home base"
                              value={resolvedUserAssignedLocationId}
                              onChange={(value) => {
                                setUserDraftDirty(true);
                                setUserAssignedLocationDraft(value);
                              }}
                              options={workspace.locations.map((location) => ({ label: location.name, value: location.id }))}
                            />
                            {isAdmin ? (
                              <SelectTextField
                                label="Primary role"
                                value={resolvedUserRole}
                                onChange={(value) => {
                                  setUserDraftDirty(true);
                                  setUserRoleDraft(value);
                                }}
                                options={[
                                  { label: "Admin", value: "admin" },
                                  { label: "Asset Manager", value: "asset_manager" },
                                  { label: "Staff", value: "staff" },
                                  { label: "Volunteer", value: "volunteer" },
                                ]}
                              />
                            ) : (
                              <FieldCard label="Primary role" value={selectedUser.role} />
                            )}
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <FieldCard label="Email" value={selectedUser.email} />
                            <FieldCard label="Access state" value={selectedUser.approved ? "Approved" : "Pending approval"} />
                            <FieldCard label="Lock state" value={selectedUser.locked ? "Locked" : "Unlocked"} />
                            <FieldCard label="Department" value={selectedUser.department ?? "No department"} />
                          </div>
                          {createdUserPassword ? (
                            <div className="rounded-[1rem] border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-100/85">
                              Temporary password for the last created user: <span className="font-mono">{createdUserPassword}</span>
                            </div>
                          ) : null}
                          {resetUserPassword ? (
                            <div className="rounded-[1rem] border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-100/85">
                              Temporary password for {selectedUser.full_name}: <span className="font-mono">{resetUserPassword}</span>
                            </div>
                          ) : null}
                          {isAdmin ? (
                            <div className="rounded-[1rem] border border-primary/12 bg-card/45 p-4">
                              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                                <TextField
                                  label="Temporary password"
                                  value={userPasswordDraft}
                                  onChange={setUserPasswordDraft}
                                  placeholder="Leave blank to generate one"
                                />
                                <button
                                  type="button"
                                  onClick={() => void updateUserPassword()}
                                  disabled={busyAction !== null}
                                  className="inline-flex h-11 self-end items-center justify-center rounded-[1rem] border border-primary/18 bg-card/55 px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {busyAction === "user" ? "Working" : "Reset Password"}
                                </button>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => void saveUser()}
                                  disabled={busyAction !== null}
                                  className="matrix-button inline-flex h-11 items-center justify-center rounded-[1rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {busyAction === "user" ? "Saving User" : "Save User"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void approveUserAccess()}
                                  disabled={busyAction !== null || !resolvedUserDisplayName.trim()}
                                  className="inline-flex h-11 items-center justify-center rounded-[1rem] border border-emerald-500/25 bg-emerald-500/10 px-4 text-sm font-medium text-emerald-100 transition-colors hover:bg-emerald-500/18 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {selectedUser.approved ? "Re-apply Access" : "Approve Access"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void revokeUserAccess()}
                                  disabled={busyAction !== null || !selectedUser.approved}
                                  className="inline-flex h-11 items-center justify-center rounded-[1rem] border border-amber-500/25 bg-amber-500/10 px-4 text-sm font-medium text-amber-100 transition-colors hover:bg-amber-500/18 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Revoke Access
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteUserAccount()}
                                  disabled={busyAction !== null || selectedUser.id === user?.id}
                                  className="inline-flex h-11 items-center justify-center rounded-[1rem] border border-rose-500/25 bg-rose-500/10 px-4 text-sm font-medium text-rose-100 transition-colors hover:bg-rose-500/18 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Delete User
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void saveUser()}
                              disabled={busyAction !== null}
                              className="matrix-button inline-flex h-11 items-center justify-center rounded-[1rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {busyAction === "user" ? "Saving User" : "Save User"}
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="rounded-[1rem] border border-dashed border-primary/14 px-4 py-10 text-center text-sm text-muted-foreground">
                          Choose a user to edit.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {activeTab === "roles" && (
                <div className="space-y-4">
                  <DataSection
                    title="Roles"
                    body="Review role distribution and access boundaries."
                    rows={[]}
                  />
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {roleSummaryRows.map((row) => (
                      <div key={row.role} className="rounded-[1rem] border border-primary/12 bg-card/45 px-4 py-4">
                        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{row.label}</div>
                        <div className="mt-2 font-display text-3xl text-foreground glow-soft">{row.count}</div>
                        <div className="mt-2 text-sm text-muted-foreground">{row.locationRule}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-3 xl:grid-cols-2">
                    {roleSummaryRows.map((row) => (
                      <div key={`${row.role}-detail`} className="rounded-[1rem] border border-primary/12 bg-card/45 px-4 py-4">
                        <div className="font-display text-xl text-foreground glow-soft">{row.label}</div>
                        <div className="mt-2 text-sm text-muted-foreground">{row.capability}</div>
                        <div className="mt-2 text-sm text-muted-foreground">{row.locationRule}</div>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab("users");
                            setUserRoleFilter(row.role);
                            setUserAccessFilter("all");
                          }}
                          className="mt-4 inline-flex h-10 items-center justify-center rounded-[0.9rem] border border-primary/18 px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary"
                        >
                          View {row.label} Users
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeTab === "locations" && (
                <div className="space-y-4">
                  <DataSection
                    title="Locations"
                    body="Manage location records and active states."
                    rows={[]}
                  />
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <TextField label="New location" value={newLocationName} onChange={setNewLocationName} placeholder="Location name" />
                    <label className="flex items-center gap-3 rounded-[1rem] border border-primary/12 bg-card/45 px-4 py-3 text-sm text-foreground">
                      <input type="checkbox" checked={newLocationIsHomeBase} onChange={(event) => setNewLocationIsHomeBase(event.target.checked)} />
                      <span>Home base enabled</span>
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => void addLocation()}
                    disabled={busyAction !== null || !newLocationName.trim()}
                    className="matrix-button inline-flex h-11 items-center justify-center rounded-[1rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === "location" ? "Saving Location" : "Add Location"}
                  </button>
                  <div className="space-y-2">
                    {workspace.locations.map((entry) => (
                      <ActionRow
                        key={entry.id}
                        title={entry.name}
                        meta={`${entry.active ? "Active" : "Inactive"} | ${entry.is_home_base ? "Home base enabled" : "Temporary only"}`}
                        actionLabel={entry.active ? "Disable" : "Enable"}
                        onAction={() => void toggleLocationActive(entry)}
                        disabled={busyAction !== null}
                      />
                    ))}
                  </div>
                </div>
              )}
              {activeTab === "departments" && (
                <div className="space-y-4">
                  <DataSection
                    title="Departments"
                    body="Manage department records and active states."
                    rows={[]}
                  />
                  <TextField label="New department" value={newDepartmentName} onChange={setNewDepartmentName} placeholder="Department name" />
                  <button
                    type="button"
                    onClick={() => void addDepartment()}
                    disabled={busyAction !== null || !newDepartmentName.trim()}
                    className="matrix-button inline-flex h-11 items-center justify-center rounded-[1rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === "department" ? "Saving Department" : "Add Department"}
                  </button>
                  <div className="space-y-2">
                    {workspace.departments.map((entry) => (
                      <ActionRow
                        key={entry.id}
                        title={entry.name}
                        meta={entry.active ? "Active" : "Inactive"}
                        actionLabel={entry.active ? "Archive" : "Enable"}
                        onAction={() => void toggleDepartmentActive(entry)}
                        disabled={busyAction !== null}
                      />
                    ))}
                  </div>
                </div>
              )}
              {activeTab === "kits" && (
                <div className="space-y-4">
                  <DataSection
                    title="Kits"
                    body="Create kits, manage members, and control kit status."
                    rows={[]}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField label="Kit name" value={newKitName} onChange={setNewKitName} placeholder="Sunday Camera Kit" />
                    <TextField label="Home base" value={newKitHomeBase} onChange={setNewKitHomeBase} placeholder="Centurion" />
                    <NumberTextField label="Legacy fallback count" value={newKitItemCount} onChange={setNewKitItemCount} />
                  </div>
                  <button
                    type="button"
                    onClick={() => void addKit()}
                    disabled={busyAction !== null || !newKitName.trim()}
                    className="matrix-button inline-flex h-11 items-center justify-center rounded-[1rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === "kit" ? "Saving Kit" : "Add Kit"}
                  </button>
                  <div className="space-y-2">
                    {workspace.kits.map((entry) => (
                      <div
                        key={entry.id}
                        className={cn(
                          "flex flex-col gap-3 rounded-[1rem] border px-4 py-4 sm:flex-row sm:items-center sm:justify-between",
                          entry.id === (selectedKit?.id ?? "") ? "border-primary/24 bg-primary/10" : "border-primary/12 bg-card/45",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedKitId(entry.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="text-sm font-medium text-foreground">{entry.name}</div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {entry.home_base ?? "Unassigned"} | {entry.item_count} item{entry.item_count === 1 ? "" : "s"} | {entry.active ? "Active" : "Inactive"}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleKitActive(entry)}
                          disabled={busyAction !== null}
                          className="inline-flex h-10 items-center justify-center rounded-[0.9rem] border border-primary/18 px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {entry.active ? "Retire" : "Enable"}
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <div className="space-y-3">
                      <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 p-4">
                        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Selected kit</div>
                        <div className="mt-2 text-sm text-foreground">
                          {selectedKit ? `${selectedKit.name} | ${resolvedKitMemberIds.length} saved asset${resolvedKitMemberIds.length === 1 ? "" : "s"}` : "Choose a kit to edit membership."}
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground">
                          Source: {kitMembersSource === "live" ? "Live membership" : "Fallback membership"} | Asset pool: {kitAssetCandidatesSource === "live" ? "Live assets" : "Fallback assets"}
                        </div>
                      </div>

                      {kitMemberWarnings.concat(kitAssetCandidateWarnings).length > 0 && (
                        <div className="rounded-[1.2rem] border border-amber-500/20 bg-amber-500/8 px-4 py-4 text-sm text-amber-100/85">
                          <div className="space-y-1">
                            {kitMemberWarnings.concat(kitAssetCandidateWarnings).map((warning, index) => (
                              <div key={`${warning}-${index}`}>{warning}</div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => void saveKitMembership()}
                          disabled={busyAction !== null || !selectedKit}
                          className="matrix-button inline-flex h-11 items-center justify-center rounded-[1rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busyAction === "kit" ? "Saving Kit" : "Save Membership"}
                        </button>
                        <button
                          type="button"
                          onClick={resetKitDraft}
                          disabled={busyAction !== null || !kitMemberDraftDirty}
                          className="inline-flex h-11 items-center justify-center rounded-[1rem] border border-primary/18 px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Reset Draft
                        </button>
                      </div>

                      <div className="space-y-2">
                        {loadingKitMembers ? (
                          <div className="rounded-[1rem] border border-dashed border-primary/14 px-4 py-10 text-center text-sm text-muted-foreground">
                            Loading saved kit membership...
                          </div>
                        ) : selectedKitMemberAssets.length === 0 ? (
                          <div className="rounded-[1rem] border border-dashed border-primary/14 px-4 py-10 text-center text-sm text-muted-foreground">
                            No saved kit members yet. Add assets from the pool on the right.
                          </div>
                        ) : (
                          selectedKitMemberAssets.map((asset) => (
                            <KitAssetRow
                              key={`${selectedKit?.id ?? "kit"}-${asset.asset_id}`}
                              title={asset.asset_name}
                              meta={`${asset.asset_code} | ${asset.current_location ?? "No location"} | ${asset.department ?? "No department"} | ${asset.status}`}
                              actionLabel="Remove"
                              onAction={() => removeAssetFromKitDraft(asset.asset_id)}
                              disabled={busyAction !== null}
                            />
                          ))
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <TextField label="Search asset pool" value={kitAssetSearch} onChange={setKitAssetSearch} placeholder="Tag, name, location, department..." />
                      <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 px-4 py-3 text-sm text-muted-foreground">
                        {loadingKitAssets ? "Loading asset pool..." : `${filteredKitAssetCandidates.length} asset${filteredKitAssetCandidates.length === 1 ? "" : "s"} available to add to this kit.`}
                      </div>
                      <div className="space-y-2">
                        {filteredKitAssetCandidates.length === 0 ? (
                          <div className="rounded-[1rem] border border-dashed border-primary/14 px-4 py-10 text-center text-sm text-muted-foreground">
                            No matching assets remain in the pool.
                          </div>
                        ) : (
                          filteredKitAssetCandidates.map((asset) => (
                            <KitAssetRow
                              key={asset.asset_id}
                              title={asset.asset_name}
                              meta={`${asset.asset_code} | ${asset.current_location ?? "No location"} | ${asset.department ?? "No department"} | ${asset.status}`}
                              actionLabel="Add"
                              onAction={() => addAssetToKitDraft(asset.asset_id)}
                              disabled={busyAction !== null || !selectedKit}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === "consumables" && (
                <div className="space-y-4">
                  <DataSection
                    title="Consumables"
                    body="Manage consumables, stock, and active states."
                    rows={[]}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField label="Name" value={newConsumableName} onChange={setNewConsumableName} placeholder="Consumable name" />
                    <TextField label="Department" value={newConsumableDepartment} onChange={setNewConsumableDepartment} placeholder="Optional department" />
                    <TextField label="Unit" value={newConsumableUnit} onChange={setNewConsumableUnit} placeholder="box, roll, unit..." />
                    <NumberTextField label="Stock on hand" value={newConsumableStock} onChange={setNewConsumableStock} />
                    <NumberTextField label="Reorder level" value={newConsumableReorderLevel} onChange={setNewConsumableReorderLevel} />
                  </div>
                  <button
                    type="button"
                    onClick={() => void addConsumable()}
                    disabled={busyAction !== null || !newConsumableName.trim() || !newConsumableUnit.trim()}
                    className="matrix-button inline-flex h-11 items-center justify-center rounded-[1rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === "consumable" ? "Saving Consumable" : "Add Consumable"}
                  </button>
                  <div className="space-y-2">
                    {workspace.consumables.map((entry) => (
                      <ActionRow
                        key={entry.id}
                        title={entry.name}
                        meta={`${entry.stock_on_hand} ${entry.unit} | Reorder at ${entry.reorder_level} | ${entry.department ?? "No department"} | ${entry.active ? "Active" : "Inactive"}`}
                        actionLabel={entry.active ? "Archive" : "Enable"}
                        onAction={() => void toggleConsumableActive(entry)}
                        disabled={busyAction !== null}
                      />
                    ))}
                  </div>
                </div>
              )}
              {activeTab === "reports" && (
                <div className="space-y-4">
                  <DataSection
                    title="Reports"
                    body="Filter report data and export the current view."
                    rows={[]}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SelectTextField
                      label="Report type"
                      value={reportType}
                      onChange={(value) => setReportType(value as ReportType)}
                      options={[
                        { label: "Damage reports", value: "damage" },
                        { label: "Asset history", value: "asset_history" },
                        { label: "Accountability history", value: "accountability" },
                      ]}
                    />
                    <SelectTextField
                      label="Location filter"
                      value={resolvedReportLocationId}
                      onChange={setReportLocationId}
                      options={[
                        { label: "All locations", value: "" },
                        ...workspace.locations.map((location) => ({ label: location.name, value: location.id })),
                      ]}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setReportRefreshTick((current) => current + 1)}
                      disabled={loadingReports}
                      className="inline-flex h-11 items-center justify-center rounded-[1rem] border border-primary/18 bg-card/55 px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loadingReports ? "Refreshing Report" : "Refresh Report"}
                    </button>
                    <button
                      type="button"
                      onClick={exportCurrentReportCsv}
                      disabled={loadingReports || reportWorkspace.rows.length === 0}
                      className="matrix-button inline-flex h-11 items-center justify-center rounded-[1rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={exportCurrentReportXlsx}
                      disabled={loadingReports || reportWorkspace.rows.length === 0}
                      className="inline-flex h-11 items-center justify-center rounded-[1rem] border border-primary/18 bg-card/55 px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Export XLSX
                    </button>
                    <button
                      type="button"
                      onClick={exportCurrentReportPdf}
                      disabled={loadingReports || reportWorkspace.rows.length === 0}
                      className="inline-flex h-11 items-center justify-center rounded-[1rem] border border-primary/18 bg-card/55 px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Export PDF
                    </button>
                  </div>
                  <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 px-4 py-4 text-sm text-muted-foreground">
                    Filtered report export is now available as CSV, XLSX, and PDF from the same live report surface.
                  </div>
                  {reportWorkspace.warnings.length > 0 && (
                    <div className="rounded-[1.2rem] border border-amber-500/20 bg-amber-500/8 px-4 py-4 text-sm text-amber-100/85">
                      {reportWorkspace.warnings.map((warning) => (
                        <div key={warning}>{warning}</div>
                      ))}
                    </div>
                  )}
                  <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary/72">Current report rows</div>
                      <div className="text-xs text-muted-foreground">
                        {reportWorkspace.source === "live" ? "Live data" : "Fallback/legacy surface"} | {reportWorkspace.rows.length} rows
                      </div>
                    </div>
                    {reportWorkspace.columns.length === 0 ? (
                      <div className="mt-4 rounded-[1rem] border border-dashed border-primary/14 px-4 py-10 text-center text-sm text-muted-foreground">
                        No report rows loaded yet.
                      </div>
                    ) : (
                      <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-primary/12">
                              {reportWorkspace.columns.map((column) => (
                                <th key={column} className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                                  {column}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {reportWorkspace.rows.slice(0, 25).map((row, index) => (
                              <tr key={`report-row-${index}`} className="border-b border-primary/8 align-top">
                                {reportWorkspace.columns.map((column) => (
                                  <td key={`${index}-${column}`} className="px-3 py-3 text-foreground">
                                    {row[column] || "-"}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {activeTab === "duplicates" && (
                <div className="space-y-4">
                  <DataSection
                    title="Duplicates"
                    body="Compare duplicate records and resolve them."
                    rows={[]}
                  />
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
                    <div className="space-y-2">
                      {workspace.duplicates.length === 0 ? (
                        <div className="rounded-[1rem] border border-dashed border-primary/14 px-4 py-10 text-center text-sm text-muted-foreground">
                          No duplicate pairs found in this queue.
                        </div>
                      ) : (
                        workspace.duplicates.map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => setSelectedDuplicateId(entry.id)}
                            className={cn(
                              "flex w-full flex-col gap-1 rounded-[1rem] border px-4 py-3 text-left transition-colors",
                              entry.id === (selectedDuplicate?.id ?? "") ? "border-primary/24 bg-primary/10 text-primary" : "border-primary/12 bg-card/45 text-foreground",
                            )}
                          >
                            <span className="text-sm font-medium">{entry.primary_asset} vs {entry.duplicate_asset}</span>
                            <span className="text-sm text-muted-foreground">{entry.status} | {new Date(entry.created_at).toLocaleDateString()}</span>
                          </button>
                        ))
                      )}
                    </div>
                    <div className="space-y-4">
                      {selectedDuplicate ? (
                        <>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <DuplicateAssetCard
                              label="Primary asset"
                              asset={duplicateComparison?.primary ?? null}
                              selected={duplicateSurvivor === "primary"}
                              onSelect={() => setDuplicateSurvivor("primary")}
                              disabled={duplicateResolutionStatus !== "Merged"}
                            />
                            <DuplicateAssetCard
                              label="Duplicate candidate"
                              asset={duplicateComparison?.duplicate ?? null}
                              selected={duplicateSurvivor === "duplicate"}
                              onSelect={() => setDuplicateSurvivor("duplicate")}
                              disabled={duplicateResolutionStatus !== "Merged"}
                            />
                          </div>
                          {loadingDuplicateComparison ? (
                            <div className="rounded-[1rem] border border-primary/12 bg-card/45 px-4 py-3 text-sm text-muted-foreground">
                              Loading duplicate comparison...
                            </div>
                          ) : null}
                          {duplicateComparison?.warnings.length ? (
                            <div className="rounded-[1rem] border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-100/85">
                              {duplicateComparison.warnings.map((warning) => (
                                <div key={warning}>{warning}</div>
                              ))}
                            </div>
                          ) : null}
                          <div className="grid gap-3 sm:grid-cols-2">
                            <SelectTextField
                              label="Resolution"
                              value={duplicateResolutionStatus}
                              onChange={(value) => setDuplicateResolutionStatus(value as "Merged" | "Not Duplicate")}
                              options={[
                                { label: "Merged", value: "Merged" },
                                { label: "Not Duplicate", value: "Not Duplicate" },
                              ]}
                            />
                            <FieldCard label="Queue source" value={duplicateComparison?.source === "live" ? "Live compare data" : "Fallback compare data"} />
                          </div>
                          <TextField
                            label="Resolution note"
                            value={duplicateNote}
                            onChange={setDuplicateNote}
                            placeholder="Explain the merge decision or why this is not a duplicate"
                          />
                          <button
                            type="button"
                            onClick={() => void submitDuplicateResolution()}
                            disabled={busyAction !== null || !duplicateNote.trim()}
                            className="matrix-button inline-flex h-11 items-center justify-center rounded-[1rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busyAction === "duplicate" ? "Saving Duplicate Resolution" : "Save Duplicate Resolution"}
                          </button>
                        </>
                      ) : (
                        <div className="rounded-[1rem] border border-dashed border-primary/14 px-4 py-10 text-center text-sm text-muted-foreground">
                          Choose a duplicate pair to compare and resolve.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {activeTab === "config" && (
                <div className="space-y-4">
                  <DataSection
                    title="Config"
                    body="Manage operational rules and QR export settings."
                    rows={workspace.config.slice(0, 8).map((entry) => `${entry.key} | ${JSON.stringify(entry.value)}`)}
                  />
                  <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 p-4">
                    <div className="flex items-center gap-3">
                      <QrCode size={18} className="text-primary" />
                      <div>
                        <div className="font-display text-xl text-foreground glow-soft">Bulk QR export</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          Packed A4 PDF sheets, filtered by created-date range and standard filters, with 20mm x 20mm labels and UUID-encoded QR payloads.
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <NumberTextField
                        label="Label mm"
                        value={resolvedQrExportLabelMm}
                        onChange={(value) => {
                          setQrExportDirty(true);
                          setQrExportLabelMm(value);
                        }}
                      />
                      <NumberTextField
                        label="Page border mm"
                        value={resolvedQrExportPageBorderMm}
                        onChange={(value) => {
                          setQrExportDirty(true);
                          setQrExportPageBorderMm(value);
                        }}
                      />
                      <TextField
                        label="Format"
                        value={resolvedQrExportFormat}
                        onChange={(value) => {
                          setQrExportDirty(true);
                          setQrExportFormat(value);
                        }}
                        placeholder="A4"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void saveQrExportConfig()}
                      disabled={busyAction !== null}
                      className="matrix-button mt-4 inline-flex h-11 items-center justify-center rounded-[1rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyAction === "config" ? "Saving Config" : "Save QR Export Config"}
                    </button>
                  </div>
                  <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 p-4">
                    <div className="font-display text-xl text-foreground glow-soft">QR export asset filter</div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <TextField label="Search" value={qrFilterSearch} onChange={setQrFilterSearch} placeholder="Tag, name, location..." />
                      <SelectTextField
                        label="Location"
                        value={qrFilterLocationId}
                        onChange={setQrFilterLocationId}
                        options={[
                          { label: "All locations", value: "" },
                          ...workspace.locations.map((location) => ({ label: location.name, value: location.id })),
                        ]}
                      />
                      <SelectTextField
                        label="Department"
                        value={qrFilterDepartmentId}
                        onChange={setQrFilterDepartmentId}
                        options={[
                          { label: "All departments", value: "" },
                          ...workspace.departments.map((department) => ({ label: department.name, value: department.id })),
                        ]}
                      />
                      <TextField label="Status" value={qrFilterStatus} onChange={setQrFilterStatus} placeholder="available, assigned..." />
                      <DateField label="Created from" value={qrCreatedFrom} onChange={setQrCreatedFrom} />
                      <DateField label="Created to" value={qrCreatedTo} onChange={setQrCreatedTo} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void loadQrPreview()}
                        disabled={loadingQrPreview}
                        className="inline-flex h-11 items-center justify-center rounded-[1rem] border border-primary/18 bg-card/55 px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loadingQrPreview ? "Loading QR Assets" : "Load QR Assets"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void exportQrSheetPdf()}
                        disabled={busyAction !== null || qrPreviewAssets.length === 0}
                        className="matrix-button inline-flex h-11 items-center justify-center rounded-[1rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyAction === "config" ? "Generating QR PDF" : "Generate QR Sheet PDF"}
                      </button>
                    </div>
                    <div className="mt-4 rounded-[1rem] border border-primary/10 bg-card/35 px-4 py-3 text-sm text-muted-foreground">
                      {qrPreviewAssets.length} asset{qrPreviewAssets.length === 1 ? "" : "s"} currently matched. Output remains A4, sorted by tag, with UUID-encoded QR payloads and visible tag text.
                    </div>
                    {qrPreviewAssets.length > 0 && (
                      <div className="mt-4 max-h-64 overflow-auto rounded-[1rem] border border-primary/10 bg-card/35">
                        <table className="min-w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-primary/12">
                              {["Tag", "Name", "Location", "Department", "Status"].map((column) => (
                                <th key={column} className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                                  {column}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {qrPreviewAssets.slice(0, 50).map((asset) => (
                              <tr key={asset.id} className="border-b border-primary/8">
                                <td className="px-3 py-3 text-foreground">{asset.tag}</td>
                                <td className="px-3 py-3 text-foreground">{asset.name}</td>
                                <td className="px-3 py-3 text-foreground">{asset.location}</td>
                                <td className="px-3 py-3 text-foreground">{asset.department}</td>
                                <td className="px-3 py-3 text-foreground">{asset.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
      </div>
        </main>
      </div>
    </div>
  );
}

function DataSection({
  title,
  body,
  rows,
}: {
  title: string;
  body?: string;
  rows: string[];
}) {
  return (
    <div className="space-y-4">
      <div className="app-kicker">{title}</div>
      <div className="font-display text-3xl text-foreground glow-soft">{title} workspace</div>
      {body ? <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 p-4 text-sm text-muted-foreground">{body}</div> : null}
      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={`${title}-${index}`} className="rounded-[1rem] border border-primary/12 bg-card/45 px-4 py-3 text-sm text-foreground">
              {row}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FieldCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-primary/12 bg-card/45 px-4 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm text-foreground">{value}</div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="space-y-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="matrix-field h-12 w-full rounded-[1rem] px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}

function NumberTextField({
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
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="matrix-field h-12 w-full rounded-[1rem] px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}

function DateField({
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
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="matrix-field h-12 w-full rounded-[1rem] px-4 text-sm text-foreground outline-none"
      />
    </label>
  );
}

function SelectTextField({
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
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <div className="matrix-field rounded-[1rem] px-4">
        <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full bg-transparent text-sm text-foreground outline-none">
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

function ActionRow({
  title,
  meta,
  actionLabel,
  onAction,
  disabled,
}: {
  title: string;
  meta: string;
  actionLabel: string;
  onAction: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[1rem] border border-primary/12 bg-card/45 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="mt-1 text-sm text-muted-foreground">{meta}</div>
      </div>
      <button
        type="button"
        onClick={onAction}
        disabled={disabled}
        className="inline-flex h-10 items-center justify-center rounded-[0.9rem] border border-primary/18 px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function KitAssetRow({
  title,
  meta,
  actionLabel,
  onAction,
  disabled,
}: {
  title: string;
  meta: string;
  actionLabel: string;
  onAction: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[1rem] border border-primary/12 bg-card/45 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="mt-1 text-sm text-muted-foreground">{meta}</div>
      </div>
      <button
        type="button"
        onClick={onAction}
        disabled={disabled}
        className="inline-flex h-10 items-center justify-center rounded-[0.9rem] border border-primary/18 px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function DuplicateAssetCard({
  label,
  asset,
  selected,
  onSelect,
  disabled,
}: {
  label: string;
  asset: DuplicateComparison["primary"];
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "rounded-[1rem] border px-4 py-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        selected ? "border-primary/24 bg-primary/10 text-primary" : "border-primary/12 bg-card/45 text-foreground",
      )}
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-3 space-y-2 text-sm">
        <div className="font-medium text-foreground">{asset?.name ?? "Unknown asset"}</div>
        <div>Tag: {asset?.tag ?? "-"}</div>
        <div>Serial: {asset?.serial ?? "-"}</div>
        <div>Location: {asset?.location ?? "-"}</div>
        <div>Department: {asset?.department ?? "-"}</div>
        <div>Status: {asset?.status ?? "-"}</div>
      </div>
    </button>
  );
}
