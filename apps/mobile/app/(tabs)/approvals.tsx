import { useEffect, useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { ActionButton, Card, LoadingState, Screen, SectionTitle, ListRow, Pill, StatCard } from "@mobile/components/Screen";
import { useAuth } from "@mobile/contexts/auth-context";
import { useLocationScope } from "@mobile/contexts/location-scope-context";
import { getSupabaseClient } from "@mobile/lib/supabase";
import {
  acceptReturnApproval,
  fallbackApprovalsWorkspace,
  loadApprovalsWorkspace,
  reviewApprovalItem,
  resolveDamageCaseItem,
  resolveDamageCaseLost,
  sendRecipientReminder,
  type ApprovalAction,
  type ApprovalQueueItem,
  type ApprovalTab,
  type ApprovalsWorkspaceData,
} from "@/lib/approvals";

const tabOrder: ApprovalTab[] = ["recipient", "asset_requests", "special_requests", "returns", "damage_locks"];

const fallbackWorkspace: ApprovalsWorkspaceData = {
  ...fallbackApprovalsWorkspace,
  warnings: ["Supabase is not configured yet, so Approvals will only show the mobile shell."],
};

export default function ApprovalsScreen() {
  const { isAdmin, isAssetManager, isConfigured } = useAuth();
  const { activeLocationId, locations, selectedLocationName } = useLocationScope();
  const [workspace, setWorkspace] = useState<ApprovalsWorkspaceData>(() => ({
    ...fallbackWorkspace,
    warnings: [],
  }));
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ApprovalTab>("recipient");
  const [reviewNotes, setReviewNotes] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const canUseApprovals = isAdmin || isAssetManager;
  const selectedItem = workspace.queues[activeTab][0] ?? null;

  useEffect(() => {
    let cancelled = false;

    const loadWorkspace = async () => {
      if (!isConfigured) {
        if (!cancelled) {
          setWorkspace(fallbackWorkspace);
          setLoading(false);
        }
        return;
      }

      const supabase = getSupabaseClient();
      if (!supabase) {
        if (!cancelled) {
          setWorkspace(fallbackWorkspace);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setLoading(true);
      }

      const nextWorkspace = await loadApprovalsWorkspace(supabase, activeLocationId);

      if (!cancelled) {
        setWorkspace(nextWorkspace);
        setLoading(false);
      }
    };

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [activeLocationId, isConfigured]);

  const summary = useMemo(
    () =>
      tabOrder.map((tab) => ({
        tab,
        count: workspace.queues[tab].length,
      })),
    [workspace.queues],
  );

  const refreshWorkspace = async () => {
    if (!isConfigured) {
      setWorkspace(fallbackWorkspace);
      setLoading(false);
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setWorkspace(fallbackWorkspace);
      setLoading(false);
      return;
    }

    setLoading(true);
    const nextWorkspace = await loadApprovalsWorkspace(supabase, activeLocationId);
    setWorkspace(nextWorkspace);
    setLoading(false);
  };

  const runAction = async (action: ApprovalAction) => {
    if (!selectedItem) return;
    const supabase = getSupabaseClient();
    if (!supabase) {
      setFeedback("Supabase is not configured yet.");
      return;
    }

    try {
      setFeedback(null);
      if (action === "send_reminder") {
        await sendRecipientReminder(supabase, { approvalId: selectedItem.id, note: reviewNotes });
      } else if (action === "approve" || action === "decline" || action === "request_changes") {
        await reviewApprovalItem(supabase, {
          approvalId: selectedItem.id,
          status: action === "approve" ? "Approved" : action === "decline" ? "Declined" : "Request Changes",
          reviewNotes,
        });
      } else if (action === "accept_return") {
        const finalLocationId = activeLocationId ?? locations[0]?.id;
        if (!finalLocationId) throw new Error("Choose a location first.");
        await acceptReturnApproval(supabase, {
          approvalId: selectedItem.id,
          finalLocationId,
          reviewNotes,
        });
      } else if (action === "resolve_available") {
        await resolveDamageCaseItem(supabase, {
          caseId: selectedItem.target.kind === "damage_case" ? selectedItem.target.id : selectedItem.id,
          resolvedState: "Available",
          conditionNote: reviewNotes,
        });
      } else if (action === "resolve_damaged") {
        await resolveDamageCaseItem(supabase, {
          caseId: selectedItem.target.kind === "damage_case" ? selectedItem.target.id : selectedItem.id,
          resolvedState: "Damaged",
          conditionNote: reviewNotes,
        });
      } else if (action === "resolve_lost") {
        await resolveDamageCaseLost(supabase, {
          caseId: selectedItem.target.kind === "damage_case" ? selectedItem.target.id : selectedItem.id,
        });
      }

      setFeedback("Action completed.");
      await refreshWorkspace();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Approval action failed.");
    }
  };

  if (!canUseApprovals) {
    return (
      <Screen kicker="Approvals" title="Access restricted" subtitle="Only admin and asset-manager roles can use approvals.">
        <Card>
          <Text style={{ color: "#a8c0b4" }}>This role does not have approval access.</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen kicker="Approvals" title="Review queue" subtitle={`Scope: ${selectedLocationName}.`}>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <SectionTitle title="Queue summary" />
          <ActionButton label="Refresh" onPress={() => void refreshWorkspace()} tone="secondary" />
        </View>
        {loading ? <LoadingState label="Loading approvals" /> : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {summary.map((item) => (
            <StatCard key={item.tab} label={item.tab.replace(/_/g, " ")} value={item.count} />
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {workspace.locations.slice(0, 5).map((location) => (
            <Pill key={location.id} label={location.name} />
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle title="Open queue" subtitle="Select a queue and process the first item." />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {tabOrder.map((tab) => (
            <ActionButton key={tab} label={tab.replace(/_/g, " ")} onPress={() => setActiveTab(tab)} tone={activeTab === tab ? "primary" : "secondary"} />
          ))}
        </View>
        {selectedItem ? (
          <>
            <ListRow title={selectedItem.summary} description={selectedItem.requester} meta={selectedItem.status} />
            <TextInput value={reviewNotes} onChangeText={setReviewNotes} placeholder="Review notes" placeholderTextColor="#69817a" style={inputStyle} multiline />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {selectedItem.actions.map((action) => (
                <ActionButton key={action} label={action.replace(/_/g, " ")} onPress={() => void runAction(action)} />
              ))}
            </View>
          </>
        ) : (
          <Text style={{ color: "#8fa89b" }}>No items in this queue.</Text>
        )}
        {feedback ? <Text style={{ color: "#8fd7ab", lineHeight: 20 }}>{feedback}</Text> : null}
      </Card>

      {tabOrder.map((tab) => (
        <Card key={tab}>
          <SectionTitle title={tab.replace(/_/g, " ")} subtitle={`${workspace.queues[tab].length} item(s)`} />
          <View style={{ gap: 10 }}>
            {workspace.queues[tab].length === 0 ? (
              <Text style={{ color: "#8fa89b" }}>No items in this queue.</Text>
            ) : (
              workspace.queues[tab].slice(0, 6).map((item: ApprovalQueueItem) => (
                <ListRow key={item.id} title={item.summary} description={item.requester} meta={item.status} />
              ))
            )}
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const inputStyle = {
  backgroundColor: "#08150f",
  borderWidth: 1,
  borderColor: "#20382c",
  borderRadius: 16,
  color: "#f6fff9",
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 15,
} as const;
