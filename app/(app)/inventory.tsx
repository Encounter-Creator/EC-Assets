import { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { Badge, Panel } from "../../src/components/Cards";
import { DetailRow } from "../../src/components/Lists";
import { Screen } from "../../src/components/Screen";
import { useLiveInventory } from "../../src/hooks/useLiveInventory";
import { useSnapshot } from "../../src/hooks/useSnapshot";
import { isSupabaseEnabled } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";

export default function InventoryScreen() {
  const { user } = useAuth();
  const snapshot = useSnapshot(user!.role);
  const live = useLiveInventory();
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const base = isSupabaseEnabled
      ? live.groupedAssets
      : snapshot.inventoryGroups.map((group) => ({
          id: group.id,
          name: group.name,
          type: group.type,
          available: group.available,
          assigned: group.assigned,
          traveling: group.traveling,
          damaged: group.damaged,
          locations: group.locations,
        }));

    const term = search.trim().toLowerCase();
    if (!term) {
      return base;
    }

    return base.filter((group) => group.name.toLowerCase().includes(term) || group.type.toLowerCase().includes(term) || group.locations.some((location) => location.toLowerCase().includes(term)));
  }, [live.groupedAssets, search, snapshot.inventoryGroups]);

  return (
    <Screen title="Inventory" subtitle="Grouped catalog first. Top-level filters are Search, Location, Department, Status, and Availability.">
      <TextInput placeholder="Search item or location" placeholderTextColor="#6f8b79" value={search} onChangeText={setSearch} style={styles.input} />
      {groups.map((group) => (
        <Panel key={`${group.name}-${group.type}`} title={group.name} subtitle={`${group.type} / ${group.locations.join(", ")}`} onPress={() => router.push(`/asset/${group.id}` as never)}>
          <View style={styles.badges}>
            <Badge label={`Available ${group.available}`} tone="#22c55e" />
            <Badge label={`Assigned ${group.assigned}`} tone="#3b82f6" />
            <Badge label={`Traveling ${group.traveling}`} tone="#f59e0b" />
            <Badge label={`Damaged ${group.damaged}`} tone="#ef4444" />
          </View>
          <DetailRow label="Units open into" value="Physical asset rows with Tag, Name, Serial, Status, Current Location, Holder" />
        </Panel>
      ))}
      {groups.length === 0 ? <Text style={styles.empty}>No inventory groups matched the current search.</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { borderRadius: 14, borderWidth: 1, borderColor: "#173225", backgroundColor: "#08150f", color: "#f6fff9", paddingHorizontal: 14, paddingVertical: 12 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  empty: { color: "#89a995", lineHeight: 20 },
});
