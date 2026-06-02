"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

import { type AssetStatus } from "@/lib/assets";

export type InventoryAsset = {
  id: string;
  tag: string;
  name: string;
  serial: string;
  status: AssetStatus;
  location: string;
  locationId?: string | null;
  department: string;
  departmentId?: string | null;
  holder: string;
};

export type InventoryWorkspaceData = {
  assets: InventoryAsset[];
  source: "live" | "fallback";
  warnings: string[];
};

export type InventoryHistoryRecord = {
  id: string;
  action: string;
  note: string;
  performedBy: string;
  createdAt: string;
};

type LocationRow = { id: string; name: string };
type DepartmentRow = { id: string; name: string };
type ProfileRow = { id: string; display_name: string | null; surname: string | null };

type AssetRow = {
  id: string;
  code: string | null;
  name: string | null;
  serial_number: string | null;
  status: string | null;
  current_location_id: string | null;
  department_id: string | null;
  current_holder: string | null;
};

type AssetHistoryRow = {
  id: string;
  action: string | null;
  notes: string | null;
  performed_by: string | null;
  created_at: string | null;
};

export const fallbackInventoryAssets: InventoryAsset[] = [
  { id: "1", tag: "CMR101", name: "Camera Body", serial: "CMB-00192", status: "available", location: "Centurion", locationId: "l1", department: "Production", departmentId: "d1", holder: "-" },
  { id: "2", tag: "CMR102", name: "Camera Body", serial: "CMB-00193", status: "assigned", location: "Centurion", locationId: "l1", department: "Production", departmentId: "d1", holder: "John Doe" },
  { id: "3", tag: "MIC301", name: "Wireless Mic", serial: "WM-00481", status: "traveling", location: "Traveling", locationId: "l5", department: "Audio", departmentId: "d2", holder: "Sarah M" },
  { id: "4", tag: "MIC302", name: "Wireless Mic", serial: "WM-00482", status: "damaged", location: "Krugersdorp", locationId: "l2", department: "Audio", departmentId: "d2", holder: "-" },
  { id: "5", tag: "LGT221", name: "LED Panel", serial: "LP-19821", status: "available", location: "Lanseria", locationId: "l3", department: "Lighting", departmentId: "d3", holder: "-" },
  { id: "6", tag: "LGT222", name: "LED Panel", serial: "LP-19822", status: "stationed", location: "Lanseria", locationId: "l3", department: "Lighting", departmentId: "d3", holder: "-" },
  { id: "7", tag: "CAM401", name: "Tripod", serial: "TR-82711", status: "available", location: "Office", locationId: "l4", department: "Production", departmentId: "d1", holder: "-" },
  { id: "8", tag: "CAM402", name: "Tripod", serial: "TR-82712", status: "assigned", location: "Krugersdorp", locationId: "l2", department: "Production", departmentId: "d1", holder: "Barend N" },
];

export const fallbackInventoryHistory: InventoryHistoryRecord[] = [
  { id: "h1", action: "sign_out", note: "Standard sign-out", performedBy: "Michael Admin", createdAt: "2026-06-01 08:30" },
  { id: "h2", action: "recipient_approve", note: "Recipient approved assignment", performedBy: "Barend N", createdAt: "2026-06-01 09:05" },
  { id: "h3", action: "sign_in", note: "Standard sign-in to Centurion", performedBy: "Sarah Ops", createdAt: "2026-05-28 18:14" },
];

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
  return [profile?.display_name?.trim(), profile?.surname?.trim()].filter(Boolean).join(" ") || "-";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

async function loadReferenceMaps(supabase: SupabaseClient, locationIds: string[], departmentIds: string[], holderIds: string[]) {
  const [locationsResult, departmentsResult, profilesResult] = await Promise.all([
    locationIds.length > 0 ? supabase.from("locations").select("id, name").in("id", locationIds) : Promise.resolve({ data: [], error: null }),
    departmentIds.length > 0 ? supabase.from("departments").select("id, name").in("id", departmentIds) : Promise.resolve({ data: [], error: null }),
    holderIds.length > 0 ? supabase.from("profiles").select("id, display_name, surname").in("id", holderIds) : Promise.resolve({ data: [], error: null }),
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

async function loadInventoryAssets(supabase: SupabaseClient, activeLocationId: string | null) {
  const query = supabase
    .from("assets")
    .select("id, code, name, serial_number, status, current_location_id, department_id, current_holder")
    .order("name");

  const { data, error } = activeLocationId ? await query.eq("current_location_id", activeLocationId) : await query;
  if (error) throw error;

  const rows = (data ?? []) as AssetRow[];
  const locationIds = [...new Set(rows.map((row) => row.current_location_id).filter(Boolean))] as string[];
  const departmentIds = [...new Set(rows.map((row) => row.department_id).filter(Boolean))] as string[];
  const holderIds = [...new Set(rows.map((row) => row.current_holder).filter(Boolean))] as string[];
  const maps = await loadReferenceMaps(supabase, locationIds, departmentIds, holderIds);

  return rows.map((row) => ({
    id: row.id,
    tag: row.code ?? "No tag",
    name: row.name ?? "Unnamed asset",
    serial: row.serial_number ?? "-",
    status: (row.status ?? "available") as AssetStatus,
    locationId: row.current_location_id ?? null,
    location: row.current_location_id ? maps.locations[row.current_location_id] ?? "Unknown location" : "No location",
    departmentId: row.department_id ?? null,
    department: row.department_id ? maps.departments[row.department_id] ?? "Unknown department" : "No department",
    holder: row.current_holder ? maps.profiles[row.current_holder] ?? "Assigned user" : "-",
  }));
}

export async function updateInventoryAssetDetails(
  supabase: SupabaseClient,
  input: {
    assetId: string;
    name: string;
    tag: string;
    departmentId: string | null;
  },
) {
  return supabase
    .from("assets")
    .update({
      name: input.name.trim() || null,
      code: input.tag.trim() || null,
      department_id: input.departmentId,
    })
    .eq("id", input.assetId);
}

export async function loadInventoryWorkspace(supabase: SupabaseClient, activeLocationId: string | null): Promise<InventoryWorkspaceData> {
  try {
    const assets = await loadInventoryAssets(supabase, activeLocationId);
    return {
      assets,
      source: "live",
      warnings: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inventory could not be loaded.";
    return {
      assets: fallbackInventoryAssets,
      source: "fallback",
      warnings: [isMissingSchemaError(message) ? "Inventory is showing fallback data because the live asset schema is not fully available yet." : message],
    };
  }
}

export async function loadInventoryAssetHistory(supabase: SupabaseClient, assetId: string): Promise<InventoryHistoryRecord[]> {
  try {
    const { data, error } = await supabase
      .from("asset_history")
      .select("id, action, notes, performed_by, created_at")
      .eq("asset_id", assetId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) throw error;

    const rows = (data ?? []) as AssetHistoryRow[];
    const performerIds = [...new Set(rows.map((row) => row.performed_by).filter(Boolean))] as string[];
    const { profiles } = await loadReferenceMaps(supabase, [], [], performerIds);

    return rows.map((row) => ({
      id: row.id,
      action: row.action ?? "update",
      note: row.notes?.trim() || "No note recorded.",
      performedBy: row.performed_by ? profiles[row.performed_by] ?? "Unknown user" : "System",
      createdAt: formatDateTime(row.created_at),
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Asset history could not be loaded.";
    if (!isMissingSchemaError(message)) {
      throw error;
    }
    return fallbackInventoryHistory;
  }
}
