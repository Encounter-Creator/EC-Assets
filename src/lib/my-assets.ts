"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeAssetStatus } from "@/lib/assets";

export type AssignedAsset = {
  id: string;
  tag: string;
  name: string;
  serial: string;
  status: string;
  location: string;
  department: string;
  assignedBy: string;
  assignedAt: string;
  availableActions: string[];
};

export type PendingItem = {
  id: string;
  type: "assignment" | "handover";
  title: string;
  requestedBy: string;
  location: string;
  sentAt: string;
  notes?: string;
  items: Array<{
    tag: string;
    name: string;
    serial: string;
    department: string;
  }>;
};

export type DamageRecord = {
  id: string;
  tag: string;
  name: string;
  recordedAt: string;
  status: "Form Submitted" | "Under Review" | "Resolved: Available" | "Resolved: Damaged";
  note: string;
};

export type HandoverRecipient = {
  id: string;
  fullName: string;
  role: string;
  homeBase: string | null;
};

export type MyAssetsWorkspaceData = {
  assignedAssets: AssignedAsset[];
  pendingItems: PendingItem[];
  damageRecords: DamageRecord[];
  source: "live" | "mixed" | "fallback";
  warnings: string[];
};

export type SubmitDamageReportInput = {
  userId: string;
  assetId: string;
  assetTag: string;
  assetName: string;
  damageType: string;
  description: string;
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
  updated_at: string | null;
};

type RecipientApprovalRpcItem = {
  asset_id: string;
  code: string | null;
  name: string | null;
  serial_number: string | null;
  location_name: string | null;
  division_name: string | null;
};

type RecipientApprovalRpcRow = {
  id: string;
  flow_type: string;
  package_name: string | null;
  notes: string | null;
  source_location_name: string | null;
  requested_by_name: string | null;
  created_at: string;
  items: RecipientApprovalRpcItem[];
};

type HandoverRow = {
  id: string;
  from_user: string;
  notes: string | null;
  created_at: string;
};

type HandoverItemRow = {
  handover_id: string;
  asset_id: string;
};

type DamageRow = {
  id: string;
  asset_code: string | null;
  asset_name: string | null;
  created_at: string | null;
  status: string | null;
  damage_type: string | null;
  description: string | null;
};

export const fallbackAssignedAssets: AssignedAsset[] = [
  {
    id: "a1",
    tag: "CAM101C",
    name: "Camera Body",
    serial: "CMB-00192",
    status: "assigned",
    location: "Centurion",
    department: "Production",
    assignedBy: "Michael Admin",
    assignedAt: "2026-06-01 08:30",
    availableActions: ["Request Return", "Request Handover"],
  },
  {
    id: "a2",
    tag: "MIC302K",
    name: "Wireless Mic",
    serial: "WM-00482",
    status: "assigned",
    location: "Krugersdorp",
    department: "Audio",
    assignedBy: "Sarah Ops",
    assignedAt: "2026-05-31 17:15",
    availableActions: ["Request Return", "Request Handover"],
  },
  {
    id: "a3",
    tag: "LGT221L",
    name: "LED Panel",
    serial: "LP-19821",
    status: "traveling",
    location: "Traveling",
    department: "Lighting",
    assignedBy: "Michael Admin",
    assignedAt: "2026-05-30 14:00",
    availableActions: ["Request Return"],
  },
];

export const fallbackPendingItems: PendingItem[] = [
  {
    id: "p1",
    type: "assignment",
    title: "Incoming asset assignment",
    requestedBy: "Sarah Ops",
    location: "Centurion",
    sentAt: "2026-06-01 09:40",
    notes: "Needed for Sunday service camera package.",
    items: [
      { tag: "CAM109C", name: "Tripod", serial: "TR-82713", department: "Production" },
      { tag: "CAM110C", name: "Battery Kit", serial: "BK-00991", department: "Production" },
    ],
  },
  {
    id: "p2",
    type: "handover",
    title: "Incoming handover",
    requestedBy: "John Doe",
    location: "Lanseria",
    sentAt: "2026-06-01 10:05",
    notes: "Please take responsibility for this temporary-use package.",
    items: [{ tag: "MIC410L", name: "Wireless Mic", serial: "WM-90012", department: "Audio" }],
  },
];

