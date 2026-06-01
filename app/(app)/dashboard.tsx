import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Panel } from "../../src/components/Cards";
import { Screen } from "../../src/components/Screen";
import { useSnapshot } from "../../src/hooks/useSnapshot";
import { useAuth } from "../../src/providers/AuthProvider";

export default function DashboardScreen() {
  const { user, signOut } = useAuth();
  const snapshot = useSnapshot(user!.role);

  return (
    <Screen
      title="Dashboard"
      subtitle={`${user?.fullName} / ${user?.role.replace("_", " ")} / ${user?.homeBase}`}
      right={
        <Pressable onPress={() => void signOut()}>
          <Text style={{ color: "#92dfac", fontWeight: "700" }}>Sign Out</Text>
        </Pressable>
      }
    >
      <View style={styles.grid}>
        {snapshot.dashboard.topCards[user!.role].map((card) => (
          <Pressable key={card.id} onPress={() => router.push(card.route as never)} style={styles.metric}>
            <Text style={styles.metricValue}>{card.value}</Text>
            <Text style={styles.metricLabel}>{card.label}</Text>
          </Pressable>
        ))}
      </View>

      {snapshot.dashboard.lowerCards[user!.role].map((card) => (
        <Panel key={card.id} title={card.title}>
          {card.rows.map((row) => (
            <Text key={row} style={styles.rowText}>
              {row}
            </Text>
          ))}
        </Panel>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metric: { width: "48%", minWidth: 150, borderRadius: 22, borderWidth: 1, borderColor: "#173225", backgroundColor: "#102119", padding: 16, gap: 10 },
  metricValue: { color: "#f6fff9", fontSize: 28, fontWeight: "900" },
  metricLabel: { color: "#92dfac", fontWeight: "700" },
  rowText: { color: "#d1ead9", lineHeight: 20 },
});
