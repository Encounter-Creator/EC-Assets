import { PropsWithChildren } from "react";
import { Redirect } from "expo-router";

import { AppRole } from "../domain/types";
import { useAuth } from "../providers/AuthProvider";

export function RoleGate({ allow, children }: PropsWithChildren<{ allow: AppRole[] }>) {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (!allow.includes(user.role)) {
    return <Redirect href="/dashboard" />;
  }

  return <>{children}</>;
}
