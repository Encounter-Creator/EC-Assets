"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

export type SettingsUserRecord = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  home_base: string | null;
  department: string | null;
  approved: boolean;
  locked: boolean;
};

export type SettingsLocationRecord = {
  id: string;
  name: string;
  active: boolean;
  is_home_base: boolean;
};

export type SettingsDepartmentRecord = {
  id: string;
  name: string;
  active: boolean;
};

export type SettingsKitRecord = {
  id: string;
  name: string;
  home_base: string | null;
  active: boolean;
  item_count: number;
};

export type SettingsKitMemberRecord = {
  id: string;
  kit_id: string;
  asset_id: string;
  asset_code: string;
  asset_name: string;
  serial_number: string | null;
  status: string;
  current_location: string | null;
  department: string | null;
  sort_order: number;
};

export type SettingsKitAssetCandidateRecord = {
  asset_id: string;
  asset_code: string;
  asset_name: string;
  serial_number: string | null;
  status: string;
  current_location: string | null;
  department: string | null;
};

export type SettingsConsumableRecord = {
  id: string;
  name: string;
  department: string | null;
  unit: string;
  stock_on_hand: number;
  reorder_level: number;
  active: boolean;
};

export type SettingsDuplicateRecord = {
  id: string;
  primary_asset: string;
  duplicate_asset: string;
  status: string;
  notes: string | null;
  created_at: string;
};

export type SettingsConfigRecord = {
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  updated_at: string;
};

export type SettingsWorkspaceData = {
  users: SettingsUserRecord[];
  locations: SettingsLocationRecord[];
  departments: SettingsDepartmentRecord[];
  kits: SettingsKitRecord[];
  consumables: SettingsConsumableRecord[];
  duplicates: SettingsDuplicateRecord[];
  config: SettingsConfigRecord[];
  source: "live" | "mixed" | "fallback";
  warnings: string[];
};

export type DuplicateAssetDetail = {
  key: string;
  tag: string;
  name: string;
  serial: string;
  location: string;
  department: string;
  status: string;
};

export type DuplicateComparison = {
  primary: DuplicateAssetDetail | null;
  duplicate: DuplicateAssetDetail | null;
  source: "live" | "fallback";
  warnings: string[];
};

type SettingsAssetRow = {
  id: string;
  code: string | null;
  name: string | null;
  serial_number: string | null;
  status: string | null;
  current_location_id: string | null;
  department_id: string | null;
};

type SettingsProfileDirectRow = {
  id: string;
  display_name: string | null;
  surname: string | null;
  full_name: string | null;
  assigned_location_id: string | null;
  asset_manager_location_id: string | null;
};

type SettingsDamageLockRow = {
  responsible_user_id: string | null;
  status: string | null;
};

const fallbackWorkspace: SettingsWorkspaceData = {
  users: [
    { id: "u1", full_name: "Barend N", email: "barend@example.com", role: "staff", home_base: "Centurion", department: "Production", approved: true, locked: false },
    { id: "u2", full_name: "Lerato M", email: "lerato@example.com", role: "asset_manager", home_base: "Krugersdorp", department: "Audio", approved: true, locked: false },
  ],
  locations: [
    { id: "l1", name: "Centurion", active: true, is_home_base: true },
    { id: "l2", name: "Krugersdorp", active: true, is_home_base: true },
    { id: "l3", name: "Office", active: true, is_home_base: true },
  ],
  departments: [
    { id: "d1", name: "Production", active: true },
    { id: "d2", name: "Audio", active: true },
    { id: "d3", name: "Prophet", active: true },
  ],
  kits: [
    { id: "k1", name: "Sunday Camera Kit", home_base: "Centurion", active: true, item_count: 6 },
  ],
  consumables: [
    { id: "c1", name: "AA Batteries", department: "Audio", unit: "box", stock_on_hand: 14, reorder_level: 6, active: true },
  ],
  duplicates: [
    { id: "dup1", primary_asset: "CAM101C", duplicate_asset: "CAM101-OLD", status: "Open", notes: "Possible duplicate import", created_at: "2026-06-01T09:00:00Z" },
  ],
  config: [
    { key: "qr_export", value: { labelMm: 20, pageBorderMm: 5, format: "A4" }, description: "Bulk QR export defaults", updated_at: "2026-06-01T09:00:00Z" },
  ],
  source: "fallback",
  warnings: ["Supabase is not configured yet, so Settings is using the rebuild preview dataset."],
};

