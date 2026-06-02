import type { SupabaseClient } from "@supabase/supabase-js";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";

export type QrExportAsset = {
  id: string;
  tag: string;
  name: string;
  createdAt: string | null;
  location: string;
  department: string;
  status: string;
};

async function loadReferenceMaps(
  supabase: SupabaseClient,
  {
    locationIds,
    departmentIds,
  }: {
    locationIds: string[];
    departmentIds: string[];
  },
) {
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

export async function loadQrExportAssets(
  supabase: SupabaseClient,
  input: {
    search: string;
    locationId: string | null;
    departmentId: string | null;
    status: string | null;
    createdFrom: string | null;
    createdTo: string | null;
  },
) {
  let query = supabase
    .from("assets")
    .select("id, code, name, created_at, current_location_id, department_id, status")
    .order("code");

  if (input.locationId) {
    query = query.eq("current_location_id", input.locationId);
  }
  if (input.departmentId) {
    query = query.eq("department_id", input.departmentId);
  }
  if (input.status) {
    query = query.eq("status", input.status);
  }
  if (input.createdFrom) {
    query = query.gte("created_at", new Date(input.createdFrom).toISOString());
  }
  if (input.createdTo) {
    const endOfDay = new Date(`${input.createdTo}T23:59:59.999`);
    query = query.lte("created_at", endOfDay.toISOString());
  }

  const { data, error } = await query.limit(500);
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    id: string;
    code: string | null;
    name: string | null;
    created_at: string | null;
    current_location_id: string | null;
    department_id: string | null;
    status: string | null;
  }>;

  const locationIds = [...new Set(rows.map((row) => row.current_location_id).filter(Boolean))] as string[];
  const departmentIds = [...new Set(rows.map((row) => row.department_id).filter(Boolean))] as string[];
  const maps = await loadReferenceMaps(supabase, { locationIds, departmentIds });
  const search = input.search.trim().toLowerCase();

  return rows
    .map((row) => ({
      id: row.id,
      tag: row.code ?? "No tag",
      name: row.name ?? "Unnamed asset",
      createdAt: row.created_at,
      location: row.current_location_id ? maps.locations[row.current_location_id] ?? "Unknown location" : "No location",
      department: row.department_id ? maps.departments[row.department_id] ?? "Unknown department" : "No department",
      status: row.status ?? "Unknown",
    }))
    .filter((row) => {
      if (!search) return true;
      return [row.tag, row.name, row.location, row.department, row.status].some((part) => part.toLowerCase().includes(search));
    })
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

export async function generateQrExportPdf(
  assets: QrExportAsset[],
  input: {
    labelMm: number;
    pageBorderMm: number;
  },
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = 210;
  const pageHeight = 297;
  const labelSize = input.labelMm;
  const border = input.pageBorderMm;
  const usableWidth = pageWidth - border * 2;
  const usableHeight = pageHeight - border * 2;
  const columns = Math.floor(usableWidth / labelSize);
  const rows = Math.floor(usableHeight / labelSize);
  const labelsPerPage = Math.max(columns * rows, 1);
  const qrSize = Math.max(labelSize - 4, 10);

  doc.setDrawColor(120);

  for (let index = 0; index < assets.length; index += 1) {
    if (index > 0 && index % labelsPerPage === 0) {
      doc.addPage();
    }

    const indexOnPage = index % labelsPerPage;
    const column = indexOnPage % columns;
    const row = Math.floor(indexOnPage / columns);
    const x = border + column * labelSize;
    const y = border + row * labelSize;
    const asset = assets[index];

    if (indexOnPage === 0) {
      doc.rect(border, border, usableWidth, usableHeight);
    }

    const qrDataUrl = await QRCode.toDataURL(asset.id, {
      margin: 0,
      width: 256,
    });

    doc.addImage(qrDataUrl, "PNG", x + 2, y + 1, qrSize - 2, qrSize - 5);
    doc.setFontSize(6);
    doc.text(asset.tag, x + labelSize / 2, y + labelSize - 2, { align: "center", maxWidth: labelSize - 2 });
  }

  doc.save("assets-qr-export.pdf");
}
