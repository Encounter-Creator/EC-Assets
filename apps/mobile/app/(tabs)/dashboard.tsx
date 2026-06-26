import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";

import { ActionButton, Card, LoadingState, Screen, SectionTitle, StatCard, ListRow } from "@mobile/components/Screen";
import { useAuth } from "@mobile/contexts/auth-context";
import { useLocationScope } from "@mobile/contexts/location-scope-context";
import { getSupabaseClient } from "@mobile/lib/supabase";
import { getFallbackDashboardWorkspace, loadDashboardWorkspace, type DashboardWorkspaceData } from "@/lib/dashboard";

export default function DashboardScreen() {
  const { isAdmin, isAssetManager, isVolunteer, isConfigured, user } = useAuth();
  const { activeLocationId, isReady: isLocationScopeReady, selectedLocationName } = useLocationScope();
  const role = isAdmin ? "admin" : isAssetManager ? "asset_manager" : isVolunteer ? "volunteer" : "staff";
  const roleTitle = isAdmin ? "Admin" : isAssetManager ? "Asset Manager" : isVolunteer ? "Volunteer" : "Staff";
  const [workspace, setWorkspace] = useState<DashboardWorkspaceData>(() => ({
    ...getFallbackDashboardWorkspace(role),
    warnings: [],
  }));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLocationScopeReady) return;

    let cancelled = false;

    const loadWorkspace = async () => {
      if (!isConfigured || !user) {
        if (!cancelled) {
          setWorkspace(getFallbackDashboardWorkspace(role));
          setLoading(false);
        }
        return;
      }

      const supabase = getSupabaseClient();
      if (!supabase) {
        if (!cancelled) {
          setWorkspace(getFallbackDashboardWorkspace(role));
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setLoading(true);
      }

      const nextWorkspace = await loadDashboardWorkspace(supabase, {
        role,
        userId: user.id,
        activeLocationId,
      });

      if (!cancelled) {
        setWorkspace(nextWorkspace);
        setLoading(false);
      }
    };

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [activeLocationId, isConfigured, isLocationScopeReady, role, user]);

  const sourceLabel = useMemo(() => {
    if (workspace.source === "live") return "Live data";
    if (workspace.source === "mixed") return "Mixed data";
    return "Fallback preview";
  }, [workspace.source]);

  const refreshWorkspace = async () => {
    if (!isConfigured || !user) {
      setWorkspace(getFallbackDashboardWorkspace(role));
      setLoading(false);
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setWorkspace(getFallbackDashboardWorkspace(role));
      setLoading(false);
      return;
    }

    setLoading(true);
    const nextWorkspace = await loadDashboardWorkspace(supabase, {
      role,
      userId: user.id,
      activeLocationId,
    });
    setWorkspace(nextWorkspace);
    setLoading(false);
  };

  return (
    <Screen kicker="Dashboard" title="Operations overview" subtitle={`Signed in as ${roleTitle}. Scope: ${selectedLocationName}.`}>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <SectionTitle title="Status" subtitle={sourceLabel} />
          </View>
          <ActionButton label={loading ? "Refreshing..." : "Refresh"} onPress={() => void refreshWorkspace()} tone="secondary" />
        </View>
        {loading || !isLocationScopeReady ? <LoadingState label="Loading dashboard data" /> : null}
        {workspace.warnings.length > 0 ? (
          <View style={{ gap: 6 }}>
            {workspace.warnings.map((warning) => (
              <Text key={warning} style={{ color: "#d7c28a", lineHeight: 20 }}>
                {warning}
              </Text>
            ))}
          </View>
        ) : null}
      </Card>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {workspace.topCards.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} />
        ))}
      </View>

      {workspace.lowerCards.map((card) => (
        <Card key={card.title}>
          <SectionTitle title={card.title} subtitle="Recent activity and snapshots" />
          <View style={{ gap: 10 }}>
            {card.rows.length === 0 ? (
              <Text style={{ color: "#8fa89b" }}>No rows available.</Text>
            ) : (
              card.rows.map((row, index) => <ListRow key={`${card.title}-${index}`} title={row} />)
            )}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
