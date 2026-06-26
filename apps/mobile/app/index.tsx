import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@mobile/contexts/auth-context";

export default function IndexRoute() {
  const { authStatus, loading, accessState, isConfigured } = useAuth();

  if (!isConfigured || loading || authStatus === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#06110b" }}>
        <ActivityIndicator color="#67e8a0" />
      </View>
    );
  }

  if (authStatus !== "signed_in") {
    return <Redirect href="/login" />;
  }

  if (accessState === "pending_approval") {
    return <Redirect href="/approval-pending" />;
  }

  if (accessState === "damage_locked") {
    return <Redirect href="/damage-lock" />;
  }

  return <Redirect href="/dashboard" />;
}
