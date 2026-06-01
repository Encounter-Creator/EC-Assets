import { useMemo } from "react";
import { useLocalSearchParams } from "expo-router";

import { Badge, Panel } from "../../../src/components/Cards";
import { DetailRow, StatusRow } from "../../../src/components/Lists";
import { Screen } from "../../../src/components/Screen";
import { useLiveAssetDetail, useLiveInventory } from "../../../src/hooks/useLiveInventory";
import { useSnapshot } from "../../../src/hooks/useSnapshot";
import { isSupabaseEnabled } from "../../../src/lib/supabase";
import { useAuth } from "../../../src/providers/AuthProvider";

export default function AssetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const snapshot = useSnapshot(user!.role);
  const inventory = useLiveInventory();
  const live = useLiveAssetDetail(id ?? null);

  const fallbackUnits = useMemo(
    () => snapshot.assetUnits.filter((unit) => unit.id === id || unit.name.toLowerCase().includes(String(id).toLowerCase())),
    [id, snapshot.assetUnits],
  );

  const liveUnits = useMemo(() => {
    if (!isSupabaseEnabled) {
      return [];
    }

    if (live.asset.data) {
      return [live.asset.data];
    }

    return (inventory.assets.data ?? []).filter((unit) => unit.id === id || unit.name.toLowerCase().includes(String(id).toLowerCase()));
  }, [id, inventory.assets.data, live.asset.data]);

  const units = isSupabaseEnabled
    ? liveUnits.map((unit) => ({
        id: unit.id,
        tag: unit.tag,
        name: unit.name,
        serial: unit.serial_number,
        status: unit.state,
        currentLocation: unit.current_location ?? "Unknown",
        holder: unit.holder ?? undefined,
        department: unit.department ?? "No department",
        notes: unit.condition_note ?? undefined,
      }))
    : fallbackUnits;

  const historyRows = isSupabaseEnabled
    ? (live.history.data ?? []).map((row) => ({
        title: row.action.replace(/_/g, " "),
        subtitle: `${row.performed_by ?? "System"} / ${row.notes ?? new Date(row.created_at).toLocaleString()}`,
        status: "Available" as const,
      }))
    : [
        { title: "Sign-out to staff user", subtitle: "Recipient approval required", status: "Assigned" as const },
        { title: "Return accepted", subtitle: "Approver-selected final sign-in location", status: "Available" as const },
        { title: "Damage resolution", subtitle: "One-time condition note recorded", status: "Damaged" as const },
      ];

  return (
    <Screen title="Asset Detail" subtitle={`Primary action surface after drill-in / ${String(id)}`}>
      <Panel title="Current State" subtitle="Allowed edits are inline and scoped by role.">
        <DetailRow label="Manager edits" value="Name, Tag, Department/Team only" />
        <DetailRow label="Locked fields" value="Serial number and main notes/description" />
        <DetailRow label="History" value="Recent preview plus full audit trail access" />
      </Panel>
      {units.map((unit) => (
        <Panel key={unit.id} title={unit.name} subtitle={unit.tag}>
          <Badge label={unit.status} tone="#4ade80" />
          <DetailRow label="Serial" value={unit.serial} />
          <DetailRow label="Location" value={unit.currentLocation} />
          <DetailRow label="Holder" value={unit.holder ?? "Unassigned"} />
          <DetailRow label="Department" value={unit.department} />
          {unit.notes ? <DetailRow label="Condition note" value={unit.notes} /> : null}
        </Panel>
      ))}
      <Panel title="Recent History" subtitle={isSupabaseEnabled ? "Live asset history from Supabase." : "Scaffold history preview."}>
        {historyRows.map((row, index) => (
          <StatusRow key={`${row.title}-${index}`} title={row.title} subtitle={row.subtitle} status={row.status} />
        ))}
      </Panel>
    </Screen>
  );
}
