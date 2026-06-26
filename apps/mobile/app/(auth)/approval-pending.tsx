import { Redirect } from "expo-router";
import { useEffect } from "react";
import { Text } from "react-native";

import { ActionButton, Card, Screen } from "@mobile/components/Screen";
import { useAuth } from "@mobile/contexts/auth-context";

export default function ApprovalPendingScreen() {
  const { accessState, authStatus, isApproved, isConfigured, retryAccessLoad } = useAuth();

  useEffect(() => {
    if (!isConfigured || authStatus !== "signed_in" || accessState !== "pending_approval") return;
    const interval = setInterval(() => {
      void retryAccessLoad();
    }, 5000);
    return () => clearInterval(interval);
  }, [accessState, authStatus, isConfigured, retryAccessLoad]);

  if (isApproved) {
    return <Redirect href="/dashboard" />;
  }

  return (
    <Screen
      kicker="Operator queue"
      title="Waiting for approval"
      subtitle="Your account is signed in, but access is still pending. This screen will retry automatically."
    >
      <Card>
        <Text style={{ color: "#a8c0b4", lineHeight: 20 }}>
          Approval is managed from the same backend as the web app. Once your account is approved, the app will route to the mobile dashboard.
        </Text>
        <ActionButton label="Check Again" onPress={() => void retryAccessLoad()} />
      </Card>
    </Screen>
  );
}
