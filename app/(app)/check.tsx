import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Badge, Panel } from "../../src/components/Cards";
import { DetailRow } from "../../src/components/Lists";
import { RoleGate } from "../../src/components/RoleGate";
import { Screen } from "../../src/components/Screen";
import { CheckTabKey, LocationOption, OperatorProfile } from "../../src/domain/types";
import { MOCK_STANDARD_LOCATIONS, MOCK_STANDARD_RECIPIENTS } from "../../src/domain/mockData";
import { useLiveCheckOperations } from "../../src/hooks/useLiveCheckOperations";
import { useLiveInventory } from "../../src/hooks/useLiveInventory";
import { useLiveSettings } from "../../src/hooks/useLiveSettings";
import { useSnapshot } from "../../src/hooks/useSnapshot";
import { isSupabaseEnabled } from "../../src/lib/supabase";
import { useAuth } from "../../src/providers/AuthProvider";

const tabs: CheckTabKey[] = ["Standard", "Permanent", "Stationed", "Sunday Kits", "Returns", "QR Scan"];

const descriptions: Record<CheckTabKey, string> = {
  Standard: "Two-mode sign out/sign in workspace with multi-item processing and direct intake support.",
  Permanent: "Dedicated permanent-assignment flow. Assets stay Traveling until explicit sign-in.",
  Stationed: "Resting-state model. Temporary use assigns a responsible user and can return as Stationed, Available, or Damaged.",
  "Sunday Kits": "Saved kit deployment workspace with partial returns and item-level outcomes.",
  Returns: "Read-only return monitoring surface. Accepted returns auto-sign in from Approvals.",
  "QR Scan": "Single-mode scanning batch for bulk sign in or sign out.",
};

type StandardMode = "Sign Out" | "Sign In";

type StandardAsset = {
  id: string;
  tag: string;
  name: string;
  serial: string;
  state: string;
  currentLocation: string;
  holder: string | null;
  department: string | null;
};

function normalizeAsset(input: {
  id: string;
  tag: string;
  name: string;
  serial?: string;
  serial_number?: string;
  state: string;
  currentLocation?: string;
  current_location?: string | null;
  holder?: string | null;
  department?: string | null;
}): StandardAsset {
  return {
    id: input.id,
    tag: input.tag,
    name: input.name,
    serial: input.serial ?? input.serial_number ?? "NA",
    state: input.state,
    currentLocation: input.currentLocation ?? input.current_location ?? "Unknown",
    holder: input.holder ?? null,
    department: input.department ?? null,
  };
}

