import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { REQUESTS_TABS } from "../../src/domain/mockData";
import { RequestsTabKey } from "../../src/domain/types";
import { Panel } from "../../src/components/Cards";
import { QueueList } from "../../src/components/Lists";
import { Screen } from "../../src/components/Screen";
import { useLiveRequests } from "../../src/hooks/useLiveRequests";
import { useSnapshot } from "../../src/hooks/useSnapshot";
import { isSupabaseEnabled } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";

export default function RequestsScreen() {
  const { user } = useAuth();
  const snapshot = useSnapshot(user!.role);
  const [tab, setTab] = useState<RequestsTabKey>("Asset");
  const [assetForm, setAssetForm] = useState({
    needDate: "",
    reason: "",
    duration: "",
    eventContext: "",
  });
  const [specialForm, setSpecialForm] = useState({
    specialType: "",
    targetAsset: "",
    notes: "",
  });
  const [returnForm, setReturnForm] = useState({
    returnDate: "",
    preferredLocation: "",
    note: "",
  });
  const [draftMessage, setDraftMessage] = useState("Drafts save automatically.");
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const { requests, saveDraft, submit } = useLiveRequests();

  const payload = useMemo(() => {
    if (tab === "Asset") return assetForm;
    if (tab === "Special") return specialForm;
    if (tab === "Returns") return returnForm;
    return null;
  }, [assetForm, returnForm, specialForm, tab]);

  useEffect(() => {
    if (!isSupabaseEnabled || !payload || tab === "History") {
      return;
    }

    const hasValue = Object.values(payload).some((value) => String(value).trim().length > 0);
    if (!hasValue) {
      return;
    }

    const timeout = setTimeout(() => {
      saveDraft
        .mutateAsync({
          workflowType: tab,
          sourceLocationId: null,
          payload,
        })
        .then((draft) => {
          if (draft) {
            setActiveDraftId(draft.id);
            setDraftMessage(`Draft saved ${new Date(draft.updated_at).toLocaleTimeString()}`);
          }
        })
        .catch(() => {
          setDraftMessage("Draft save failed. Check Supabase configuration.");
        });
    }, 700);

    return () => clearTimeout(timeout);
  }, [payload, saveDraft, tab]);

  const historyItems = isSupabaseEnabled
    ? (requests.data ?? []).map((request) => ({
        id: request.id,
        title: `${request.workflow_type} request`,
        subtitle: `Status ${request.status} • Updated ${new Date(request.updated_at).toLocaleString()}`,
        status: request.status,
      }))
    : snapshot.requests;

  const submitCurrentDraft = async () => {
    if (!activeDraftId || !isSupabaseEnabled) {
      setDraftMessage("Draft submission requires a saved Supabase draft.");
      return;
    }

    try {
      const request = await submit.mutateAsync(activeDraftId);
      setDraftMessage(`Submitted ${request?.workflow_type ?? "request"} successfully.`);
      setActiveDraftId(null);
    } catch {
      setDraftMessage("Draft submission failed.");
    }
  };

  return (
    <Screen title="Requests" subtitle="Guided step flow, one basket per workflow type, one source location, draft autosave by type.">
      <View style={styles.tabs}>
        {REQUESTS_TABS.map((item) => (
          <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, item === tab && styles.tabActive]}>
            <Text style={[styles.tabText, item === tab && styles.tabTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <Panel title="Draft Status" subtitle={isSupabaseEnabled ? "Supabase-backed autosave is active." : "Running in scaffold mode until env vars are set."}>
        <Text style={styles.helper}>{draftMessage}</Text>
        {tab !== "History" ? (
          <Pressable onPress={() => void submitCurrentDraft()} style={styles.submitButton}>
            <Text style={styles.submitButtonText}>{submit.isPending ? "Submitting..." : "Submit Current Draft"}</Text>
          </Pressable>
        ) : null}
      </Panel>

      {tab === "Asset" ? (
        <Panel title="Asset Request Basket" subtitle="Physical-unit multi-select with shared Need Date, Reason, Duration, Event/Use Context.">
          <TextInput placeholder="Need Date" placeholderTextColor="#6f8b79" style={styles.input} value={assetForm.needDate} onChangeText={(needDate) => setAssetForm((current) => ({ ...current, needDate }))} />
          <TextInput placeholder="Reason" placeholderTextColor="#6f8b79" style={styles.input} value={assetForm.reason} onChangeText={(reason) => setAssetForm((current) => ({ ...current, reason }))} />
          <TextInput placeholder="Duration" placeholderTextColor="#6f8b79" style={styles.input} value={assetForm.duration} onChangeText={(duration) => setAssetForm((current) => ({ ...current, duration }))} />
          <TextInput placeholder="Event / Use Context" placeholderTextColor="#6f8b79" style={styles.input} value={assetForm.eventContext} onChangeText={(eventContext) => setAssetForm((current) => ({ ...current, eventContext }))} />
        </Panel>
      ) : null}

      {tab === "Special" ? (
        <Panel title="Special Request" subtitle="Dynamic form for Stationed Use and Permanent Reassignment.">
          <TextInput placeholder="Special Type" placeholderTextColor="#6f8b79" style={styles.input} value={specialForm.specialType} onChangeText={(specialType) => setSpecialForm((current) => ({ ...current, specialType }))} />
          <TextInput placeholder="Target Asset" placeholderTextColor="#6f8b79" style={styles.input} value={specialForm.targetAsset} onChangeText={(targetAsset) => setSpecialForm((current) => ({ ...current, targetAsset }))} />
          <TextInput placeholder="Workflow Notes" placeholderTextColor="#6f8b79" style={styles.input} value={specialForm.notes} onChangeText={(notes) => setSpecialForm((current) => ({ ...current, notes }))} />
        </Panel>
      ) : null}

      {tab === "Returns" ? (
        <Panel title="Return Request" subtitle="Unified return workspace for creation and tracking.">
          <TextInput placeholder="Return Date" placeholderTextColor="#6f8b79" style={styles.input} value={returnForm.returnDate} onChangeText={(returnDate) => setReturnForm((current) => ({ ...current, returnDate }))} />
          <TextInput placeholder="Preferred Return Location" placeholderTextColor="#6f8b79" style={styles.input} value={returnForm.preferredLocation} onChangeText={(preferredLocation) => setReturnForm((current) => ({ ...current, preferredLocation }))} />
          <TextInput placeholder="Note" placeholderTextColor="#6f8b79" style={styles.input} value={returnForm.note} onChangeText={(note) => setReturnForm((current) => ({ ...current, note }))} />
        </Panel>
      ) : null}

      <Panel title="History" subtitle={requests.isFetching ? "Refreshing live request history..." : "Most recent requests first."}>
        <QueueList items={historyItems} />
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
  input: { borderRadius: 14, borderWidth: 1, borderColor: "#173225", backgroundColor: "#08150f", color: "#f6fff9", paddingHorizontal: 14, paddingVertical: 12 },
  helper: { color: "#d1ead9", lineHeight: 20 },
  submitButton: { alignSelf: "flex-start", borderRadius: 14, backgroundColor: "#24c05a", paddingHorizontal: 14, paddingVertical: 12 },
  submitButtonText: { color: "#03110b", fontWeight: "900" },
});
