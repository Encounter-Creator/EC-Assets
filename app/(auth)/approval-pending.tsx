import { Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";

import { useAuth } from "../../src/providers/AuthProvider";

export default function ApprovalPendingScreen() {
  const { user, signOut } = useAuth();

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (user.approved) {
    return <Redirect href="/dashboard" />;
  }

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.kicker}>Approval Pending</Text>
        <Text style={styles.title}>Your account is waiting for admin approval.</Text>
        <Text style={styles.body}>Admins should receive in-app, push, and email notifications when new accounts are created.</Text>
        <Pressable onPress={() => void signOut()} style={styles.button}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#06110d", justifyContent: "center", padding: 20 },
  card: { borderRadius: 24, backgroundColor: "#0d1c16", borderWidth: 1, borderColor: "#173225", padding: 22, gap: 12 },
  kicker: { color: "#52d485", textTransform: "uppercase", fontWeight: "800", letterSpacing: 2 },
  title: { color: "#f6fff9", fontSize: 28, fontWeight: "800" },
  body: { color: "#89a995", lineHeight: 20 },
  button: { backgroundColor: "#173225", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  buttonText: { color: "#f6fff9", fontWeight: "700" },
});
