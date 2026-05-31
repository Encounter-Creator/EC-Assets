import { StyleSheet, Text } from "react-native";

import { Panel } from "../../src/components/Cards";
import { RoleGate } from "../../src/components/RoleGate";
import { Screen } from "../../src/components/Screen";

const tabs = ["Users", "Roles", "Locations", "Departments", "Kits", "Consumables", "Reports", "Duplicates", "Config"];

const summaries: Record<string, string> = {
  Users: "Admins manage full records; managers edit operational fields for local users only.",
  Roles: "Fixed system roles in v1. No custom permissions editor.",
  Locations: "Admins can add, disable, or retire locations and route records to Unassigned.",
  Departments: "Admin-managed create, rename, merge, archive, and organization controls.",
  Kits: "Saved Sunday kit builder with edit and retire flows.",
  Consumables: "Consumable catalog, stock rules, and attachment flows.",
  Reports: "Filtered exports for damage, history, and accountability views.",
  Duplicates: "Admin compare-and-merge queue with tombstone preservation.",
  Config: "Business rules, system toggles, and bulk QR sheet export.",
};

export default function SettingsScreen() {
  return (
    <RoleGate allow={["admin", "asset_manager"]}>
      <Screen title="Settings" subtitle="Role-aware settings surface. Managers have limited operational access only.">
        {tabs.map((tab) => (
          <Panel key={tab} title={tab} subtitle={summaries[tab] ?? "Baseline-defined settings area."}>
            <Text style={styles.body}>This section is scaffolded for the Expo rebuild and maps directly to the baseline module boundaries.</Text>
          </Panel>
        ))}
      </Screen>
    </RoleGate>
  );
}

const styles = StyleSheet.create({
  body: { color: "#d1ead9", lineHeight: 20 },
});
