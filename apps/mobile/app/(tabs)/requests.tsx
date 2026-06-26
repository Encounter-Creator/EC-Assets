import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { ActionButton, Card, LoadingState, Screen, SectionTitle, ListRow, StatCard } from "@mobile/components/Screen";
import { useAuth } from "@mobile/contexts/auth-context";
import { useLocationScope } from "@mobile/contexts/location-scope-context";
import { getSupabaseClient } from "@mobile/lib/supabase";
import {
  fallbackAssignedForReturn,
  fallbackRequestHistory,
  fallbackRequestableAssets,
  loadRequestsWorkspace,
  submitAssetRequest,
  submitReturnRequest,
  submitSpecialRequest,
  type RequestHistoryItem,
  type RequestsWorkspaceData,
  type SpecialRequestType,
} from "@/lib/requests";

const fallbackWorkspace: RequestsWorkspaceData = {
  requestableAssets: fallbackRequestableAssets,
  assignedForReturn: fallbackAssignedForReturn,
  requestHistory: fallbackRequestHistory,
  source: "fallback",
  warnings: ["Supabase is not configured yet, so Requests will only show the rebuild preview dataset."],
};

type RequestMode = "asset" | "return" | "special";

export default function RequestsScreen() {
  const { isConfigured, user } = useAuth();
  const { activeLocationId, locations, selectedLocationName } = useLocationScope();
  const [workspace, setWorkspace] = useState<RequestsWorkspaceData>(() => ({
    ...fallbackWorkspace,
    warnings: [],
  }));
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<RequestMode>("asset");
  const [assetSelections, setAssetSelections] = useState<string[]>([]);
  const [neededFor, setNeededFor] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [note, setNote] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [preferredReturnLocationId, setPreferredReturnLocationId] = useState("");
  const [specialRequestType, setSpecialRequestType] = useState<SpecialRequestType>("Stationed Use");
  const [duration, setDuration] = useState("");
  const [eventContext, setEventContext] = useState("");
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
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

      const nextWorkspace = await loadRequestsWorkspace(supabase, user.id, activeLocationId);

      if (!cancelled) {
        setWorkspace(nextWorkspace);
        setLoading(false);
      }
    };

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [activeLocationId, isConfigured, user]);

  useEffect(() => {
    if (workspace.requestableAssets.length > 0 && assetSelections.length === 0) {
      setAssetSelections([workspace.requestableAssets[0].id]);
    }
    if (!preferredReturnLocationId && locations.length > 0) {
      setPreferredReturnLocationId(locations[0].id);
    }
  }, [assetSelections.length, locations, preferredReturnLocationId, workspace.requestableAssets]);

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
    const nextWorkspace = await loadRequestsWorkspace(supabase, user.id, activeLocationId);
    setWorkspace(nextWorkspace);
    setLoading(false);
  };

  const toggleAssetSelection = (assetId: string) => {
    setAssetSelections((current) =>
      current.includes(assetId) ? current.filter((value) => value !== assetId) : [...current, assetId],
    );
  };

  const submitCurrentRequest = async () => {
    if (!user) {
      setFeedback("Sign in first.");
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setFeedback("Supabase is not configured yet.");
      return;
    }

    try {
      setFeedback(null);
      if (mode === "asset") {
        if (assetSelections.length === 0) throw new Error("Select at least one asset.");
        const { error } = await submitAssetRequest(supabase, {
          activeLocationId: activeLocationId ?? "",
          selectedAssetIds: assetSelections,
          neededFor,
          neededBy,
          note,
        });
        if (error) throw error;
        setFeedback("Asset request submitted.");
      } else if (mode === "return") {
        if (assetSelections.length === 0) throw new Error("Select at least one asset.");
        if (!preferredReturnLocationId) throw new Error("Choose a return location.");
        const { error } = await submitReturnRequest(supabase, {
          activeLocationId,
          selectedAssetIds: assetSelections,
          returnDate,
          preferredReturnLocationId,
          note,
        });
        if (error) throw error;
        setFeedback("Return request submitted.");
      } else {
        if (assetSelections.length !== 1) throw new Error("Select one asset for special request.");
        const { error } = await submitSpecialRequest(supabase, {
          activeLocationId,
          assetId: assetSelections[0],
          requestType: specialRequestType,
          neededBy,
          duration,
          reason: note || "Mobile submission",
          eventContext,
        });
        if (error) throw error;
        setFeedback("Special request submitted.");
      }

      await refreshWorkspace();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Request submission failed.");
    }
  };

  return (
    <Screen kicker="Requests" title="Request hub" subtitle={`Scope: ${selectedLocationName}.`}>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <SectionTitle title="Workspace summary" />
          <ActionButton label="Refresh" onPress={() => void refreshWorkspace()} tone="secondary" />
        </View>
        {loading ? <LoadingState label="Loading requests" /> : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <StatCard label="Requestable" value={workspace.requestableAssets.length} />
          <StatCard label="Returns" value={workspace.assignedForReturn.length} />
          <StatCard label="History" value={workspace.requestHistory.length} />
        </View>
        {workspace.warnings.length > 0
          ? workspace.warnings.map((warning) => (
              <Text key={warning} style={{ color: "#d7c28a", lineHeight: 20 }}>
                {warning}
              </Text>
            ))
          : null}
      </Card>

      <Card>
        <SectionTitle title="Submit request" subtitle="Choose a request type and submit from the same backend workflow as web." />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <ActionButton label="Asset" onPress={() => setMode("asset")} tone={mode === "asset" ? "primary" : "secondary"} />
          <ActionButton label="Return" onPress={() => setMode("return")} tone={mode === "return" ? "primary" : "secondary"} />
          <ActionButton label="Special" onPress={() => setMode("special")} tone={mode === "special" ? "primary" : "secondary"} />
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ color: "#93ac9e", fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" }}>Select assets</Text>
          <View style={{ gap: 8 }}>
            {(mode === "return" ? workspace.assignedForReturn : workspace.requestableAssets).map((asset) => (
              <ActionButton
                key={asset.id}
                label={`${asset.tag} - ${asset.name}`}
                onPress={() => toggleAssetSelection(asset.id)}
                tone={assetSelections.includes(asset.id) ? "primary" : "secondary"}
              />
            ))}
          </View>
        </View>

        <TextInput value={neededFor} onChangeText={setNeededFor} placeholder="Needed for" placeholderTextColor="#69817a" style={inputStyle} />
        <TextInput value={neededBy} onChangeText={setNeededBy} placeholder="Needed by (date/time)" placeholderTextColor="#69817a" style={inputStyle} />
        <TextInput value={returnDate} onChangeText={setReturnDate} placeholder="Return date" placeholderTextColor="#69817a" style={inputStyle} />
        <TextInput value={note} onChangeText={setNote} placeholder="Note" placeholderTextColor="#69817a" style={inputStyle} multiline />
        <TextInput value={duration} onChangeText={setDuration} placeholder="Duration" placeholderTextColor="#69817a" style={inputStyle} />
        <TextInput value={eventContext} onChangeText={setEventContext} placeholder="Event context" placeholderTextColor="#69817a" style={inputStyle} />

        <View style={{ gap: 8 }}>
          <Text style={{ color: "#93ac9e", fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" }}>Preferred return location</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {locations.map((location) => (
              <ActionButton
                key={location.id}
                label={location.name}
                onPress={() => setPreferredReturnLocationId(location.id)}
                tone={preferredReturnLocationId === location.id ? "primary" : "secondary"}
              />
            ))}
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <ActionButton
            label="Stationed Use"
            onPress={() => setSpecialRequestType("Stationed Use")}
            tone={specialRequestType === "Stationed Use" ? "primary" : "secondary"}
          />
          <ActionButton
            label="Permanent Reassignment"
            onPress={() => setSpecialRequestType("Permanent Reassignment")}
            tone={specialRequestType === "Permanent Reassignment" ? "primary" : "secondary"}
          />
        </View>

        {feedback ? <Text style={{ color: "#8fd7ab" }}>{feedback}</Text> : null}
        <ActionButton label="Submit" onPress={() => void submitCurrentRequest()} />
      </Card>

      <Card>
        <SectionTitle title="Recent request history" />
        <View style={{ gap: 10 }}>
          {workspace.requestHistory.length === 0 ? (
            <Text style={{ color: "#8fa89b" }}>No request history available.</Text>
          ) : (
            workspace.requestHistory.map((item: RequestHistoryItem) => (
              <ListRow key={item.id} title={item.title} description={`${item.location} - ${item.date}`} meta={item.status} />
            ))
          )}
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
