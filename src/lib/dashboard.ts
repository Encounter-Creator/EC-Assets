"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

import { loadApprovalsWorkspace } from "@/lib/approvals";
import { loadCheckOperationsWorkspace } from "@/lib/check-operations";
import { loadInventoryWorkspace } from "@/lib/inventory";
import { loadMyAssetsWorkspace } from "@/lib/my-assets";
import { loadRequestsWorkspace } from "@/lib/requests";

export type DashboardCard = {
  label: string;
  value: string;
};

export type DashboardFeedCard = {
  title: string;
  rows: string[];
};

export type DashboardWorkspaceData = {
  topCards: DashboardCard[];
  lowerCards: DashboardFeedCard[];
  source: "live" | "mixed" | "fallback";
  warnings: string[];
};

type DashboardRole = "admin" | "asset_manager" | "staff" | "volunteer";

type AssetHistoryRow = {
  asset_id: string;
  action: string | null;
  notes: string | null;
  performed_by: string | null;
  created_at: string;
};

type AssetRefRow = {
  id: string;
  code: string | null;
  name: string | null;
  current_location_id: string | null;
};

type LocationRow = {
  id: string;
  name: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  surname: string | null;
  full_name?: string | null;
};

type RequestRow = {
  workflow_type: string | null;
  status: string | null;
  source_location_id: string | null;
  created_at: string;
};

type DamageCaseRow = {
  id: string;
  asset_id: string | null;
  status: string | null;
  created_at: string | null;
  responsible_user_id: string | null;
};

type AssetCountRow = {
  state?: string | null;
  status?: string | null;
  current_location_id?: string | null;
};

const fallbackWorkspace: Record<DashboardRole, DashboardWorkspaceData> = {
  admin: {
    source: "fallback",
    warnings: ["Supabase is not configured yet, so Dashboard is using the rebuild preview dataset."],
    topCards: [
      { label: "Approvals", value: "12" },
      { label: "Damage Locks", value: "3" },
      { label: "Transfers", value: "4" },
      { label: "Blocked Workflows", value: "2" },
    ],
    lowerCards: [
      { title: "Recent Asset Activity", rows: previewRows("Asset activity") },
      { title: "Recent Requests", rows: previewRows("Request") },
      { title: "Recent Returns", rows: previewRows("Return") },
      { title: "Recent Damage Reports", rows: previewRows("Damage case") },
      { title: "Location Snapshot", rows: previewRows("Location snapshot") },
    ],
  },
  asset_manager: {
    source: "fallback",
    warnings: ["Supabase is not configured yet, so Dashboard is using the rebuild preview dataset."],
    topCards: [
      { label: "Approvals", value: "12" },
      { label: "Returns", value: "5" },
      { label: "Sign-Outs", value: "8" },
      { label: "Damage Tasks", value: "2" },
    ],
    lowerCards: [
      { title: "Recent Asset Activity", rows: previewRows("Asset activity") },
      { title: "Open Requests Snapshot", rows: previewRows("Request") },
      { title: "Returns in Progress", rows: previewRows("Return") },
      { title: "Damage Workflow Updates", rows: previewRows("Damage case") },
      { title: "Location Inventory Snapshot", rows: previewRows("Inventory snapshot") },
    ],
  },
  staff: {
    source: "fallback",
    warnings: ["Supabase is not configured yet, so Dashboard is using the rebuild preview dataset."],
    topCards: [
      { label: "Pending Approvals", value: "4" },
      { label: "My Assigned Items", value: "6" },
      { label: "Return Requests", value: "2" },
      { label: "Damage Actions", value: "1" },
    ],
    lowerCards: [
      { title: "My Recent Requests", rows: previewRows("My request") },
      { title: "My Return Requests", rows: previewRows("My return") },
      { title: "My Pending Items", rows: previewRows("Pending item") },
      { title: "Home Base Inventory Highlights", rows: previewRows("Inventory highlight") },
    ],
  },
  volunteer: {
    source: "fallback",
    warnings: ["Supabase is not configured yet, so Dashboard is using the rebuild preview dataset."],
    topCards: [
      { label: "Pending Approvals", value: "4" },
      { label: "My Assigned Items", value: "6" },
      { label: "Return Requests", value: "2" },
      { label: "Damage Actions", value: "1" },
    ],
    lowerCards: [
      { title: "My Pending Items", rows: previewRows("Pending item") },
      { title: "My Assigned Assets", rows: previewRows("Assigned asset") },
      { title: "My Return Requests", rows: previewRows("My return") },
      { title: "My Damage Actions", rows: previewRows("Damage action") },
    ],
  },
};

