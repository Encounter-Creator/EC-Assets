"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getAssetStatusLabel, normalizeAssetStatus } from "@/lib/assets";

export type RequestableAsset = {
  id: string;
  tag: string;
  name: string;
  serial: string;
  status: string;
  location: string;
  department: string;
};

export type ReturnableAsset = {
  id: string;
  tag: string;
  name: string;
  serial: string;
  location: string;
};

export type RequestHistoryItem = {
  id: string;
  type: "asset" | "special" | "return";
  title: string;
  status: "Draft" | "Pending" | "Approved" | "Declined" | "Completed";
  location: string;
  date: string;
  note: string;
};

export type RequestsWorkspaceData = {
  requestableAssets: RequestableAsset[];
  assignedForReturn: ReturnableAsset[];
  requestHistory: RequestHistoryItem[];
  source: "live" | "mixed" | "fallback";
  warnings: string[];
};

type LocationRow = { id: string; name: string };
type DepartmentRow = { id: string; name: string };

type AssetRow = {
  id: string;
  code: string | null;
  name: string | null;
  serial_number: string | null;
  status: string | null;
  current_location_id: string | null;
  department_id: string | null;
  current_holder?: string | null;
};

type RequestBundleRow = {
  id: string;
  location_id: string;
  needed_for: string | null;
  needed_by: string | null;
  notes: string | null;
  status: string | null;
  rejection_notes: string | null;
  created_at: string;
};

type RequestBundleItemRow = {
  id: string;
  bundle_id: string;
  asset_id: string | null;
  item_description: string | null;
  fulfilled_asset_id: string | null;
  source_status: string | null;
  status: string | null;
  skip_note: string | null;
};

