import { Pressable, StyleSheet, Text, View } from "react-native";

import { ASSET_STATUS_COLORS } from "../domain/mockData";
import { AssetState, RequestQueueRow } from "../domain/types";
import { Badge } from "./Cards";

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function QueueList({ items }: { items: RequestQueueRow[] }) {
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View key={item.id} style={styles.queueItem}>
          <View style={styles.queueCopy}>
            <Text style={styles.queueTitle}>{item.title}</Text>
            <Text style={styles.queueSubtitle}>{item.subtitle}</Text>
          </View>
          <Badge label={item.status} tone="#38bdf8" />
        </View>
      ))}
    </View>
  );
}

export function StatusRow({
  title,
  subtitle,
  status,
  onPress,
}: {
  title: string;
  subtitle: string;
  status: AssetState;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.queueItem}>
      <View style={styles.queueCopy}>
        <Text style={styles.queueTitle}>{title}</Text>
        <Text style={styles.queueSubtitle}>{subtitle}</Text>
      </View>
      <Badge label={status} tone={ASSET_STATUS_COLORS[status]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  queueItem: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#11231b",
  },
  queueCopy: {
    flex: 1,
    gap: 4,
  },
  queueTitle: {
    color: "#effff3",
    fontSize: 15,
    fontWeight: "700",
  },
  queueSubtitle: {
    color: "#89a995",
    fontSize: 13,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  label: {
    color: "#89a995",
    fontSize: 13,
  },
  value: {
    color: "#f6fff9",
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
  },
});
