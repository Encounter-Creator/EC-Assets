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
    usersResult.status === "fulfilled"
      ? ((usersResult.value.data ?? []) as SettingsUserRecord[])
      : (() => {
          const message = usersResult.reason instanceof Error ? usersResult.reason.message : "Users could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Users are using fallback data because the settings RPC is not available yet." : message);
          return fallbackWorkspace.users;
        })();

  const locations =
    locationsResult.status === "fulfilled"
      ? ((locationsResult.value.data ?? []) as SettingsLocationRecord[])
      : (() => {
          const message = locationsResult.reason instanceof Error ? locationsResult.reason.message : "Locations could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Locations are using fallback data because the settings RPC is not available yet." : message);
          return fallbackWorkspace.locations;
        })();

  const departments =
    departmentsResult.status === "fulfilled"
      ? ((departmentsResult.value.data ?? []) as SettingsDepartmentRecord[])
      : (() => {
          const message = departmentsResult.reason instanceof Error ? departmentsResult.reason.message : "Departments could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Departments are using fallback data because the settings RPC is not available yet." : message);
          return fallbackWorkspace.departments;
        })();

  const kits =
    kitsResult.status === "fulfilled"
      ? ((kitsResult.value.data ?? []) as SettingsKitRecord[])
      : (() => {
          const message = kitsResult.reason instanceof Error ? kitsResult.reason.message : "Kits could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Kits are using fallback data because the settings RPC is not available yet." : message);
          return fallbackWorkspace.kits;
        })();

  const consumables =
    consumablesResult.status === "fulfilled"
      ? ((consumablesResult.value.data ?? []) as SettingsConsumableRecord[])
      : (() => {
          const message = consumablesResult.reason instanceof Error ? consumablesResult.reason.message : "Consumables could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Consumables are using fallback data because the settings RPC is not available yet." : message);
          return fallbackWorkspace.consumables;
        })();

  const duplicates =
    duplicatesResult.status === "fulfilled"
      ? ((duplicatesResult.value.data ?? []) as SettingsDuplicateRecord[])
      : (() => {
          const message = duplicatesResult.reason instanceof Error ? duplicatesResult.reason.message : "Duplicates could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Duplicates are using fallback data because the settings RPC is not available yet." : message);
          return fallbackWorkspace.duplicates;
        })();

  const config =
    configResult.status === "fulfilled"
      ? ((configResult.value.data ?? []) as SettingsConfigRecord[])
      : (() => {
          const message = configResult.reason instanceof Error ? configResult.reason.message : "Config could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Config is using fallback data because the settings RPC is not available yet." : message);
          return fallbackWorkspace.config;
        })();

  const successCount = [usersResult, locationsResult, departmentsResult, kitsResult, consumablesResult, duplicatesResult, configResult].filter((result) => result.status === "fulfilled").length;
  const source = successCount === 7 ? "live" : successCount === 0 ? "fallback" : "mixed";

  return {
    users,
    locations,
    departments,
    kits,
    consumables,
    duplicates,
    config,
    source,
    warnings,
  };
}

export function getFallbackSettingsWorkspace() {
  return fallbackWorkspace;
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
