import { PropsWithChildren, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { registerPushToken } from "../lib/api";
import { registerForPushNotificationsAsync } from "../lib/notifications";
import { AuthProvider } from "./AuthProvider";

const queryClient = new QueryClient();

export function AppProviders({ children }: PropsWithChildren) {
  useEffect(() => {
    registerForPushNotificationsAsync()
      .then((token) => {
        if (token) {
          return registerPushToken(token, Platform.OS);
        }
        return null;
      })
      .catch(() => null);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AuthProvider>{children}</AuthProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
