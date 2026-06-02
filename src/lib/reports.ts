import type { SupabaseClient } from "@supabase/supabase-js";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";

export type ReportType = "damage" | "asset_history" | "accountability";

export type ReportWorkspace = {
  columns: string[];
  rows: Array<Record<string, string>>;
  source: "live" | "fallback";
  warnings: string[];
};

type AssetRow = {
  id: string;
  code: string | null;
  name: string | null;
  current_location_id: string | null;
  current_holder?: string | null;
  department_id?: string | null;
  status?: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  surname: string | null;
  full_name?: string | null;
};

type LocationRow = {
  id: string;
  name: string;
};

type DepartmentRow = {
  id: string;
  name: string;
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
  return [profile?.display_name?.trim(), profile?.surname?.trim()].filter(Boolean).join(" ") || profile?.full_name?.trim() || "Unknown user";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

async function loadReferenceMaps(
  supabase: SupabaseClient,
  {
    profileIds,
    locationIds,
    departmentIds,
  }: {
    profileIds: string[];
    locationIds: string[];
    departmentIds: string[];
  },
) {
  const [profilesResult, locationsResult, departmentsResult] = await Promise.all([
    profileIds.length > 0 ? supabase.from("profiles").select("id, display_name, surname, full_name").in("id", profileIds) : Promise.resolve({ data: [], error: null }),
    locationIds.length > 0 ? supabase.from("locations").select("id, name").in("id", locationIds) : Promise.resolve({ data: [], error: null }),
    departmentIds.length > 0 ? supabase.from("departments").select("id, name").in("id", departmentIds) : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (locationsResult.error) throw locationsResult.error;
  if (departmentsResult.error) throw departmentsResult.error;

  return {
    profiles: Object.fromEntries(((profilesResult.data ?? []) as ProfileRow[]).map((row) => [row.id, formatProfileName(row)])),
    locations: Object.fromEntries(((locationsResult.data ?? []) as LocationRow[]).map((row) => [row.id, row.name])),
    departments: Object.fromEntries(((departmentsResult.data ?? []) as DepartmentRow[]).map((row) => [row.id, row.name])),
  };
}

async function loadDamageReport(supabase: SupabaseClient, locationId: string | null): Promise<ReportWorkspace> {
  try {
    const { data, error } = await supabase
      .from("damage_cases")
      .select("id, asset_id, responsible_user_id, status, user_statement, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const rows = (data ?? []) as Array<{
      id: string;
      asset_id: string | null;
      responsible_user_id: string | null;
      status: string | null;
      user_statement: string | null;
      created_at: string | null;
    }>;

    const assetIds = [...new Set(rows.map((row) => row.asset_id).filter(Boolean))] as string[];
    const profileIds = [...new Set(rows.map((row) => row.responsible_user_id).filter(Boolean))] as string[];

    const { data: assetData, error: assetError } = assetIds.length > 0
      ? await supabase.from("assets").select("id, code, name, current_location_id").in("id", assetIds)
      : { data: [], error: null };
    if (assetError) throw assetError;

    const assets = (assetData ?? []) as AssetRow[];
    const locationIds = [...new Set(assets.map((row) => row.current_location_id).filter(Boolean))] as string[];
    const maps = await loadReferenceMaps(supabase, { profileIds, locationIds, departmentIds: [] });
    const assetMap = Object.fromEntries(assets.map((row) => [row.id, row]));

    const filtered = rows.filter((row) => {
      if (!locationId) return true;
      return row.asset_id ? assetMap[row.asset_id]?.current_location_id === locationId : false;
    });

    return {
      columns: ["Opened", "Asset Tag", "Asset Name", "Location", "Responsible User", "Status", "Statement"],
      rows: filtered.map((row) => {
        const asset = row.asset_id ? assetMap[row.asset_id] : undefined;
        return {
          Opened: formatDateTime(row.created_at),
          "Asset Tag": asset?.code ?? "No tag",
          "Asset Name": asset?.name ?? "Unknown asset",
          Location: asset?.current_location_id ? maps.locations[asset.current_location_id] ?? "Unknown location" : "No location",
          "Responsible User": row.responsible_user_id ? maps.profiles[row.responsible_user_id] ?? "Unknown user" : "Unknown user",
          Status: row.status ?? "Open",
          Statement: row.user_statement?.trim() || "-",
        };
      }),
      source: "live",
      warnings: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Damage report could not be loaded.";
    if (!isMissingSchemaError(message)) throw error;
  }

  const { data, error } = await supabase
    .from("damage_reports")
    .select("asset_code, asset_name, created_at, status, damage_type, description")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  return {
    columns: ["Opened", "Asset Tag", "Asset Name", "Status", "Type", "Description"],
    rows: ((data ?? []) as Array<{
      asset_code: string | null;
      asset_name: string | null;
      created_at: string | null;
      status: string | null;
      damage_type: string | null;
      description: string | null;
    }>).map((row) => ({
      Opened: formatDateTime(row.created_at),
      "Asset Tag": row.asset_code ?? "No tag",
      "Asset Name": row.asset_name ?? "Unknown asset",
      Status: row.status ?? "Open",
      Type: row.damage_type?.trim() || "-",
      Description: row.description?.trim() || "-",
    })),
    source: "fallback",
    warnings: ["Damage report is loading from the legacy damage-report surface because damage cases are not fully available."],
  };
}

async function loadAssetHistoryReport(supabase: SupabaseClient, locationId: string | null): Promise<ReportWorkspace> {
  const { data, error } = await supabase
    .from("asset_history")
    .select("asset_id, action, notes, performed_by, created_at")
    .order("created_at", { ascending: false })
    .limit(150);
  if (error) throw error;

  const historyRows = (data ?? []) as Array<{
    asset_id: string;
    action: string | null;
    notes: string | null;
    performed_by: string | null;
    created_at: string;
  }>;

  const assetIds = [...new Set(historyRows.map((row) => row.asset_id).filter(Boolean))] as string[];
  const profileIds = [...new Set(historyRows.map((row) => row.performed_by).filter(Boolean))] as string[];

  const { data: assetData, error: assetError } = assetIds.length > 0
    ? await supabase.from("assets").select("id, code, name, current_location_id").in("id", assetIds)
    : { data: [], error: null };
  if (assetError) throw assetError;

  const assets = (assetData ?? []) as AssetRow[];
  const locationIds = [...new Set(assets.map((row) => row.current_location_id).filter(Boolean))] as string[];
  const maps = await loadReferenceMaps(supabase, { profileIds, locationIds, departmentIds: [] });
  const assetMap = Object.fromEntries(assets.map((row) => [row.id, row]));

  const filtered = historyRows.filter((row) => {
    if (!locationId) return true;
    return assetMap[row.asset_id]?.current_location_id === locationId;
  });

  return {
    columns: ["Occurred", "Asset Tag", "Asset Name", "Location", "Action", "Performed By", "Notes"],
    rows: filtered.map((row) => {
      const asset = assetMap[row.asset_id];
      return {
        Occurred: formatDateTime(row.created_at),
        "Asset Tag": asset?.code ?? "No tag",
        "Asset Name": asset?.name ?? "Unknown asset",
        Location: asset?.current_location_id ? maps.locations[asset.current_location_id] ?? "Unknown location" : "No location",
        Action: row.action ?? "update",
        "Performed By": row.performed_by ? maps.profiles[row.performed_by] ?? "Unknown user" : "System",
        Notes: row.notes?.trim() || "-",
      };
    }),
    source: "live",
    warnings: [],
  };
}

async function loadAccountabilityReport(supabase: SupabaseClient, locationId: string | null): Promise<ReportWorkspace> {
  const query = supabase
    .from("assets")
    .select("id, code, name, current_location_id, current_holder, department_id, status")
    .not("current_holder", "is", null)
    .order("name");
  const { data, error } = locationId ? await query.eq("current_location_id", locationId) : await query;
  if (error) throw error;

  const assets = (data ?? []) as AssetRow[];
  const profileIds = [...new Set(assets.map((row) => row.current_holder).filter(Boolean))] as string[];
  const locationIds = [...new Set(assets.map((row) => row.current_location_id).filter(Boolean))] as string[];
  const departmentIds = [...new Set(assets.map((row) => row.department_id).filter(Boolean))] as string[];
  const maps = await loadReferenceMaps(supabase, { profileIds, locationIds, departmentIds });

  return {
    columns: ["Asset Tag", "Asset Name", "Holder", "Location", "Department", "Status"],
    rows: assets.map((row) => ({
      "Asset Tag": row.code ?? "No tag",
      "Asset Name": row.name ?? "Unknown asset",
      Holder: row.current_holder ? maps.profiles[row.current_holder] ?? "Unknown user" : "Unassigned",
      Location: row.current_location_id ? maps.locations[row.current_location_id] ?? "Unknown location" : "No location",
      Department: row.department_id ? maps.departments[row.department_id] ?? "Unknown department" : "No department",
      Status: row.status ?? "Unknown",
    })),
    source: "live",
    warnings: [],
  };
}

export async function loadReportWorkspace(
  supabase: SupabaseClient,
  input: {
    type: ReportType;
    locationId: string | null;
  },
): Promise<ReportWorkspace> {
  if (input.type === "damage") return loadDamageReport(supabase, input.locationId);
  if (input.type === "asset_history") return loadAssetHistoryReport(supabase, input.locationId);
  return loadAccountabilityReport(supabase, input.locationId);
}

function escapeCsv(value: string) {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replaceAll("\"", "\"\"")}"`;
  }
  return value;
}

export function buildCsv(columns: string[], rows: Array<Record<string, string>>) {
  const header = columns.map(escapeCsv).join(",");
  const lines = rows.map((row) => columns.map((column) => escapeCsv(row[column] ?? "")).join(","));
  return [header, ...lines].join("\n");
}

export function exportXlsxReport(
  filename: string,
  columns: string[],
  rows: Array<Record<string, string>>,
) {
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: columns });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  XLSX.writeFileXLSX(workbook, filename);
}

