import { NextResponse } from "next/server";

import { createAssetRecord } from "./helpers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    serialNumber?: string;
    locationName?: string;
    departmentName?: string;
    code?: string;
  };

  const result = await createAssetRecord(
    {
      name: body.name?.trim() ?? "",
      serialNumber: body.serialNumber?.trim() ?? "",
      locationName: body.locationName?.trim() ?? "",
      departmentName: body.departmentName?.trim() ?? "",
      code: body.code?.trim() ?? "",
    },
    "asset_create",
    "Created via Asset Intake",
  );

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    asset: result.asset,
    message: "Asset created.",
  });
}
