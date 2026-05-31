import { StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { Badge, Panel } from "../../src/components/Cards";
import { DetailRow } from "../../src/components/Lists";
import { Screen } from "../../src/components/Screen";
import { useSnapshot } from "../../src/hooks/useSnapshot";
import { useAuth } from "../../src/providers/AuthProvider";

export default function InventoryScreen() {
  const { user } = useAuth();
  const snapshot = useSnapshot(user!.role);

  return (
    <Screen title="Inventory" subtitle="Grouped catalog first. Top-level filters are Search, Location, Department, Status, and Availability.">
      {snapshot.inventoryGroups.map((group) => (
        <Panel key={group.id} title={group.name} subtitle={`${group.type} • ${group.locations.join(", ")}`} onPress={() => router.push(`/asset/${group.id}` as never)}>
          <View style={styles.badges}>
            <Badge label={`Available ${group.available}`} tone="#22c55e" />
            <Badge label={`Assigned ${group.assigned}`} tone="#3b82f6" />
            <Badge label={`Traveling ${group.traveling}`} tone="#f59e0b" />
            <Badge label={`Damaged ${group.damaged}`} tone="#ef4444" />
          </View>
          <DetailRow label="Units open into" value="Physical asset rows with Tag, Name, Serial, Status, Current Location, Holder" />
        </Panel>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
