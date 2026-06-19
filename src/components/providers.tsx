"use client";

import { type ReactNode } from "react";

import { AuthProvider } from "@/contexts/auth-context";
import { useAuth } from "@/contexts/auth-context";
import { LocationScopeProvider } from "@/contexts/location-scope-context";
import { ToastProvider } from "@/components/toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <ScopedLocationProviders>{children}</ScopedLocationProviders>
      </AuthProvider>
    </ToastProvider>
  );
}

function ScopedLocationProviders({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  return <LocationScopeProvider key={user?.id ?? "anonymous"}>{children}</LocationScopeProvider>;
}
