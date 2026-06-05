import { requireAdminContext } from "@/app/api/admin/users/helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

type AssetInput = {
  name: string;
  serialNumber: string;
  locationName: string;
  departmentName: string;
  code?: string;
};

export type AssetImportMapping = {
  name: string;
  serial_number: string;
  location: string;
  department: string;
  code?: string;
};

export type AssetImportRow = Record<string, string>;

export type AssetImportResult = {
  rowNumber: number;
  name: string;
  serialNumber: string;
  location: string;
  department: string;
  finalCode: string | null;
  result: "ready" | "created" | "skipped";
  reason?: string;
};

type ReferenceMaps = {
  locationIdsByName: Map<string, string>;
  departmentIdsByName: Map<string, string>;
};

type AdminAssetContext = {
  adminSupabase: SupabaseClient;
  currentUser: { id: string };
  references: ReferenceMaps;
};

function normalizeLookup(value: string) {
  return value.trim().toLowerCase();
}

function normalizedSerialNumber(value: string) {
  const trimmed = value.trim();
  return trimmed || "NA";
}

function firstMeaningfulCharacter(value: string, fallback: string) {
  const match = value.trim().match(/[A-Za-z0-9]/);
  return (match?.[0] ?? fallback).toUpperCase();
}

async function loadReferenceMaps() {
  const context = await requireAdminContext();
  if (!("adminSupabase" in context) || !("currentUser" in context)) {
    return context;
  }

  const { adminSupabase } = context as { adminSupabase: SupabaseClient };
  const [{ data: locations, error: locationsError }, { data: departments, error: departmentsError }] = await Promise.all([
    adminSupabase.from("locations").select("id, name").order("name"),
    adminSupabase.from("departments").select("id, name").order("name"),
  ]);

  if (locationsError) {
    return { error: locationsError.message, status: 400 as const };
  }

  if (departmentsError) {
    return { error: departmentsError.message, status: 400 as const };
  }

  return {
    ...context,
    references: {
      locationIdsByName: new Map(((locations ?? []) as Array<{ id: string; name: string }>).map((row) => [normalizeLookup(row.name), row.id])),
      departmentIdsByName: new Map(((departments ?? []) as Array<{ id: string; name: string }>).map((row) => [normalizeLookup(row.name), row.id])),
    } satisfies ReferenceMaps,
  };
}

async function codeExists(adminSupabase: SupabaseClient, code: string) {
  const { data, error } = await adminSupabase.from("assets").select("id").eq("code", code).maybeSingle();
  if (error && error.code !== "PGRST116") {
    throw new Error(error.message);
  }
  return Boolean(data);
}

async function generateAssetCode(
  adminSupabase: SupabaseClient,
  input: {
    name: string;
    departmentName: string;
    locationName: string;
  },
  reservedCodes: Set<string>,
) {
  const itemInitial = firstMeaningfulCharacter(input.name, "X");
  const departmentInitial = firstMeaningfulCharacter(input.departmentName, "X");
  const locationInitial = firstMeaningfulCharacter(input.locationName, "X");

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const digits = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
    const candidate = `${itemInitial}${departmentInitial}${digits}${locationInitial}`;
    if (reservedCodes.has(candidate)) continue;
    if (await codeExists(adminSupabase, candidate)) continue;
    reservedCodes.add(candidate);
    return candidate;
  }

  throw new Error("A unique asset code could not be generated. Try again.");
}

async function resolveAssetPayload(
  adminSupabase: SupabaseClient,
  references: ReferenceMaps,
  input: AssetInput,
  reservedCodes: Set<string>,
) {
  const name = input.name.trim();
  const serialNumber = normalizedSerialNumber(input.serialNumber);
  const locationName = input.locationName.trim();
  const departmentName = input.departmentName.trim();
  const explicitCode = input.code?.trim().toUpperCase() ?? "";

  if (!name) {
    throw new Error("Asset name is required.");
  }

  if (!locationName) {
    throw new Error("Location is required.");
  }

  if (!departmentName) {
    throw new Error("Department is required.");
  }

  const locationId = references.locationIdsByName.get(normalizeLookup(locationName));
  if (!locationId) {
    throw new Error(`Unknown location: ${locationName}`);
  }

  const departmentId = references.departmentIdsByName.get(normalizeLookup(departmentName));
  if (!departmentId) {
    throw new Error(`Unknown department: ${departmentName}`);
  }

  let code = explicitCode;
  if (code) {
    if (reservedCodes.has(code) || (await codeExists(adminSupabase, code))) {
      throw new Error(`Asset code already exists: ${code}`);
    }
    reservedCodes.add(code);
  } else {
    code = await generateAssetCode(
      adminSupabase,
      {
        name,
        departmentName,
        locationName,
      },
      reservedCodes,
    );
  }

  return {
    name,
    serialNumber,
    locationName,
    departmentName,
    locationId,
    departmentId,
    code,
  };
}

