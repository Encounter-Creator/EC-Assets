export const ASSET_STATUSES = ["available", "assigned", "traveling", "stationed", "damaged"] as const;

export type CoreAssetStatus = (typeof ASSET_STATUSES)[number];
export type AssetStatus = CoreAssetStatus | (string & {});

export const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  assigned: "Assigned",
  traveling: "Traveling",
  stationed: "Stationed",
  damaged: "Damaged",
  signed_out: "Assigned",
  permanent: "Traveling",
  out_for_repairs: "Damaged",
};

export const STATUS_BADGE_CLASSES: Record<string, string> = {
  available: "border-primary/35 bg-primary/12 text-primary",
  assigned: "border-amber-500/35 bg-amber-500/12 text-amber-300",
  traveling: "border-violet-500/35 bg-violet-500/12 text-violet-300",
  stationed: "border-sky-500/35 bg-sky-500/12 text-sky-300",
  damaged: "border-rose-500/35 bg-rose-500/12 text-rose-300",
};

export function normalizeAssetStatus(status: string): CoreAssetStatus {
  const normalized = (status ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["signed_out", "sign_out", "checked_out", "in_handover"].includes(normalized)) return "assigned";
  if (["permanent", "permanent_assignment", "permanently_assigned"].includes(normalized)) return "traveling";
  if (["out_for_repair", "out_for_repairs", "repair", "repairs", "maintenance", "lost"].includes(normalized)) return "damaged";
  if (normalized === "stationed") return "stationed";
  if (normalized === "traveling") return "traveling";
  if (normalized === "damaged") return "damaged";
  if (normalized === "assigned") return "assigned";
  return "available";
}

export function getAssetStatusLabel(status: string) {
  const normalizedStatus = normalizeAssetStatus(status);
  return STATUS_LABELS[normalizedStatus] ?? normalizedStatus;
}

export function getStatusBadgeClass(status: string) {
  return STATUS_BADGE_CLASSES[normalizeAssetStatus(status)] ?? "border-primary/20 bg-primary/8 text-primary";
}

export type GroupedAsset<T> = {
  key: string;
  name: string;
  items: T[];
  totalUnits: number;
  counts: Record<(typeof ASSET_STATUSES)[number], number>;
  locationSummary: string;
};

function summarizeLocationNames(names: Array<string | null | undefined>, maxVisible = 2) {
  const unique = Array.from(new Set(names.map((name) => (name ?? "").trim()).filter(Boolean)));
  if (unique.length === 0) return "-";
  if (unique.length <= maxVisible) return unique.join(" | ");
  return `${unique.slice(0, maxVisible).join(" | ")} +${unique.length - maxVisible}`;
}

export function groupAssetsByName<T extends { name: string; status: string }>(
  items: T[],
  getLocationName?: (item: T) => string | null | undefined,
) {
  const grouped = new Map<string, GroupedAsset<T>>();

  for (const item of items) {
    const key = item.name.trim().toLowerCase();
    const normalizedStatus = normalizeAssetStatus(item.status);
    const existing = grouped.get(key);

    if (existing) {
      existing.items.push(item);
      existing.totalUnits += 1;
      existing.counts[normalizedStatus] += 1;
      existing.locationSummary = summarizeLocationNames(existing.items.map((entry) => (getLocationName ? getLocationName(entry) : null)));
      continue;
    }

    grouped.set(key, {
      key,
      name: item.name.trim(),
      items: [item],
      totalUnits: 1,
      counts: {
        available: normalizedStatus === "available" ? 1 : 0,
        assigned: normalizedStatus === "assigned" ? 1 : 0,
        traveling: normalizedStatus === "traveling" ? 1 : 0,
        stationed: normalizedStatus === "stationed" ? 1 : 0,
        damaged: normalizedStatus === "damaged" ? 1 : 0,
      },
      locationSummary: summarizeLocationNames([getLocationName ? getLocationName(item) : null]),
    });
  }

  return Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name));
}
