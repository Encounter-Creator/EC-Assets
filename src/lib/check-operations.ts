"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

export type StandardAssetRecord = {
  id: string;
  tag: string;
  name: string;
  serial_number: string;
  state: string;
  current_location: string | null;
  holder: string | null;
  department: string | null;
};

export type StandardRecipientRecord = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  home_base: string | null;
  department: string | null;
};

export type StandardLocationRecord = {
  id: string;
  name: string;
};

export type ReturnRequestMonitorRecord = {
  id: string;
  request_id: string | null;
  preferred_return_location: string | null;
  status: string;
  note: string | null;
  created_at: string;
  workflow_status: string | null;
};

export type SundayKitRecord = {
  id: string;
  name: string;
  home_base: string | null;
  active: boolean;
  item_count: number;
};

export type SundayKitDeploymentRecord = {
  id: string;
  kit_name: string;
  item_count: number;
  responsible_user: string;
  deployed_location: string;
  status: string;
  returned_count: number;
  damaged_count: number;
  note: string | null;
  created_at: string;
};

export type CheckOperationsWorkspaceData = {
  signOutAssets: StandardAssetRecord[];
  signInAssets: StandardAssetRecord[];
  stationedReadyAssets: StandardAssetRecord[];
  stationedActiveAssets: StandardAssetRecord[];
  sundayKits: SundayKitRecord[];
  sundayKitDeployments: SundayKitDeploymentRecord[];
  recipients: StandardRecipientRecord[];
  locations: StandardLocationRecord[];
  returnMonitor: ReturnRequestMonitorRecord[];
  source: "live" | "mixed" | "fallback";
  warnings: string[];
};

type AssetRow = {
  id: string;
  code: string | null;
  name: string | null;
  serial_number: string | null;
  status: string | null;
  current_location_id: string | null;
  current_holder: string | null;
  department_id: string | null;
};

type LocationRow = {
  id: string;
  name: string;
};

type DepartmentRow = {
  id: string;
  name: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  surname: string | null;
  full_name?: string | null;
};

export const fallbackSignOutAssets: StandardAssetRecord[] = [
  { id: "so1", tag: "CAM121C", name: "Camera Body", serial_number: "CMB-90211", state: "Available", current_location: "Centurion", holder: null, department: "Production" },
  { id: "so2", tag: "MIC511K", name: "Wireless Mic", serial_number: "WM-20310", state: "Available", current_location: "Krugersdorp", holder: null, department: "Audio" },
  { id: "so3", tag: "TRP100O", name: "Tripod", serial_number: "TR-50001", state: "Available", current_location: "Office", holder: null, department: "Production" },
];

export const fallbackSignInAssets: StandardAssetRecord[] = [
  { id: "si1", tag: "CAM101C", name: "Camera Body", serial_number: "CMB-00192", state: "Assigned", current_location: "Traveling", holder: "Barend N", department: "Production" },
  { id: "si2", tag: "MIC302K", name: "Wireless Mic", serial_number: "WM-00482", state: "Assigned", current_location: "Traveling", holder: "Lerato M", department: "Audio" },
];

export const fallbackRecipients: StandardRecipientRecord[] = [
  { id: "r1", full_name: "Barend N", email: "barend@example.com", role: "staff", home_base: "Centurion", department: "Production" },
  { id: "r2", full_name: "Lerato M", email: "lerato@example.com", role: "volunteer", home_base: "Krugersdorp", department: "Audio" },
];

export const fallbackStationedReadyAssets: StandardAssetRecord[] = [
  { id: "st1", tag: "MIC511K", name: "Wireless Mic", serial_number: "WM-20310", state: "Stationed", current_location: "Krugersdorp", holder: null, department: "Audio" },
  { id: "st2", tag: "LGT222", name: "LED Panel", serial_number: "LP-19822", state: "Stationed", current_location: "Lanseria", holder: null, department: "Lighting" },
];

export const fallbackStationedActiveAssets: StandardAssetRecord[] = [
  { id: "sta1", tag: "MIC512K", name: "Wireless Mic", serial_number: "WM-20311", state: "Traveling", current_location: "Traveling", holder: "Barend N", department: "Audio" },
];