type LegacyRequestRow = {
  id: string;
  workflow_type: string | null;
  status: string | null;
  source_location_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

type ReturnRequestRow = {
  request_id: string;
  preferred_return_location_id: string | null;
  status: string | null;
  note: string | null;
  created_at: string;
};

type AssetNameRow = {
  id: string;
  code: string | null;
  name: string | null;
};

export const fallbackRequestableAssets: RequestableAsset[] = [
  { id: "r1", tag: "CAM121C", name: "Camera Body", serial: "CMB-90211", status: "available", location: "Centurion", department: "Production" },
  { id: "r2", tag: "MIC511K", name: "Wireless Mic", serial: "WM-20310", status: "stationed", location: "Krugersdorp", department: "Audio" },
  { id: "r3", tag: "LGT201L", name: "LED Panel", serial: "LP-19880", status: "traveling", location: "Traveling", department: "Lighting" },
  { id: "r4", tag: "TRP100O", name: "Tripod", serial: "TR-50001", status: "available", location: "Office", department: "Production" },
];

export const fallbackAssignedForReturn: ReturnableAsset[] = [
  { id: "a1", tag: "CAM101C", name: "Camera Body", serial: "CMB-00192", location: "Centurion" },
  { id: "a2", tag: "MIC302K", name: "Wireless Mic", serial: "WM-00482", location: "Krugersdorp" },
];

export const fallbackRequestHistory: RequestHistoryItem[] = [
  { id: "h1", type: "asset", title: "Sunday camera package", status: "Draft", location: "Centurion", date: "2026-06-01 09:15", note: "Need Date, Reason, Duration, Event Context saved." },
  { id: "h2", type: "special", title: "Permanent reassignment", status: "Pending", location: "Krugersdorp", date: "2026-05-31 14:20", note: "Waiting for current holder response." },
  { id: "h3", type: "return", title: "Shared return request", status: "Approved", location: "Lanseria", date: "2026-05-29 17:40", note: "Final sign-in location selected by approver." },
];

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
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

function mapHistoryStatus(status: string | null | undefined): RequestHistoryItem["status"] {
  const normalized = (status ?? "").trim().toLowerCase();
  if (normalized === "awaiting_recipient") return "Approved";
  if (normalized === "completed") return "Completed";
  if (normalized === "rejected" || normalized === "declined") return "Declined";
  if (normalized === "draft") return "Draft";
  return "Pending";
}

async function loadReferenceMaps(supabase: SupabaseClient, locationIds: string[], departmentIds: string[]) {
  const [locationsResult, departmentsResult] = await Promise.all([
    locationIds.length > 0 ? supabase.from("locations").select("id, name").in("id", locationIds) : Promise.resolve({ data: [], error: null }),
    departmentIds.length > 0 ? supabase.from("departments").select("id, name").in("id", departmentIds) : Promise.resolve({ data: [], error: null }),
  ]);

  if (locationsResult.error) throw locationsResult.error;
  if (departmentsResult.error) throw departmentsResult.error;

  return {
    locations: Object.fromEntries(((locationsResult.data ?? []) as LocationRow[]).map((row) => [row.id, row.name])),
    departments: Object.fromEntries(((departmentsResult.data ?? []) as DepartmentRow[]).map((row) => [row.id, row.name])),
  };
}

async function loadRequestableAssets(supabase: SupabaseClient, activeLocationId: string | null) {
  const query = supabase
    .from("assets")
    .select("id, code, name, serial_number, status, current_location_id, department_id")
    .in("status", ["available", "stationed", "permanent"])
    .order("name");

  const { data, error } = activeLocationId ? await query.eq("current_location_id", activeLocationId) : await query;
  if (error) throw error;

  const rows = (data ?? []) as AssetRow[];
  const locationIds = [...new Set(rows.map((row) => row.current_location_id).filter(Boolean))] as string[];
  const departmentIds = [...new Set(rows.map((row) => row.department_id).filter(Boolean))] as string[];
  const maps = await loadReferenceMaps(supabase, locationIds, departmentIds);

  return rows.map((row) => ({
    id: row.id,
    tag: row.code ?? "No tag",
    name: row.name ?? "Unnamed asset",
    serial: row.serial_number ?? "-",
    status: row.status ?? "available",
    location: row.current_location_id ? maps.locations[row.current_location_id] ?? "Unknown location" : "No location",
    department: row.department_id ? maps.departments[row.department_id] ?? "Unknown department" : "No department",
  }));
}

async function loadAssignedForReturn(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("assets")
    .select("id, code, name, serial_number, current_location_id, status")
    .eq("current_holder", userId)
    .order("name");

  if (error) throw error;

  const rows = (data ?? []) as AssetRow[];
  const locationIds = [...new Set(rows.map((row) => row.current_location_id).filter(Boolean))] as string[];
  const maps = await loadReferenceMaps(supabase, locationIds, []);

  return rows
    .filter((row) => normalizeAssetStatus(row.status ?? "") !== "damaged")
    .map((row) => ({
      id: row.id,
      tag: row.code ?? "No tag",
      name: row.name ?? "Unnamed asset",
      serial: row.serial_number ?? "-",
      location: row.current_location_id ? maps.locations[row.current_location_id] ?? "Unknown location" : "No location",
    }));
}

async function loadRequestHistory(supabase: SupabaseClient, userId: string) {
  const [{ data: bundleRows, error: bundleError }, { data: itemRows, error: itemError }] = await Promise.all([
    supabase.from("asset_request_bundles" as never).select("id, location_id, needed_for, needed_by, notes, status, rejection_notes, created_at").eq("requested_by", userId).order("created_at", { ascending: false }),
    supabase.from("asset_request_bundle_items" as never).select("id, bundle_id, asset_id, item_description, fulfilled_asset_id, source_status, status, skip_note").order("bundle_id"),
  ]);

  if (bundleError) throw bundleError;
  if (itemError) throw itemError;

  const bundles = (bundleRows ?? []) as RequestBundleRow[];
  const items = (itemRows ?? []) as RequestBundleItemRow[];
  const locationIds = [...new Set(bundles.map((row) => row.location_id).filter(Boolean))] as string[];
  const assetIds = [...new Set(items.flatMap((row) => [row.asset_id, row.fulfilled_asset_id]).filter(Boolean))] as string[];

  const [{ locations }, assetResult] = await Promise.all([
    loadReferenceMaps(supabase, locationIds, []),
    assetIds.length > 0 ? supabase.from("assets").select("id, code, name").in("id", assetIds) : Promise.resolve({ data: [], error: null }),
  ]);

  if (assetResult.error) throw assetResult.error;

  const assetMap = Object.fromEntries(((assetResult.data ?? []) as Array<{ id: string; code: string | null; name: string | null }>).map((row) => [row.id, row]));
  const itemsByBundle = items.reduce<Record<string, RequestBundleItemRow[]>>((acc, row) => {
    if (!acc[row.bundle_id]) acc[row.bundle_id] = [];
    acc[row.bundle_id].push(row);
    return acc;
  }, {});

  return bundles.map((bundle) => {
    const lines = itemsByBundle[bundle.id] ?? [];
    const lineSummary =
      lines.length === 0
        ? "No request lines recorded."
        : lines
            .slice(0, 2)
            .map((line) => {
              const asset = line.fulfilled_asset_id
                ? assetMap[line.fulfilled_asset_id]
                : line.asset_id
                  ? assetMap[line.asset_id]
                  : undefined;
              const title = asset?.name ?? line.item_description ?? "Requested item";
              const suffix = line.status ? ` (${line.status.replace(/_/g, " ")})` : "";
              return `${title}${suffix}`;
            })
            .join(" | ");

    return {
      id: bundle.id,
      type: "asset" as const,
      title: bundle.needed_for?.trim() || "Asset request",
      status: mapHistoryStatus(bundle.status),
      location: locations[bundle.location_id] ?? "Unknown location",
      date: formatDateTime(bundle.created_at),
      note: bundle.rejection_notes?.trim() || bundle.notes?.trim() || lineSummary,
    };
  });
}

async function loadLegacyReturnHistory(supabase: SupabaseClient, userId: string) {
  const [{ data: requestRows, error: requestError }, { data: returnRows, error: returnError }] = await Promise.all([
    supabase
      .from("requests")
      .select("id, workflow_type, status, source_location_id, payload, created_at")
      .eq("requested_by", userId)
      .eq("workflow_type", "return")
      .order("created_at", { ascending: false }),
    supabase.from("return_requests").select("request_id, preferred_return_location_id, status, note, created_at").order("created_at", { ascending: false }),
  ]);

  if (requestError) throw requestError;
  if (returnError) throw returnError;

  const requests = (requestRows ?? []) as LegacyRequestRow[];
  const returns = (returnRows ?? []) as ReturnRequestRow[];
  const returnMap = Object.fromEntries(returns.map((row) => [row.request_id, row]));
  const locationIds = [...new Set(requests.map((row) => row.source_location_id).concat(returns.map((row) => row.preferred_return_location_id)).filter(Boolean))] as string[];
  const { locations } = await loadReferenceMaps(supabase, locationIds, []);

  return requests.map((request) => {
    const returnRow = returnMap[request.id];
    const payloadAssetCount = Array.isArray(request.payload?.asset_ids) ? request.payload?.asset_ids.length : undefined;
    const returnDate = typeof request.payload?.return_date === "string" ? request.payload.return_date : null;

    return {
      id: request.id,
      type: "return" as const,
      title: payloadAssetCount ? `Shared return request (${payloadAssetCount})` : "Shared return request",
      status: mapHistoryStatus(returnRow?.status ?? request.status),
      location:
        (returnRow?.preferred_return_location_id && locations[returnRow.preferred_return_location_id]) ||
        (request.source_location_id && locations[request.source_location_id]) ||
        "Unknown location",
      date: formatDateTime(returnRow?.created_at ?? request.created_at),
      note:
        returnRow?.note?.trim() ||
        (returnDate ? `Return Date: ${formatDateTime(returnDate)}` : "") ||
        "Return request submitted.",
    };
  });
}

async function loadLegacySpecialHistory(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("requests")
    .select("id, workflow_type, status, source_location_id, payload, created_at")
    .eq("requested_by", userId)
    .in("workflow_type", ["stationed_use", "permanent_reassignment"])
    .order("created_at", { ascending: false });

  if (error) throw error;

  const requests = (data ?? []) as LegacyRequestRow[];
  const locationIds = [...new Set(requests.map((row) => row.source_location_id).filter(Boolean))] as string[];
  const assetIds = [...new Set(requests.map((row) => (typeof row.payload?.asset_id === "string" ? row.payload.asset_id : null)).filter(Boolean))] as string[];

  const [{ locations }, assetResult] = await Promise.all([
    loadReferenceMaps(supabase, locationIds, []),
    assetIds.length > 0 ? supabase.from("assets").select("id, code, name").in("id", assetIds) : Promise.resolve({ data: [], error: null }),
  ]);

  if (assetResult.error) throw assetResult.error;

  const assetMap = Object.fromEntries(((assetResult.data ?? []) as AssetNameRow[]).map((row) => [row.id, row]));

  return requests.map((request) => {
    const assetId = typeof request.payload?.asset_id === "string" ? request.payload.asset_id : null;
    const asset = assetId ? assetMap[assetId] : undefined;
    const requestType = request.workflow_type === "permanent_reassignment" ? "Permanent reassignment" : "Stationed use";
    const assetLabel = asset?.name ? `${requestType} | ${asset.name}` : requestType;
    const context = typeof request.payload?.event_context === "string" ? request.payload.event_context.trim() : "";
    const reasonText = typeof request.payload?.reason === "string" ? request.payload.reason.trim() : "";

    return {
      id: request.id,
      type: "special" as const,
      title: assetLabel,
      status: mapHistoryStatus(request.status),
      location: request.source_location_id ? locations[request.source_location_id] ?? "Unknown location" : "Unknown location",
      date: formatDateTime(request.created_at),
      note: [reasonText, context].filter(Boolean).join(" | ") || `${requestType} submitted.`,
    };
  });
}

export async function loadRequestsWorkspace(supabase: SupabaseClient, userId: string, activeLocationId: string | null): Promise<RequestsWorkspaceData> {
  const warnings: string[] = [];

  const [requestableResult, returnsResult, historyResult, legacyReturnHistoryResult, legacySpecialHistoryResult] = await Promise.allSettled([
    loadRequestableAssets(supabase, activeLocationId),
    loadAssignedForReturn(supabase, userId),
    loadRequestHistory(supabase, userId),
    loadLegacyReturnHistory(supabase, userId),
    loadLegacySpecialHistory(supabase, userId),
  ]);

  const requestableAssets =
    requestableResult.status === "fulfilled"
      ? requestableResult.value
      : (() => {
          const message = requestableResult.reason instanceof Error ? requestableResult.reason.message : "Requestable assets could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Requestable assets are using fallback data because the live request schema is not fully available yet." : message);
          return fallbackRequestableAssets;
        })();

  const assignedForReturn =
    returnsResult.status === "fulfilled"
      ? returnsResult.value
      : (() => {
          const message = returnsResult.reason instanceof Error ? returnsResult.reason.message : "Assigned returnable assets could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Return selection is using fallback assigned assets because the live asset query is not fully available yet." : message);
          return fallbackAssignedForReturn;
        })();

  const bundleHistory =
    historyResult.status === "fulfilled"
      ? historyResult.value
      : (() => {
          const message = historyResult.reason instanceof Error ? historyResult.reason.message : "Request history could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Bundle request history is unavailable, so only the compatible history surface will be used." : message);
          return [];
        })();

  const legacyReturnHistory =
    legacyReturnHistoryResult.status === "fulfilled"
      ? legacyReturnHistoryResult.value
      : (() => {
          const message = legacyReturnHistoryResult.reason instanceof Error ? legacyReturnHistoryResult.reason.message : "Return history could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Legacy return history is unavailable, so only the bundle history surface will be used." : message);
          return [];
        })();

  const legacySpecialHistory =
    legacySpecialHistoryResult.status === "fulfilled"
      ? legacySpecialHistoryResult.value
      : (() => {
          const message = legacySpecialHistoryResult.reason instanceof Error ? legacySpecialHistoryResult.reason.message : "Special-request history could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Legacy special-request history is unavailable, so only the other request history surfaces will be used." : message);
          return [];
        })();

  const requestHistory = [...bundleHistory, ...legacyReturnHistory, ...legacySpecialHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (requestHistory.length === 0 && historyResult.status === "rejected" && legacyReturnHistoryResult.status === "rejected" && legacySpecialHistoryResult.status === "rejected") {
    warnings.push("Request history is using fallback data because no compatible history surface is available.");
  }

  const effectiveRequestHistory = requestHistory.length > 0 ? requestHistory : fallbackRequestHistory;

  const successCount = [requestableResult, returnsResult, historyResult, legacyReturnHistoryResult, legacySpecialHistoryResult].filter((result) => result.status === "fulfilled").length;
  const source = successCount === 5 ? "live" : successCount === 0 ? "fallback" : "mixed";

  return {
    requestableAssets,
    assignedForReturn,
    requestHistory: effectiveRequestHistory,
    source,
    warnings,
  };
}

