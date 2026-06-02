"use client";

import { Archive, FileText, MapPin, Package, QrCode, RefreshCcw, Settings2, Shield, UserRound, Users, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import {
  createDepartment,
  createConsumable,
  createKit,
  createLocation,
  getFallbackSettingsWorkspace,
  loadSettingsWorkspace,
  saveSettingsConfig,
  saveSettingsUser,
  setConsumableActiveState,
  setDepartmentActiveState,
  setKitActiveState,
  setLocationActiveState,
  updateMyProfile,
  type SettingsConfigRecord,
  type SettingsConsumableRecord,
  type SettingsDepartmentRecord,
  type SettingsKitRecord,
  type SettingsLocationRecord,
  type SettingsWorkspaceData,
} from "@/lib/settings";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { SectionShell } from "../layout";

type SettingsTab =
  | "profile"
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
  const { isAdmin, isAssetManager, profileName, roles, isConfigured, user, assignedLocationId, assetManagerLocationId } = useAuth();
  const [workspace, setWorkspace] = useState<SettingsWorkspaceData>(getFallbackSettingsWorkspace());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [feedback, setFeedback] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null);
  const [busyAction, setBusyAction] = useState<"profile" | "user" | "location" | "department" | "kit" | "consumable" | "config" | null>(null);
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [profileSurname, setProfileSurname] = useState("");
  const [profileDirty, setProfileDirty] = useState(false);
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
  const [newConsumableName, setNewConsumableName] = useState("");
  const [newConsumableDepartment, setNewConsumableDepartment] = useState("");
  const [newConsumableUnit, setNewConsumableUnit] = useState("");
  const [newConsumableStock, setNewConsumableStock] = useState("0");
  const [newConsumableReorderLevel, setNewConsumableReorderLevel] = useState("0");
  const [qrExportLabelMm, setQrExportLabelMm] = useState("20");
  const [qrExportPageBorderMm, setQrExportPageBorderMm] = useState("5");
  const [qrExportFormat, setQrExportFormat] = useState("A4");
  const [qrExportDirty, setQrExportDirty] = useState(false);

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
    () => workspace.locations.find((location) => location.id === assignedLocationId)?.name ?? workspace.users.find((entry) => entry.email === user?.email)?.home_base ?? "No home base assigned",
    [assignedLocationId, user?.email, workspace.locations, workspace.users],
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
  const selectedUser = useMemo(
    () => visibleUsers.find((entry) => entry.id === (selectedUserId || visibleUsers[0]?.id)) ?? null,
    [selectedUserId, visibleUsers],
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
      const { error } = await createKit(supabase, {
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

    setBusyAction("config");
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

  return (
    <SectionShell title="Settings" kicker="Profile + role-aware operational tabs">
      <div className="space-y-4 sm:space-y-6">
        <section className="app-panel p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="app-kicker">Settings</div>
              <h1 className="app-title mt-2">Role-aware settings workspace now loads live read-side data.</h1>
              <p className="app-subtitle mt-3">
                `Profile` remains visible to all roles, while the operational/admin tabs now pull live section lists where the backend surface exists and fall back safely where it does not.
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-primary/18 bg-primary/8 px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/72">Current profile</div>
              <div className="mt-2 text-sm text-primary">{profileName || "Operator"} | {roleLabel}</div>
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
          <div className="grid gap-0 xl:grid-cols-[minmax(0,0.36fr)_minmax(0,0.64fr)]">
            <div className="border-b border-primary/12 xl:border-b-0 xl:border-r">
              <div className="p-4 sm:p-5">
                <div className="app-kicker">Tabs</div>
                <div className="mt-2 text-sm text-muted-foreground">Visibility is role-aware. Profile stays visible for everyone.</div>
              </div>

              <div className="space-y-2 px-4 pb-4 sm:px-5 sm:pb-5">
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
                  <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 p-4 text-sm text-muted-foreground">
                    This tab now uses live identity context where available and supports basic name updates. Notification preferences are still deferred.
                  </div>
                </div>
              )}

              {activeTab === "users" && (
                <div className="space-y-4">
                  <DataSection
                    title="Users"
                    body={
                      isAdmin
                        ? "Users uses one shared record structure with split admin versus manager edit sets. This pass supports core profile, home-base, and primary-role updates."
                        : "Managers can now edit core operational profile fields for users in their own location from the rebuilt settings route."
                    }
                    rows={[]}
                  />
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                    <div className="space-y-2">
                      {visibleUsers.length === 0 ? (
                        <div className="rounded-[1rem] border border-dashed border-primary/14 px-4 py-10 text-center text-sm text-muted-foreground">
                          No users available in this scope.
                        </div>
                      ) : (
                        visibleUsers.map((entry) => (
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
                            <span className="text-sm text-muted-foreground">{entry.role} | {entry.home_base ?? "No home base"} | {entry.locked ? "Locked" : "Active"}</span>
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
                          </div>
                          <button
                            type="button"
                            onClick={() => void saveUser()}
                            disabled={busyAction !== null}
                            className="matrix-button inline-flex h-11 items-center justify-center rounded-[1rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busyAction === "user" ? "Saving User" : "Save User"}
                          </button>
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
                <DataSection
                  title="Roles"
                  body="Roles remain fixed system roles in v1. There is no custom role or permission editor in the new baseline."
                  rows={["Admin | full operational access", "Asset Manager | one-location operations", "Staff | requests + inventory browse", "Volunteer | assigned-items only"]}
                />
              )}
              {activeTab === "locations" && (
                <div className="space-y-4">
                  <DataSection
                    title="Locations"
                    body="Locations remains the admin-managed home for add, disable, retire, and force-retirement handling. This first write-side pass supports add plus active/inactive state changes."
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
                    body="Departments remains the admin-managed list for create, rename, merge, archive, and organization controls. This first write-side pass supports create plus active/inactive state changes."
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
                    body="Kits remains the saved kit builder and lifecycle workspace for create, edit, and retire actions. This first write-side pass supports creating kit definitions plus retire/re-enable state changes."
                    rows={[]}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField label="Kit name" value={newKitName} onChange={setNewKitName} placeholder="Sunday Camera Kit" />
                    <TextField label="Home base" value={newKitHomeBase} onChange={setNewKitHomeBase} placeholder="Centurion" />
                    <NumberTextField label="Item count" value={newKitItemCount} onChange={setNewKitItemCount} />
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
                      <ActionRow
                        key={entry.id}
                        title={entry.name}
                        meta={`${entry.home_base ?? "No home base"} | ${entry.item_count} item${entry.item_count === 1 ? "" : "s"} | ${entry.active ? "Active" : "Inactive"}`}
                        actionLabel={entry.active ? "Retire" : "Enable"}
                        onAction={() => void toggleKitActive(entry)}
                        disabled={busyAction !== null}
                      />
                    ))}
                  </div>
                  <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 p-4 text-sm text-muted-foreground">
                    Item-level kit membership editing is still deferred. This pass focuses on real saved-kit definition lifecycle so the Sunday Kits deployment flow has a maintainable source list.
                  </div>
                </div>
              )}
              {activeTab === "consumables" && (
                <div className="space-y-4">
                  <DataSection
                    title="Consumables"
                    body="Consumables remains the operational catalog plus stock-rules workspace available to admins and managers. This write-side pass supports create plus active/inactive state changes."
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
                <DataSection
                  title="Reports"
                  body="Reports remains the filtered report/export workspace for damage reports, asset history, and accountability history, with CSV, XLSX, and PDF export targets."
                  rows={["Damage reports | export pending", "Asset history | export pending", "Accountability history | export pending"]}
                />
              )}
              {activeTab === "duplicates" && (
                <DataSection
                  title="Duplicates"
                  body="Duplicates remains the admin review queue for compare-and-merge operations, preserving history and leaving merged tombstones."
                  rows={workspace.duplicates.slice(0, 8).map((entry) => `${entry.primary_asset} | ${entry.duplicate_asset} | ${entry.status}`)}
                />
              )}
              {activeTab === "config" && (
                <div className="space-y-4">
                  <DataSection
                    title="Config"
                    body="Config remains the business-rules plus technical/admin switch area and the home for bulk QR export tooling in the baseline. This pass adds a focused QR export editor."
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
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </SectionShell>
  );
}

function DataSection({
  title,
  body,
  rows,
}: {
  title: string;
  body: string;
  rows: string[];
}) {
  return (
    <div className="space-y-4">
      <div className="app-kicker">{title}</div>
      <div className="font-display text-3xl text-foreground glow-soft">{title} workspace</div>
      <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 p-4 text-sm text-muted-foreground">{body}</div>
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