export function exportPdfReport(
  filename: string,
  title: string,
  columns: string[],
  rows: Array<Record<string, string>>,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const usableWidth = pageWidth - margin * 2;
  const colWidth = usableWidth / Math.max(columns.length, 1);
  const lineHeight = 5;
  const maxY = pageHeight - margin;

  let y = margin;
  doc.setFontSize(16);
  doc.text(title, margin, y);
  y += 8;

  const drawHeader = () => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    columns.forEach((column, index) => {
      doc.text(column, margin + index * colWidth, y, { maxWidth: colWidth - 1 });
    });
    y += lineHeight + 1;
    doc.setDrawColor(180);
    doc.line(margin, y - 2, pageWidth - margin, y - 2);
    doc.setFont("helvetica", "normal");
  };

  drawHeader();

  rows.forEach((row) => {
    const wrappedColumns = columns.map((column) =>
      doc.splitTextToSize(row[column] || "-", colWidth - 1),
    );
    const rowHeight = Math.max(...wrappedColumns.map((lines) => lines.length), 1) * lineHeight;

    if (y + rowHeight > maxY) {
      doc.addPage();
      y = margin;
      doc.setFontSize(16);
      doc.text(title, margin, y);
      y += 8;
      drawHeader();
    }

    wrappedColumns.forEach((lines, index) => {
      doc.text(lines, margin + index * colWidth, y, { maxWidth: colWidth - 1 });
    });
    y += rowHeight;
  });

  doc.save(filename);
}