export const fallbackLocations: StandardLocationRecord[] = [
  { id: "l1", name: "Centurion" },
  { id: "l2", name: "Krugersdorp" },
  { id: "l3", name: "Lanseria" },
  { id: "l4", name: "Office" },
];

export const fallbackReturnMonitor: ReturnRequestMonitorRecord[] = [
  { id: "rt1", request_id: "req1", preferred_return_location: "Office", status: "Pending", note: "Camera package coming back after conference.", created_at: "2026-06-01T09:15:00Z", workflow_status: "Pending" },
  { id: "rt2", request_id: "req2", preferred_return_location: "Centurion", status: "Accepted", note: "Accepted by receiving manager.", created_at: "2026-05-31T14:10:00Z", workflow_status: "Approved" },
];

export const fallbackSundayKits: SundayKitRecord[] = [
  { id: "k1", name: "Sunday Camera Kit", home_base: "Centurion", active: true, item_count: 6 },
  { id: "k2", name: "Sunday Audio Kit", home_base: "Krugersdorp", active: true, item_count: 4 },
];

export const fallbackSundayKitDeployments: SundayKitDeploymentRecord[] = [
  {
    id: "kd1",
    kit_name: "Sunday Camera Kit",
    item_count: 6,
    responsible_user: "Barend N",
    deployed_location: "Centurion",
    status: "Deployed",
    returned_count: 0,
    damaged_count: 0,
    note: "Main auditorium deployment.",
    created_at: "2026-06-02T06:00:00Z",
  },
];

const fallbackWorkspace: CheckOperationsWorkspaceData = {
  signOutAssets: fallbackSignOutAssets,
  signInAssets: fallbackSignInAssets,
  stationedReadyAssets: fallbackStationedReadyAssets,
  stationedActiveAssets: fallbackStationedActiveAssets,
  sundayKits: fallbackSundayKits,
  sundayKitDeployments: fallbackSundayKitDeployments,
  recipients: fallbackRecipients,
  locations: fallbackLocations,
  returnMonitor: fallbackReturnMonitor,
  source: "fallback",
  warnings: ["Supabase is not configured yet, so Check-out/In is using the rebuild preview dataset."],
};

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

function formatProfileName(profile: ProfileRow | null | undefined) {
  const name = [profile?.display_name?.trim(), profile?.surname?.trim()].filter(Boolean).join(" ");
  return name || profile?.full_name?.trim() || "Assigned user";
}

async function loadReferenceMaps(supabase: SupabaseClient, locationIds: string[], departmentIds: string[], profileIds: string[]) {
  const [locationsResult, departmentsResult, profilesResult] = await Promise.all([
    locationIds.length > 0 ? supabase.from("locations").select("id, name").in("id", locationIds) : Promise.resolve({ data: [], error: null }),
    departmentIds.length > 0 ? supabase.from("departments").select("id, name").in("id", departmentIds) : Promise.resolve({ data: [], error: null }),
    profileIds.length > 0 ? supabase.from("profiles").select("id, display_name, surname, full_name").in("id", profileIds) : Promise.resolve({ data: [], error: null }),
  ]);

  if (locationsResult.error) throw locationsResult.error;
  if (departmentsResult.error) throw departmentsResult.error;
  if (profilesResult.error) throw profilesResult.error;

  return {
    locations: Object.fromEntries(((locationsResult.data ?? []) as LocationRow[]).map((row) => [row.id, row.name])),
    departments: Object.fromEntries(((departmentsResult.data ?? []) as DepartmentRow[]).map((row) => [row.id, row.name])),
    profiles: Object.fromEntries(((profilesResult.data ?? []) as ProfileRow[]).map((row) => [row.id, formatProfileName(row)])),
  };
}

