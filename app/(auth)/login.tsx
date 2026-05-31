import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect, router } from "expo-router";

import { useAuth } from "../../src/providers/AuthProvider";

type Mode = "signin" | "signup";

export default function LoginScreen() {
  const { loading, user, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user?.approved) {
    return <Redirect href="/dashboard" />;
  }

  if (!loading && user && !user.approved) {
    return <Redirect href="/approval-pending" />;
  }

  const onSubmit = async () => {
    setBusy(true);
    setError(null);

    if (mode === "signin") {
      const result = await signIn(email, password);
      if (!result.ok) {
        setError(result.message ?? "Sign in failed.");
        setBusy(false);
        return;
      }
      router.replace("/dashboard");
      return;
    }

    const result = await signUp({ fullName: name, surname, email, password });
    if (!result.ok) {
      setError(result.message ?? "Sign up failed.");
      setBusy(false);
      return;
    }

    router.replace("/approval-pending");
  };

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Image source={require("../../assets/app-logo.png")} style={styles.logo} />
        <Text style={styles.kicker}>Encounter Assets</Text>
        <Text style={styles.title}>{mode === "signin" ? "Login" : "Create Access"}</Text>
        <Text style={styles.subtitle}>Baseline-first Expo rebuild with push, email, approvals, requests, returns, and damage locks.</Text>
        {mode === "signup" ? (
          <View style={styles.row}>
            <TextInput placeholder="Name" placeholderTextColor="#6f8b79" value={name} onChangeText={setName} style={[styles.input, styles.half]} />
            <TextInput placeholder="Surname" placeholderTextColor="#6f8b79" value={surname} onChangeText={setSurname} style={[styles.input, styles.half]} />
          </View>
        ) : null}
        <TextInput placeholder="Email address" placeholderTextColor="#6f8b79" value={email} onChangeText={setEmail} autoCapitalize="none" style={styles.input} />
        <TextInput placeholder="Password" placeholderTextColor="#6f8b79" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable onPress={() => void onSubmit()} style={styles.primary}>
          <Text style={styles.primaryText}>{busy ? "Working..." : mode === "signin" ? "Sign In" : "Create Account"}</Text>
        </Pressable>
        <Pressable onPress={() => setMode(mode === "signin" ? "signup" : "signin")}>
          <Text style={styles.secondaryText}>{mode === "signin" ? "Create operator access" : "Back to login"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#03110b", justifyContent: "center", padding: 20 },
  card: { borderRadius: 28, borderWidth: 1, borderColor: "#173225", backgroundColor: "#0b1c15", padding: 22, gap: 14 },
  logo: { width: 72, height: 72, alignSelf: "center", borderRadius: 18 },
  kicker: { color: "#52d485", textAlign: "center", textTransform: "uppercase", letterSpacing: 2, fontWeight: "800" },
  title: { color: "#f6fff9", textAlign: "center", fontSize: 30, fontWeight: "800" },
  subtitle: { color: "#89a995", textAlign: "center", lineHeight: 20 },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  input: { borderRadius: 16, borderWidth: 1, borderColor: "#163323", backgroundColor: "#08150f", color: "#f6fff9", paddingHorizontal: 14, paddingVertical: 14 },
  error: { color: "#fda4af", fontWeight: "700" },
  primary: { borderRadius: 16, backgroundColor: "#24c05a", paddingVertical: 14, alignItems: "center" },
  primaryText: { color: "#03110b", fontWeight: "900" },
  secondaryText: { color: "#92dfac", textAlign: "center", fontWeight: "700" },
});
