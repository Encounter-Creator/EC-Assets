import type { ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "../contexts/auth-context";
import { LocationScopeProvider } from "../contexts/location-scope-context";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LocationScopeProvider>{children}</LocationScopeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
