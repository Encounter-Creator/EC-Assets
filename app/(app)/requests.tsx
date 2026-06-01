import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Badge, Panel } from "../../src/components/Cards";
import { QueueList } from "../../src/components/Lists";
import { REQUESTS_TABS } from "../../src/domain/mockData";
import { RequestsTabKey } from "../../src/domain/types";
import { useLiveInventory } from "../../src/hooks/useLiveInventory";
import { useLiveMyAssets } from "../../src/hooks/useLiveMyAssets";
import { useLiveRequests } from "../../src/hooks/useLiveRequests";
import { useSnapshot } from "../../src/hooks/useSnapshot";
import { isSupabaseEnabled } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";
import { Screen } from "../../src/components/Screen";

type SpecialType = "Stationed Use" | "Permanent Reassignment";

export default function RequestsScreen() {
  const { user } = useAuth();
  const snapshot = useSnapshot(user!.role);
  const inventory = useLiveInventory();
  const myAssets = useLiveMyAssets();
  const [tab, setTab] = useState<RequestsTabKey>("Asset");
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [selectedReturnIds, setSelectedReturnIds] = useState<string[]>([]);
  const [assetForm, setAssetForm] = useState({
    needDate: "",
    reason: "",
    duration: "",
    eventContext: "",
  });
  const [specialForm, setSpecialForm] = useState<{
    specialType: SpecialType;
    targetAssetId: string | null;
    notes: string;
  }>({
    specialType: "Stationed Use",
    targetAssetId: null,
    notes: "",
  });
  const [returnForm, setReturnForm] = useState({
    returnDate: "",
    preferredLocation: "",
    note: "",
  });
  const [draftMessage, setDraftMessage] = useState("Drafts save automatically.");
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const { requests, saveDraft, submit } = useLiveRequests();

  const requestableAssets = useMemo(
    () =>
      isSupabaseEnabled
        ? (inventory.assets.data ?? []).filter((asset) => asset.state === "Available" || asset.state === "Stationed")
        : snapshot.assetUnits
            .filter((asset) => asset.status === "Available" || asset.status === "Stationed")
            .map((asset) => ({
              id: asset.id,
              tag: asset.tag,
              name: asset.name,
              serial_number: asset.serial,
              item_type: asset.name,
              state: asset.status,
              current_location: asset.currentLocation,
              holder: asset.holder ?? null,
              department: asset.department,
              condition_note: asset.notes ?? null,
            })),
    [inventory.assets.data, snapshot.assetUnits],
  );

  const allVisibleAssets = useMemo(
    () =>
      isSupabaseEnabled
        ? (inventory.assets.data ?? [])
        : snapshot.assetUnits.map((asset) => ({
            id: asset.id,
            tag: asset.tag,
            name: asset.name,
            serial_number: asset.serial,
            item_type: asset.name,
            state: asset.status,
            current_location: asset.currentLocation,
            holder: asset.holder ?? null,
            department: asset.department,
            condition_note: asset.notes ?? null,
          })),
    [inventory.assets.data, snapshot.assetUnits],
  );

  const selectedAssetLocation =
    selectedAssetIds.length > 0
      ? requestableAssets.find((asset) => asset.id === selectedAssetIds[0])?.current_location ?? null
      : null;

  const availableSpecialAssets = useMemo(
    () =>
      allVisibleAssets.filter((asset) =>
        specialForm.specialType === "Stationed Use" ? asset.state === "Stationed" : asset.state === "Assigned",
      ),
    [allVisibleAssets, specialForm.specialType],
  );

  const returnableAssets = useMemo(
    () =>
      isSupabaseEnabled
        ? (myAssets.assignedAssets.data ?? []).map((asset) => ({
            id: asset.id,
            tag: asset.tag,
            name: asset.name,
            serial_number: asset.serial_number,
            current_location: asset.current_location,
            department: asset.department,
          }))
        : snapshot.assetUnits
            .filter((asset) => asset.holder === user?.fullName && asset.status === "Assigned")
            .map((asset) => ({
              id: asset.id,
              tag: asset.tag,
              name: asset.name,
              serial_number: asset.serial,
              current_location: asset.currentLocation,
              department: asset.department,
            })),
    [isSupabaseEnabled, myAssets.assignedAssets.data, snapshot.assetUnits, user?.fullName],
  );

  const payload = useMemo(() => {
    if (tab === "Asset") {
      return {
        ...assetForm,
        assetIds: selectedAssetIds,
        sourceLocation: selectedAssetLocation,
      };
    }
    if (tab === "Special") {
      return {
        specialType: specialForm.specialType,
        targetAssetId: specialForm.targetAssetId,
        notes: specialForm.notes,
      };
    }
    if (tab === "Returns") {
      return {
        ...returnForm,
        assetIds: selectedReturnIds,
      };
    }
    return null;
  }, [assetForm, returnForm, selectedAssetIds, selectedAssetLocation, selectedReturnIds, specialForm, tab]);

  useEffect(() => {
    if (!isSupabaseEnabled || !payload || tab === "History") {
      return;
    }

    const hasValue = Object.values(payload).some((value) => (Array.isArray(value) ? value.length > 0 : String(value ?? "").trim().length > 0));
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
        subtitle: `Status ${request.status} / Updated ${new Date(request.updated_at).toLocaleString()}`,
        status: request.status,
      }))
    : snapshot.requests;

  const toggleAsset = (assetId: string) => {
    const selected = requestableAssets.find((asset) => asset.id === assetId);
    if (!selected) {
      return;
    }

    setSelectedAssetIds((current) => {
      if (current.includes(assetId)) {
        return current.filter((id) => id !== assetId);
      }

      const currentLocation = current.length > 0 ? requestableAssets.find((asset) => asset.id === current[0])?.current_location ?? null : null;
      if (currentLocation && currentLocation !== selected.current_location) {
        setValidationMessage("One asset basket is limited to one source location.");
        return current;
      }

      setValidationMessage(null);
      return [...current, assetId];
    });
  };

  const toggleReturnAsset = (assetId: string) => {
    setSelectedReturnIds((current) => (current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId]));
  };

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
        {validationMessage ? <Text style={styles.validation}>{validationMessage}</Text> : null}
        {tab !== "History" ? (
          <Pressable onPress={() => void submitCurrentDraft()} style={[styles.submitButton, submit.isPending && styles.submitButtonDisabled]} disabled={submit.isPending}>
            <Text style={styles.submitButtonText}>{submit.isPending ? "Submitting..." : "Submit Current Draft"}</Text>
          </Pressable>
        ) : null}
      </Panel>

      {tab === "Asset" ? (
        <>
          <Panel title="Asset Request Basket" subtitle="Physical-unit multi-select with shared Need Date, Reason, Duration, Event/Use Context.">
            <TextInput placeholder="Need Date" placeholderTextColor="#6f8b79" style={styles.input} value={assetForm.needDate} onChangeText={(needDate) => setAssetForm((current) => ({ ...current, needDate }))} />
            <TextInput placeholder="Reason" placeholderTextColor="#6f8b79" style={styles.input} value={assetForm.reason} onChangeText={(reason) => setAssetForm((current) => ({ ...current, reason }))} />
            <TextInput placeholder="Duration" placeholderTextColor="#6f8b79" style={styles.input} value={assetForm.duration} onChangeText={(duration) => setAssetForm((current) => ({ ...current, duration }))} />
            <TextInput placeholder="Event / Use Context" placeholderTextColor="#6f8b79" style={styles.input} value={assetForm.eventContext} onChangeText={(eventContext) => setAssetForm((current) => ({ ...current, eventContext }))} />
            <Text style={styles.helper}>{selectedAssetIds.length === 0 ? "No physical units selected." : `${selectedAssetIds.length} unit(s) selected from ${selectedAssetLocation ?? "Unknown"}.`}</Text>
          </Panel>
          <Panel title="Available Units" subtitle="One basket can only include assets from one source location.">
            <View style={styles.list}>
              {requestableAssets.map((asset) => {
                const selected = selectedAssetIds.includes(asset.id);
                return (
                  <Pressable key={asset.id} onPress={() => toggleAsset(asset.id)} style={[styles.choiceCard, selected && styles.choiceCardActive]}>
                    <View style={styles.choiceCopy}>
                      <Text style={styles.choiceTitle}>{asset.tag} / {asset.name}</Text>
                      <Text style={styles.choiceMeta}>{asset.serial_number} / {asset.current_location ?? "Unknown"} / {asset.department ?? "No department"}</Text>
                    </View>
                    <Badge label={selected ? "Selected" : asset.state} tone={selected ? "#4ade80" : "#38bdf8"} />
                  </Pressable>
                );
              })}
            </View>
          </Panel>
        </>
      ) : null}

      {tab === "Special" ? (
        <Panel title="Special Request" subtitle="Dynamic form for Stationed Use and Permanent Reassignment.">
          <View style={styles.actions}>
            {(["Stationed Use", "Permanent Reassignment"] as SpecialType[]).map((type) => (
              <Pressable key={type} onPress={() => setSpecialForm((current) => ({ ...current, specialType: type, targetAssetId: null }))} style={[styles.modeButton, specialForm.specialType === type && styles.modeButtonActive]}>
                <Text style={[styles.modeText, specialForm.specialType === type && styles.modeTextActive]}>{type}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.list}>
            {availableSpecialAssets.map((asset) => {
              const selected = specialForm.targetAssetId === asset.id;
              return (
                <Pressable key={asset.id} onPress={() => setSpecialForm((current) => ({ ...current, targetAssetId: asset.id }))} style={[styles.choiceCard, selected && styles.choiceCardActive]}>
                  <View style={styles.choiceCopy}>
                    <Text style={styles.choiceTitle}>{asset.tag} / {asset.name}</Text>
                    <Text style={styles.choiceMeta}>{asset.state} / {asset.current_location ?? "Unknown"} / {asset.department ?? "No department"}</Text>
                  </View>
                  <Badge label={selected ? "Selected" : asset.state} tone={selected ? "#4ade80" : "#38bdf8"} />
                </Pressable>
              );
            })}
          </View>
          <TextInput placeholder="Workflow Notes" placeholderTextColor="#6f8b79" style={styles.input} value={specialForm.notes} onChangeText={(notes) => setSpecialForm((current) => ({ ...current, notes }))} />
        </Panel>
      ) : null}

      {tab === "Returns" ? (
        <>
          <Panel title="Return Request" subtitle="Unified return workspace for creation and tracking.">
            <TextInput placeholder="Return Date" placeholderTextColor="#6f8b79" style={styles.input} value={returnForm.returnDate} onChangeText={(returnDate) => setReturnForm((current) => ({ ...current, returnDate }))} />
            <TextInput placeholder="Preferred Return Location" placeholderTextColor="#6f8b79" style={styles.input} value={returnForm.preferredLocation} onChangeText={(preferredLocation) => setReturnForm((current) => ({ ...current, preferredLocation }))} />
            <TextInput placeholder="Note" placeholderTextColor="#6f8b79" style={styles.input} value={returnForm.note} onChangeText={(note) => setReturnForm((current) => ({ ...current, note }))} />
            <Text style={styles.helper}>{selectedReturnIds.length === 0 ? "No assigned assets selected for return." : `${selectedReturnIds.length} assigned asset(s) selected for one shared return request.`}</Text>
          </Panel>
          <Panel title="Assigned Assets" subtitle="Only assets currently assigned to you can be returned in one shared request.">
            <View style={styles.list}>
              {returnableAssets.map((asset) => {
                const selected = selectedReturnIds.includes(asset.id);
                return (
                  <Pressable key={asset.id} onPress={() => toggleReturnAsset(asset.id)} style={[styles.choiceCard, selected && styles.choiceCardActive]}>
                    <View style={styles.choiceCopy}>
                      <Text style={styles.choiceTitle}>{asset.tag} / {asset.name}</Text>
                      <Text style={styles.choiceMeta}>{asset.serial_number} / {asset.current_location ?? "Unknown"} / {asset.department ?? "No department"}</Text>
                    </View>
                    <Badge label={selected ? "Selected" : "Assigned"} tone={selected ? "#4ade80" : "#38bdf8"} />
                  </Pressable>
                );
              })}
            </View>
          </Panel>
        </>
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
  validation: { color: "#fecaca", lineHeight: 20, fontWeight: "700" },
  submitButton: { alignSelf: "flex-start", borderRadius: 14, backgroundColor: "#24c05a", paddingHorizontal: 14, paddingVertical: 12 },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: { color: "#03110b", fontWeight: "900" },
  list: { gap: 10 },
  choiceCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: "#173225", backgroundColor: "#11231b", padding: 14 },
  choiceCardActive: { borderColor: "#24c05a", backgroundColor: "#123122" },
  choiceCopy: { flex: 1, gap: 4 },
  choiceTitle: { color: "#effff3", fontSize: 15, fontWeight: "700" },
  choiceMeta: { color: "#89a995", fontSize: 13 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  modeButton: { borderRadius: 14, borderWidth: 1, borderColor: "#173225", backgroundColor: "#08150f", paddingHorizontal: 14, paddingVertical: 12 },
  modeButtonActive: { backgroundColor: "#173225" },
  modeText: { color: "#8eb39c", fontWeight: "700" },
  modeTextActive: { color: "#f6fff9" },
});
