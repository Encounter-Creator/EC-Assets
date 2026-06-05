import { NextResponse } from "next/server";

import type { AssetImportMapping, AssetImportRow } from "../helpers";
import { previewOrImportRows } from "../helpers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    rows?: AssetImportRow[];
    mapping?: AssetImportMapping;
    dryRun?: boolean;
  };

  const rows = Array.isArray(body.rows) ? body.rows : [];
  const mapping = body.mapping;

  if (!mapping?.name || !mapping.serial_number || !mapping.location || !mapping.department) {
    return NextResponse.json({ error: "Map the required CSV fields before previewing or importing." }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "Upload a CSV with at least one data row." }, { status: 400 });
  }

  const result = await previewOrImportRows({
    rows,
    mapping,
    dryRun: body.dryRun !== false,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    rows: result.rows,
    summary: result.summary,
    message: body.dryRun !== false ? "Import preview generated." : "Asset import completed.",
  });
}
