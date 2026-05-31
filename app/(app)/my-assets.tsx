import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { MY_ASSETS_TABS } from "../../src/domain/mockData";
import { MyAssetsTabKey } from "../../src/domain/types";
import { Panel } from "../../src/components/Cards";
import { QueueList } from "../../src/components/Lists";
import { Screen } from "../../src/components/Screen";
import { useSnapshot } from "../../src/hooks/useSnapshot";
import { useAuth } from "../../src/providers/AuthProvider";

export default function MyAssetsScreen() {
  const { user } = useAuth();
  const snapshot = useSnapshot(user!.role);
  const [tab, setTab] = useState<MyAssetsTabKey>("Assigned");

  return (
    <Screen title="My Assets" subtitle="Action-oriented assigned items, recipient approvals, and damage history.">
      <View style={styles.tabs}>
        {MY_ASSETS_TABS.map((item) => (
          <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabActive]}>
            <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <Panel title={tab}>
        <QueueList items={snapshot.myAssets[tab]} />
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: "#0f1c16", borderWidth: 1, borderColor: "#173225" },
  tabActive: { backgroundColor: "#173225" },
  tabText: { color: "#8eb39c", fontWeight: "700" },
  tabTextActive: { color: "#f6fff9" },
});
