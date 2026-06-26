import { Redirect } from "expo-router";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";

import { ActionButton, Card, Screen } from "@mobile/components/Screen";
import { useAuth } from "@mobile/contexts/auth-context";
import { getSupabaseClient } from "@mobile/lib/supabase";
import { submitDamageLockStatement } from "@/lib/damage-lock";

export default function DamageLockScreen() {
  const { damageLockCase, isApproved, signOut, retryAccessLoad } = useAuth();
  const [statement, setStatement] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (isApproved) {
    return <Redirect href="/dashboard" />;
  }

  const submitStatement = async () => {
    if (!damageLockCase) return;
    const supabase = getSupabaseClient();
    if (!supabase) {
      setFeedback("Supabase is not configured.");
      return;
    }

    const trimmed = statement.trim();
    if (!trimmed) {
      setFeedback("Enter a statement before submitting.");
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      await submitDamageLockStatement(supabase, {
        caseId: damageLockCase.id,
        statement: trimmed,
      });
      setFeedback("Statement submitted. Your access will be restored once reviewed.");
      await retryAccessLoad();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Statement submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      kicker="Damage lock"
      title="Action required"
      subtitle="One of your assigned assets has a blocking damage case. Submit your statement to restore access."
    >
      <Card>
        <Text style={{ color: "#f6fff9", fontSize: 18, fontWeight: "700" }}>
          {damageLockCase?.assetTag ?? "Unknown asset"}
        </Text>
        <Text style={{ color: "#a8c0b4", lineHeight: 20 }}>
          {damageLockCase?.assetName ?? "Damage case"}
          {damageLockCase?.locationName ? ` at ${damageLockCase.locationName}` : ""}.
        </Text>
        {damageLockCase?.status ? (
          <Text style={{ color: "#6f8b7e", fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" }}>
            {damageLockCase.status}
          </Text>
        ) : null}
      </Card>

      {damageLockCase?.userStatement ? (
        <Card>
          <Text style={{ color: "#93ac9e", fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" }}>
            Statement on file
          </Text>
          <Text style={{ color: "#8fd7ab", lineHeight: 20 }}>{damageLockCase.userStatement}</Text>
          <Text style={{ color: "#6f8b7e", lineHeight: 18 }}>
            Your statement has been submitted. You will be unlocked once a manager reviews the case.
          </Text>
          <ActionButton label="Check Again" onPress={() => void retryAccessLoad()} tone="secondary" />
        </Card>
      ) : (
        <Card>
          <Text style={{ color: "#f2fbf5", fontSize: 18, fontWeight: "700" }}>Damage statement</Text>
          <Text style={{ color: "#8fa89b", lineHeight: 18 }}>
            Describe what happened to the asset. Be specific about the circumstances.
          </Text>
          <View style={{ gap: 8 }}>
            <TextInput
              value={statement}
              onChangeText={setStatement}
              placeholder="Describe the damage incident..."
              placeholderTextColor="#69817a"
              multiline
              numberOfLines={5}
              style={{
                backgroundColor: "#08150f",
                borderWidth: 1,
                borderColor: "#20382c",
                borderRadius: 16,
                color: "#f6fff9",
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 15,
                minHeight: 110,
                textAlignVertical: "top",
              }}
            />
          </View>
          {feedback ? (
            <Text style={{ color: feedback.startsWith("Statement submitted") ? "#8fd7ab" : "#d7c28a", lineHeight: 20 }}>
              {feedback}
            </Text>
          ) : null}
          <ActionButton
            label={submitting ? "Submitting..." : "Submit Statement"}
            onPress={() => void submitStatement()}
            disabled={submitting}
          />
        </Card>
      )}

      <Card>
        <ActionButton label="Sign Out" onPress={() => void signOut()} tone="danger" />
      </Card>
    </Screen>
  );
}