export default function CheckScreen() {
  const { user } = useAuth();
  const snapshot = useSnapshot(user!.role);
  const [tab, setTab] = useState<CheckTabKey>("Standard");
  const [mode, setMode] = useState<StandardMode>("Sign Out");
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"Available" | "Damaged">("Available");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState("Select assets, then complete the action context.");
  const [qrMode, setQrMode] = useState<StandardMode>("Sign Out");
  const [qrInput, setQrInput] = useState("");
  const [qrBatch, setQrBatch] = useState<StandardAsset[]>([]);
  const [mockAssets, setMockAssets] = useState<StandardAsset[]>(
    snapshot.assetUnits.map((asset) =>
      normalizeAsset({
        id: asset.id,
        tag: asset.tag,
        name: asset.name,
        serial: asset.serial,
        state: asset.status,
        currentLocation: asset.currentLocation,
        holder: asset.holder,
        department: asset.department,
      }),
    ),
  );
  const live = useLiveCheckOperations();
  const inventory = useLiveInventory();
  const settings = useLiveSettings();

  const recipients: OperatorProfile[] = isSupabaseEnabled
    ? (live.recipients.data ?? []).map((recipient) => ({
        id: recipient.id,
        fullName: recipient.full_name,
        email: recipient.email,
        role: recipient.role,
        homeBase: recipient.home_base ?? "Unassigned",
        department: recipient.department,
      }))
    : MOCK_STANDARD_RECIPIENTS.filter((recipient) => user?.role === "admin" || recipient.homeBase === user?.homeBase);

  const locations: LocationOption[] = isSupabaseEnabled
    ? (live.locations.data ?? []).map((location) => ({
        id: location.id,
        name: location.name,
      }))
    : MOCK_STANDARD_LOCATIONS.filter((location) => user?.role === "admin" || location.name === user?.homeBase);

  const signOutAssets = isSupabaseEnabled
    ? (live.signOutAssets.data ?? []).map((asset) => normalizeAsset(asset))
    : mockAssets.filter((asset) => asset.state === "Available");

  const signInAssets = isSupabaseEnabled
    ? (live.signInAssets.data ?? []).map((asset) => normalizeAsset(asset))
    : mockAssets.filter((asset) => asset.state === "Assigned");

  const allAssets = isSupabaseEnabled
    ? (inventory.assets.data ?? []).map((asset) =>
        normalizeAsset({
          ...asset,
          serial_number: asset.serial_number,
          current_location: asset.current_location,
        }),
      )
    : mockAssets;

  const permanentAssets = allAssets.filter((asset) => asset.state === "Assigned");
  const stationedAssets = allAssets.filter((asset) => asset.state === "Stationed");
  const returnMonitorRows = isSupabaseEnabled
    ? (live.returnMonitor.data ?? []).map((item) => ({
        id: item.id,
        title: `${item.preferred_return_location ?? "Unknown"} return`,
        subtitle: `${item.status} / ${item.workflow_status ?? "No workflow"} / ${item.note ?? "No note"}`,
      }))
    : snapshot.requests.map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
      }));
  const kitRows = isSupabaseEnabled
    ? (settings.kits.data ?? []).map((kit) => ({
        id: kit.id,
        title: kit.name,
        subtitle: `${kit.home_base ?? "No home base"} / ${kit.item_count} items / ${kit.active ? "Active" : "Inactive"}`,
      }))
    : snapshot.inventoryGroups.map((group) => ({
        id: group.id,
        title: `${group.name} kit`,
        subtitle: `${group.locations.join(", ")} / ${group.available + group.assigned + group.traveling + group.damaged} units`,
      }));

  const activeAssets = mode === "Sign Out" ? signOutAssets : signInAssets;
  const selectedRecipient = recipients.find((recipient) => recipient.id === selectedRecipientId) ?? null;
  const selectedLocation = locations.find((location) => location.id === selectedLocationId) ?? null;

  const selectedCountText = useMemo(() => {
    if (selectedAssetIds.length === 0) return "No assets selected.";
    return `${selectedAssetIds.length} asset${selectedAssetIds.length === 1 ? "" : "s"} selected.`;
  }, [selectedAssetIds.length]);

  const busy = live.signingIn || live.signingOut;

  const resetSelection = () => {
    setSelectedAssetIds([]);
    setSelectedRecipientId(null);
    setSelectedLocationId(null);
    setOutcome("Available");
    setNote("");
  };

  const toggleAsset = (assetId: string) => {
    setSelectedAssetIds((current) => (current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId]));
  };

  const addQrAsset = () => {
    const token = qrInput.trim().toLowerCase();
    if (!token) {
      setFeedback("Enter an asset tag or name for the QR batch.");
      return;
    }

    const match = allAssets.find((asset) => asset.tag.toLowerCase() === token || asset.name.toLowerCase().includes(token) || asset.id.toLowerCase() === token);
    if (!match) {
      setFeedback("No asset matched the QR input.");
      return;
    }

    setQrBatch((current) => (current.some((asset) => asset.id === match.id) ? current : [...current, match]));
    setQrInput("");
    setFeedback(`Added ${match.tag} to the ${qrMode} QR batch.`);
  };

  const performMockSignOut = () => {
    if (!selectedRecipient) {
      setFeedback("Choose a recipient before signing assets out.");
      return;
    }

    setMockAssets((current) =>
      current.map((asset) =>
        selectedAssetIds.includes(asset.id)
          ? {
              ...asset,
              state: "Assigned",
              currentLocation: "Traveling",
              holder: selectedRecipient.fullName,
            }
          : asset,
      ),
    );
    setFeedback(`Signed out ${selectedAssetIds.length} asset(s) to ${selectedRecipient.fullName}.`);
    resetSelection();
  };

  const performMockSignIn = () => {
    if (!selectedLocation) {
      setFeedback("Choose the final sign-in location before processing.");
      return;
    }

    setMockAssets((current) =>
      current.map((asset) =>
        selectedAssetIds.includes(asset.id)
          ? {
              ...asset,
              state: outcome,
              currentLocation: selectedLocation.name,
              holder: null,
            }
          : asset,
      ),
    );
    setFeedback(
      outcome === "Damaged"
        ? `Signed in ${selectedAssetIds.length} asset(s) as damaged to ${selectedLocation.name}. Damage lock should follow in live mode.`
        : `Signed in ${selectedAssetIds.length} asset(s) to ${selectedLocation.name}.`,
    );
    resetSelection();
  };

  const submitAction = async () => {
    if (selectedAssetIds.length === 0) {
      setFeedback("Select at least one asset first.");
      return;
    }

    if (mode === "Sign Out") {
      if (!selectedRecipient) {
        setFeedback("Choose a recipient before signing assets out.");
        return;
      }

      if (!isSupabaseEnabled) {
        performMockSignOut();
        return;
      }

      try {
        await live.runSignOut({
          assetIds: selectedAssetIds,
          holderId: selectedRecipient.id,
          note,
        });
        setFeedback(`Signed out ${selectedAssetIds.length} asset(s) to ${selectedRecipient.fullName}.`);
        resetSelection();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Sign-out failed.");
      }

      return;
    }

    if (!selectedLocation) {
      setFeedback("Choose the final sign-in location before processing.");
      return;
    }

    if (!isSupabaseEnabled) {
      performMockSignIn();
      return;
    }

    try {
      await live.runSignIn({
        assetIds: selectedAssetIds,
        finalLocationId: selectedLocation.id,
        outcome,
        note,
      });
      setFeedback(
        outcome === "Damaged"
          ? `Signed in ${selectedAssetIds.length} asset(s) as damaged to ${selectedLocation.name}.`
          : `Signed in ${selectedAssetIds.length} asset(s) to ${selectedLocation.name}.`,
      );
      resetSelection();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Sign-in failed.");
    }
  };

  return (
    <RoleGate allow={["admin", "asset_manager"]}>
      <Screen title="Check-out/In" subtitle="Manager and admin workspace with Standard as the default tab.">
        <View style={styles.tabs}>
          {tabs.map((item) => (
            <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, item === tab && styles.tabActive]}>
              <Text style={[styles.tabText, item === tab && styles.tabTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        {tab === "Standard" ? (
          <>
            <Panel title="Standard Workspace" subtitle="Asset-first sign out. Assigned-asset-first sign in. Direct intake supported without a prior return request.">
              <View style={styles.modeRow}>
                {(["Sign Out", "Sign In"] as StandardMode[]).map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => {
                      setMode(item);
                      resetSelection();
                      setFeedback("Selection reset for the new standard mode.");
                    }}
                    style={[styles.modeButton, mode === item && styles.modeButtonActive]}
                  >
                    <Text style={[styles.modeText, mode === item && styles.modeTextActive]}>{item}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.note}>{mode === "Sign Out" ? "Choose available assets, then pick the receiving user." : "Choose assigned assets, then set final location and outcome."}</Text>
              <Badge label={selectedCountText} tone="#4ade80" />
            </Panel>

            <Panel
              title={mode === "Sign Out" ? "Recipient Context" : "Sign-in Context"}
              subtitle={isSupabaseEnabled ? "Live Supabase queries are active for Standard operations." : "Running in scaffold mode with local state only."}
            >
              {mode === "Sign Out" ? (
                <>
                  <View style={styles.choiceWrap}>
                    {recipients.map((recipient) => {
                      const selected = recipient.id === selectedRecipientId;
                      return (
                        <Pressable
                          key={recipient.id}
                          onPress={() => setSelectedRecipientId(recipient.id)}
                          style={[styles.choiceCard, selected && styles.choiceCardActive]}
                        >
                          <Text style={styles.choiceTitle}>{recipient.fullName}</Text>
                          <Text style={styles.choiceMeta}>
                            {recipient.role.replace("_", " ")} / {recipient.homeBase}
                          </Text>
                          <Text style={styles.choiceMeta}>{recipient.department ?? "No department"}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {recipients.length === 0 ? <Text style={styles.empty}>No eligible recipients returned for your role and location.</Text> : null}
                </>
              ) : (
                <>
                  <View style={styles.choiceWrap}>
                    {locations.map((location) => {
                      const selected = location.id === selectedLocationId;
                      return (
                        <Pressable
                          key={location.id}
                          onPress={() => setSelectedLocationId(location.id)}
                          style={[styles.choiceCard, selected && styles.choiceCardActive]}
                        >
                          <Text style={styles.choiceTitle}>{location.name}</Text>
                          <Text style={styles.choiceMeta}>Final sign-in destination</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={styles.modeRow}>
                    {(["Available", "Damaged"] as const).map((item) => (
                      <Pressable key={item} onPress={() => setOutcome(item)} style={[styles.outcomeButton, outcome === item && styles.outcomeButtonActive]}>
                        <Text style={[styles.modeText, outcome === item && styles.modeTextActive]}>{item}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
              <TextInput
                placeholder={mode === "Sign Out" ? "Operational note" : "Sign-in note / observed condition"}
                placeholderTextColor="#6f8b79"
                style={styles.input}
                value={note}
                onChangeText={setNote}
              />
            </Panel>

            <Panel
              title={mode === "Sign Out" ? "Available Assets" : "Assigned Assets"}
              subtitle={mode === "Sign Out" ? "Select one or more available units for a shared sign-out." : "Select one or more assigned units for the same sign-in outcome and location."}
            >
              <View style={styles.list}>
                {activeAssets.map((asset) => {
                  const selected = selectedAssetIds.includes(asset.id);
                  return (
                    <Pressable key={asset.id} onPress={() => toggleAsset(asset.id)} style={[styles.assetRow, selected && styles.assetRowActive]}>
                      <View style={styles.assetCopy}>
                        <Text style={styles.assetTitle}>
                          {asset.tag} / {asset.name}
                        </Text>
                        <Text style={styles.assetMeta}>
                          {asset.serial} / {asset.currentLocation} / {asset.department ?? "No department"}
                        </Text>
                        {asset.holder ? <Text style={styles.assetMeta}>Holder: {asset.holder}</Text> : null}
                      </View>
                      <Badge label={selected ? "Selected" : asset.state} tone={selected ? "#4ade80" : "#38bdf8"} />
                    </Pressable>
                  );
                })}
              </View>
              {activeAssets.length === 0 ? <Text style={styles.empty}>No assets are currently available for this Standard mode.</Text> : null}
            </Panel>

            <Panel title="Execution" subtitle="Standard sign-out creates recipient approvals. Standard damaged sign-in creates a damage lock case.">
              <DetailRow label="Selected assets" value={String(selectedAssetIds.length)} />
              <DetailRow label={mode === "Sign Out" ? "Recipient" : "Final location"} value={mode === "Sign Out" ? selectedRecipient?.fullName ?? "Not selected" : selectedLocation?.name ?? "Not selected"} />
              {mode === "Sign In" ? <DetailRow label="Outcome" value={outcome} /> : null}
              <Text style={styles.feedback}>{feedback}</Text>
              <Pressable onPress={() => void submitAction()} style={[styles.submitButton, busy && styles.submitButtonDisabled]} disabled={busy}>
                <Text style={styles.submitButtonText}>
                  {busy ? "Working..." : mode === "Sign Out" ? "Run Standard Sign Out" : "Run Standard Sign In"}
                </Text>
              </Pressable>
            </Panel>
          </>
        ) : tab === "Permanent" ? (
          <>
            <Panel title="Permanent Assignment Workspace" subtitle={descriptions[tab]}>
              <Text style={styles.note}>Permanent items remain assigned and traveling until an explicit sign-in return is processed.</Text>
              <DetailRow label="Visible candidates" value={String(permanentAssets.length)} />
            </Panel>
            <Panel title="Assigned Assets" subtitle="Start from currently assigned assets for reassignment or return planning.">
              <View style={styles.list}>
                {permanentAssets.map((asset) => (
                  <View key={asset.id} style={styles.assetRow}>
                    <View style={styles.assetCopy}>
                      <Text style={styles.assetTitle}>{asset.tag} / {asset.name}</Text>
                      <Text style={styles.assetMeta}>{asset.serial} / {asset.currentLocation} / {asset.holder ?? "No holder"}</Text>
                    </View>
                    <Badge label={asset.state} tone="#38bdf8" />
                  </View>
                ))}
              </View>
              {permanentAssets.length === 0 ? <Text style={styles.empty}>No assigned assets are available for permanent workflow actions.</Text> : null}
            </Panel>
          </>
        ) : tab === "Stationed" ? (
          <>
            <Panel title="Stationed Workspace" subtitle={descriptions[tab]}>
              <Text style={styles.note}>Stationed assets can be issued for temporary use, then signed back in as Stationed, Available, or Damaged.</Text>
              <DetailRow label="Stationed assets" value={String(stationedAssets.length)} />
            </Panel>
            <Panel title="Stationed Assets" subtitle="Resting-state inventory available for temporary-use issue.">
              <View style={styles.list}>
                {stationedAssets.map((asset) => (
                  <View key={asset.id} style={styles.assetRow}>
                    <View style={styles.assetCopy}>
                      <Text style={styles.assetTitle}>{asset.tag} / {asset.name}</Text>
                      <Text style={styles.assetMeta}>{asset.serial} / {asset.currentLocation} / {asset.department ?? "No department"}</Text>
                    </View>
                    <Badge label={asset.state} tone="#8b5cf6" />
                  </View>
                ))}
              </View>
              {stationedAssets.length === 0 ? <Text style={styles.empty}>No stationed assets are currently available.</Text> : null}
            </Panel>
          </>
        ) : tab === "Sunday Kits" ? (
          <>
            <Panel title="Sunday Kits Workspace" subtitle={descriptions[tab]}>
              <Text style={styles.note}>Saved kit definitions are now backed by real schema and shown here for deployment planning.</Text>
              <DetailRow label="Kit definitions" value={String(kitRows.length)} />
            </Panel>
            <Panel title="Kit Definitions" subtitle="Kit-level deployment surface with item-level visibility and partial returns.">
              <View style={styles.list}>
                {kitRows.map((kit) => (
                  <View key={kit.id} style={styles.assetRow}>
                    <View style={styles.assetCopy}>
                      <Text style={styles.assetTitle}>{kit.title}</Text>
                      <Text style={styles.assetMeta}>{kit.subtitle}</Text>
                    </View>
                    <Badge label="Kit" tone="#f59e0b" />
                  </View>
                ))}
              </View>
              {kitRows.length === 0 ? <Text style={styles.empty}>No kit definitions are configured yet.</Text> : null}
            </Panel>
          </>
        ) : tab === "Returns" ? (
          <>
            <Panel title="Return Monitor" subtitle={descriptions[tab]}>
              <Text style={styles.note}>This tab is read-only by design. Accepted returns should already have been signed in from Approvals.</Text>
            </Panel>
            <Panel title="Return Queue" subtitle="Pending and completed return requests for awareness only.">
              <View style={styles.list}>
                {returnMonitorRows.map((item) => (
                  <View key={item.id} style={styles.assetRow}>
                    <View style={styles.assetCopy}>
                      <Text style={styles.assetTitle}>{item.title}</Text>
                      <Text style={styles.assetMeta}>{item.subtitle}</Text>
                    </View>
                    <Badge label="Monitor" tone="#38bdf8" />
                  </View>
                ))}
              </View>
              {returnMonitorRows.length === 0 ? <Text style={styles.empty}>No return requests are available for monitoring.</Text> : null}
            </Panel>
          </>
        ) : (
          <>
            <Panel title="QR Scan Workspace" subtitle={descriptions[tab]}>
              <View style={styles.modeRow}>
                {(["Sign Out", "Sign In"] as StandardMode[]).map((item) => (
                  <Pressable key={item} onPress={() => setQrMode(item)} style={[styles.modeButton, qrMode === item && styles.modeButtonActive]}>
                    <Text style={[styles.modeText, qrMode === item && styles.modeTextActive]}>{item}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput placeholder="Scan token, tag, or asset name" placeholderTextColor="#6f8b79" style={styles.input} value={qrInput} onChangeText={setQrInput} />
              <Pressable onPress={addQrAsset} style={styles.submitButton}>
                <Text style={styles.submitButtonText}>Add To QR Batch</Text>
              </Pressable>
            </Panel>
            <Panel title="QR Batch" subtitle="One active batch per mode and compatible workflow context.">
              <View style={styles.list}>
                {qrBatch.map((asset) => (
                  <View key={asset.id} style={styles.assetRow}>
                    <View style={styles.assetCopy}>
                      <Text style={styles.assetTitle}>{asset.tag} / {asset.name}</Text>
                      <Text style={styles.assetMeta}>{asset.serial} / {asset.currentLocation} / {asset.state}</Text>
                    </View>
                    <Badge label={qrMode} tone="#4ade80" />
                  </View>
                ))}
              </View>
              {qrBatch.length === 0 ? <Text style={styles.empty}>The QR batch is empty.</Text> : null}
            </Panel>
          </>
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
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  modeButton: { borderRadius: 14, borderWidth: 1, borderColor: "#173225", backgroundColor: "#08150f", paddingHorizontal: 14, paddingVertical: 12 },
  modeButtonActive: { backgroundColor: "#173225" },
  modeText: { color: "#8eb39c", fontWeight: "700" },
  modeTextActive: { color: "#f6fff9" },
  outcomeButton: { borderRadius: 14, borderWidth: 1, borderColor: "#173225", backgroundColor: "#08150f", paddingHorizontal: 14, paddingVertical: 12 },
  outcomeButtonActive: { backgroundColor: "#123122", borderColor: "#24c05a" },
  note: { color: "#89a995", lineHeight: 20 },
  input: { borderRadius: 14, borderWidth: 1, borderColor: "#173225", backgroundColor: "#08150f", color: "#f6fff9", paddingHorizontal: 14, paddingVertical: 12 },
  choiceWrap: { gap: 10 },
  choiceCard: { borderRadius: 16, borderWidth: 1, borderColor: "#173225", backgroundColor: "#0f1c16", padding: 14, gap: 4 },
  choiceCardActive: { borderColor: "#24c05a", backgroundColor: "#123122" },
  choiceTitle: { color: "#effff3", fontWeight: "800", fontSize: 15 },
  choiceMeta: { color: "#89a995", fontSize: 13 },
  list: { gap: 10 },
  assetRow: { flexDirection: "row", alignItems: "center", gap: 12, justifyContent: "space-between", borderRadius: 16, borderWidth: 1, borderColor: "#173225", backgroundColor: "#0f1c16", padding: 14 },
  assetRowActive: { borderColor: "#24c05a", backgroundColor: "#123122" },
  assetCopy: { flex: 1, gap: 4 },
  assetTitle: { color: "#f6fff9", fontWeight: "800", fontSize: 15 },
  assetMeta: { color: "#89a995", fontSize: 13 },
  empty: { color: "#89a995", lineHeight: 20 },
  feedback: { color: "#d1ead9", lineHeight: 20 },
  submitButton: { alignItems: "center", borderRadius: 14, backgroundColor: "#24c05a", paddingVertical: 14 },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: { color: "#03110b", fontWeight: "900" },
});
