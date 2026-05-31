import { Tabs } from "expo-router";

import { useAuth } from "../../src/providers/AuthProvider";

export default function AppLayout() {
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "asset_manager";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#08150f",
          borderTopColor: "#173225",
        },
        tabBarActiveTintColor: "#4ade80",
        tabBarInactiveTintColor: "#779483",
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="inventory" options={{ title: "Inventory" }} />
      <Tabs.Screen name="check" options={{ title: "Check-out/In", href: canManage ? undefined : null }} />
      <Tabs.Screen name="my-assets" options={{ title: "My Assets" }} />
      <Tabs.Screen name="requests" options={{ title: "Requests" }} />
      <Tabs.Screen name="approvals" options={{ title: "Approvals", href: canManage ? undefined : null }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", href: canManage ? undefined : null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="asset/[id]" options={{ href: null }} />
    </Tabs>
  );
}