export const fallbackDamageRecords: DamageRecord[] = [
  {
    id: "d1",
    tag: "CAM050C",
    name: "Camera Lens",
    recordedAt: "2026-05-12 16:22",
    status: "Resolved: Available",
    note: "Front ring repaired and signed back into service.",
  },
  {
    id: "d2",
    tag: "MIC201K",
    name: "Wireless Mic",
    recordedAt: "2026-05-28 19:10",
    status: "Under Review",
    note: "Battery latch broken during return intake.",
  },
];

function formatProfileName(profile: ProfileRow | null | undefined) {
  return [profile?.display_name?.trim(), profile?.surname?.trim()].filter(Boolean).join(" ") || "Unknown user";
}

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

function getActionList(status: string | null | undefined) {
  const normalized = normalizeAssetStatus(status ?? "");
  if (normalized === "damaged") return [];
  if (normalized === "traveling") return ["Request Return", "Report Damage"];
  return ["Request Return", "Request Handover", "Report Damage"];
}

function normalizeDamageStatus(status: string | null | undefined): DamageRecord["status"] {
  const normalized = (status ?? "").trim().toLowerCase();
  if (normalized === "pending") return "Form Submitted";
  if (normalized === "completed") return "Under Review";
  if (normalized.includes("available")) return "Resolved: Available";
  return "Resolved: Damaged";
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

async function loadAssignedAssets(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("assets")
    .select("id, code, name, serial_number, status, current_location_id, department_id, updated_at")
    .eq("current_holder", userId)
    .order("updated_at", { ascending: false });

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
    assignedBy: "Live assignment record",
    assignedAt: formatDateTime(row.updated_at),
    availableActions: getActionList(row.status),
  }));
}

async function loadRecipientApprovals(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("get_my_pending_recipient_signout_approvals");
  if (error) throw error;

  const rows = Array.isArray(data) ? (data as RecipientApprovalRpcRow[]) : [];
  return rows.map((row) => ({
    id: row.id,
    type: "assignment" as const,
    title: row.package_name?.trim() ? row.package_name : "Incoming asset assignment",
    requestedBy: row.requested_by_name ?? "Unknown user",
    location: row.source_location_name ?? "No location",
    sentAt: formatDateTime(row.created_at),
    notes: row.notes ?? undefined,
    items: (Array.isArray(row.items) ? row.items : []).map((item) => ({
      tag: item.code ?? "No tag",
      name: item.name ?? "Unnamed asset",
      serial: item.serial_number ?? "-",
      department: item.division_name ?? "No department",
    })),
  }));
}

