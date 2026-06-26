import "react-native-url-polyfill/auto";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AppProviders } from "@mobile/providers/AppProviders";

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}