async function loadStationedAssets(supabase: SupabaseClient, status: "stationed" | "traveling") {
  const { data, error } = await supabase
    .from("assets")
    .select("id, code, name, serial_number, status, current_location_id, current_holder, department_id")
    .eq("status", status)
    .order("name");

  if (error) throw error;

  const rows = (data ?? []) as AssetRow[];
  const locationIds = [...new Set(rows.map((row) => row.current_location_id).filter(Boolean))] as string[];
  const departmentIds = [...new Set(rows.map((row) => row.department_id).filter(Boolean))] as string[];
  const profileIds = [...new Set(rows.map((row) => row.current_holder).filter(Boolean))] as string[];
  const maps = await loadReferenceMaps(supabase, locationIds, departmentIds, profileIds);

  return rows.map((row) => ({
    id: row.id,
    tag: row.code ?? "No tag",
    name: row.name ?? "Unnamed asset",
    serial_number: row.serial_number ?? "-",
    state: row.status === "stationed" ? "Stationed" : "Traveling",
    current_location: row.current_location_id ? maps.locations[row.current_location_id] ?? "Unknown location" : "No location",
    holder: row.current_holder ? maps.profiles[row.current_holder] ?? "Assigned user" : null,
    department: row.department_id ? maps.departments[row.department_id] ?? "No department" : "No department",
  }));
}

async function loadSundayKitDeployments(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("kit_deployments")
    .select("id, kit_name, item_count, responsible_user_id, deployed_location_id, status, returned_count, damaged_count, note, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as Array<{
    id: string;
    kit_name: string | null;
    item_count: number | null;
    responsible_user_id: string | null;
    deployed_location_id: string | null;
    status: string | null;
    returned_count: number | null;
    damaged_count: number | null;
    note: string | null;
    created_at: string;
  }>;

  const locationIds = [...new Set(rows.map((row) => row.deployed_location_id).filter(Boolean))] as string[];
  const profileIds = [...new Set(rows.map((row) => row.responsible_user_id).filter(Boolean))] as string[];
  const maps = await loadReferenceMaps(supabase, locationIds, [], profileIds);

  return rows.map((row) => ({
    id: row.id,
    kit_name: row.kit_name ?? "Unnamed kit",
    item_count: row.item_count ?? 0,
    responsible_user: row.responsible_user_id ? maps.profiles[row.responsible_user_id] ?? "Assigned user" : "Unknown user",
    deployed_location: row.deployed_location_id ? maps.locations[row.deployed_location_id] ?? "Unknown location" : "No location",
    status: row.status ?? "Deployed",
    returned_count: row.returned_count ?? 0,
    damaged_count: row.damaged_count ?? 0,
    note: row.note,
    created_at: row.created_at,
  }));
}

