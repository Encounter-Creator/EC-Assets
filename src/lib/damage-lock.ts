import type { SupabaseClient } from "@supabase/supabase-js";

export type DamageLockCase = {
  id: string;
  assetId: string | null;
  assetTag: string;
  assetName: string;
  locationName: string | null;
  status: string;
  openedAt: string | null;
  userStatement: string | null;
};

type DamageCaseRow = {
  id: string;
  asset_id: string | null;
  status: string | null;
  user_statement: string | null;
  created_at: string | null;
};

type AssetRow = {
  id: string;
  code?: string | null;
  tag?: string | null;
  name: string | null;
  current_location_id?: string | null;
};

type LocationRow = {
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

function isBlockingDamageStatus(status: string | null | undefined) {
  const normalized = String(status ?? "").trim().toLowerCase();
  return normalized === "locked" || normalized === "form pending";
}

export async function loadActiveDamageLockCase(supabase: SupabaseClient, userId: string): Promise<DamageLockCase | null> {
  try {
    const { data, error } = await supabase
      .from("damage_cases")
      .select("id, asset_id, status, user_statement, created_at")
      .eq("responsible_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    const activeCase = ((data ?? []) as DamageCaseRow[]).find((row) => isBlockingDamageStatus(row.status));
    if (!activeCase) return null;

    let assetTag = "No tag";
    let assetName = "Damage case";
    let locationName: string | null = null;

    if (activeCase.asset_id) {
      const { data: assetData, error: assetError } = await supabase
        .from("assets")
        .select("id, code, tag, name, current_location_id")
        .eq("id", activeCase.asset_id)
        .maybeSingle();

      if (assetError) throw assetError;

      const asset = assetData as AssetRow | null;
      assetTag = asset?.code ?? asset?.tag ?? "No tag";
      assetName = asset?.name ?? "Unnamed asset";

      if (asset?.current_location_id) {
        const { data: locationData, error: locationError } = await supabase
          .from("locations")
          .select("id, name")
          .eq("id", asset.current_location_id)
          .maybeSingle();

        if (locationError) throw locationError;
        locationName = (locationData as LocationRow | null)?.name ?? null;
      }
    }

    return {
      id: activeCase.id,
      assetId: activeCase.asset_id,
      assetTag,
      assetName,
      locationName,
      status: activeCase.status ?? "Locked",
      openedAt: activeCase.created_at,
      userStatement: activeCase.user_statement ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Damage lock lookup failed.";
    if (isMissingSchemaError(message)) {
      return null;
    }
    throw error;
  }
}

export async function submitDamageLockStatement(
  supabase: SupabaseClient,
  input: {
    caseId: string;
    statement: string;
  },
) {
  const trimmedStatement = input.statement.trim();
  if (!trimmedStatement) {
    throw new Error("Enter the damage statement before submitting.");
  }

  return supabase
    .from("damage_cases")
    .update({
      user_statement: trimmedStatement,
      status: "Form Submitted",
    })
    .eq("id", input.caseId);
}
