import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Panel } from "../../src/components/Cards";
import { QueueList } from "../../src/components/Lists";
import { RoleGate } from "../../src/components/RoleGate";
import { Screen } from "../../src/components/Screen";
import { ApprovalsTabKey } from "../../src/domain/types";
import { useLiveApprovals } from "../../src/hooks/useLiveApprovals";
import { useSnapshot } from "../../src/hooks/useSnapshot";
import { isSupabaseEnabled } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";

const tabs: ApprovalsTabKey[] = ["Recipient", "Asset Requests", "Special Requests", "Returns", "Damage Locks"];

export default function ApprovalsScreen() {
  const { user } = useAuth();
  const snapshot = useSnapshot(user!.role);
  const { approvals, damageCases, reviewApproval, resolveDamage, reviewingApproval, resolvingDamage } = useLiveApprovals();
  const [tab, setTab] = useState<ApprovalsTabKey>("Recipient");
  const [reviewNotes, setReviewNotes] = useState("");
  const [damageNote, setDamageNote] = useState("");

  const liveApprovalItems = useMemo(() => {
    if (!isSupabaseEnabled) {
      return snapshot.approvals[tab];
    }

    if (tab === "Damage Locks") {
      return (damageCases.data ?? []).map((item) => ({
        id: item.id,
        title: `Damage case ${item.asset_id.slice(0, 8)}`,
        subtitle: `${item.status} / ${item.user_statement ?? "Awaiting user form or resolution"}`,
        status: item.status,
      }));
    }

    const typeMap: Record<Exclude<ApprovalsTabKey, "Damage Locks">, string> = {
      Recipient: "recipient",
      "Asset Requests": "asset_request",
      "Special Requests": "special_request",
      Returns: "return",
    };

    return (approvals.data ?? [])
      .filter((item) => item.approval_type === typeMap[tab as Exclude<ApprovalsTabKey, "Damage Locks">])
      .map((item) => ({
        id: item.id,
        title: `${item.approval_type.replace(/_/g, " ")} approval`,
        subtitle: `${item.status} / ${item.review_notes ?? "Pending review"}`,
        status: item.status,
      }));
  }, [approvals.data, damageCases.data, snapshot.approvals, tab]);

  const firstQueueId = liveApprovalItems[0]?.id ?? null;

  return (
    <RoleGate allow={["admin", "asset_manager"]}>
      <Screen title="Approvals" subtitle="Queue list plus review panel. Inline decisions should be decision-complete in most cases.">
        <View style={styles.tabs}>
          {tabs.map((item) => (
            <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, item === tab && styles.tabActive]}>
              <Text style={[styles.tabText, item === tab && styles.tabTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <Panel title={tab} subtitle={isSupabaseEnabled ? "Live Supabase queue." : "Bulk actions are limited by queue compatibility; Recipient supports reminders only."}>
          <QueueList items={liveApprovalItems} />
        </Panel>

        {tab !== "Damage Locks" ? (
          <Panel title="Review Action" subtitle="Approve, decline, or request changes on the first queue item for this tab.">
            <TextInput placeholder="Review notes" placeholderTextColor="#6f8b79" style={styles.input} value={reviewNotes} onChangeText={setReviewNotes} />
            <View style={styles.actions}>
              <Pressable
                onPress={() => firstQueueId && void reviewApproval({ approvalId: firstQueueId, status: "Approved", reviewNotes })}
                style={[styles.actionButton, styles.approve]}
                disabled={!firstQueueId}
              >
                <Text style={styles.actionText}>{reviewingApproval ? "Working..." : "Approve First"}</Text>
              </Pressable>
              <Pressable
                onPress={() => firstQueueId && void reviewApproval({ approvalId: firstQueueId, status: "Declined", reviewNotes })}
                style={[styles.actionButton, styles.decline]}
                disabled={!firstQueueId}
              >
                <Text style={styles.actionText}>Decline First</Text>
              </Pressable>
              <Pressable
                onPress={() => firstQueueId && void reviewApproval({ approvalId: firstQueueId, status: "Request Changes", reviewNotes })}
                style={[styles.actionButton, styles.change]}
                disabled={!firstQueueId}
              >
                <Text style={styles.actionText}>Request Changes</Text>
              </Pressable>
            </View>
          </Panel>
        ) : (
          <Panel title="Damage Resolution" subtitle="Resolve the first damage case to Available or Damaged.">
            <TextInput placeholder="Condition note" placeholderTextColor="#6f8b79" style={styles.input} value={damageNote} onChangeText={setDamageNote} />
            <View style={styles.actions}>
              <Pressable
                onPress={() => firstQueueId && void resolveDamage({ caseId: firstQueueId, resolvedState: "Available", conditionNote: damageNote })}
                style={[styles.actionButton, styles.approve]}
                disabled={!firstQueueId}
              >
                <Text style={styles.actionText}>{resolvingDamage ? "Working..." : "Resolve Available"}</Text>
              </Pressable>
              <Pressable
                onPress={() => firstQueueId && void resolveDamage({ caseId: firstQueueId, resolvedState: "Damaged", conditionNote: damageNote })}
                style={[styles.actionButton, styles.decline]}
                disabled={!firstQueueId}
              >
                <Text style={styles.actionText}>Resolve Damaged</Text>
              </Pressable>
            </View>
          </Panel>
        )}
      </Screen>
    </RoleGate>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: "#0f1c16", borderWidth: 1, borderColor: "#173225" },
  tabActive: { backgroundColor: "#173225" },
  tabText: { color: "#8eb39c", fontWeight: "700" },
  tabTextActive: { color: "#f6fff9" },
  input: { borderRadius: 14, borderWidth: 1, borderColor: "#173225", backgroundColor: "#08150f", color: "#f6fff9", paddingHorizontal: 14, paddingVertical: 12 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionButton: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  approve: { backgroundColor: "#24c05a" },
  decline: { backgroundColor: "#ef4444" },
  change: { backgroundColor: "#0ea5e9" },
  actionText: { color: "#03110b", fontWeight: "900" },
});