export async function loadCheckOperationsWorkspace(supabase: SupabaseClient): Promise<CheckOperationsWorkspaceData> {
  const warnings: string[] = [];

  const [signOutResult, signInResult, stationedReadyResult, stationedActiveResult, sundayKitsResult, sundayKitDeploymentsResult, recipientsResult, locationsResult, returnsResult] = await Promise.allSettled([
    supabase.rpc("list_standard_sign_out_assets"),
    supabase.rpc("list_standard_sign_in_assets"),
    loadStationedAssets(supabase, "stationed"),
    loadStationedAssets(supabase, "traveling"),
    supabase.rpc("list_settings_kits"),
    loadSundayKitDeployments(supabase),
    supabase.rpc("list_standard_recipients"),
    supabase.rpc("list_standard_locations"),
    supabase.rpc("list_return_request_monitor"),
  ]);

  const signOutAssets =
    signOutResult.status === "fulfilled"
      ? ((signOutResult.value.data ?? []) as StandardAssetRecord[])
      : (() => {
          const message = signOutResult.reason instanceof Error ? signOutResult.reason.message : "Standard sign-out assets could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Standard sign-out assets are using fallback data because the RPC is not available yet." : message);
          return fallbackSignOutAssets;
        })();

  const signInAssets =
    signInResult.status === "fulfilled"
      ? ((signInResult.value.data ?? []) as StandardAssetRecord[])
      : (() => {
          const message = signInResult.reason instanceof Error ? signInResult.reason.message : "Standard sign-in assets could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Standard sign-in assets are using fallback data because the RPC is not available yet." : message);
          return fallbackSignInAssets;
        })();

  const stationedReadyAssets =
    stationedReadyResult.status === "fulfilled"
      ? stationedReadyResult.value
      : (() => {
          const message = stationedReadyResult.reason instanceof Error ? stationedReadyResult.reason.message : "Stationed-ready assets could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Stationed-ready assets are using fallback data because the live asset query is not available yet." : message);
          return fallbackStationedReadyAssets;
        })();

  const stationedActiveAssets =
    stationedActiveResult.status === "fulfilled"
      ? stationedActiveResult.value
      : (() => {
          const message = stationedActiveResult.reason instanceof Error ? stationedActiveResult.reason.message : "Stationed active assets could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Stationed active assets are using fallback data because the live asset query is not available yet." : message);
          return fallbackStationedActiveAssets;
        })();

  const sundayKits =
    sundayKitsResult.status === "fulfilled"
      ? ((sundayKitsResult.value.data ?? []) as SundayKitRecord[])
      : (() => {
          const message = sundayKitsResult.reason instanceof Error ? sundayKitsResult.reason.message : "Sunday kits could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Sunday kits are using fallback data because the settings kit surface is not available yet." : message);
          return fallbackSundayKits;
        })();

  const sundayKitDeployments =
    sundayKitDeploymentsResult.status === "fulfilled"
      ? sundayKitDeploymentsResult.value
      : (() => {
          const message = sundayKitDeploymentsResult.reason instanceof Error ? sundayKitDeploymentsResult.reason.message : "Sunday kit deployments could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Sunday kit deployments are using fallback data because the deployment ledger is not available yet." : message);
          return fallbackSundayKitDeployments;
        })();

  const recipients =
    recipientsResult.status === "fulfilled"
      ? ((recipientsResult.value.data ?? []) as StandardRecipientRecord[])
      : (() => {
          const message = recipientsResult.reason instanceof Error ? recipientsResult.reason.message : "Recipients could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Recipients are using fallback data because the RPC is not available yet." : message);
          return fallbackRecipients;
        })();

  const locations =
    locationsResult.status === "fulfilled"
      ? ((locationsResult.value.data ?? []) as StandardLocationRecord[])
      : (() => {
          const message = locationsResult.reason instanceof Error ? locationsResult.reason.message : "Locations could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Locations are using fallback data because the RPC is not available yet." : message);
          return fallbackLocations;
        })();

  const returnMonitor =
    returnsResult.status === "fulfilled"
      ? ((returnsResult.value.data ?? []) as ReturnRequestMonitorRecord[])
      : (() => {
          const message = returnsResult.reason instanceof Error ? returnsResult.reason.message : "Return monitor could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Return monitoring is using fallback data because the RPC is not available yet." : message);
          return fallbackReturnMonitor;
        })();

  const successCount = [signOutResult, signInResult, stationedReadyResult, stationedActiveResult, sundayKitsResult, sundayKitDeploymentsResult, recipientsResult, locationsResult, returnsResult].filter((result) => result.status === "fulfilled").length;
  const source = successCount === 9 ? "live" : successCount === 0 ? "fallback" : "mixed";

  return {
    signOutAssets,
    signInAssets,
    stationedReadyAssets,
    stationedActiveAssets,
    sundayKits,
    sundayKitDeployments,
    recipients,
    locations,
    returnMonitor,
    source,
    warnings,
  };
}

export function getFallbackCheckOperationsWorkspace() {
  return fallbackWorkspace;
}

export async function runStandardSignOut(
  supabase: SupabaseClient,
  input: {
    assetIds: string[];
    holderId: string;
    note?: string;
  },
) {
  return supabase.rpc("standard_sign_out_assets", {
    p_asset_ids: input.assetIds,
    p_holder_id: input.holderId,
    p_note: input.note?.trim() || null,
  });
}

