import { StyleSheet, Text } from "react-native";

import { Panel } from "../../src/components/Cards";
import { RoleGate } from "../../src/components/RoleGate";
import { Screen } from "../../src/components/Screen";
import { useLiveSettings } from "../../src/hooks/useLiveSettings";
import { isSupabaseEnabled } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";

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
  const { user } = useAuth();
  const live = useLiveSettings();

  const counts: Record<string, string> = {
    Users: isSupabaseEnabled ? String(live.users.data?.length ?? 0) : "Scaffold",
    Roles: "4 fixed roles",
    Locations: isSupabaseEnabled ? String(live.locations.data?.length ?? 0) : "Scaffold",
    Departments: isSupabaseEnabled ? String(live.departments.data?.length ?? 0) : "Scaffold",
    Kits: isSupabaseEnabled ? String(live.kits.data?.length ?? 0) : "Scaffold",
    Consumables: isSupabaseEnabled ? String(live.consumables.data?.length ?? 0) : "Scaffold",
    Reports: "Live schema ready",
    Duplicates: isSupabaseEnabled ? String(live.duplicates.data?.length ?? 0) : "Scaffold",
    Config: isSupabaseEnabled ? String(live.config.data?.length ?? 0) : "Scaffold",
  };

  const details: Record<string, string[]> = {
    Users: isSupabaseEnabled
      ? (live.users.data ?? []).slice(0, 3).map((item) => `${item.full_name} / ${item.role} / ${item.home_base ?? "Unassigned"}`)
      : ["Local fallback mode"],
    Roles: ["admin", "asset_manager", "staff", "volunteer"],
    Locations: isSupabaseEnabled
      ? (live.locations.data ?? []).slice(0, 4).map((item) => `${item.name} / ${item.active ? "Active" : "Inactive"}`)
      : ["Local fallback mode"],
    Departments: isSupabaseEnabled
      ? (live.departments.data ?? []).slice(0, 4).map((item) => `${item.name} / ${item.active ? "Active" : "Inactive"}`)
      : ["Local fallback mode"],
    Kits: isSupabaseEnabled
      ? (live.kits.data ?? []).slice(0, 4).map((item) => `${item.name} / ${item.home_base ?? "No home base"} / ${item.item_count} items`)
      : ["Local fallback mode"],
    Consumables: isSupabaseEnabled
      ? (live.consumables.data ?? []).slice(0, 4).map((item) => `${item.name} / ${item.stock_on_hand} ${item.unit}`)
      : ["Local fallback mode"],
    Reports: ["Damage history", "Asset history", "Accountability exports"],
    Duplicates: isSupabaseEnabled
      ? (live.duplicates.data ?? []).slice(0, 4).map((item) => `${item.primary_asset} / ${item.duplicate_asset} / ${item.status}`)
      : ["Local fallback mode"],
    Config: isSupabaseEnabled
      ? (live.config.data ?? []).slice(0, 4).map((item) => `${item.key} / ${item.description ?? "No description"}`)
      : ["Local fallback mode"],
  };

  const visibleTabs = user?.role === "admin" ? tabs : tabs.filter((tab) => !["Roles", "Duplicates", "Config"].includes(tab));

  return (
    <RoleGate allow={["admin", "asset_manager"]}>
      <Screen title="Settings" subtitle="Role-aware settings surface. Managers have limited operational access only.">
        {visibleTabs.map((tab) => (
          <Panel key={tab} title={tab} subtitle={summaries[tab] ?? "Baseline-defined settings area."}>
            <Text style={styles.count}>{counts[tab]}</Text>
            {(details[tab] ?? []).map((line) => (
              <Text key={`${tab}-${line}`} style={styles.body}>
                {line}
              </Text>
            ))}
          </Panel>
        ))}
      </Screen>
    </RoleGate>
  );
}

const styles = StyleSheet.create({
  count: { color: "#92dfac", fontWeight: "800", fontSize: 18 },
  body: { color: "#d1ead9", lineHeight: 20 },
});