function previewRows(label: string) {
  return Array.from({ length: 5 }, (_, index) => `${label} ${index + 1}`);
}

function isMissingSchemaError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("does not exist") ||
    normalized.includes("could not find the function") ||
    normalized.includes("schema cache") ||
    normalized.includes("relation") ||
    normalized.includes("column")
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function formatProfileName(profile: ProfileRow | null | undefined) {
  const name = [profile?.display_name?.trim(), profile?.surname?.trim()].filter(Boolean).join(" ");
  return name || profile?.full_name?.trim() || "Unknown user";
}

async function loadReferenceMaps(supabase: SupabaseClient, profileIds: string[], locationIds: string[]) {
  const [profilesResult, locationsResult] = await Promise.all([
    profileIds.length > 0
      ? supabase.from("profiles").select("id, display_name, surname, full_name").in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    locationIds.length > 0
      ? supabase.from("locations").select("id, name").in("id", locationIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (locationsResult.error) throw locationsResult.error;

  return {
    profiles: Object.fromEntries(((profilesResult.data ?? []) as ProfileRow[]).map((row) => [row.id, formatProfileName(row)])),
    locations: Object.fromEntries(((locationsResult.data ?? []) as LocationRow[]).map((row) => [row.id, row.name])),
  };
}

async function loadRecentAssetActivity(supabase: SupabaseClient, activeLocationId: string | null) {
  const { data, error } = await supabase.from("asset_history").select("asset_id, action, notes, performed_by, created_at").order("created_at", { ascending: false }).limit(20);
  if (error) throw error;

  const rows = (data ?? []) as AssetHistoryRow[];
  const assetIds = [...new Set(rows.map((row) => row.asset_id).filter(Boolean))] as string[];
  const profileIds = [...new Set(rows.map((row) => row.performed_by).filter(Boolean))] as string[];

  const [{ data: assetRows, error: assetsError }, maps] = await Promise.all([
    assetIds.length > 0
      ? supabase.from("assets").select("id, code, name, current_location_id").in("id", assetIds)
      : Promise.resolve({ data: [], error: null }),
    loadReferenceMaps(supabase, profileIds, []),
  ]);
  if (assetsError) throw assetsError;

  const assets = Object.fromEntries(((assetRows ?? []) as AssetRefRow[]).map((row) => [row.id, row]));

  return rows
    .filter((row) => {
      if (!activeLocationId) return true;
      return assets[row.asset_id]?.current_location_id === activeLocationId;
    })
    .slice(0, 5)
    .map((row) => {
      const asset = assets[row.asset_id];
      const actor = row.performed_by ? maps.profiles[row.performed_by] ?? "Unknown user" : "System";
      return `${asset?.name ?? "Asset"} (${asset?.code ?? "No tag"}) | ${row.action ?? "update"} | ${actor}`;
    });
}

async function loadRequestsSummary(supabase: SupabaseClient, activeLocationId: string | null) {
  const { data, error } = await supabase.from("requests").select("workflow_type, status, source_location_id, created_at").order("created_at", { ascending: false }).limit(20);
  if (error) throw error;

  return ((data ?? []) as RequestRow[])
    .filter((row) => !activeLocationId || row.source_location_id === activeLocationId)
    .slice(0, 5)
    .map((row) => `${row.workflow_type?.replace(/_/g, " ") ?? "Request"} | ${row.status ?? "Pending"} | ${formatDateTime(row.created_at)}`);
}

async function loadDamageSummary(supabase: SupabaseClient, activeLocationId: string | null) {
  const { data, error } = await supabase.from("damage_cases").select("id, asset_id, status, created_at, responsible_user_id").order("created_at", { ascending: false }).limit(20);
  if (error) throw error;

  const rows = (data ?? []) as DamageCaseRow[];
  const assetIds = [...new Set(rows.map((row) => row.asset_id).filter(Boolean))] as string[];
  const profileIds = [...new Set(rows.map((row) => row.responsible_user_id).filter(Boolean))] as string[];

  const [{ data: assetRows, error: assetsError }, maps] = await Promise.all([
    assetIds.length > 0 ? supabase.from("assets").select("id, code, name, current_location_id").in("id", assetIds) : Promise.resolve({ data: [], error: null }),
    loadReferenceMaps(supabase, profileIds, []),
  ]);
  if (assetsError) throw assetsError;

  const assets = Object.fromEntries(((assetRows ?? []) as AssetRefRow[]).map((row) => [row.id, row]));

  return rows
    .filter((row) => {
      if (!activeLocationId) return true;
      return row.asset_id ? assets[row.asset_id]?.current_location_id === activeLocationId : true;
    })
    .slice(0, 5)
    .map((row) => {
      const asset = row.asset_id ? assets[row.asset_id] : undefined;
      const owner = row.responsible_user_id ? maps.profiles[row.responsible_user_id] ?? "Unknown user" : "Unknown user";
      return `${asset?.name ?? "Damage case"} (${asset?.code ?? "No tag"}) | ${row.status ?? "Open"} | ${owner}`;
    });
}

async function loadLocationSnapshot(supabase: SupabaseClient, activeLocationId: string | null) {
  const { data, error } = await supabase.from("assets").select("state, current_location_id");
  if (error) throw error;

  const rows = (data ?? []) as AssetCountRow[];
  const locationIds = [...new Set(rows.map((row) => row.current_location_id).filter(Boolean))] as string[];
  const maps = await loadReferenceMaps(supabase, [], locationIds);

  if (activeLocationId) {
    const scoped = rows.filter((row) => row.current_location_id === activeLocationId);
    const stateCounts = scoped.reduce<Record<string, number>>((acc, row) => {
      const key = row.state ?? row.status ?? "Unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(stateCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([state, count]) => `${state} | ${count}`);
  }

  const locationCounts = rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.current_location_id ?? "unassigned";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(locationCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([locationId, count]) => `${maps.locations[locationId] ?? "No location"} | ${count} asset${count === 1 ? "" : "s"}`);
}

export async function loadDashboardWorkspace(
  supabase: SupabaseClient,
  input: {
    role: DashboardRole;
    userId: string;
    activeLocationId: string | null;
  },
): Promise<DashboardWorkspaceData> {
  const warnings: string[] = [];

  const [approvalsResult, requestsResult, myAssetsResult, inventoryResult, checkOpsResult, assetActivityResult, requestsSummaryResult, damageSummaryResult, locationSnapshotResult] = await Promise.allSettled([
    loadApprovalsWorkspace(supabase, input.activeLocationId),
    loadRequestsWorkspace(supabase, input.userId, input.activeLocationId),
    loadMyAssetsWorkspace(supabase, input.userId),
    loadInventoryWorkspace(supabase, input.activeLocationId),
    loadCheckOperationsWorkspace(supabase),
    loadRecentAssetActivity(supabase, input.activeLocationId),
    loadRequestsSummary(supabase, input.activeLocationId),
    loadDamageSummary(supabase, input.activeLocationId),
    loadLocationSnapshot(supabase, input.activeLocationId),
  ]);

  const approvals =
    approvalsResult.status === "fulfilled"
      ? approvalsResult.value
      : null;
  if (approvalsResult.status === "rejected") {
    const message = approvalsResult.reason instanceof Error ? approvalsResult.reason.message : "Approvals could not be loaded.";
    warnings.push(isMissingSchemaError(message) ? "Dashboard approvals are using fallback values because the approval workspace is not fully available yet." : message);
  }

  const requests =
    requestsResult.status === "fulfilled"
      ? requestsResult.value
      : null;
  if (requestsResult.status === "rejected") {
    const message = requestsResult.reason instanceof Error ? requestsResult.reason.message : "Requests could not be loaded.";
    warnings.push(isMissingSchemaError(message) ? "Dashboard requests are using fallback values because the requests workspace is not fully available yet." : message);
  }

  const myAssets =
    myAssetsResult.status === "fulfilled"
      ? myAssetsResult.value
      : null;
  if (myAssetsResult.status === "rejected") {
    const message = myAssetsResult.reason instanceof Error ? myAssetsResult.reason.message : "My Assets could not be loaded.";
    warnings.push(isMissingSchemaError(message) ? "Dashboard assigned/pending values are using fallback logic because My Assets is not fully available yet." : message);
  }

  const inventory =
    inventoryResult.status === "fulfilled"
      ? inventoryResult.value
      : null;
  if (inventoryResult.status === "rejected") {
    const message = inventoryResult.reason instanceof Error ? inventoryResult.reason.message : "Inventory could not be loaded.";
    warnings.push(isMissingSchemaError(message) ? "Dashboard inventory snapshot is using fallback values because inventory is not fully available yet." : message);
  }

  const checkOps =
    checkOpsResult.status === "fulfilled"
      ? checkOpsResult.value
      : null;
  if (checkOpsResult.status === "rejected") {
    const message = checkOpsResult.reason instanceof Error ? checkOpsResult.reason.message : "Check operations could not be loaded.";
    warnings.push(isMissingSchemaError(message) ? "Dashboard operations values are using fallback logic because Check-out/In data is not fully available yet." : message);
  }

  const assetActivity = assetActivityResult.status === "fulfilled" ? assetActivityResult.value : previewRows("Asset activity");
  const recentRequests = requestsSummaryResult.status === "fulfilled" ? requestsSummaryResult.value : previewRows("Request");
  const recentDamage = damageSummaryResult.status === "fulfilled" ? damageSummaryResult.value : previewRows("Damage case");
  const locationSnapshot = locationSnapshotResult.status === "fulfilled" ? locationSnapshotResult.value : previewRows("Location snapshot");

  const roleFallback = fallbackWorkspace[input.role];
  let topCards = roleFallback.topCards;
  let lowerCards = roleFallback.lowerCards;

  if (input.role === "admin") {
    topCards = [
      { label: "Approvals", value: String((approvals?.queues.asset_requests.length ?? 0) + (approvals?.queues.special_requests.length ?? 0) + (approvals?.queues.returns.length ?? 0)) },
      { label: "Damage Locks", value: String(approvals?.queues.damage_locks.length ?? 0) },
      { label: "Transfers", value: String((requests?.requestHistory.filter((item) => item.type === "special").length ?? 0)) },
      { label: "Blocked Workflows", value: String(recentRequests.filter((row) => row.toLowerCase().includes("blocked")).length) },
    ];
    lowerCards = [
      { title: "Recent Asset Activity", rows: assetActivity.slice(0, 5) },
      { title: "Recent Requests", rows: recentRequests.slice(0, 5) },
      { title: "Recent Returns", rows: (checkOps?.returnMonitor.slice(0, 5).map((row) => `${row.status} | ${row.preferred_return_location ?? "No location"} | ${formatDateTime(row.created_at)}`) ?? previewRows("Return")) },
      { title: "Recent Damage Reports", rows: recentDamage.slice(0, 5) },
      { title: "Location Snapshot", rows: locationSnapshot.slice(0, 5) },
    ];
  } else if (input.role === "asset_manager") {
    topCards = [
      { label: "Approvals", value: String((approvals?.queues.asset_requests.length ?? 0) + (approvals?.queues.special_requests.length ?? 0) + (approvals?.queues.returns.length ?? 0)) },
      { label: "Returns", value: String(checkOps?.returnMonitor.filter((row) => row.status === "Pending" || row.status === "Accepted").length ?? 0) },
      { label: "Sign-Outs", value: String(checkOps?.signInAssets.length ?? 0) },
      { label: "Damage Tasks", value: String(approvals?.queues.damage_locks.length ?? 0) },
    ];
    lowerCards = [
      { title: "Recent Asset Activity", rows: assetActivity.slice(0, 5) },
      { title: "Open Requests Snapshot", rows: recentRequests.slice(0, 5) },
      { title: "Returns in Progress", rows: (checkOps?.returnMonitor.filter((row) => row.status !== "Completed").slice(0, 5).map((row) => `${row.status} | ${row.preferred_return_location ?? "No location"}`) ?? previewRows("Return")) },
      { title: "Damage Workflow Updates", rows: recentDamage.slice(0, 5) },
      { title: "Location Inventory Snapshot", rows: locationSnapshot.slice(0, 5) },
    ];
  } else if (input.role === "staff") {
    topCards = [
      { label: "Pending Approvals", value: String(myAssets?.pendingItems.length ?? 0) },
      { label: "My Assigned Items", value: String(myAssets?.assignedAssets.length ?? 0) },
      { label: "Return Requests", value: String(requests?.requestHistory.filter((item) => item.type === "return").length ?? 0) },
      { label: "Damage Actions", value: String(myAssets?.damageRecords.filter((item) => item.status === "Under Review" || item.status === "Form Submitted").length ?? 0) },
    ];
    lowerCards = [
      { title: "My Recent Requests", rows: requests?.requestHistory.slice(0, 5).map((item) => `${item.title} | ${item.status}`) ?? previewRows("My request") },
      { title: "My Return Requests", rows: requests?.requestHistory.filter((item) => item.type === "return").slice(0, 5).map((item) => `${item.title} | ${item.status}`) ?? previewRows("My return") },
      { title: "My Pending Items", rows: myAssets?.pendingItems.slice(0, 5).map((item) => `${item.title} | ${item.location}`) ?? previewRows("Pending item") },
      { title: "Home Base Inventory Highlights", rows: inventory?.assets.slice(0, 5).map((item) => `${item.name} | ${item.location} | ${item.status}`) ?? previewRows("Inventory highlight") },
    ];
  } else {
    topCards = [
      { label: "Pending Approvals", value: String(myAssets?.pendingItems.length ?? 0) },
      { label: "My Assigned Items", value: String(myAssets?.assignedAssets.length ?? 0) },
      { label: "Return Requests", value: String(requests?.requestHistory.filter((item) => item.type === "return").length ?? 0) },
      { label: "Damage Actions", value: String(myAssets?.damageRecords.filter((item) => item.status === "Under Review" || item.status === "Form Submitted").length ?? 0) },
    ];
    lowerCards = [
      { title: "My Pending Items", rows: myAssets?.pendingItems.slice(0, 5).map((item) => `${item.title} | ${item.location}`) ?? previewRows("Pending item") },
      { title: "My Assigned Assets", rows: myAssets?.assignedAssets.slice(0, 5).map((item) => `${item.name} | ${item.location}`) ?? previewRows("Assigned asset") },
      { title: "My Return Requests", rows: requests?.requestHistory.filter((item) => item.type === "return").slice(0, 5).map((item) => `${item.title} | ${item.status}`) ?? previewRows("My return") },
      { title: "My Damage Actions", rows: myAssets?.damageRecords.slice(0, 5).map((item) => `${item.name} | ${item.status}`) ?? previewRows("Damage action") },
    ];
  }

  const successCount = [approvalsResult, requestsResult, myAssetsResult, inventoryResult, checkOpsResult, assetActivityResult, requestsSummaryResult, damageSummaryResult, locationSnapshotResult].filter((result) => result.status === "fulfilled").length;
  const source = successCount === 9 ? "live" : successCount === 0 ? "fallback" : "mixed";

  return {
    topCards,
    lowerCards,
    source,
    warnings: [...new Set(warnings)],
  };
}

export function getFallbackDashboardWorkspace(role: DashboardRole) {
  return fallbackWorkspace[role];
}