export async function runStandardSignIn(
  supabase: SupabaseClient,
  input: {
    assetIds: string[];
    finalLocationId: string;
    outcome: "Available" | "Damaged";
    note?: string;
  },
) {
  return supabase.rpc("standard_sign_in_assets", {
    p_asset_ids: input.assetIds,
    p_final_location_id: input.finalLocationId,
    p_outcome: input.outcome,
    p_note: input.note?.trim() || null,
  });
}

export async function runPermanentAssignment(
  supabase: SupabaseClient,
  input: {
    assetIds: string[];
    holderId: string;
    homeBaseLocationId: string;
    mode: "direct_issue" | "reassign";
    note?: string;
  },
) {
  return supabase.rpc("permanent_assign_assets", {
    p_asset_ids: input.assetIds,
    p_holder_id: input.holderId,
    p_home_base_location_id: input.homeBaseLocationId,
    p_mode: input.mode,
    p_note: input.note?.trim() || null,
  });
}

export async function runStationedCheckout(
  supabase: SupabaseClient,
  input: {
    assetIds: string[];
    holderId: string;
    note?: string;
  },
) {
  return supabase.rpc("stationed_checkout_assets", {
    p_asset_ids: input.assetIds,
    p_holder_id: input.holderId,
    p_note: input.note?.trim() || null,
  });
}

export async function runStationedCheckIn(
  supabase: SupabaseClient,
  input: {
    assetIds: string[];
    finalLocationId: string;
    outcome: "Stationed" | "Damaged";
    note?: string;
  },
) {
  return supabase.rpc("stationed_checkin_assets", {
    p_asset_ids: input.assetIds,
    p_final_location_id: input.finalLocationId,
    p_outcome: input.outcome,
    p_note: input.note?.trim() || null,
  });
}

export async function resolveOperationalAssetsByCodes(
  supabase: SupabaseClient,
  input: {
    codes: string[];
  },
) {
  const normalizedCodes = input.codes.map((code) => code.trim()).filter(Boolean);
  if (normalizedCodes.length === 0) return [];

  const { data, error } = await supabase
    .from("assets")
    .select("id, code, name, serial_number, status, current_location_id, current_holder, department_id")
    .in("code", normalizedCodes)
    .order("name");

  if (error) throw error;

  const rows = (data ?? []) as AssetRow[];
  const locationIds = [...new Set(rows.map((row) => row.current_location_id).filter(Boolean))] as string[];
  const departmentIds = [...new Set(rows.map((row) => row.department_id).filter(Boolean))] as string[];
  const profileIds = [...new Set(rows.map((row) => row.current_holder).filter(Boolean))] as string[];
  const maps = await loadReferenceMaps(supabase, locationIds, departmentIds, profileIds);

  return rows.map((row) => ({
    id: row.id,
    tag: row.code ?? "No tag",
    name: row.name ?? "Unnamed asset",
    serial_number: row.serial_number ?? "-",
    state: row.status ?? "Unknown",
    current_location: row.current_location_id ? maps.locations[row.current_location_id] ?? "Unknown location" : "No location",
    holder: row.current_holder ? maps.profiles[row.current_holder] ?? "Assigned user" : null,
    department: row.department_id ? maps.departments[row.department_id] ?? "No department" : "No department",
  }));
}

export async function deploySundayKit(
  supabase: SupabaseClient,
  input: {
    kitId: string;
    kitName: string;
    itemCount: number;
    responsibleUserId: string;
    locationId: string;
    note?: string;
  },
) {
  return supabase.rpc("deploy_sunday_kit", {
    p_kit_reference: input.kitId,
    p_kit_name: input.kitName,
    p_item_count: input.itemCount,
    p_responsible_user_id: input.responsibleUserId,
    p_location_id: input.locationId,
    p_note: input.note?.trim() || null,
  });
}

export async function returnSundayKitDeployment(
  supabase: SupabaseClient,
  input: {
    deploymentId: string;
    returnedCount: number;
    damagedCount: number;
    note?: string;
  },
) {
  return supabase.rpc("return_sunday_kit_items", {
    p_deployment_id: input.deploymentId,
    p_returned_count: input.returnedCount,
    p_damaged_count: input.damagedCount,
    p_note: input.note?.trim() || null,
  });
}
