import { Redirect } from "expo-router";

import { useAuth } from "../src/providers/AuthProvider";

export default function Index() {
  const { loading, user } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (!user.approved) {
    return <Redirect href="/approval-pending" />;
  }

  if (user.locked) {
    return <Redirect href="/damage-lock" />;
  }

  return <Redirect href="/dashboard" />;
}