async function loadPendingHandovers(supabase: SupabaseClient, userId: string) {
  const { data: handoverRows, error: handoverError } = await supabase
    .from("handovers")
    .select("id, from_user, notes, created_at")
    .eq("to_user", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (handoverError) throw handoverError;

  const rows = (handoverRows ?? []) as HandoverRow[];
  if (rows.length === 0) return [];

  const handoverIds = rows.map((row) => row.id);
  const fromUserIds = [...new Set(rows.map((row) => row.from_user))];

  const [{ data: profileRows, error: profileError }, { data: itemRows, error: itemError }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, surname").in("id", fromUserIds),
    supabase.from("handover_items").select("handover_id, asset_id").in("handover_id", handoverIds),
  ]);

  if (profileError) throw profileError;
  if (itemError) throw itemError;

  const links = (itemRows ?? []) as HandoverItemRow[];
  const assetIds = [...new Set(links.map((row) => row.asset_id))];

  const { data: assetRows, error: assetError } = assetIds.length
    ? await supabase.from("assets").select("id, code, name, serial_number, current_location_id, department_id").in("id", assetIds)
    : { data: [], error: null };

  if (assetError) throw assetError;

  const assets = (assetRows ?? []) as AssetRow[];
  const locationIds = [...new Set(assets.map((row) => row.current_location_id).filter(Boolean))] as string[];
  const departmentIds = [...new Set(assets.map((row) => row.department_id).filter(Boolean))] as string[];
  const maps = await loadReferenceMaps(supabase, locationIds, departmentIds);

  const profileMap = Object.fromEntries(((profileRows ?? []) as ProfileRow[]).map((row) => [row.id, formatProfileName(row)]));
  const assetMap = Object.fromEntries(
    assets.map((row) => [
      row.id,
      {
        tag: row.code ?? "No tag",
        name: row.name ?? "Unnamed asset",
        serial: row.serial_number ?? "-",
        department: row.department_id ? maps.departments[row.department_id] ?? "Unknown department" : "No department",
        location: row.current_location_id ? maps.locations[row.current_location_id] ?? "Unknown location" : "No location",
      },
    ]),
  );

  const itemsByHandover = links.reduce<
    Record<
      string,
      Array<{
        tag: string;
        name: string;
        serial: string;
        department: string;
        location: string;
      }>
    >
  >((acc, row) => {
    const asset = assetMap[row.asset_id];
    if (!asset) return acc;
    if (!acc[row.handover_id]) acc[row.handover_id] = [];
    acc[row.handover_id].push(asset);
    return acc;
  }, {});

  return rows.map((row) => ({
    id: row.id,
    type: "handover" as const,
    title: "Incoming handover",
    requestedBy: profileMap[row.from_user] ?? "Unknown user",
    location: itemsByHandover[row.id]?.[0]?.location ?? "No location",
    sentAt: formatDateTime(row.created_at),
    notes: row.notes ?? undefined,
    items: (itemsByHandover[row.id] ?? []).map((item) => ({
      tag: item.tag,
      name: item.name,
      serial: item.serial,
      department: item.department,
    })),
  }));
}

async function loadDamageHistory(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("damage_reports")
    .select("id, asset_code, asset_name, created_at, status, damage_type, description")
    .eq("assigned_to", userId)
    .neq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) throw error;

  return ((data ?? []) as DamageRow[]).map((row) => ({
    id: row.id,
    tag: row.asset_code ?? "No tag",
    name: row.asset_name ?? "Unnamed asset",
    recordedAt: formatDateTime(row.created_at),
    status: normalizeDamageStatus(row.status),
    note: row.description?.trim() || row.damage_type?.trim() || "Damage incident recorded.",
  }));
}

export async function loadMyAssetsWorkspace(supabase: SupabaseClient, userId: string): Promise<MyAssetsWorkspaceData> {
  const warnings: string[] = [];

  const [assignedResult, approvalsResult, handoversResult, damageResult] = await Promise.allSettled([
    loadAssignedAssets(supabase, userId),
    loadRecipientApprovals(supabase),
    loadPendingHandovers(supabase, userId),
    loadDamageHistory(supabase, userId),
  ]);

  const assignedAssets =
    assignedResult.status === "fulfilled"
      ? assignedResult.value
      : (() => {
          const message = assignedResult.reason instanceof Error ? assignedResult.reason.message : "Assigned assets could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Assigned assets are using fallback data because the live schema is not fully available yet." : message);
          return fallbackAssignedAssets;
        })();

  const approvalItems =
    approvalsResult.status === "fulfilled"
      ? approvalsResult.value
      : (() => {
          const message = approvalsResult.reason instanceof Error ? approvalsResult.reason.message : "Pending approvals could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Recipient approvals are still using fallback data because the approval RPC is not available yet." : message);
          return fallbackPendingItems.filter((item) => item.type === "assignment");
        })();

  const handoverItems =
    handoversResult.status === "fulfilled"
      ? handoversResult.value
      : (() => {
          const message = handoversResult.reason instanceof Error ? handoversResult.reason.message : "Pending handovers could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Handovers are still using fallback data because the live handover workflow is not fully available yet." : message);
          return fallbackPendingItems.filter((item) => item.type === "handover");
        })();

  const damageRecords =
    damageResult.status === "fulfilled"
      ? damageResult.value
      : (() => {
          const message = damageResult.reason instanceof Error ? damageResult.reason.message : "Damage history could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Damage history is still using fallback data because the damage workflow tables are not fully available yet." : message);
          return fallbackDamageRecords;
        })();

  const liveSuccessCount = [assignedResult, approvalsResult, handoversResult, damageResult].filter((result) => result.status === "fulfilled").length;
  const source = liveSuccessCount === 4 ? "live" : liveSuccessCount === 0 ? "fallback" : "mixed";

  return {
    assignedAssets,
    pendingItems: [...approvalItems, ...handoverItems].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()),
    damageRecords,
    source,
    warnings,
  };
}

