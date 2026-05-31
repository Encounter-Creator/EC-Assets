import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { CheckTabKey } from "../../src/domain/types";
import { Panel } from "../../src/components/Cards";
import { RoleGate } from "../../src/components/RoleGate";
import { Screen } from "../../src/components/Screen";

const tabs: CheckTabKey[] = ["Standard", "Permanent", "Stationed", "Sunday Kits", "Returns", "QR Scan"];

const descriptions: Record<CheckTabKey, string> = {
  Standard: "Two-mode sign out/sign in workspace with multi-item processing and direct intake support.",
  Permanent: "Dedicated permanent-assignment flow. Assets stay Traveling until explicit sign-in.",
  Stationed: "Resting-state model. Temporary use assigns a responsible user and can return as Stationed, Available, or Damaged.",
  "Sunday Kits": "Saved kit deployment workspace with partial returns and item-level outcomes.",
  Returns: "Read-only return monitoring surface. Accepted returns auto-sign in from Approvals.",
  "QR Scan": "Single-mode scanning batch for bulk sign in or sign out.",
};

export default function CheckScreen() {
  const [tab, setTab] = useState<CheckTabKey>("Standard");

  return (
    <RoleGate allow={["admin", "asset_manager"]}>
      <Screen title="Check-out/In" subtitle="Manager and admin workspace with Standard as the default tab.">
        <View style={styles.tabs}>
          {tabs.map((item) => (
            <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, item === tab && styles.tabActive]}>
              <Text style={[styles.tabText, item === tab && styles.tabTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <Panel title={tab} subtitle={descriptions[tab]}>
          <TextInput placeholder="Asset / Tag / User lookup" placeholderTextColor="#6f8b79" style={styles.input} />
          <TextInput placeholder="Notes" placeholderTextColor="#6f8b79" style={styles.input} />
          <Text style={styles.note}>This surface is scaffolded for the baseline workflow contract and awaits RPC-backed execution.</Text>
        </Panel>
      </Screen>
    </RoleGate>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: "#0f1c16", borderWidth: 1, borderColor: "#173225" },
  tabActive: { backgroundColor: "#173225" },
  tabText: { color: "#8eb39c", fontWeight: "700" },
  tabTextActive: { color: "#f6fff9" },
  input: { borderRadius: 14, borderWidth: 1, borderColor: "#173225", backgroundColor: "#08150f", color: "#f6fff9", paddingHorizontal: 14, paddingVertical: 12 },
  note: { color: "#89a995", lineHeight: 20 },
});
