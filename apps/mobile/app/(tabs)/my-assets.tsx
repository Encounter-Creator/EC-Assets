import { useEffect, useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { ActionButton, Card, LoadingState, Screen, SectionTitle, ListRow, StatCard, Pill } from "@mobile/components/Screen";
import { useAuth } from "@mobile/contexts/auth-context";
import { getSupabaseClient } from "@mobile/lib/supabase";
import {
  fallbackAssignedAssets,
  fallbackDamageRecords,
  fallbackPendingItems,
  loadHandoverRecipients,
  loadMyAssetsWorkspace,
  submitDamageReport,
  submitHandoverRequest,
  type AssignedAsset,
  type HandoverRecipient,
  type MyAssetsWorkspaceData,
} from "@/lib/my-assets";

const fallbackWorkspace: MyAssetsWorkspaceData = {
  assignedAssets: fallbackAssignedAssets,
  pendingItems: fallbackPendingItems,
  damageRecords: fallbackDamageRecords,
  source: "fallback",
  warnings: ["Supabase is not configured yet, so this page is showing the rebuild preview dataset."],
};

export default function MyAssetsScreen() {
  const { isConfigured, isDamageLocked, damageLockCase, user } = useAuth();
  const [workspace, setWorkspace] = useState<MyAssetsWorkspaceData>(() => ({
    ...fallbackWorkspace,
    warnings: [],
  }));
  const [loading, setLoading] = useState(true);
  const [handoverRecipients, setHandoverRecipients] = useState<HandoverRecipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [handoverAssetId, setHandoverAssetId] = useState("");
  const [handoverRecipientId, setHandoverRecipientId] = useState("");
  const [handoverNote, setHandoverNote] = useState("");
  const [damageAssetId, setDamageAssetId] = useState("");
  const [damageType, setDamageType] = useState("Physical damage");
  const [damageDescription, setDamageDescription] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadWorkspace = async () => {
      if (!isConfigured || !user) {
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

      const nextWorkspace = await loadMyAssetsWorkspace(supabase, user.id);

      if (!cancelled) {
        setWorkspace(nextWorkspace);
        setLoading(false);
      }
    };

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [isConfigured, user]);

  useEffect(() => {
    if (workspace.assignedAssets.length > 0 && !handoverAssetId) {
      setHandoverAssetId(workspace.assignedAssets[0].id);
    }
    if (workspace.assignedAssets.length > 0 && !damageAssetId) {
      setDamageAssetId(workspace.assignedAssets[0].id);
    }
  }, [damageAssetId, handoverAssetId, workspace.assignedAssets]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadRecipients = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      setLoadingRecipients(true);
      try {
        const nextRecipients = await loadHandoverRecipients(supabase, user.id);
        if (!cancelled) {
          setHandoverRecipients(nextRecipients);
          if (nextRecipients.length > 0 && !handoverRecipientId) {
            setHandoverRecipientId(nextRecipients[0].id);
          }
        }
      } finally {
        if (!cancelled) {
          setLoadingRecipients(false);
        }
      }
    };

    void loadRecipients();

    return () => {
      cancelled = true;
    };
  }, [handoverRecipientId, user]);

  const refreshWorkspace = async () => {
    if (!isConfigured || !user) {
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
    const nextWorkspace = await loadMyAssetsWorkspace(supabase, user.id);
    setWorkspace(nextWorkspace);
    setLoading(false);
  };

  const selectedHandoverAsset = useMemo(
    () => workspace.assignedAssets.find((asset) => asset.id === handoverAssetId) ?? null,
    [handoverAssetId, workspace.assignedAssets],
  );
  const selectedDamageAsset = useMemo(
    () => workspace.assignedAssets.find((asset) => asset.id === damageAssetId) ?? null,
    [damageAssetId, workspace.assignedAssets],
  );

  const submitHandover = async () => {
    if (!user) return;
    const supabase = getSupabaseClient();
    if (!supabase) {
      setFeedback("Supabase is not configured yet.");
      return;
    }
    if (!selectedHandoverAsset || !handoverRecipientId) {
      setFeedback("Select an asset and a recipient.");
      return;
    }

    try {
      setFeedback(null);
      await submitHandoverRequest(supabase, {
        fromUserId: user.id,
        toUserId: handoverRecipientId,
        assetIds: [selectedHandoverAsset.id],
        notes: handoverNote,
      });
      setFeedback("Handover request submitted.");
      await refreshWorkspace();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Handover submission failed.");
    }
  };

  const submitDamage = async () => {
    if (!user) return;
    const supabase = getSupabaseClient();
    if (!supabase) {
      setFeedback("Supabase is not configured yet.");
      return;
    }
    if (!selectedDamageAsset) {
      setFeedback("Select an asset.");
      return;
    }

    try {
      setFeedback(null);
      await submitDamageReport(supabase, {
        userId: user.id,
        assetId: selectedDamageAsset.id,
        assetTag: selectedDamageAsset.tag,
        assetName: selectedDamageAsset.name,
        damageType,
        description: damageDescription,
      });
      setFeedback("Damage report submitted.");
      await refreshWorkspace();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Damage report submission failed.");
    }
  };

  return (
    <Screen kicker="My Assets" title="Personal workspace" subtitle={isDamageLocked ? "Damage lock active for an assigned asset." : "Your assigned items, pending actions, and damage history."}>
      {isDamageLocked && damageLockCase ? (
        <Card>
          <SectionTitle title="Damage lock" subtitle={damageLockCase.assetTag} />
          <Text style={{ color: "#a8c0b4", lineHeight: 20 }}>
            {damageLockCase.assetName}
            {damageLockCase.locationName ? ` at ${damageLockCase.locationName}` : ""}.
          </Text>
        </Card>
      ) : null}

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <SectionTitle title="Summary" subtitle="Counts from your workspace" />
          <ActionButton label="Refresh" onPress={() => void refreshWorkspace()} tone="secondary" />
        </View>
        {loading ? <LoadingState label="Loading my assets" /> : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <StatCard label="Assigned" value={workspace.assignedAssets.length} />
          <StatCard label="Pending" value={workspace.pendingItems.length} />
          <StatCard label="Damage" value={workspace.damageRecords.length} />
          <StatCard label="Source" value={workspace.source.toUpperCase()} />
        </View>
      </Card>

      <Card>
        <SectionTitle title="Handover request" subtitle="Submit a handover to another approved user." />
        <View style={{ gap: 8 }}>
          {workspace.assignedAssets.map((asset) => (
            <ActionButton
              key={asset.id}
              label={`${asset.tag} - ${asset.name}`}
              onPress={() => setHandoverAssetId(asset.id)}
              tone={handoverAssetId === asset.id ? "primary" : "secondary"}
            />
          ))}
        </View>
        <View style={{ gap: 8 }}>
          {loadingRecipients ? <LoadingState label="Loading recipients" /> : null}
          {handoverRecipients.map((recipient) => (
            <ActionButton
              key={recipient.id}
              label={`${recipient.fullName} - ${recipient.role}`}
              onPress={() => setHandoverRecipientId(recipient.id)}
              tone={handoverRecipientId === recipient.id ? "primary" : "secondary"}
            />
          ))}
        </View>
        <TextInput value={handoverNote} onChangeText={setHandoverNote} placeholder="Handover note" placeholderTextColor="#69817a" style={inputStyle} multiline />
        {selectedHandoverAsset ? <Text style={{ color: "#8fa89b" }}>Selected: {selectedHandoverAsset.tag}</Text> : null}
        <ActionButton label="Submit handover" onPress={() => void submitHandover()} />
      </Card>

      <Card>
        <SectionTitle title="Damage report" subtitle="Open a damage case for an assigned asset." />
        <View style={{ gap: 8 }}>
          {workspace.assignedAssets.map((asset) => (
            <ActionButton
              key={asset.id}
              label={`${asset.tag} - ${asset.name}`}
              onPress={() => setDamageAssetId(asset.id)}
              tone={damageAssetId === asset.id ? "primary" : "secondary"}
            />
          ))}
        </View>
        <TextInput value={damageType} onChangeText={setDamageType} placeholder="Damage type" placeholderTextColor="#69817a" style={inputStyle} />
        <TextInput value={damageDescription} onChangeText={setDamageDescription} placeholder="Damage description" placeholderTextColor="#69817a" style={inputStyle} multiline />
        {selectedDamageAsset ? <Text style={{ color: "#8fa89b" }}>Selected: {selectedDamageAsset.tag}</Text> : null}
        <ActionButton label="Submit damage report" onPress={() => void submitDamage()} />
      </Card>

      {workspace.pendingItems.length > 0 ? (
        <Card>
          <SectionTitle title="Pending items" />
          <View style={{ gap: 10 }}>
            {workspace.pendingItems.map((item) => (
              <ListRow key={item.id} title={item.title} description={`${item.requestedBy} - ${item.location}`} meta={item.type} />
            ))}
          </View>
        </Card>
      ) : null}

      {workspace.assignedAssets.length > 0 ? (
        <Card>
          <SectionTitle title="Assigned assets" />
          <View style={{ gap: 10 }}>
            {workspace.assignedAssets.slice(0, 8).map((asset: AssignedAsset) => (
              <ListRow key={asset.id} title={`${asset.tag} - ${asset.name}`} description={`${asset.location} - ${asset.department}`} meta={asset.status} />
            ))}
          </View>
        </Card>
      ) : null}

      {workspace.damageRecords.length > 0 ? (
        <Card>
          <SectionTitle title="Damage history" />
          <View style={{ gap: 10 }}>
            {workspace.damageRecords.map((record) => (
              <ListRow key={record.id} title={`${record.tag} - ${record.status}`} description={record.note} meta={record.recordedAt} />
            ))}
          </View>
        </Card>
      ) : null}

      {feedback ? (
        <Card>
          <Text style={{ color: "#8fd7ab", lineHeight: 20 }}>{feedback}</Text>
        </Card>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {workspace.warnings.map((warning) => (
          <Pill key={warning} label={warning} />
        ))}
      </View>
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
