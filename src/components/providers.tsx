"use client";

import { type ReactNode } from "react";

import { AuthProvider } from "@/contexts/auth-context";
import { useAuth } from "@/contexts/auth-context";
import { LocationScopeProvider } from "@/contexts/location-scope-context";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ScopedLocationProviders>{children}</ScopedLocationProviders>
    </AuthProvider>
  );
}

function ScopedLocationProviders({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  return <LocationScopeProvider key={user?.id ?? "anonymous"}>{children}</LocationScopeProvider>;
}
