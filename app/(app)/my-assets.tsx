import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Badge, Panel } from "../../src/components/Cards";
import { QueueList } from "../../src/components/Lists";
import { MY_ASSETS_TABS } from "../../src/domain/mockData";
import { MyAssetsTabKey } from "../../src/domain/types";
import { useLiveMyAssets } from "../../src/hooks/useLiveMyAssets";
import { useSnapshot } from "../../src/hooks/useSnapshot";
import { isSupabaseEnabled } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { Screen } from "../../src/components/Screen";

export default function MyAssetsScreen() {
  const { user } = useAuth();
  const snapshot = useSnapshot(user!.role);
  const [tab, setTab] = useState<MyAssetsTabKey>("Assigned");
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);
  const [declineReason, setDeclineReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const live = useLiveMyAssets();

  const pendingApprovalRows = useMemo(
    () =>
      (live.pendingApprovals.data ?? []).map((approval) => ({
        id: approval.id,
        title: String(approval.payload.asset_name ?? approval.payload.tag ?? "Pending assignment"),
        subtitle: `${approval.status} / ${String(approval.payload.note ?? "Awaiting your approval")}`,
        status: approval.status,
      })),
    [live.pendingApprovals.data],
  );

  const items = useMemo(() => {
    if (!isSupabaseEnabled) {
      return snapshot.myAssets[tab];
    }

    if (tab === "Assigned") {
      return (live.assignedAssets.data ?? []).map((asset) => ({
        id: asset.id,
        title: `${asset.tag} / ${asset.name}`,
        subtitle: `${asset.serial_number} / ${asset.current_location ?? "Unknown"} / ${asset.department ?? "No department"}`,
        status: asset.state,
      }));
    }

    if (tab === "Pending") {
      return pendingApprovalRows;
    }

    return live.damageCases.data?.map((damageCase) => ({
      id: damageCase.id,
      title: `Damage case ${damageCase.asset_id.slice(0, 8)}`,
      subtitle: `${damageCase.status} / ${damageCase.user_statement ?? damageCase.resolved_state ?? "No statement yet"}`,
      status: damageCase.status,
    })) ?? [];
  }, [live.assignedAssets.data, live.damageCases.data, pendingApprovalRows, snapshot.myAssets, tab]);

  const subtitle = isSupabaseEnabled
    ? tab === "Assigned"
      ? "Live assigned assets currently held by this account."
      : tab === "Pending"
        ? "Recipient approvals awaiting your response."
        : "Damage cases tied to this account, including resolved history."
    : "Action-oriented assigned items, recipient approvals, and damage history.";

  const togglePending = (approvalId: string) => {
    setSelectedPendingIds((current) => (current.includes(approvalId) ? current.filter((id) => id !== approvalId) : [...current, approvalId]));
  };

  const resetPendingSelection = () => {
    setSelectedPendingIds([]);
    setDeclineReason("");
  };

  const submitPendingDecision = async (decision: "Approved" | "Declined") => {
    if (selectedPendingIds.length === 0) {
      setFeedback("Select at least one pending assignment first.");
      return;
    }

    if (decision === "Declined" && !declineReason.trim()) {
      setFeedback("Decline reason is required.");
      return;
    }

    if (!isSupabaseEnabled) {
      setFeedback(`${decision === "Approved" ? "Approved" : "Declined"} ${selectedPendingIds.length} assignment(s) in scaffold mode.`);
      resetPendingSelection();
      return;
    }

    try {
      await live.reviewAssignments({
        approvalIds: selectedPendingIds,
        decision,
        reason: decision === "Declined" ? declineReason.trim() : undefined,
      });
      setFeedback(`${decision === "Approved" ? "Approved" : "Declined"} ${selectedPendingIds.length} assignment(s).`);
      resetPendingSelection();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Recipient review failed.");
    }
  };

  return (
    <Screen title="My Assets" subtitle="Action-oriented assigned items, recipient approvals, and damage history.">
      <View style={styles.tabs}>
        {MY_ASSETS_TABS.map((item) => (
          <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabActive]}>
            <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <Panel title={tab} subtitle={subtitle}>
        {tab === "Pending" ? (
          <>
            <View style={styles.list}>
              {items.map((item) => {
                const selected = selectedPendingIds.includes(item.id);
                return (
                  <Pressable key={item.id} onPress={() => togglePending(item.id)} style={[styles.pendingRow, selected && styles.pendingRowActive]}>
                    <View style={styles.pendingCopy}>
                      <Text style={styles.pendingTitle}>{item.title}</Text>
                      <Text style={styles.pendingSubtitle}>{item.subtitle}</Text>
                    </View>
                    <Badge label={selected ? "Selected" : item.status} tone={selected ? "#4ade80" : "#38bdf8"} />
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              placeholder="Shared decline reason"
              placeholderTextColor="#6f8b79"
              style={styles.input}
              value={declineReason}
              onChangeText={setDeclineReason}
            />
            <View style={styles.actions}>
              <Pressable
                onPress={() => void submitPendingDecision("Approved")}
                style={[styles.actionButton, styles.approveButton, live.reviewingAssignments && styles.actionButtonDisabled]}
                disabled={live.reviewingAssignments}
              >
                <Text style={styles.actionText}>{live.reviewingAssignments ? "Working..." : "Approve Selected"}</Text>
              </Pressable>
              <Pressable
                onPress={() => void submitPendingDecision("Declined")}
                style={[styles.actionButton, styles.declineButton, live.reviewingAssignments && styles.actionButtonDisabled]}
                disabled={live.reviewingAssignments}
              >
                <Text style={styles.actionText}>Decline Selected</Text>
              </Pressable>
            </View>
            {feedback ? <Text style={styles.meta}>{feedback}</Text> : null}
          </>
        ) : (
          <QueueList items={items} />
        )}
        {isSupabaseEnabled && items.length === 0 ? <Text style={styles.empty}>No live items were returned for this tab.</Text> : null}
        {isSupabaseEnabled && tab === "Damage" && live.activeDamageCases.length > 0 ? (
          <Text style={styles.meta}>{`${live.activeDamageCases.length} active damage case(s), ${live.resolvedDamageCases.length} resolved.`}</Text>
        ) : null}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: "#0f1c16", borderWidth: 1, borderColor: "#173225" },
  tabActive: { backgroundColor: "#173225" },
  tabText: { color: "#8eb39c", fontWeight: "700" },
  tabTextActive: { color: "#f6fff9" },
  list: { gap: 10 },
  pendingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: "#173225", backgroundColor: "#11231b", padding: 14 },
  pendingRowActive: { borderColor: "#24c05a", backgroundColor: "#123122" },
  pendingCopy: { flex: 1, gap: 4 },
  pendingTitle: { color: "#effff3", fontSize: 15, fontWeight: "700" },
  pendingSubtitle: { color: "#89a995", fontSize: 13 },
  input: { borderRadius: 14, borderWidth: 1, borderColor: "#173225", backgroundColor: "#08150f", color: "#f6fff9", paddingHorizontal: 14, paddingVertical: 12 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionButton: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  actionButtonDisabled: { opacity: 0.7 },
  approveButton: { backgroundColor: "#24c05a" },
  declineButton: { backgroundColor: "#ef4444" },
  actionText: { color: "#03110b", fontWeight: "900" },
  empty: { color: "#89a995", lineHeight: 20 },
  meta: { color: "#89a995", lineHeight: 20 },
});
