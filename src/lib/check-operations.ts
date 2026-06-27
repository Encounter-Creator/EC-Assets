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

export type ResolvedOperationalAssetBatch = {
  assets: StandardAssetRecord[];
  unresolvedInputs: string[];
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

export type SundayKitDeploymentItemRecord = {
  id: string;
  deployment_id: string;
  asset_id: string | null;
  asset_code: string | null;
  asset_name: string;
  serial_number: string | null;
  sort_order: number;
  return_status: "Pending" | "Available" | "Damaged";
};

export type KitMemberRecord = {
  id: string;
  asset_id: string;
  sort_order: number;
  asset_tag: string;
  asset_name: string;
  asset_serial: string | null;
  asset_status: string;
  asset_location: string | null;
  asset_department: string | null;
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

type ReturnRequestJoinRow = {
  id: string;
  request_id: string | null;
  preferred_return_location_id: string | null;
  status: string | null;
  note: string | null;
  created_at: string;
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

export const fallbackSundayKitDeploymentItems: SundayKitDeploymentItemRecord[] = [
  {
    id: "kdi1",
    deployment_id: "kd1",
    asset_id: null,
    asset_code: "KIT-CAM-01",
    asset_name: "Camera Body",
    serial_number: "CMB-00192",
    sort_order: 1,
    return_status: "Pending",
  },
  {
    id: "kdi2",
    deployment_id: "kd1",
    asset_id: null,
    asset_code: "KIT-CAM-02",
    asset_name: "Tripod",
    serial_number: "TR-50001",
    sort_order: 2,
    return_status: "Pending",
  },
  {
    id: "kdi3",
    deployment_id: "kd1",
    asset_id: null,
    asset_code: "KIT-CAM-03",
    asset_name: "Battery Kit",
    serial_number: "BAT-10001",
    sort_order: 3,
    return_status: "Pending",
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

async function loadStandardAssetsByStatus(
  supabase: SupabaseClient,
  input: {
    statuses: string[];
    holderRequired?: boolean;
  },
) {
  const { data, error } = await supabase
    .from("assets")
    .select("id, code, name, serial_number, status, current_location_id, current_holder, department_id")
    .in("status", input.statuses)
    .order("name");

  if (error) throw error;

  const rows = ((data ?? []) as AssetRow[]).filter((row) => (input.holderRequired ? Boolean(row.current_holder) : true));
  const locationIds = [...new Set(rows.map((row) => row.current_location_id).filter(Boolean))] as string[];
  const departmentIds = [...new Set(rows.map((row) => row.department_id).filter(Boolean))] as string[];
  const profileIds = [...new Set(rows.map((row) => row.current_holder).filter(Boolean))] as string[];
  const maps = await loadReferenceMaps(supabase, locationIds, departmentIds, profileIds);

  return rows.map((row) => ({
    id: row.id,
    tag: row.code ?? "No tag",
    name: row.name ?? "Unnamed asset",
    serial_number: row.serial_number ?? "-",
    state: row.status ? row.status.replace(/_/g, " ").replace(/\b\w/g, (value) => value.toUpperCase()) : "Unknown",
    current_location: row.current_location_id ? maps.locations[row.current_location_id] ?? "Unknown location" : "No location",
    holder: row.current_holder ? maps.profiles[row.current_holder] ?? "Assigned user" : null,
    department: row.department_id ? maps.departments[row.department_id] ?? "No department" : "No department",
  }));
}

async function loadStandardRecipientsDirect(supabase: SupabaseClient) {
  const [{ data: profileRows, error: profilesError }, { data: roleRows, error: rolesError }, { data: locationRows, error: locationsError }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, surname, full_name, assigned_location_id, asset_manager_location_id"),
    supabase.from("user_roles").select("user_id, role"),
    supabase.from("locations").select("id, name"),
  ]);

  if (profilesError) throw profilesError;
  if (rolesError) throw rolesError;
  if (locationsError) throw locationsError;

  const locationMap = Object.fromEntries(((locationRows ?? []) as LocationRow[]).map((row) => [row.id, row.name]));
  const roleMap = new Map<string, string>();
  for (const row of ((roleRows ?? []) as Array<{ user_id: string; role: string }>)) {
    if (!roleMap.has(row.user_id)) {
      roleMap.set(row.user_id, row.role);
    }
  }

  return ((profileRows ?? []) as Array<ProfileRow & { assigned_location_id?: string | null; asset_manager_location_id?: string | null }>).map((row) => ({
    id: row.id,
    full_name: formatProfileName(row),
    email: "-",
    role: roleMap.get(row.id) ?? "staff",
    home_base: row.assigned_location_id ? locationMap[row.assigned_location_id] ?? "Unknown location" : row.asset_manager_location_id ? locationMap[row.asset_manager_location_id] ?? "Unknown location" : null,
    department: null,
  }));
}

async function loadStandardLocationsDirect(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("locations").select("id, name").eq("active", true).order("name");
  if (error) throw error;
  return ((data ?? []) as StandardLocationRecord[]).filter((row) => row.id && row.name);
}

async function loadReturnMonitorDirect(supabase: SupabaseClient) {
  const [{ data: returnRows, error: returnsError }, { data: locationRows, error: locationsError }, { data: requestRows, error: requestsError }] = await Promise.all([
    supabase.from("return_requests").select("id, request_id, preferred_return_location_id, status, note, created_at").order("created_at", { ascending: false }),
    supabase.from("locations").select("id, name"),
    supabase.from("requests").select("id, status"),
  ]);

  if (returnsError) throw returnsError;
  if (locationsError) throw locationsError;
  if (requestsError) throw requestsError;

  const locationMap = Object.fromEntries(((locationRows ?? []) as LocationRow[]).map((row) => [row.id, row.name]));
  const requestMap = Object.fromEntries((((requestRows ?? []) as Array<{ id: string; status: string | null }>)).map((row) => [row.id, row]));

  return ((returnRows ?? []) as ReturnRequestJoinRow[]).map((row) => ({
    id: row.id,
    request_id: row.request_id,
    preferred_return_location: row.preferred_return_location_id ? locationMap[row.preferred_return_location_id] ?? "Unknown location" : null,
    status: row.status ?? "Pending",
    note: row.note,
    created_at: row.created_at,
    workflow_status: row.request_id ? requestMap[row.request_id]?.status ?? null : null,
  }));
}

async function loadSundayKitsDirect(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("kits").select("id, name, home_base, active, item_count").order("name");
  if (error) throw error;
  return ((data ?? []) as SundayKitRecord[]).map((row) => ({
    id: row.id,
    name: row.name ?? "Unnamed kit",
    home_base: row.home_base ?? null,
    active: Boolean(row.active),
    item_count: row.item_count ?? 0,
  }));
}

export async function loadKitMembers(
  supabase: SupabaseClient,
  kitId: string,
): Promise<{ members: KitMemberRecord[]; source: "live" | "fallback"; warnings: string[] }> {
  try {
    const { data: memberRows, error: memberError } = await supabase
      .from("kit_members")
      .select("id, asset_id, sort_order")
      .eq("kit_id", kitId)
      .order("sort_order");

    if (memberError) throw memberError;

    const rows = (memberRows ?? []) as Array<{ id: string; asset_id: string | null; sort_order: number }>;
    const validRows = rows.filter((r) => r.asset_id);
    const assetIds = [...new Set(validRows.map((r) => r.asset_id as string))];

    if (assetIds.length === 0) {
      return { members: [], source: "live", warnings: [] };
    }

    const { data: assetRows, error: assetError } = await supabase
      .from("assets")
      .select("id, code, name, serial_number, status, current_location_id, department_id")
      .in("id", assetIds);

    if (assetError) throw assetError;

    const assetData = (assetRows ?? []) as Array<{
      id: string;
      code: string | null;
      name: string | null;
      serial_number: string | null;
      status: string | null;
      current_location_id: string | null;
      department_id: string | null;
    }>;

    const locationIds = [...new Set(assetData.map((a) => a.current_location_id).filter(Boolean))] as string[];
    const departmentIds = [...new Set(assetData.map((a) => a.department_id).filter(Boolean))] as string[];
    const maps = await loadReferenceMaps(supabase, locationIds, departmentIds, []);
    const assetMap = new Map(assetData.map((a) => [a.id, a]));

    return {
      members: validRows.map((r) => {
        const asset = assetMap.get(r.asset_id as string);
        return {
          id: r.id,
          asset_id: r.asset_id as string,
          sort_order: r.sort_order,
          asset_tag: asset?.code ?? "No tag",
          asset_name: asset?.name ?? "Unnamed asset",
          asset_serial: asset?.serial_number ?? null,
          asset_status: asset?.status ?? "unknown",
          asset_location: asset?.current_location_id ? maps.locations[asset.current_location_id] ?? null : null,
          asset_department: asset?.department_id ? maps.departments[asset.department_id] ?? null : null,
        };
      }),
      source: "live",
      warnings: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kit members could not be loaded.";
    return { members: [], source: "fallback", warnings: [message] };
  }
}

export async function loadSundayKitDeploymentItems(
  supabase: SupabaseClient,
  deploymentId: string,
): Promise<{
  items: SundayKitDeploymentItemRecord[];
  source: "live" | "fallback";
  warnings: string[];
}> {
  try {
    const { data, error } = await supabase
      .from("kit_deployment_items")
      .select("id, deployment_id, asset_id, asset_code, asset_name, serial_number, sort_order, return_status")
      .eq("deployment_id", deploymentId)
      .order("sort_order");

    if (error) throw error;

    return {
      items: ((data ?? []) as SundayKitDeploymentItemRecord[]).map((row) => ({
        ...row,
        asset_name: row.asset_name ?? "Kit item",
        return_status: row.return_status ?? "Pending",
      })),
      source: "live",
      warnings: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sunday kit deployment items could not be loaded.";
    if (!isMissingSchemaError(message)) {
      throw error;
    }

    return {
      items: fallbackSundayKitDeploymentItems.filter((item) => item.deployment_id === deploymentId),
      source: "fallback",
      warnings: ["Sunday kit item-level returns are using fallback data because the deployment-item schema is not available yet."],
    };
  }
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
    signOutResult.status === "fulfilled" && !signOutResult.value.error
      ? ((signOutResult.value.data ?? []) as StandardAssetRecord[])
      : (() => {
          const message =
            signOutResult.status === "fulfilled"
              ? signOutResult.value.error?.message ?? "Standard sign-out assets could not be loaded."
              : signOutResult.reason instanceof Error
                ? signOutResult.reason.message
                : "Standard sign-out assets could not be loaded.";
          if (!isMissingSchemaError(message)) {
            warnings.push(message);
            return fallbackSignOutAssets;
          }
          warnings.push("Standard sign-out assets are using direct live queries because the RPC is not available yet.");
          return loadStandardAssetsByStatus(supabase, { statuses: ["available"] });
        })();

  const signInAssets =
    signInResult.status === "fulfilled" && !signInResult.value.error
      ? ((signInResult.value.data ?? []) as StandardAssetRecord[])
      : (() => {
          const message =
            signInResult.status === "fulfilled"
              ? signInResult.value.error?.message ?? "Standard sign-in assets could not be loaded."
              : signInResult.reason instanceof Error
                ? signInResult.reason.message
                : "Standard sign-in assets could not be loaded.";
          if (!isMissingSchemaError(message)) {
            warnings.push(message);
            return fallbackSignInAssets;
          }
          warnings.push("Standard sign-in assets are using direct live queries because the RPC is not available yet.");
          return loadStandardAssetsByStatus(supabase, { statuses: ["assigned", "traveling", "signed_out", "permanent"], holderRequired: true });
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
    sundayKitsResult.status === "fulfilled" && !sundayKitsResult.value.error
      ? ((sundayKitsResult.value.data ?? []) as SundayKitRecord[])
      : (() => {
          const message =
            sundayKitsResult.status === "fulfilled"
              ? sundayKitsResult.value.error?.message ?? "Sunday kits could not be loaded."
              : sundayKitsResult.reason instanceof Error
                ? sundayKitsResult.reason.message
                : "Sunday kits could not be loaded.";
          if (!isMissingSchemaError(message)) {
            warnings.push(message);
            return fallbackSundayKits;
          }
          warnings.push("Sunday kits are using direct live queries because the settings kit RPC is not available yet.");
          return loadSundayKitsDirect(supabase);
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
    recipientsResult.status === "fulfilled" && !recipientsResult.value.error
      ? ((recipientsResult.value.data ?? []) as StandardRecipientRecord[])
      : (() => {
          const message =
            recipientsResult.status === "fulfilled"
              ? recipientsResult.value.error?.message ?? "Recipients could not be loaded."
              : recipientsResult.reason instanceof Error
                ? recipientsResult.reason.message
                : "Recipients could not be loaded.";
          if (!isMissingSchemaError(message)) {
            warnings.push(message);
            return fallbackRecipients;
          }
          warnings.push("Recipients are using direct live queries because the RPC is not available yet.");
          return loadStandardRecipientsDirect(supabase);
        })();

  const locations =
    locationsResult.status === "fulfilled" && !locationsResult.value.error
      ? ((locationsResult.value.data ?? []) as StandardLocationRecord[])
      : (() => {
          const message =
            locationsResult.status === "fulfilled"
              ? locationsResult.value.error?.message ?? "Locations could not be loaded."
              : locationsResult.reason instanceof Error
                ? locationsResult.reason.message
                : "Locations could not be loaded.";
          if (!isMissingSchemaError(message)) {
            warnings.push(message);
            return fallbackLocations;
          }
          warnings.push("Locations are using direct live queries because the RPC is not available yet.");
          return loadStandardLocationsDirect(supabase);
        })();

  const returnMonitor =
    returnsResult.status === "fulfilled" && !returnsResult.value.error
      ? ((returnsResult.value.data ?? []) as ReturnRequestMonitorRecord[])
      : (() => {
          const message =
            returnsResult.status === "fulfilled"
              ? returnsResult.value.error?.message ?? "Return monitor could not be loaded."
              : returnsResult.reason instanceof Error
                ? returnsResult.reason.message
                : "Return monitor could not be loaded.";
          if (!isMissingSchemaError(message)) {
            warnings.push(message);
            return fallbackReturnMonitor;
          }
          warnings.push("Return monitoring is using direct live queries because the RPC is not available yet.");
          return loadReturnMonitorDirect(supabase);
        })();

  const resolvedWorkspace = await Promise.all([
    Promise.resolve(signOutAssets),
    Promise.resolve(signInAssets),
    Promise.resolve(stationedReadyAssets),
    Promise.resolve(stationedActiveAssets),
    Promise.resolve(sundayKits),
    Promise.resolve(sundayKitDeployments),
    Promise.resolve(recipients),
    Promise.resolve(locations),
    Promise.resolve(returnMonitor),
  ]);

  const successCount = [
    signOutResult.status === "fulfilled" && !signOutResult.value.error,
    signInResult.status === "fulfilled" && !signInResult.value.error,
    stationedReadyResult.status === "fulfilled",
    stationedActiveResult.status === "fulfilled",
    sundayKitsResult.status === "fulfilled" && !sundayKitsResult.value.error,
    sundayKitDeploymentsResult.status === "fulfilled",
    recipientsResult.status === "fulfilled" && !recipientsResult.value.error,
    locationsResult.status === "fulfilled" && !locationsResult.value.error,
    returnsResult.status === "fulfilled" && !returnsResult.value.error,
  ].filter(Boolean).length;
  const source = successCount === 9 ? "live" : successCount === 0 ? "fallback" : "mixed";

  return {
    signOutAssets: resolvedWorkspace[0],
    signInAssets: resolvedWorkspace[1],
    stationedReadyAssets: resolvedWorkspace[2],
    stationedActiveAssets: resolvedWorkspace[3],
    sundayKits: resolvedWorkspace[4],
    sundayKitDeployments: resolvedWorkspace[5],
    recipients: resolvedWorkspace[6],
    locations: resolvedWorkspace[7],
    returnMonitor: resolvedWorkspace[8],
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
    outcome: "Stationed" | "Available" | "Damaged";
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
) : Promise<ResolvedOperationalAssetBatch> {
  const normalizedCodes = [...new Set(input.codes.map((code) => code.trim()).filter(Boolean))];
  if (normalizedCodes.length === 0) {
    return {
      assets: [],
      unresolvedInputs: [],
    };
  }

  const uuidCandidates = normalizedCodes.filter((value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

  const [codeResult, idResult] = await Promise.all([
    supabase
      .from("assets")
      .select("id, code, name, serial_number, status, current_location_id, current_holder, department_id")
      .in("code", normalizedCodes)
      .order("name"),
    uuidCandidates.length > 0
      ? supabase
          .from("assets")
          .select("id, code, name, serial_number, status, current_location_id, current_holder, department_id")
          .in("id", uuidCandidates)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (codeResult.error) throw codeResult.error;
  if (idResult.error) throw idResult.error;

  const rowMap = new Map<string, AssetRow>();
  for (const row of [...((codeResult.data ?? []) as AssetRow[]), ...((idResult.data ?? []) as AssetRow[])]) {
    rowMap.set(row.id, row);
  }

  const rows = [...rowMap.values()];
  const locationIds = [...new Set(rows.map((row) => row.current_location_id).filter(Boolean))] as string[];
  const departmentIds = [...new Set(rows.map((row) => row.department_id).filter(Boolean))] as string[];
  const profileIds = [...new Set(rows.map((row) => row.current_holder).filter(Boolean))] as string[];
  const maps = await loadReferenceMaps(supabase, locationIds, departmentIds, profileIds);

  const assets = rows.map((row) => ({
    id: row.id,
    tag: row.code ?? "No tag",
    name: row.name ?? "Unnamed asset",
    serial_number: row.serial_number ?? "-",
    state: row.status ?? "Unknown",
    current_location: row.current_location_id ? maps.locations[row.current_location_id] ?? "Unknown location" : "No location",
    holder: row.current_holder ? maps.profiles[row.current_holder] ?? "Assigned user" : null,
    department: row.department_id ? maps.departments[row.department_id] ?? "No department" : "No department",
  }));

  const matchedInputs = new Set<string>();
  for (const row of rows) {
    matchedInputs.add(row.id);
    if (row.code) {
      matchedInputs.add(row.code);
    }
  }

  return {
    assets: normalizedCodes
      .flatMap((inputCode) => assets.filter((asset) => asset.id === inputCode || asset.tag === inputCode))
      .filter((asset, index, all) => all.findIndex((entry) => entry.id === asset.id) === index),
    unresolvedInputs: normalizedCodes.filter((inputCode) => !matchedInputs.has(inputCode)),
  };
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

export async function returnSundayKitDeploymentItems(
  supabase: SupabaseClient,
  input: {
    deploymentId: string;
    itemResolutions: Array<{
      itemId: string;
      outcome: "Available" | "Damaged";
    }>;
    note?: string;
  },
) {
  return supabase.rpc("return_sunday_kit_item_resolutions", {
    p_deployment_id: input.deploymentId,
    p_item_resolutions: input.itemResolutions.map((resolution) => ({
      item_id: resolution.itemId,
      outcome: resolution.outcome,
    })),
    p_note: input.note?.trim() || null,
  });
}
