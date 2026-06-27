import { Redirect, Tabs } from "expo-router";
import { View } from "react-native";

import { useAuth } from "@mobile/contexts/auth-context";

function TabIcon({ filled, color }: { filled: boolean; color: string }) {
  return (
    <View
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: filled ? color : "transparent",
        borderWidth: 1,
        borderColor: color,
      }}
    />
  );
}

export default function TabsLayout() {
  const { authStatus, accessState, loading, isAdmin, isAssetManager, isStaff, isConfigured } = useAuth();

  if (!isConfigured || loading || authStatus === "loading") return null;

  if (authStatus !== "signed_in") return <Redirect href="/login" />;
  if (accessState === "pending_approval") return <Redirect href="/approval-pending" />;
  if (accessState === "damage_locked") return <Redirect href="/damage-lock" />;

  const canUseOperations = isAdmin || isAssetManager;
  const canBrowseInventory = isAdmin || isAssetManager || isStaff;
  const canMakeRequests = isAdmin || isAssetManager || isStaff;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#67e8a0",
        tabBarInactiveTintColor: "#4a6358",
        tabBarStyle: {
          backgroundColor: "#07120c",
          borderTopColor: "#173227",
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, focused }) => <TabIcon filled={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: "Inventory",
          href: canBrowseInventory ? undefined : null,
          tabBarIcon: ({ color, focused }) => <TabIcon filled={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="my-assets"
        options={{
          title: "My Assets",
          tabBarIcon: ({ color, focused }) => <TabIcon filled={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: "Requests",
          href: canMakeRequests ? undefined : null,
          tabBarIcon: ({ color, focused }) => <TabIcon filled={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="approvals"
        options={{
          title: "Approvals",
          href: canUseOperations ? undefined : null,
          tabBarIcon: ({ color, focused }) => <TabIcon filled={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="check-out-in"
        options={{
          title: "Check-in",
          href: canUseOperations ? undefined : null,
          tabBarIcon: ({ color, focused }) => <TabIcon filled={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => <TabIcon filled={focused} color={color} />,
        }}
      />
    </Tabs>
  );
}