export async function createAssetRecord(input: AssetInput, action: "asset_create" | "asset_import", note: string) {
  const context = await loadReferenceMaps();
  if (!("adminSupabase" in context) || !("currentUser" in context) || !("references" in context)) {
    return context;
  }

  const { adminSupabase, currentUser, references } = context as AdminAssetContext;
  const reservedCodes = new Set<string>();
  const payload = await resolveAssetPayload(adminSupabase, references, input, reservedCodes);

  const { data: createdAsset, error: createError } = await adminSupabase
    .from("assets")
    .insert({
      name: payload.name,
      serial_number: payload.serialNumber,
      code: payload.code,
      tag: payload.code,
      current_location_id: payload.locationId,
      department_id: payload.departmentId,
      current_holder: null,
      status: "available",
      state: "available",
    })
    .select("id, name, code, serial_number")
    .single();

  if (createError) {
    return { error: createError.message, status: 400 as const };
  }

  const { error: historyError } = await adminSupabase.from("asset_history").insert({
    asset_id: createdAsset.id,
    action,
    notes: note,
    performed_by: currentUser.id,
  });

  if (historyError) {
    return { error: historyError.message, status: 400 as const };
  }

  return {
    asset: {
      id: createdAsset.id,
      name: createdAsset.name ?? payload.name,
      code: createdAsset.code ?? payload.code,
      serialNumber: createdAsset.serial_number ?? payload.serialNumber,
      locationName: payload.locationName,
      departmentName: payload.departmentName,
    },
  };
}

export async function previewOrImportRows(input: {
  rows: AssetImportRow[];
  mapping: AssetImportMapping;
  dryRun: boolean;
}) {
  const context = await loadReferenceMaps();
  if (!("adminSupabase" in context) || !("currentUser" in context) || !("references" in context)) {
    return context;
  }

  const { adminSupabase, currentUser, references } = context as AdminAssetContext;
  const reservedCodes = new Set<string>();
  const results: AssetImportResult[] = [];

  for (let index = 0; index < input.rows.length; index += 1) {
    const row = input.rows[index] ?? {};
    const mappedName = row[input.mapping.name] ?? "";
    const mappedSerial = row[input.mapping.serial_number] ?? "";
    const mappedLocation = row[input.mapping.location] ?? "";
    const mappedDepartment = row[input.mapping.department] ?? "";
    const mappedCode = input.mapping.code ? row[input.mapping.code] ?? "" : "";

    try {
      const payload = await resolveAssetPayload(
        adminSupabase,
        references,
        {
          name: mappedName,
          serialNumber: mappedSerial,
          locationName: mappedLocation,
          departmentName: mappedDepartment,
          code: mappedCode,
        },
        reservedCodes,
      );

      if (input.dryRun) {
        results.push({
          rowNumber: index + 2,
          name: payload.name,
          serialNumber: payload.serialNumber,
          location: payload.locationName,
          department: payload.departmentName,
          finalCode: payload.code,
          result: "ready",
        });
        continue;
      }

      const { data: createdAsset, error: createError } = await adminSupabase
        .from("assets")
        .insert({
          name: payload.name,
          serial_number: payload.serialNumber,
          code: payload.code,
          tag: payload.code,
          current_location_id: payload.locationId,
          department_id: payload.departmentId,
          current_holder: null,
          status: "available",
          state: "available",
        })
        .select("id")
        .single();

      if (createError) {
        results.push({
          rowNumber: index + 2,
          name: payload.name,
          serialNumber: payload.serialNumber,
          location: payload.locationName,
          department: payload.departmentName,
          finalCode: payload.code,
          result: "skipped",
          reason: createError.message,
        });
        continue;
      }

      const { error: historyError } = await adminSupabase.from("asset_history").insert({
        asset_id: createdAsset.id,
        action: "asset_import",
        notes: "Imported via Asset Intake",
        performed_by: currentUser.id,
      });

      if (historyError) {
        results.push({
          rowNumber: index + 2,
          name: payload.name,
          serialNumber: payload.serialNumber,
          location: payload.locationName,
          department: payload.departmentName,
          finalCode: payload.code,
          result: "skipped",
          reason: historyError.message,
        });
        continue;
      }

      results.push({
        rowNumber: index + 2,
        name: payload.name,
        serialNumber: payload.serialNumber,
        location: payload.locationName,
        department: payload.departmentName,
        finalCode: payload.code,
        result: "created",
      });
    } catch (error) {
      results.push({
        rowNumber: index + 2,
        name: mappedName.trim(),
        serialNumber: normalizedSerialNumber(mappedSerial),
        location: mappedLocation.trim(),
        department: mappedDepartment.trim(),
        finalCode: mappedCode.trim().toUpperCase() || null,
        result: "skipped",
        reason: error instanceof Error ? error.message : "This row could not be prepared.",
      });
    }
  }

  const readyCount = results.filter((row) => row.result === "ready").length;
  const createdCount = results.filter((row) => row.result === "created").length;
  const skippedCount = results.filter((row) => row.result === "skipped").length;

  return {
    rows: results,
    summary: {
      total: results.length,
      ready: readyCount,
      created: createdCount,
      skipped: skippedCount,
    },
  };
}