export async function loadHandoverRecipients(supabase: SupabaseClient, currentUserId: string) {
  try {
    const { data, error } = await supabase.rpc("list_settings_users");
    if (error) throw error;

    return ((data ?? []) as Array<{ id: string; full_name: string; role: string; home_base: string | null; approved: boolean; locked: boolean }>)
      .filter((row) => row.id !== currentUserId && row.approved && !row.locked)
      .map((row) => ({
        id: row.id,
        fullName: row.full_name,
        role: row.role,
        homeBase: row.home_base,
      }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Handover recipients could not be loaded.";
    if (!isMissingSchemaError(message)) throw error;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, surname, full_name")
    .neq("id", currentUserId)
    .order("full_name");

  if (error) throw error;

  return ((data ?? []) as Array<{ id: string; display_name: string | null; surname: string | null; full_name?: string | null }>).map((row) => ({
    id: row.id,
    fullName: [row.display_name?.trim(), row.surname?.trim()].filter(Boolean).join(" ") || row.full_name?.trim() || "Unknown user",
    role: "operator",
    homeBase: null,
  }));
}

export async function submitHandoverRequest(
  supabase: SupabaseClient,
  input: {
    fromUserId: string;
    toUserId: string;
    assetIds: string[];
    notes?: string;
  },
) {
  if (!input.toUserId) {
    throw new Error("Choose the receiving user first.");
  }
  if (input.assetIds.length === 0) {
    throw new Error("Choose at least one assigned asset first.");
  }

  const { data: handoverRow, error: handoverError } = await supabase
    .from("handovers")
    .insert({
      from_user: input.fromUserId,
      to_user: input.toUserId,
      notes: input.notes?.trim() || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (handoverError) throw handoverError;

  const handoverId = (handoverRow as { id: string }).id;

  const { error: itemsError } = await supabase.from("handover_items").insert(
    input.assetIds.map((assetId) => ({
      handover_id: handoverId,
      asset_id: assetId,
    })),
  );

  if (itemsError) throw itemsError;

  return handoverId;
}

export async function submitDamageReport(supabase: SupabaseClient, input: SubmitDamageReportInput) {
  const trimmedDamageType = input.damageType.trim();
  const trimmedDescription = input.description.trim();

  if (!trimmedDamageType) {
    throw new Error("Choose the damage type before submitting.");
  }
  if (!trimmedDescription) {
    throw new Error("Describe the damage incident before submitting.");
  }

  try {
    const { error } = await supabase.from("damage_cases").insert({
      asset_id: input.assetId,
      responsible_user_id: input.userId,
      status: "Form Pending",
      user_statement: `${trimmedDamageType}: ${trimmedDescription}`,
    });

    if (error) throw error;
    return { target: "damage_cases" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Damage case submission failed.";
    if (!isMissingSchemaError(message)) {
      throw error;
    }
  }

  const { error } = await supabase.from("damage_reports").insert({
    assigned_to: input.userId,
    asset_code: input.assetTag,
    asset_name: input.assetName,
    status: "pending",
    damage_type: trimmedDamageType,
    description: trimmedDescription,
  });

  if (error) throw error;
  return { target: "damage_reports" as const };
}
