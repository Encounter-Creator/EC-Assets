import { useEffect, useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { ActionButton, Card, LoadingState, Screen, SectionTitle, ListRow, Pill } from "@mobile/components/Screen";
import { useAuth } from "@mobile/contexts/auth-context";
import { useLocationScope } from "@mobile/contexts/location-scope-context";
import { getSupabaseClient } from "@mobile/lib/supabase";
import { getAssetStatusLabel, groupAssetsByName, normalizeAssetStatus, type AssetStatus } from "@/lib/assets";
import { fallbackInventoryAssets, loadInventoryWorkspace, type InventoryWorkspaceData } from "@/lib/inventory";
import { matchesSearchQuery } from "@/lib/search";

const fallbackWorkspace: InventoryWorkspaceData = {
  assets: fallbackInventoryAssets,
  source: "fallback",
  warnings: ["Supabase is not configured yet, so Inventory is using the rebuild preview dataset."],
};

export default function InventoryScreen() {
  const { isAdmin, isAssetManager, isConfigured, isStaff } = useAuth();
  const { activeLocationId, selectedLocationName } = useLocationScope();
  const [workspace, setWorkspace] = useState<InventoryWorkspaceData>(() => ({
    ...fallbackWorkspace,
    warnings: [],
  }));
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "all">("all");
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);

  const canBrowseInventory = isAdmin || isAssetManager || isStaff;

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

      try {
        const nextWorkspace = await loadInventoryWorkspace(supabase, activeLocationId);
        if (!cancelled) {
          setWorkspace(nextWorkspace);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Inventory could not be loaded.";
        if (!cancelled) {
          setWorkspace({
            ...fallbackWorkspace,
            warnings: [...fallbackWorkspace.warnings, message],
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [activeLocationId, isConfigured]);

  const filteredAssets = useMemo(
    () =>
      workspace.assets.filter((asset) => {
        const normalizedStatus = normalizeAssetStatus(asset.status);
        const matchesQuery = matchesSearchQuery([asset.name, asset.tag, asset.serial, asset.location, asset.department, asset.holder], query);
        const matchesStatus = statusFilter === "all" || normalizedStatus === statusFilter;
        return matchesQuery && matchesStatus;
      }),
    [query, statusFilter, workspace.assets],
  );

  const groupedAssets = useMemo(() => groupAssetsByName(filteredAssets, (asset) => asset.location), [filteredAssets]);
  const selectedGroup = useMemo(
    () => groupedAssets.find((group) => group.key === selectedGroupKey) ?? groupedAssets[0] ?? null,
    [groupedAssets, selectedGroupKey],
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
    try {
      const nextWorkspace = await loadInventoryWorkspace(supabase, activeLocationId);
      setWorkspace(nextWorkspace);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Inventory could not be refreshed.";
      setWorkspace({
        ...fallbackWorkspace,
        warnings: [...fallbackWorkspace.warnings, message],
      });
    } finally {
      setLoading(false);
    }
  };

  if (!canBrowseInventory) {
    return (
      <Screen kicker="Inventory" title="Access restricted" subtitle="This role does not have general inventory access.">
        <Card>
          <Text style={{ color: "#a8c0b4", lineHeight: 20 }}>Use My Assets for assigned items and personal actions.</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen kicker="Inventory" title="Grouped catalog" subtitle={`Scope: ${selectedLocationName}.`}>
      <Card>
        <SectionTitle title="Search and filter" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name, tag, serial, location, department..."
          placeholderTextColor="#69817a"
          style={{
            backgroundColor: "#08150f",
            borderWidth: 1,
            borderColor: "#20382c",
            borderRadius: 16,
            color: "#f6fff9",
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 15,
          }}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(["all", "available", "assigned", "traveling", "stationed", "damaged"] as const).map((value) => (
            <ActionButton
              key={value}
              label={value === "all" ? "All" : getAssetStatusLabel(value)}
              onPress={() => setStatusFilter(value)}
              tone={statusFilter === value ? "primary" : "secondary"}
            />
          ))}
        </View>
        <ActionButton label={loading ? "Refreshing..." : "Refresh"} onPress={() => void refreshWorkspace()} tone="secondary" />
        {loading ? <LoadingState label="Loading inventory" /> : null}
        {workspace.warnings.length > 0 ? workspace.warnings.map((warning) => <Text key={warning} style={{ color: "#d7c28a" }}>{warning}</Text>) : null}
      </Card>

      <Card>
        <SectionTitle title={`${groupedAssets.length} grouped items`} subtitle={`${workspace.assets.length} assets total`} />
        <View style={{ gap: 10 }}>
          {groupedAssets.map((group) => (
            <ActionButton key={group.key} label={`${group.name} (${group.totalUnits})`} onPress={() => setSelectedGroupKey(group.key)} tone={selectedGroup?.key === group.key ? "primary" : "secondary"} />
          ))}
        </View>
      </Card>

      {selectedGroup ? (
        <Card>
          <SectionTitle title={selectedGroup.name} subtitle={selectedGroup.locationSummary} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <Pill label={`Available ${selectedGroup.counts.available}`} />
            <Pill label={`Assigned ${selectedGroup.counts.assigned}`} />
            <Pill label={`Traveling ${selectedGroup.counts.traveling}`} />
            <Pill label={`Damaged ${selectedGroup.counts.damaged}`} />
          </View>
          <View style={{ gap: 10 }}>
            {selectedGroup.items.map((asset) => (
              <ListRow
                key={asset.id}
                title={`${asset.tag} - ${asset.name}`}
                description={`Serial ${asset.serial} - ${asset.location} - ${asset.department}`}
                meta={getAssetStatusLabel(normalizeAssetStatus(asset.status))}
              />
            ))}
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}
