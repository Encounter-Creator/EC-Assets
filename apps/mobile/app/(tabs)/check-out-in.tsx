import { useEffect, useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { ActionButton, Card, LoadingState, Screen, SectionTitle, ListRow, StatCard } from "@mobile/components/Screen";
import { useAuth } from "@mobile/contexts/auth-context";
import { useLocationScope } from "@mobile/contexts/location-scope-context";
import { getSupabaseClient } from "@mobile/lib/supabase";
import {
  getFallbackCheckOperationsWorkspace,
  loadCheckOperationsWorkspace,
  resolveOperationalAssetsByCodes,
  runPermanentAssignment,
  runStandardSignIn,
  runStandardSignOut,
  runStationedCheckIn,
  runStationedCheckout,
  type CheckOperationsWorkspaceData,
} from "@/lib/check-operations";

const fallbackWorkspace: CheckOperationsWorkspaceData = {
  ...getFallbackCheckOperationsWorkspace(),
  warnings: ["Supabase is not configured yet, so Check-out/In will only show the mobile shell."],
};

type OpsMode = "standard_out" | "standard_in" | "permanent" | "stationed_out" | "stationed_in";

export default function CheckOutInScreen() {
  const { isAdmin, isAssetManager, isConfigured } = useAuth();
  const { activeLocationId, selectedLocationName } = useLocationScope();
  const [workspace, setWorkspace] = useState<CheckOperationsWorkspaceData>(() => ({
    ...fallbackWorkspace,
    warnings: [],
  }));
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<OpsMode>("standard_out");
  const [assetCodes, setAssetCodes] = useState("");
  const [holderId, setHolderId] = useState("");
  const [finalLocationId, setFinalLocationId] = useState("");
  const [outcome, setOutcome] = useState<"Available" | "Damaged" | "Stationed">("Available");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const canUseOps = isAdmin || isAssetManager;

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

      const nextWorkspace = await loadCheckOperationsWorkspace(supabase);

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

  useEffect(() => {
    if (!holderId && workspace.recipients.length > 0) {
      setHolderId(workspace.recipients[0].id);
    }
    if (!finalLocationId && workspace.locations.length > 0) {
      setFinalLocationId(workspace.locations[0].id);
    }
  }, [finalLocationId, holderId, workspace.locations, workspace.recipients]);

  const summary = useMemo(
    () => ({
      standard: workspace.signOutAssets.length,
      signIn: workspace.signInAssets.length,
      stationed: workspace.stationedReadyAssets.length,
      returns: workspace.returnMonitor.length,
      kits: workspace.sundayKits.length,
    }),
    [workspace],
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
    const nextWorkspace = await loadCheckOperationsWorkspace(supabase);
    setWorkspace(nextWorkspace);
    setLoading(false);
  };

  const submitAction = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setFeedback("Supabase is not configured yet.");
      return;
    }

    const codes = assetCodes
      .split(/\r?\n|,/)
      .map((code) => code.trim())
      .filter(Boolean);
    if (codes.length === 0) {
      setFeedback("Enter at least one asset code.");
      return;
    }

    try {
      setFeedback(null);
      const resolved = await resolveOperationalAssetsByCodes(supabase, { codes });
      if (resolved.assets.length === 0) {
        throw new Error("No assets were resolved from the entered codes.");
      }

      if (mode === "standard_out") {
        if (!holderId) throw new Error("Choose a holder first.");
        const { error } = await runStandardSignOut(supabase, {
          assetIds: resolved.assets.map((asset) => asset.id),
          holderId,
          note,
        });
        if (error) throw error;
      } else if (mode === "standard_in") {
        if (!finalLocationId) throw new Error("Choose a final location first.");
        const { error } = await runStandardSignIn(supabase, {
          assetIds: resolved.assets.map((asset) => asset.id),
          finalLocationId,
          outcome: outcome === "Stationed" ? "Available" : outcome,
          note,
        });
        if (error) throw error;
      } else if (mode === "permanent") {
        if (!holderId) throw new Error("Choose a holder first.");
        if (!finalLocationId) throw new Error("Choose a home base first.");
        const { error } = await runPermanentAssignment(supabase, {
          assetIds: resolved.assets.map((asset) => asset.id),
          holderId,
          homeBaseLocationId: finalLocationId,
          mode: "direct_issue",
          note,
        });
        if (error) throw error;
      } else if (mode === "stationed_out") {
        if (!holderId) throw new Error("Choose a holder first.");
        const { error } = await runStationedCheckout(supabase, {
          assetIds: resolved.assets.map((asset) => asset.id),
          holderId,
          note,
        });
        if (error) throw error;
      } else if (mode === "stationed_in") {
        if (!finalLocationId) throw new Error("Choose a final location first.");
        const { error } = await runStationedCheckIn(supabase, {
          assetIds: resolved.assets.map((asset) => asset.id),
          finalLocationId,
          outcome,
          note,
        });
        if (error) throw error;
      }

      setFeedback(`Operation completed for ${resolved.assets.length} asset(s).`);
      setAssetCodes("");
      await refreshWorkspace();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Operation failed.");
    }
  };

  if (!canUseOps) {
    return (
      <Screen kicker="Check-out/In" title="Access restricted" subtitle="Only admin and asset-manager roles can use operations.">
        <Card>
          <Text style={{ color: "#a8c0b4" }}>This role does not have operational access.</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen kicker="Check-out/In" title="Operational flow" subtitle={`Scope: ${selectedLocationName}.`}>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <SectionTitle title="Summary" />
          <ActionButton label="Refresh" onPress={() => void refreshWorkspace()} tone="secondary" />
        </View>
        {loading ? <LoadingState label="Loading operations" /> : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <StatCard label="Sign-outs" value={summary.standard} />
          <StatCard label="Sign-ins" value={summary.signIn} />
          <StatCard label="Stationed" value={summary.stationed} />
          <StatCard label="Returns" value={summary.returns} />
          <StatCard label="Kits" value={summary.kits} />
        </View>
      </Card>

      <Card>
        <SectionTitle title="Operation mode" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <ActionButton label="Standard out" onPress={() => setMode("standard_out")} tone={mode === "standard_out" ? "primary" : "secondary"} />
          <ActionButton label="Standard in" onPress={() => setMode("standard_in")} tone={mode === "standard_in" ? "primary" : "secondary"} />
          <ActionButton label="Permanent" onPress={() => setMode("permanent")} tone={mode === "permanent" ? "primary" : "secondary"} />
          <ActionButton label="Stationed out" onPress={() => setMode("stationed_out")} tone={mode === "stationed_out" ? "primary" : "secondary"} />
          <ActionButton label="Stationed in" onPress={() => setMode("stationed_in")} tone={mode === "stationed_in" ? "primary" : "secondary"} />
        </View>

        <TextInput value={assetCodes} onChangeText={setAssetCodes} placeholder="Enter asset codes, one per line" placeholderTextColor="#69817a" style={inputStyle} multiline />

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {workspace.recipients.map((recipient) => (
            <ActionButton
              key={recipient.id}
              label={recipient.full_name}
              onPress={() => setHolderId(recipient.id)}
              tone={holderId === recipient.id ? "primary" : "secondary"}
            />
          ))}
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {workspace.locations.map((location) => (
            <ActionButton
              key={location.id}
              label={location.name}
              onPress={() => setFinalLocationId(location.id)}
              tone={finalLocationId === location.id ? "primary" : "secondary"}
            />
          ))}
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <ActionButton label="Available" onPress={() => setOutcome("Available")} tone={outcome === "Available" ? "primary" : "secondary"} />
          <ActionButton label="Damaged" onPress={() => setOutcome("Damaged")} tone={outcome === "Damaged" ? "primary" : "secondary"} />
          <ActionButton label="Stationed" onPress={() => setOutcome("Stationed")} tone={outcome === "Stationed" ? "primary" : "secondary"} />
        </View>

        <TextInput value={note} onChangeText={setNote} placeholder="Note" placeholderTextColor="#69817a" style={inputStyle} multiline />
        <ActionButton label="Run operation" onPress={() => void submitAction()} />
        {feedback ? <Text style={{ color: "#8fd7ab", lineHeight: 20 }}>{feedback}</Text> : null}
      </Card>

      <Card>
        <SectionTitle title="Ready for standard sign-out" />
        <View style={{ gap: 10 }}>
          {workspace.signOutAssets.slice(0, 6).map((asset) => (
            <ListRow key={asset.id} title={`${asset.tag} - ${asset.name}`} description={`${asset.current_location ?? "Unknown location"} - ${asset.department ?? "No department"}`} meta={asset.state} />
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle title="Return monitor" />
        <View style={{ gap: 10 }}>
          {workspace.returnMonitor.slice(0, 6).map((row) => (
            <ListRow key={row.id} title={row.preferred_return_location ?? "No preferred location"} description={row.note ?? "No note"} meta={row.status} />
          ))}
        </View>
      </Card>
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
