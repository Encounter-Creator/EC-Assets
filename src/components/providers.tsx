"use client";

import { type ReactNode } from "react";

import { AuthProvider } from "@/contexts/auth-context";
import { LocationScopeProvider } from "@/contexts/location-scope-context";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <LocationScopeProvider>{children}</LocationScopeProvider>
    </AuthProvider>
  );
}