const fallbackKitMembers: Record<string, SettingsKitMemberRecord[]> = {
  k1: [
    {
      id: "km1",
      kit_id: "k1",
      asset_id: "a1",
      asset_code: "CAM101C",
      asset_name: "Camera Body",
      serial_number: "CMB-00192",
      status: "available",
      current_location: "Centurion",
      department: "Production",
      sort_order: 1,
    },
    {
      id: "km2",
      kit_id: "k1",
      asset_id: "a2",
      asset_code: "TRP100O",
      asset_name: "Tripod",
      serial_number: "TR-50001",
      status: "available",
      current_location: "Office",
      department: "Production",
      sort_order: 2,
    },
    {
      id: "km3",
      kit_id: "k1",
      asset_id: "a3",
      asset_code: "BAT120C",
      asset_name: "Battery Kit",
      serial_number: "BAT-10001",
      status: "available",
      current_location: "Centurion",
      department: "Production",
      sort_order: 3,
    },
  ],
};

const fallbackKitAssetCandidates: SettingsKitAssetCandidateRecord[] = [
  {
    asset_id: "a1",
    asset_code: "CAM101C",
    asset_name: "Camera Body",
    serial_number: "CMB-00192",
    status: "available",
    current_location: "Centurion",
    department: "Production",
  },
  {
    asset_id: "a2",
    asset_code: "TRP100O",
    asset_name: "Tripod",
    serial_number: "TR-50001",
    status: "available",
    current_location: "Office",
    department: "Production",
  },
  {
    asset_id: "a3",
    asset_code: "BAT120C",
    asset_name: "Battery Kit",
    serial_number: "BAT-10001",
    status: "available",
    current_location: "Centurion",
    department: "Production",
  },
  {
    asset_id: "a4",
    asset_code: "MIC302K",
    asset_name: "Wireless Mic",
    serial_number: "WM-00482",
    status: "assigned",
    current_location: "Traveling",
    department: "Audio",
  },
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

async function loadSettingsLocationsDirect(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("locations").select("id, name, active, is_home_base").order("name");
  if (error) throw error;
  return ((data ?? []) as SettingsLocationRecord[]).map((row) => ({
    id: row.id,
    name: row.name,
    active: Boolean(row.active),
    is_home_base: Boolean(row.is_home_base),
  }));
}

async function loadSettingsDepartmentsDirect(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("departments").select("id, name, active").order("name");
  if (error) throw error;
  return ((data ?? []) as SettingsDepartmentRecord[]).map((row) => ({
    id: row.id,
    name: row.name,
    active: Boolean(row.active),
  }));
}

async function loadSettingsKitsDirect(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("kits").select("id, name, home_base, active, item_count").order("name");
  if (error) throw error;
  return ((data ?? []) as SettingsKitRecord[]).map((row) => ({
    id: row.id,
    name: row.name,
    home_base: row.home_base ?? null,
    active: Boolean(row.active),
    item_count: row.item_count ?? 0,
  }));
}

async function loadSettingsConsumablesDirect(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("consumables")
    .select("id, name, department, unit, stock_on_hand, reorder_level, active")
    .order("name");
  if (error) throw error;
  return ((data ?? []) as SettingsConsumableRecord[]).map((row) => ({
    id: row.id,
    name: row.name,
    department: row.department ?? null,
    unit: row.unit,
    stock_on_hand: row.stock_on_hand ?? 0,
    reorder_level: row.reorder_level ?? 0,
    active: Boolean(row.active),
  }));
}

async function loadSettingsConfigDirect(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("app_config").select("key, value, description, updated_at").order("key");
  if (error) throw error;
  return ((data ?? []) as SettingsConfigRecord[]).map((row) => ({
    key: row.key,
    value: row.value ?? {},
    description: row.description ?? null,
    updated_at: row.updated_at,
  }));
}

function isBlockingDamageStatus(status: string | null | undefined) {
  const normalized = (status ?? "").trim().toLowerCase();
  return normalized === "locked" || normalized === "form pending";
}

function formatSettingsUserName(row: SettingsProfileDirectRow) {
  return [row.display_name?.trim(), row.surname?.trim()].filter(Boolean).join(" ") || row.full_name?.trim() || "Unknown user";
}

async function loadSettingsUsersDirect(supabase: SupabaseClient) {
  const [{ data: profilesData, error: profilesError }, { data: rolesData, error: rolesError }, { data: locationsData, error: locationsError }, { data: damageLocksData, error: damageLocksError }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, surname, full_name, assigned_location_id, asset_manager_location_id"),
    supabase.from("user_roles").select("user_id, role"),
    supabase.from("locations").select("id, name"),
    supabase.from("damage_cases").select("responsible_user_id, status").in("status", ["Locked", "Form Pending"]),
  ]);

  if (profilesError) throw profilesError;
  if (rolesError) throw rolesError;
  if (locationsError) throw locationsError;
  if (damageLocksError) throw damageLocksError;

  const profiles = (profilesData ?? []) as SettingsProfileDirectRow[];
  const roleRows = (rolesData ?? []) as Array<{ user_id: string; role: string }>;
  const locations = Object.fromEntries(((locationsData ?? []) as Array<{ id: string; name: string }>).map((row) => [row.id, row.name]));
  const lockedUsers = new Set(
    ((damageLocksData ?? []) as SettingsDamageLockRow[])
      .filter((row) => row.responsible_user_id && isBlockingDamageStatus(row.status))
      .map((row) => row.responsible_user_id as string),
  );

  const roleMap = new Map<string, string>();
  for (const row of roleRows) {
    if (!roleMap.has(row.user_id)) {
      roleMap.set(row.user_id, row.role);
    }
  }

  const approvalResults = await Promise.allSettled(
    profiles.map(async (profile) => {
      const { data, error } = await supabase.rpc("is_approved", { _user_id: profile.id });
      if (error) throw error;
      return { userId: profile.id, approved: Boolean(data) };
    }),
  );

  const approvedMap = new Map<string, boolean>();
  for (const result of approvalResults) {
    if (result.status === "fulfilled") {
      approvedMap.set(result.value.userId, result.value.approved);
    }
  }

  return profiles
    .map((profile) => ({
      id: profile.id,
      full_name: formatSettingsUserName(profile),
      email: "",
      role: roleMap.get(profile.id) ?? "staff",
      home_base:
        (profile.assigned_location_id && locations[profile.assigned_location_id]) ||
        (profile.asset_manager_location_id && locations[profile.asset_manager_location_id]) ||
        null,
      department: null,
      approved: approvedMap.get(profile.id) ?? false,
      locked: lockedUsers.has(profile.id),
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export async function loadSettingsWorkspace(supabase: SupabaseClient): Promise<SettingsWorkspaceData> {
  const warnings: string[] = [];

  const [usersResult, locationsResult, departmentsResult, kitsResult, consumablesResult, duplicatesResult, configResult] = await Promise.allSettled([
    supabase.rpc("list_settings_users"),
    supabase.rpc("list_settings_locations"),
    supabase.rpc("list_settings_departments"),
    supabase.rpc("list_settings_kits"),
    supabase.rpc("list_settings_consumables"),
    supabase.rpc("list_settings_duplicates"),
    supabase.rpc("list_settings_config"),
  ]);

  const users =
    usersResult.status === "fulfilled" && !usersResult.value.error
      ? ((usersResult.value.data ?? []) as SettingsUserRecord[])
      : (() => {
          const message =
            usersResult.status === "fulfilled"
              ? usersResult.value.error?.message ?? "Users could not be loaded."
              : usersResult.reason instanceof Error
                ? usersResult.reason.message
                : "Users could not be loaded.";
          if (!isMissingSchemaError(message)) {
            warnings.push(message);
            return fallbackWorkspace.users;
          }
          warnings.push("Users are using direct live queries because the settings RPC is not available yet.");
          return loadSettingsUsersDirect(supabase);
        })();

  const locations =
    locationsResult.status === "fulfilled" && !locationsResult.value.error
      ? ((locationsResult.value.data ?? []) as SettingsLocationRecord[])
      : (() => {
          const message =
            locationsResult.status === "fulfilled"
              ? locationsResult.value.error?.message ?? "Locations could not be loaded."
              : locationsResult.reason instanceof Error
                ? locationsResult.reason.message
                : "Locations could not be loaded.";
          if (!isMissingSchemaError(message)) {
            warnings.push(message);
            return fallbackWorkspace.locations;
          }
          warnings.push("Locations are using direct live queries because the settings RPC is not available yet.");
          return loadSettingsLocationsDirect(supabase);
        })();

  const departments =
    departmentsResult.status === "fulfilled" && !departmentsResult.value.error
      ? ((departmentsResult.value.data ?? []) as SettingsDepartmentRecord[])
      : (() => {
          const message =
            departmentsResult.status === "fulfilled"
              ? departmentsResult.value.error?.message ?? "Departments could not be loaded."
              : departmentsResult.reason instanceof Error
                ? departmentsResult.reason.message
                : "Departments could not be loaded.";
          if (!isMissingSchemaError(message)) {
            warnings.push(message);
            return fallbackWorkspace.departments;
          }
          warnings.push("Departments are using direct live queries because the settings RPC is not available yet.");
          return loadSettingsDepartmentsDirect(supabase);
        })();

  const kits =
    kitsResult.status === "fulfilled" && !kitsResult.value.error
      ? ((kitsResult.value.data ?? []) as SettingsKitRecord[])
      : (() => {
          const message =
            kitsResult.status === "fulfilled"
              ? kitsResult.value.error?.message ?? "Kits could not be loaded."
              : kitsResult.reason instanceof Error
                ? kitsResult.reason.message
                : "Kits could not be loaded.";
          if (!isMissingSchemaError(message)) {
            warnings.push(message);
            return fallbackWorkspace.kits;
          }
          warnings.push("Kits are using direct live queries because the settings RPC is not available yet.");
          return loadSettingsKitsDirect(supabase);
        })();

  const consumables =
    consumablesResult.status === "fulfilled" && !consumablesResult.value.error
      ? ((consumablesResult.value.data ?? []) as SettingsConsumableRecord[])
      : (() => {
          const message =
            consumablesResult.status === "fulfilled"
              ? consumablesResult.value.error?.message ?? "Consumables could not be loaded."
              : consumablesResult.reason instanceof Error
                ? consumablesResult.reason.message
                : "Consumables could not be loaded.";
          if (!isMissingSchemaError(message)) {
            warnings.push(message);
            return fallbackWorkspace.consumables;
          }
          warnings.push("Consumables are using direct live queries because the settings RPC is not available yet.");
          return loadSettingsConsumablesDirect(supabase);
        })();

  const duplicates =
    duplicatesResult.status === "fulfilled" && !duplicatesResult.value.error
      ? ((duplicatesResult.value.data ?? []) as SettingsDuplicateRecord[])
      : (() => {
          const message =
            duplicatesResult.status === "fulfilled"
              ? duplicatesResult.value.error?.message ?? "Duplicates could not be loaded."
              : duplicatesResult.reason instanceof Error
                ? duplicatesResult.reason.message
                : "Duplicates could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Duplicates are using fallback data because the settings RPC is not available yet." : message);
          return fallbackWorkspace.duplicates;
        })();

  const config =
    configResult.status === "fulfilled" && !configResult.value.error
      ? ((configResult.value.data ?? []) as SettingsConfigRecord[])
      : (() => {
          const message =
            configResult.status === "fulfilled"
              ? configResult.value.error?.message ?? "Config could not be loaded."
              : configResult.reason instanceof Error
                ? configResult.reason.message
                : "Config could not be loaded.";
          if (!isMissingSchemaError(message)) {
            warnings.push(message);
            return fallbackWorkspace.config;
          }
          warnings.push("Config is using direct live queries because the settings RPC is not available yet.");
          return loadSettingsConfigDirect(supabase);
        })();

  const resolvedWorkspace = await Promise.all([
    Promise.resolve(users),
    Promise.resolve(locations),
    Promise.resolve(departments),
    Promise.resolve(kits),
    Promise.resolve(consumables),
    Promise.resolve(duplicates),
    Promise.resolve(config),
  ]);

  const successCount = [
    usersResult.status === "fulfilled" && !usersResult.value.error,
    locationsResult.status === "fulfilled" && !locationsResult.value.error,
    departmentsResult.status === "fulfilled" && !departmentsResult.value.error,
    kitsResult.status === "fulfilled" && !kitsResult.value.error,
    consumablesResult.status === "fulfilled" && !consumablesResult.value.error,
    duplicatesResult.status === "fulfilled" && !duplicatesResult.value.error,
    configResult.status === "fulfilled" && !configResult.value.error,
  ].filter(Boolean).length;
  const source = successCount === 7 ? "live" : successCount === 0 ? "fallback" : "mixed";

  return {
    users: resolvedWorkspace[0],
    locations: resolvedWorkspace[1],
    departments: resolvedWorkspace[2],
    kits: resolvedWorkspace[3],
    consumables: resolvedWorkspace[4],
    duplicates: resolvedWorkspace[5],
    config: resolvedWorkspace[6],
    source,
    warnings,
  };
}

export function getFallbackSettingsWorkspace() {
  return fallbackWorkspace;
}

async function loadReferenceMaps(supabase: SupabaseClient, locationIds: string[], departmentIds: string[]) {
  const [locationsResult, departmentsResult] = await Promise.all([
    locationIds.length > 0 ? supabase.from("locations").select("id, name").in("id", locationIds) : Promise.resolve({ data: [], error: null }),
    departmentIds.length > 0 ? supabase.from("departments").select("id, name").in("id", departmentIds) : Promise.resolve({ data: [], error: null }),
  ]);

  if (locationsResult.error) throw locationsResult.error;
  if (departmentsResult.error) throw departmentsResult.error;

  return {
    locations: Object.fromEntries(((locationsResult.data ?? []) as Array<{ id: string; name: string }>).map((row) => [row.id, row.name])),
    departments: Object.fromEntries(((departmentsResult.data ?? []) as Array<{ id: string; name: string }>).map((row) => [row.id, row.name])),
  };
}

export async function loadSettingsKitMembers(
  supabase: SupabaseClient,
  kitId: string,
): Promise<{
  members: SettingsKitMemberRecord[];
  source: "live" | "fallback";
  warnings: string[];
}> {
  try {
    const { data, error } = await supabase.rpc("list_settings_kit_members", {
      p_kit_id: kitId,
    });

    if (error) throw error;

    return {
      members: ((data ?? []) as SettingsKitMemberRecord[]).map((row) => ({
        ...row,
        asset_code: row.asset_code ?? "No tag",
        asset_name: row.asset_name ?? "Unnamed asset",
      })),
      source: "live",
      warnings: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kit members could not be loaded.";
    if (!isMissingSchemaError(message)) {
      throw error;
    }

    return {
      members: fallbackKitMembers[kitId] ?? [],
      source: "fallback",
      warnings: ["Kit membership is using fallback data because the kit-membership schema is not available yet."],
    };
  }
}

export async function loadSettingsKitAssetCandidates(
  supabase: SupabaseClient,
): Promise<{
  assets: SettingsKitAssetCandidateRecord[];
  source: "live" | "fallback";
  warnings: string[];
}> {
  try {
    const { data, error } = await supabase
      .from("assets")
      .select("id, code, name, serial_number, status, current_location_id, department_id")
      .order("name");

    if (error) throw error;

    const rows = (data ?? []) as SettingsAssetRow[];
    const locationIds = [...new Set(rows.map((row) => row.current_location_id).filter(Boolean))] as string[];
    const departmentIds = [...new Set(rows.map((row) => row.department_id).filter(Boolean))] as string[];
    const maps = await loadReferenceMaps(supabase, locationIds, departmentIds);

    return {
      assets: rows.map((row) => ({
        asset_id: row.id,
        asset_code: row.code ?? "No tag",
        asset_name: row.name ?? "Unnamed asset",
        serial_number: row.serial_number ?? null,
        status: row.status ?? "unknown",
        current_location: row.current_location_id ? maps.locations[row.current_location_id] ?? "Unknown location" : "No location",
        department: row.department_id ? maps.departments[row.department_id] ?? "No department" : "No department",
      })),
      source: "live",
      warnings: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kit asset candidates could not be loaded.";
    if (!isMissingSchemaError(message)) {
      throw error;
    }

    return {
      assets: fallbackKitAssetCandidates,
      source: "fallback",
      warnings: ["Kit asset candidates are using fallback data because the asset source query is not available yet."],
    };
  }
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function loadDuplicateComparison(
  supabase: SupabaseClient,
  record: SettingsDuplicateRecord,
): Promise<DuplicateComparison> {
  const warnings: string[] = [];

  const assetKeys = [record.primary_asset, record.duplicate_asset];
  const queryColumn = assetKeys.every(looksLikeUuid) ? "id" : "code";
  const { data, error } = await supabase
    .from("assets")
    .select("id, code, name, serial_number, current_location_id, department_id, status")
    .in(queryColumn, assetKeys)
    .limit(2);

  if (error) {
    return {
      primary: {
        key: record.primary_asset,
        tag: record.primary_asset,
        name: "Unknown asset",
        serial: "-",
        location: "-",
        department: "-",
        status: "-",
      },
      duplicate: {
        key: record.duplicate_asset,
        tag: record.duplicate_asset,
        name: "Unknown asset",
        serial: "-",
        location: "-",
        department: "-",
        status: "-",
      },
      source: "fallback",
      warnings: [error.message],
    };
  }

  const assetRows = (data ?? []) as Array<{
    id: string;
    code: string | null;
    name: string | null;
    serial_number: string | null;
    current_location_id: string | null;
    department_id: string | null;
    status: string | null;
  }>;

  const locationIds = [...new Set(assetRows.map((row) => row.current_location_id).filter(Boolean))] as string[];
  const departmentIds = [...new Set(assetRows.map((row) => row.department_id).filter(Boolean))] as string[];

  let locations: Record<string, string> = {};
  let departments: Record<string, string> = {};
  try {
    const maps = await loadReferenceMaps(supabase, locationIds, departmentIds);
    locations = maps.locations;
    departments = maps.departments;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reference lookups failed.";
    warnings.push(message);
  }
  const assetMap = Object.fromEntries(
    assetRows.map((row) => [
      queryColumn === "id" ? row.id : (row.code ?? row.id),
      {
        key: queryColumn === "id" ? row.id : (row.code ?? row.id),
        tag: row.code ?? "No tag",
        name: row.name ?? "Unnamed asset",
        serial: row.serial_number ?? "-",
        location: row.current_location_id ? locations[row.current_location_id] ?? "Unknown location" : "No location",
        department: row.department_id ? departments[row.department_id] ?? "Unknown department" : "No department",
        status: row.status ?? "Unknown",
      },
    ]),
  );

  return {
    primary: assetMap[record.primary_asset] ?? {
      key: record.primary_asset,
      tag: record.primary_asset,
      name: "Unknown asset",
      serial: "-",
      location: "-",
      department: "-",
      status: "-",
    },
    duplicate: assetMap[record.duplicate_asset] ?? {
      key: record.duplicate_asset,
      tag: record.duplicate_asset,
      name: "Unknown asset",
      serial: "-",
      location: "-",
      department: "-",
      status: "-",
    },
    source: warnings.length === 0 ? "live" : "fallback",
    warnings,
  };
}

export async function resolveSettingsDuplicate(
  supabase: SupabaseClient,
  input: {
    duplicateId: string;
    status: "Merged" | "Not Duplicate";
    survivorAsset: string | null;
    note: string;
  },
) {
  const rpcResult = await supabase.rpc("resolve_settings_duplicate", {
    p_duplicate_id: input.duplicateId,
    p_status: input.status,
    p_survivor_asset: input.survivorAsset,
    p_note: input.note.trim() || null,
  });

  if (!rpcResult.error) {
    return { error: null, previewOnly: false };
  }

  const normalizedMessage = rpcResult.error.message.toLowerCase();
  const missingRpc =
    normalizedMessage.includes("could not find the function") ||
    normalizedMessage.includes("does not exist") ||
    normalizedMessage.includes("schema cache");

  if (!missingRpc) {
    return { error: rpcResult.error, previewOnly: false };
  }

  for (const table of ["duplicates", "asset_duplicates", "duplicate_assets"]) {
    const { error } = await supabase
      .from(table)
      .update({
        status: input.status,
        notes: input.note.trim() || null,
      })
      .eq("id", input.duplicateId);

    if (!error) {
      return { error: null, previewOnly: false };
    }
  }

  return { error: null, previewOnly: true };
}

export async function updateMyProfile(
  supabase: SupabaseClient,
  input: {
    displayName: string;
    surname: string;
  },
) {
  const trimmedDisplayName = input.displayName.trim();
  const trimmedSurname = input.surname.trim();

  if (!trimmedDisplayName && !trimmedSurname) {
    throw new Error("Enter at least a first name or surname.");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user) throw new Error("Not authenticated.");

  return supabase
    .from("profiles")
    .update({
      display_name: trimmedDisplayName || null,
      surname: trimmedSurname || null,
      full_name: [trimmedDisplayName, trimmedSurname].filter(Boolean).join(" ") || null,
    })
    .eq("id", user.id);
}

export async function createLocation(
  supabase: SupabaseClient,
  input: {
    name: string;
    isHomeBase: boolean;
  },
) {
  return supabase.rpc("create_settings_location", {
    p_name: input.name.trim(),
    p_is_home_base: input.isHomeBase,
  });
}

export async function setLocationActiveState(
  supabase: SupabaseClient,
  input: {
    locationId: string;
    active: boolean;
  },
) {
  return supabase.rpc("set_settings_location_active", {
    p_location_id: input.locationId,
    p_active: input.active,
  });
}

export async function createDepartment(
  supabase: SupabaseClient,
  input: {
    name: string;
  },
) {
  return supabase.rpc("create_settings_department", {
    p_name: input.name.trim(),
  });
}

export async function setDepartmentActiveState(
  supabase: SupabaseClient,
  input: {
    departmentId: string;
    active: boolean;
  },
) {
  return supabase.rpc("set_settings_department_active", {
    p_department_id: input.departmentId,
    p_active: input.active,
  });
}

export async function createConsumable(
  supabase: SupabaseClient,
  input: {
    name: string;
    department: string;
    unit: string;
    stockOnHand: number;
    reorderLevel: number;
  },
) {
  return supabase.rpc("create_settings_consumable", {
    p_name: input.name.trim(),
    p_department: input.department.trim() || null,
    p_unit: input.unit.trim(),
    p_stock_on_hand: input.stockOnHand,
    p_reorder_level: input.reorderLevel,
  });
}

export async function setConsumableActiveState(
  supabase: SupabaseClient,
  input: {
    consumableId: string;
    active: boolean;
  },
) {
  return supabase.rpc("set_settings_consumable_active", {
    p_consumable_id: input.consumableId,
    p_active: input.active,
  });
}

export async function saveSettingsConfig(
  supabase: SupabaseClient,
  input: {
    key: string;
    value: Record<string, unknown>;
    description?: string | null;
  },
) {
  return supabase.rpc("save_settings_config", {
    p_key: input.key,
    p_value: input.value,
    p_description: input.description ?? null,
  });
}

export async function createKit(
  supabase: SupabaseClient,
  input: {
    name: string;
    homeBase: string;
    itemCount: number;
  },
) {
  return supabase.rpc("create_settings_kit", {
    p_name: input.name.trim(),
    p_home_base: input.homeBase.trim() || null,
    p_item_count: input.itemCount,
  });
}

export async function setKitActiveState(
  supabase: SupabaseClient,
  input: {
    kitId: string;
    active: boolean;
  },
) {
  return supabase.rpc("set_settings_kit_active", {
    p_kit_id: input.kitId,
    p_active: input.active,
  });
}

export async function saveSettingsKitMembers(
  supabase: SupabaseClient,
  input: {
    kitId: string;
    assetIds: string[];
  },
) {
  return supabase.rpc("save_settings_kit_members", {
    p_kit_id: input.kitId,
    p_asset_ids: input.assetIds,
  });
}

export async function saveSettingsUser(
  supabase: SupabaseClient,
  input: {
    userId: string;
    displayName: string;
    surname: string;
    assignedLocationId: string | null;
    assetManagerLocationId: string | null;
    role: string | null;
  },
) {
  return supabase.rpc("save_settings_user", {
    p_user_id: input.userId,
    p_display_name: input.displayName.trim() || null,
    p_surname: input.surname.trim() || null,
    p_assigned_location_id: input.assignedLocationId,
    p_asset_manager_location_id: input.assetManagerLocationId,
    p_role: input.role?.trim() || null,
  });
}