export async function submitAssetRequest(
  supabase: SupabaseClient,
  payload: {
    activeLocationId: string;
    selectedAssetIds: string[];
    neededFor: string;
    neededBy: string;
    note: string;
  },
) {
  const requestItems = payload.selectedAssetIds.map((assetId) => ({ asset_id: assetId }));

  return supabase.rpc("submit_asset_request_bundle", {
    target_location_id: payload.activeLocationId,
    target_needed_for: payload.neededFor.trim() || null,
    target_needed_by: payload.neededBy ? new Date(payload.neededBy).toISOString() : null,
    target_notes: payload.note.trim() || null,
    request_items: requestItems,
  });
}

export async function submitReturnRequest(
  supabase: SupabaseClient,
  payload: {
    activeLocationId: string | null;
    selectedAssetIds: string[];
    returnDate: string;
    preferredReturnLocationId: string;
    note: string;
  },
) {
  return supabase.rpc("submit_return_request", {
    p_source_location_id: payload.activeLocationId,
    p_asset_ids: payload.selectedAssetIds,
    p_return_date: payload.returnDate ? new Date(payload.returnDate).toISOString() : null,
    p_preferred_return_location_id: payload.preferredReturnLocationId,
    p_note: payload.note.trim() || null,
  });
}

export async function submitSpecialRequest(
  supabase: SupabaseClient,
  payload: {
    activeLocationId: string | null;
    assetId: string;
    requestType: "Stationed Use" | "Permanent Reassignment";
    neededBy: string;
    duration: string;
    reason: string;
    eventContext: string;
  },
) {
  return supabase.rpc("submit_special_request", {
    p_source_location_id: payload.activeLocationId,
    p_asset_id: payload.assetId,
    p_request_type: payload.requestType === "Permanent Reassignment" ? "permanent_reassignment" : "stationed_use",
    p_needed_by: payload.neededBy ? new Date(payload.neededBy).toISOString() : null,
    p_duration: payload.duration.trim() || null,
    p_reason: payload.reason.trim() || null,
    p_event_context: payload.eventContext.trim() || null,
  });
}

export function getRequestAssetHint(status: string) {
  const normalized = normalizeAssetStatus(status);
  if (normalized === "stationed") return "Stationed asset, manager review required.";
  if (normalized === "traveling") return "Traveling assets are not requestable from this flow.";
  if (normalized === "assigned") return "Assigned assets are not requestable from this flow.";
  if (status === "permanent") return "Permanent items may need holder release before manager review.";
  return `${getAssetStatusLabel(status)} asset`;
}
