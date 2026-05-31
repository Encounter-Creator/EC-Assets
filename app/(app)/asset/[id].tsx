import { useLocalSearchParams } from "expo-router";

import { Badge, Panel } from "../../../src/components/Cards";
import { DetailRow, StatusRow } from "../../../src/components/Lists";
import { Screen } from "../../../src/components/Screen";
import { useSnapshot } from "../../../src/hooks/useSnapshot";
import { useAuth } from "../../../src/providers/AuthProvider";

export default function AssetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const snapshot = useSnapshot(user!.role);
  const units = snapshot.assetUnits.filter((unit) => unit.id === id || unit.name.toLowerCase().includes(String(id).toLowerCase()));

  return (
    <Screen title="Asset Detail" subtitle={`Primary action surface after drill-in • ${String(id)}`}>
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
      <Panel title="Recent History">
        <StatusRow title="Sign-out to staff user" subtitle="Recipient approval required" status="Assigned" />
        <StatusRow title="Return accepted" subtitle="Approver-selected final sign-in location" status="Available" />
        <StatusRow title="Damage resolution" subtitle="One-time condition note recorded" status="Damaged" />
      </Panel>
    </Screen>
  );
}
