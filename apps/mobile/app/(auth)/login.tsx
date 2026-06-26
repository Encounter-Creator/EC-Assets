import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { ActionButton, Card, Field, Pill, Screen } from "@mobile/components/Screen";
import { useAuth } from "@mobile/contexts/auth-context";

type Mode = "sign_in" | "sign_up" | "reset";

export default function LoginScreen() {
  const { authStatus, isConfigured, signIn, signUp, requestPasswordReset } = useAuth();
  const [mode, setMode] = useState<Mode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authStatus === "signed_in") {
      setFeedback(null);
    }
  }, [authStatus]);

  if (!isConfigured) {
    return (
      <Screen
        kicker="Auth setup"
        title="Supabase not configured"
        subtitle="Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY for mobile auth."
      >
        <Card>
          <Text style={{ color: "#a8c0b4", lineHeight: 20 }}>
            The Expo app is wired to the same Supabase backend as web, but it needs mobile-exposed environment variables before sign in will work.
          </Text>
        </Card>
      </Screen>
    );
  }

  if (authStatus === "signed_in") {
    return <Redirect href="/dashboard" />;
  }

  const submit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setFeedback("Enter your email address.");
      return;
    }

    setBusy(true);
    setFeedback(null);

    try {
      if (mode === "sign_in") {
        const { error } = await signIn(normalizedEmail, password);
        setFeedback(error ?? "Signed in.");
        return;
      }

      if (mode === "sign_up") {
        const { error, requiresEmailConfirmation } = await signUp(normalizedEmail, password);
        setFeedback(error ?? (requiresEmailConfirmation ? "Account created. Check your email to confirm sign-up." : "Account created."));
        return;
      }

      const { error } = await requestPasswordReset(normalizedEmail);
      setFeedback(error ?? "Password reset link sent.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      kicker="Operator access"
      title="Assets App"
      subtitle="Sign in to reach the same approvals, inventory, requests, and scanning workflows on mobile."
    >
      <Card>
        <View style={{ gap: 8, flexDirection: "row", flexWrap: "wrap" }}>
          <Pill label={mode === "sign_in" ? "Sign in" : "Sign in available"} />
          <Pill label={mode === "sign_up" ? "Create account" : "Create account"} />
          <Pill label={mode === "reset" ? "Reset password" : "Reset password"} />
        </View>

        <Field label="Email" value={email} onChangeText={setEmail} placeholder="name@domain.com" />
        {mode !== "reset" ? (
          <Field label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />
        ) : null}

        {feedback ? <Text style={{ color: "#a8c0b4", lineHeight: 20 }}>{feedback}</Text> : null}

        <ActionButton label={busy ? "Working..." : mode === "sign_in" ? "Sign In" : mode === "sign_up" ? "Create Account" : "Send Reset Link"} onPress={() => void submit()} disabled={busy} />

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <ActionButton label="Sign In Mode" onPress={() => setMode("sign_in")} tone="secondary" />
          <ActionButton label="Sign Up Mode" onPress={() => setMode("sign_up")} tone="secondary" />
          <ActionButton label="Reset Mode" onPress={() => setMode("reset")} tone="secondary" />
        </View>
      </Card>
    </Screen>
  );
}
