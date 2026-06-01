import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { getAssetDetail, listAssetHistory, listInventoryAssets } from "../lib/api";
import { isSupabaseEnabled } from "../lib/supabase";

export function useLiveInventory() {
  const assets = useQuery({
    queryKey: ["inventory-assets"],
    queryFn: listInventoryAssets,
    enabled: isSupabaseEnabled,
  });

  const groupedAssets = useMemo(() => {
    const items = assets.data ?? [];
    const groups = new Map<
      string,
      {
        id: string;
        name: string;
        type: string;
        available: number;
        assigned: number;
        traveling: number;
        damaged: number;
        locations: string[];
      }
    >();

    for (const item of items) {
      const key = `${item.name}::${item.item_type}`;
      const current = groups.get(key) ?? {
        id: item.id,
        name: item.name,
        type: item.item_type,
        available: 0,
        assigned: 0,
        traveling: 0,
        damaged: 0,
        locations: [],
      };

      if (item.state === "Available") current.available += 1;
      if (item.state === "Assigned") current.assigned += 1;
      if (item.state === "Traveling") current.traveling += 1;
      if (item.state === "Damaged") current.damaged += 1;
      if (item.current_location && !current.locations.includes(item.current_location)) {
        current.locations.push(item.current_location);
      }

      groups.set(key, current);
    }

    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name) || a.type.localeCompare(b.type));
  }, [assets.data]);

  return {
    assets,
    groupedAssets,
  };
}

export function useLiveAssetDetail(assetId: string | null) {
  const asset = useQuery({
    queryKey: ["asset-detail", assetId],
    queryFn: () => getAssetDetail(assetId!),
    enabled: isSupabaseEnabled && Boolean(assetId),
  });

  const history = useQuery({
    queryKey: ["asset-history", assetId],
    queryFn: () => listAssetHistory(assetId!),
    enabled: isSupabaseEnabled && Boolean(assetId),
  });

  return {
    asset,
    history,
  };
}
