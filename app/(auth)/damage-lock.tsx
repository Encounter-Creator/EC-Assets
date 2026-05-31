import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect, router } from "expo-router";

import { useAuth } from "../../src/providers/AuthProvider";

export default function DamageLockScreen() {
  const { user, completeDamageForm } = useAuth();
  const [note, setNote] = useState("");

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (!user.locked) {
    return <Redirect href="/dashboard" />;
  }

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.kicker}>Damage Lock</Text>
        <Text style={styles.title}>Access paused until the damage form is submitted.</Text>
        <Text style={styles.body}>Submitting this user form should auto-unlock before final manager or admin asset resolution.</Text>
        <TextInput value={note} onChangeText={setNote} placeholder="Describe what happened" placeholderTextColor="#6f8b79" multiline style={styles.input} />
        <Pressable
          onPress={() => {
            if (!note.trim()) return;
            completeDamageForm();
            router.replace("/dashboard");
          }}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Submit Damage Form</Text>
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
  input: { minHeight: 120, borderRadius: 16, borderWidth: 1, borderColor: "#7f1d1d", backgroundColor: "#22090d", color: "#fff1f2", padding: 14, textAlignVertical: "top" },
  button: { backgroundColor: "#ef4444", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "800" },
});
