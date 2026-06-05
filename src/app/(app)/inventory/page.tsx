"use client";

import { AlertTriangle, ExternalLink, History, RefreshCcw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/contexts/auth-context";
import { useLocationScope } from "@/contexts/location-scope-context";
import { getAssetStatusLabel, getStatusBadgeClass, groupAssetsByName, normalizeAssetStatus, type AssetStatus } from "@/lib/assets";
import { fallbackInventoryAssets, fallbackInventoryHistory, loadInventoryAssetHistory, loadInventoryWorkspace, updateInventoryAssetDetails, type InventoryHistoryRecord, type InventoryWorkspaceData } from "@/lib/inventory";
import { matchesSearchQuery } from "@/lib/search";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { SectionShell } from "../layout";

const fallbackWorkspace: InventoryWorkspaceData = {
  assets: fallbackInventoryAssets,
  source: "fallback",
  warnings: ["Supabase is not configured yet, so Inventory is using the rebuild preview dataset."],
};

type InventoryQuickAction = {
  label: string;
  href: string;
  tone?: "default" | "warning";
};

function getInventoryActionSummary(status: AssetStatus) {
  switch (normalizeAssetStatus(status)) {
    case "available":
      return "Available units can move directly into request or operational issue workflows.";
    case "assigned":
      return "Assigned units usually need return, sign-in, or reassignment handling next.";
    case "traveling":
      return "Traveling units should be brought back through sign-in or reviewed for follow-up handling.";
    case "stationed":
      return "Stationed units can move into temporary-use or return-to-site handling.";
    case "damaged":
      return "Damaged units are operationally blocked and should route into damage review.";
    default:
      return "Choose the next compatible workflow from the actions below.";
  }
}

function getInventoryQuickActions(input: {
  assetId: string;
  status: AssetStatus;
  isAdmin: boolean;
  isAssetManager: boolean;
  isStaff: boolean;
}) {
  const normalizedStatus = normalizeAssetStatus(input.status);
  const actions: InventoryQuickAction[] = [];

  if ((input.isAdmin || input.isStaff) && normalizedStatus === "available") {
    actions.push({ label: "Open Asset Request", href: `/requests?tab=asset&assetId=${encodeURIComponent(input.assetId)}` });
  }

  if ((input.isAdmin || input.isStaff) && ["assigned", "stationed", "traveling"].includes(normalizedStatus)) {
    actions.push({ label: "Open Special Request", href: `/requests?tab=special&assetId=${encodeURIComponent(input.assetId)}` });
  }

  if ((input.isAdmin || input.isStaff) && ["assigned", "traveling", "stationed"].includes(normalizedStatus)) {
    actions.push({ label: "Open Return Request", href: `/requests?tab=returns&assetId=${encodeURIComponent(input.assetId)}` });
  }

  if ((input.isAdmin || input.isAssetManager) && normalizedStatus === "available") {
    actions.push({ label: "Open Standard Sign Out", href: `/check-out-in?tab=standard&mode=sign_out&assetId=${encodeURIComponent(input.assetId)}` });
    actions.push({ label: "Open Permanent Issue", href: `/check-out-in?tab=permanent&mode=direct_issue&assetId=${encodeURIComponent(input.assetId)}` });
    actions.push({ label: "Open Stationed Checkout", href: `/check-out-in?tab=stationed&mode=temporary_use&assetId=${encodeURIComponent(input.assetId)}` });
  }

  if ((input.isAdmin || input.isAssetManager) && ["assigned", "traveling"].includes(normalizedStatus)) {
    actions.push({ label: "Open Standard Sign In", href: `/check-out-in?tab=standard&mode=sign_in&assetId=${encodeURIComponent(input.assetId)}` });
  }

  if ((input.isAdmin || input.isAssetManager) && normalizedStatus === "assigned") {
    actions.push({ label: "Open Permanent Reassign", href: `/check-out-in?tab=permanent&mode=reassign&assetId=${encodeURIComponent(input.assetId)}` });
  }

  if ((input.isAdmin || input.isAssetManager) && normalizedStatus === "stationed") {
    actions.push({ label: "Open Return-To-Site", href: `/check-out-in?tab=stationed&mode=return_to_site&assetId=${encodeURIComponent(input.assetId)}` });
  }

  if ((input.isAdmin || input.isAssetManager) && normalizedStatus === "damaged") {
    actions.push({ label: "Review Damage Queue", href: "/approvals?tab=damage_locks", tone: "warning" });
  }

  return actions;
}

export default function InventoryPage() {
  const { isAdmin, isAssetManager, isStaff, isConfigured } = useAuth();
  const { activeLocationId, selectedLocationName } = useLocationScope();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedAssetId = searchParams.get("assetId");
  const [workspace, setWorkspace] = useState<InventoryWorkspaceData>(() => ({
    ...fallbackWorkspace,
    warnings: [],
  }));
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "all">("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "available_only" | "actionable">("all");
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [historyRows, setHistoryRows] = useState<InventoryHistoryRecord[]>(fallbackInventoryHistory);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editName, setEditName] = useState("");
  const [editTag, setEditTag] = useState("");
  const [editDepartmentId, setEditDepartmentId] = useState("");
  const [saveFeedback, setSaveFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [savingAssetEdit, setSavingAssetEdit] = useState(false);

  const canBrowseInventory = isAdmin || isAssetManager || isStaff;
  const canEditInventoryAsset = isAdmin || isAssetManager;

  useEffect(() => {
    let cancelled = false;

    const loadWorkspace = async () => {
      if (!isConfigured) {
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
        const nextWorkspace = await loadInventoryWorkspace(supabase, activeLocationId);
        if (!cancelled) {
          setWorkspace(nextWorkspace);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Inventory could not be loaded.";
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
  }, [activeLocationId, isConfigured]);

  const availableDepartments = useMemo(
    () => Array.from(new Set(workspace.assets.map((asset) => asset.department))).sort(),
    [workspace.assets],
  );
  const departmentOptions = useMemo(
    () =>
      Array.from(
        new Map(
          workspace.assets
            .filter((asset) => asset.departmentId && asset.department && asset.department !== "No department")
            .map((asset) => [asset.departmentId as string, asset.department]),
        ).entries(),
      ).map(([id, name]) => ({ id, name })),
    [workspace.assets],
  );

  const availableLocations = useMemo(
    () => Array.from(new Set(workspace.assets.map((asset) => asset.location))).sort(),
    [workspace.assets],
  );

  const scopedAssets = useMemo(() => {
    if (!activeLocationId || selectedLocationName === "All locations" || selectedLocationName === "No location assigned") {
      return workspace.assets;
    }
    return workspace.assets.filter((asset) => asset.location === selectedLocationName);
  }, [activeLocationId, selectedLocationName, workspace.assets]);

  const filteredAssets = useMemo(() => {
    return scopedAssets.filter((asset) => {
      const normalizedStatus = normalizeAssetStatus(asset.status);
      const matchesQuery = matchesSearchQuery(
        [asset.name, asset.tag, asset.serial, asset.location, asset.department, asset.holder, getAssetStatusLabel(asset.status)],
        query,
      );
      const matchesDepartment = departmentFilter === "all" || asset.department === departmentFilter;
      const matchesStatus = statusFilter === "all" || normalizedStatus === statusFilter;
      const matchesAvailability =
        availabilityFilter === "all" ||
        (availabilityFilter === "available_only" && normalizedStatus === "available") ||
        (availabilityFilter === "actionable" && ["available", "assigned", "stationed"].includes(normalizedStatus));

      return matchesQuery && matchesDepartment && matchesStatus && matchesAvailability;
    });
  }, [availabilityFilter, departmentFilter, query, scopedAssets, statusFilter]);

  const groupedAssets = useMemo(() => groupAssetsByName(filteredAssets, (asset) => asset.location), [filteredAssets]);
  const requestedGroup = useMemo(
    () => groupedAssets.find((group) => group.items.some((asset) => asset.id === requestedAssetId)) ?? null,
    [groupedAssets, requestedAssetId],
  );

  const selectedGroup = useMemo(
    () => requestedGroup ?? groupedAssets.find((group) => group.key === selectedGroupKey) ?? groupedAssets[0] ?? null,
    [groupedAssets, requestedGroup, selectedGroupKey],
  );
  const selectedAsset = useMemo(
    () =>
      (requestedAssetId ? selectedGroup?.items.find((asset) => asset.id === requestedAssetId) : null) ??
      selectedGroup?.items.find((asset) => asset.id === selectedAssetId) ??
      selectedGroup?.items[0] ??
      null,
    [requestedAssetId, selectedAssetId, selectedGroup],
  );

  useEffect(() => {
    if (!selectedAsset) return;

    queueMicrotask(() => {
      setEditName(selectedAsset.name);
      setEditTag(selectedAsset.tag);
      setEditDepartmentId(selectedAsset.departmentId ?? "");
      setSaveFeedback(null);
    });
  }, [selectedAsset]);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      if (!selectedAsset?.id) {
        if (!cancelled) {
          setHistoryRows(fallbackInventoryHistory);
          setHistoryLoading(false);
        }
        return;
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase || !isConfigured) {
        if (!cancelled) {
          setHistoryRows(fallbackInventoryHistory);
          setHistoryLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setHistoryLoading(true);
      }

      try {
        const nextHistory = await loadInventoryAssetHistory(supabase, selectedAsset.id);
        if (!cancelled) {
          setHistoryRows(nextHistory);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Asset history could not be loaded.";
        if (!cancelled) {
          setHistoryRows(fallbackInventoryHistory);
          setSaveFeedback({ tone: "error", message });
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [isConfigured, selectedAsset?.id]);

  if (!canBrowseInventory) {
    return (
      <SectionShell title="Inventory" kicker="Access restricted">
        <div className="app-panel p-5">
          <div className="app-kicker">Inventory</div>
          <h1 className="app-title mt-2">This role does not have general inventory access.</h1>
          <p className="app-subtitle mt-3">Use `My Assets` for assigned items and personal actions.</p>
        </div>
      </SectionShell>
    );
  }

  const refreshInventoryWorkspace = async () => {
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !isConfigured) {
      setWorkspace(fallbackWorkspace);
      setLoading(false);
      return;
    }
    try {
      const nextWorkspace = await loadInventoryWorkspace(supabase, activeLocationId);
      setWorkspace(nextWorkspace);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Inventory could not be refreshed.";
      setWorkspace({
        ...fallbackWorkspace,
        warnings: [...fallbackWorkspace.warnings, message],
      });
    } finally {
      setLoading(false);
    }
  };

  const replaceInventoryRoute = (assetId: string | null) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (assetId) {
      nextParams.set("assetId", assetId);
    } else {
      nextParams.delete("assetId");
    }
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };

  const saveAssetEdits = async () => {
    if (!selectedAsset) return;
    if (!editName.trim()) {
      setSaveFeedback({ tone: "error", message: "Name is required." });
      return;
    }
    if (!editTag.trim()) {
      setSaveFeedback({ tone: "error", message: "Tag is required." });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase || !isConfigured) {
      setSaveFeedback({ tone: "error", message: "Supabase is not configured yet, so asset editing is unavailable." });
      return;
    }

    setSavingAssetEdit(true);
    try {
      const { error } = await updateInventoryAssetDetails(supabase, {
        assetId: selectedAsset.id,
        name: editName,
        tag: editTag,
        departmentId: editDepartmentId || null,
      });
      if (error) throw error;

      setSaveFeedback({ tone: "success", message: "Asset detail updated." });
      await refreshInventoryWorkspace();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Asset update failed.";
      setSaveFeedback({ tone: "error", message });
    } finally {
      setSavingAssetEdit(false);
    }
  };

  const openAssetWorkflow = (href: string) => {
    router.push(href);
  };

  return (
    <SectionShell title="Inventory" kicker="Grouped catalog">
      <div className="space-y-4 sm:space-y-6">
        <section className="app-panel p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="app-kicker">Inventory</div>
              <h1 className="app-title mt-2">Browse grouped assets.</h1>
              <p className="app-subtitle mt-3">Filter by scope, department, and status, then drill into physical units.</p>
            </div>
            <div className="rounded-[1.2rem] border border-primary/18 bg-primary/8 px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/72">Inventory source</div>
              <div className="mt-2 flex items-center gap-2 text-sm text-primary">
                <RefreshCcw size={14} className={cn(loading && "animate-spin")} />
                {workspace.source === "live" ? "Live data" : "Fallback preview"}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-primary/12 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Scope: {selectedLocationName}
            </span>
            <button
              type="button"
              onClick={() => {
                void refreshInventoryWorkspace();
              }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/18 bg-card/55 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              <RefreshCcw size={14} className={cn(loading && "animate-spin")} />
              {loading ? "Refreshing" : "Refresh"}
            </button>
          </div>

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

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
            <label className="space-y-2">
              <span className="font-mono text-xs uppercase tracking-[0.14em] text-primary/72">Search</span>
              <div className="matrix-field flex h-12 items-center gap-2 rounded-[1.15rem] px-4">
                <Search size={16} className="text-primary/72" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name, tag, serial, location, department..."
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            </label>

            <FilterSelect
              label="Department"
              value={departmentFilter}
              onChange={setDepartmentFilter}
              options={["all", ...availableDepartments]}
            />
            <FilterSelect
              label="Status"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as AssetStatus | "all")}
              options={["all", "available", "assigned", "traveling", "stationed", "damaged"]}
              getLabel={(value) => (value === "all" ? "All" : getAssetStatusLabel(value))}
            />
            <FilterSelect
              label="Availability"
              value={availabilityFilter}
              onChange={(value) => setAvailabilityFilter(value as "all" | "available_only" | "actionable")}
              options={["all", "available_only", "actionable"]}
              getLabel={(value) =>
                value === "all" ? "All" : value === "available_only" ? "Available only" : "Actionable"
              }
            />
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="app-panel overflow-hidden">
            <div className="border-b border-primary/12 px-5 py-4">
              <div className="app-kicker">Grouped items</div>
              <div className="mt-2 text-sm text-muted-foreground">
                {groupedAssets.length} grouped item{groupedAssets.length === 1 ? "" : "s"} across {availableLocations.length} locations
              </div>
            </div>

            <div className="space-y-3 p-4">
              {groupedAssets.length === 0 ? (
                <div className="rounded-[1.2rem] border border-dashed border-primary/14 px-4 py-10 text-center text-sm text-muted-foreground">
                  No assets matched the current filters.
                </div>
              ) : (
                groupedAssets.map((group) => (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => {
                      setSelectedGroupKey(group.key);
                      replaceInventoryRoute(group.items[0]?.id ?? null);
                    }}
                    className={cn(
                      "matrix-dashboard-bubble w-full p-4 text-left transition-transform hover:-translate-y-0.5",
                      selectedGroup?.key === group.key && "border-primary/34",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-display text-xl text-foreground glow-soft">{group.name}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{group.locationSummary}</div>
                      </div>
                      <ExternalLink size={15} className="mt-1 shrink-0 text-primary/70" />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Metric label="Available" value={group.counts.available} />
                      <Metric label="Assigned" value={group.counts.assigned} />
                      <Metric label="Traveling" value={group.counts.traveling} />
                      <Metric label="Damaged" value={group.counts.damaged} />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="app-panel overflow-hidden">
            <div className="border-b border-primary/12 px-5 py-4">
              <div className="app-kicker">Unit drill-in</div>
              <div className="mt-2 font-display text-2xl text-foreground glow-soft">
                {selectedGroup ? selectedGroup.name : "Select a grouped item"}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {selectedGroup ? "Select a physical unit to inspect details and actions." : "Choose a group to inspect physical units."}
              </div>
            </div>

            <div className="space-y-4 p-4">
              {!selectedGroup ? (
                <div className="rounded-[1.2rem] border border-dashed border-primary/14 px-4 py-10 text-center text-sm text-muted-foreground">
                  No group selected.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedGroup.items.map((asset) => {
                    const normalizedStatus = normalizeAssetStatus(asset.status);
                    const selected = selectedAsset?.id === asset.id;

                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => {
                          setSelectedAssetId(asset.id);
                          replaceInventoryRoute(asset.id);
                        }}
                        className={cn("w-full rounded-[1.2rem] border bg-card/45 p-4 text-left transition-colors", selected ? "border-primary/26" : "border-primary/12")}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="font-mono text-sm uppercase tracking-[0.14em] text-primary">{asset.tag}</div>
                            <div className="mt-1 font-display text-lg text-foreground">{asset.name}</div>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                              <span>Serial: {asset.serial}</span>
                              <span>Location: {asset.location}</span>
                              <span>Department: {asset.department}</span>
                              <span>Holder: {asset.holder}</span>
                            </div>
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
                </div>
              )}

              {selectedAsset && (
                <div className="rounded-[1.25rem] border border-primary/12 bg-card/45 p-4 sm:p-5">
                  <div className="app-kicker">Asset detail</div>
                  <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="font-display text-2xl text-foreground glow-soft">{selectedAsset.name}</div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>Tag: {selectedAsset.tag}</span>
                        <span>Serial: {selectedAsset.serial}</span>
                        <span>Location: {selectedAsset.location}</span>
                        <span>Department: {selectedAsset.department}</span>
                        <span>Holder: {selectedAsset.holder}</span>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "inline-flex w-fit rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                        getStatusBadgeClass(selectedAsset.status),
                      )}
                    >
                      {getAssetStatusLabel(selectedAsset.status)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[1rem] border border-primary/12 bg-card/35 p-4">
                      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary/72">Allowed field edits</div>
                      {canEditInventoryAsset ? (
                        <div className="mt-3 space-y-3">
                          <FormField label="Name" value={editName} onChange={setEditName} />
                          <FormField label="Tag" value={editTag} onChange={setEditTag} />
                          <SelectField
                            label="Department / Team"
                            value={editDepartmentId}
                            onChange={setEditDepartmentId}
                            options={[
                              { label: "No department", value: "" },
                              ...departmentOptions.map((department) => ({ label: department.name, value: department.id })),
                            ]}
                          />
                          <div className="text-sm text-muted-foreground">Serial number stays read-only.</div>
                          {saveFeedback && (
                            <div className={cn(
                              "rounded-[0.95rem] border px-3 py-3 text-sm",
                              saveFeedback.tone === "success" ? "border-primary/20 bg-primary/8 text-primary" : "border-destructive/20 bg-destructive/8 text-destructive",
                            )}>
                              {saveFeedback.message}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => void saveAssetEdits()}
                            disabled={savingAssetEdit}
                            className="matrix-button inline-flex h-11 w-full items-center justify-center rounded-[1rem] px-4 text-sm font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {savingAssetEdit ? "Saving Asset" : "Save Allowed Edits"}
                          </button>
                        </div>
                      ) : (
                        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                          <div>Name</div>
                          <div>Tag</div>
                          <div>Department / Team</div>
                          <div>Serial number stays read-only.</div>
                          <div className="pt-2 text-primary/80">Only admin and asset-manager roles can save changes.</div>
                        </div>
                      )}
                    </div>

                    <div className="rounded-[1rem] border border-primary/12 bg-card/35 p-4">
                      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary/72">Quick actions</div>
                      <div className="mt-3 rounded-[0.95rem] border border-primary/12 bg-card/40 px-4 py-3 text-sm text-muted-foreground">
                        {getInventoryActionSummary(selectedAsset.status)}
                      </div>
                      <div className="mt-3 grid gap-2">
                        {getInventoryQuickActions({
                          assetId: selectedAsset.id,
                          status: selectedAsset.status,
                          isAdmin,
                          isAssetManager,
                          isStaff,
                        }).map((action) => (
                          <button
                            key={action.href}
                            type="button"
                            onClick={() => openAssetWorkflow(action.href)}
                            className={cn(
                              "rounded-[0.95rem] border px-4 py-3 text-left text-sm font-medium transition-colors",
                              action.tone === "warning"
                                ? "border-destructive/20 bg-card/55 text-destructive hover:bg-destructive/10"
                                : "border-primary/18 bg-card/55 text-foreground hover:bg-primary/8 hover:text-primary",
                            )}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 text-sm text-muted-foreground">Open the next compatible workflow for this unit.</div>
                    </div>

                    <div className="rounded-[1rem] border border-primary/12 bg-card/35 p-4">
                      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-primary/72">
                        <History size={13} />
                        Recent history
                      </div>
                      <div className="mt-3 space-y-2">
                        {historyLoading ? (
                          <div className="text-sm text-muted-foreground">Loading history...</div>
                        ) : historyRows.length === 0 ? (
                          <div className="text-sm text-muted-foreground">No recent history found.</div>
                        ) : (
                          historyRows.map((row) => (
                            <div key={row.id} className="rounded-[0.95rem] border border-primary/12 bg-card/40 px-3 py-3">
                              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em] text-primary/78">
                                <span>{row.action.replace(/_/g, " ")}</span>
                                <span className="text-muted-foreground">{row.createdAt}</span>
                              </div>
                              <div className="mt-2 text-sm text-foreground">{row.note}</div>
                              <div className="mt-1 text-xs text-muted-foreground">{row.performedBy}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
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
              {getLabel ? getLabel(option) : option === "all" ? "All" : option}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function FormField({
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
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="matrix-field h-12 w-full rounded-[1.15rem] px-4 text-sm text-foreground outline-none"
      />
    </label>
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
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 w-full bg-transparent text-sm text-foreground outline-none"
        >
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[1rem] border border-primary/12 bg-card/40 px-3 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-2xl text-foreground">{value}</div>
    </div>
  );
}
