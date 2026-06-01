import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect, router } from "expo-router";

import { useLiveDamageLock } from "../../src/hooks/useLiveDamageLock";
import { isSupabaseEnabled } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";

export default function DamageLockScreen() {
  const { user, completeDamageForm } = useAuth();
  const { activeCase, loadingCase, submitDamage, submitting } = useLiveDamageLock();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (!user.locked) {
    return <Redirect href="/dashboard" />;
  }

  const onSubmit = async () => {
    if (!note.trim()) {
      setError("Describe what happened before submitting.");
      return;
    }

    setError(null);

    if (isSupabaseEnabled) {
      if (!activeCase) {
        setError(loadingCase ? "Loading damage case..." : "No active damage case was found for this user.");
        return;
      }

      try {
        await submitDamage({ caseId: activeCase.id, statement: note.trim() });
        await completeDamageForm();
        router.replace("/dashboard");
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Damage form submission failed.");
      }

      return;
    }

    await completeDamageForm();
    router.replace("/dashboard");
  };

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.kicker}>Damage Lock</Text>
        <Text style={styles.title}>Access paused until the damage form is submitted.</Text>
        <Text style={styles.body}>Submitting this user form should auto-unlock before final manager or admin asset resolution.</Text>
        {isSupabaseEnabled ? (
          <Text style={styles.caseText}>
            {activeCase ? `Active case ${activeCase.asset_id.slice(0, 8)} / ${activeCase.status}` : loadingCase ? "Loading active damage case..." : "Active damage case not found."}
          </Text>
        ) : null}
        <TextInput value={note} onChangeText={setNote} placeholder="Describe what happened" placeholderTextColor="#6f8b79" multiline style={styles.input} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          onPress={() => void onSubmit()}
          style={[styles.button, submitting && styles.buttonDisabled]}
          disabled={submitting}
        >
          <Text style={styles.buttonText}>{submitting ? "Submitting..." : "Submit Damage Form"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#25090c", justifyContent: "center", padding: 20 },
  card: { borderRadius: 24, backgroundColor: "#341014", borderWidth: 1, borderColor: "#7f1d1d", padding: 22, gap: 12 },
  kicker: { color: "#fca5a5", textTransform: "uppercase", fontWeight: "800", letterSpacing: 2 },
  title: { color: "#fff1f2", fontSize: 28, fontWeight: "800" },
  body: { color: "#fecdd3", lineHeight: 20 },
  caseText: { color: "#fecaca", lineHeight: 20, fontWeight: "700" },
  input: { minHeight: 120, borderRadius: 16, borderWidth: 1, borderColor: "#7f1d1d", backgroundColor: "#22090d", color: "#fff1f2", padding: 14, textAlignVertical: "top" },
  error: { color: "#fecaca", fontWeight: "700" },
  button: { backgroundColor: "#ef4444", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#fff", fontWeight: "800" },
});
