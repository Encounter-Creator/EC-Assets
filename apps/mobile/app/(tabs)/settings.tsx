import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { ActionButton, Card, LoadingState, Screen, SectionTitle, ListRow, StatCard, Pill } from "@mobile/components/Screen";
import { useAuth } from "@mobile/contexts/auth-context";
import { useLocationScope } from "@mobile/contexts/location-scope-context";
import { getSupabaseClient } from "@mobile/lib/supabase";
import {
  createDepartment,
  createLocation,
  getFallbackSettingsWorkspace,
  loadSettingsWorkspace,
  setDepartmentActiveState,
  setLocationActiveState,
  updateMyProfile,
  type SettingsWorkspaceData,
} from "@/lib/settings";

const fallbackWorkspace: SettingsWorkspaceData = {
  ...getFallbackSettingsWorkspace(),
  warnings: ["Supabase is not configured yet, so Settings is using the rebuild preview dataset."],
};

export default function SettingsScreen() {
  const { isAdmin, isAssetManager, isConfigured, profileName, roles, signOut, user } = useAuth();
  const { locations, selectedLocationId, selectedLocationName, canSelectAllLocations, isLocationLocked, setSelectedLocationId } = useLocationScope();
  const [workspace, setWorkspace] = useState<SettingsWorkspaceData>(() => ({
    ...fallbackWorkspace,
    warnings: [],
  }));
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState(profileName);
  const [surname, setSurname] = useState("");
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationIsHomeBase, setNewLocationIsHomeBase] = useState(true);
  const [newDepartmentName, setNewDepartmentName] = useState("");
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

      const nextWorkspace = await loadSettingsWorkspace(supabase);

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
    const nextWorkspace = await loadSettingsWorkspace(supabase);
    setWorkspace(nextWorkspace);
    setLoading(false);
  };

  const canAdmin = isAdmin || isAssetManager;

  const saveProfile = async () => {
    const supabase = getSupabaseClient();
    if (!supabase || !user) {
      setFeedback("Supabase is not configured yet.");
      return;
    }

    try {
      setFeedback(null);
      const { error } = await updateMyProfile(supabase, {
        displayName,
        surname,
      });
      if (error) throw error;
      setFeedback("Profile updated.");
      await refreshWorkspace();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Profile update failed.");
    }
  };

  const saveLocation = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setFeedback("Supabase is not configured yet.");
      return;
    }
    try {
      const { error } = await createLocation(supabase, {
        name: newLocationName,
        isHomeBase: newLocationIsHomeBase,
      });
      if (error) throw error;
      setFeedback("Location created.");
      setNewLocationName("");
      await refreshWorkspace();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Location creation failed.");
    }
  };

  const saveDepartment = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setFeedback("Supabase is not configured yet.");
      return;
    }
    try {
      const { error } = await createDepartment(supabase, {
        name: newDepartmentName,
      });
      if (error) throw error;
      setFeedback("Department created.");
      setNewDepartmentName("");
      await refreshWorkspace();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Department creation failed.");
    }
  };

  return (
    <Screen kicker="Settings" title="Workspace settings" subtitle={`Signed in as ${profileName || "Operator"}.`}>
      <Card>
        <SectionTitle title="Profile" subtitle={roles.join(" - ") || "No roles loaded"} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <StatCard label="Role count" value={roles.length} />
          <StatCard label="Users" value={workspace.users.length} />
          <StatCard label="Locations" value={workspace.locations.length} />
          <StatCard label="Config" value={workspace.config.length} />
        </View>
        <TextInput value={displayName} onChangeText={setDisplayName} placeholder="Display name" placeholderTextColor="#69817a" style={inputStyle} />
        <TextInput value={surname} onChangeText={setSurname} placeholder="Surname" placeholderTextColor="#69817a" style={inputStyle} />
        <ActionButton label="Save profile" onPress={() => void saveProfile()} />
        <ActionButton label="Refresh" onPress={() => void refreshWorkspace()} tone="secondary" />
        {loading ? <LoadingState label="Loading settings" /> : null}
      </Card>

      <Card>
        <SectionTitle title="Location scope" subtitle={isLocationLocked ? "Your location is assigned and cannot be changed." : "Select the active location scope for all screens."} />
        {isLocationLocked ? (
          <Pill label={selectedLocationName} />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {canSelectAllLocations ? (
              <ActionButton
                label="All locations"
                onPress={() => setSelectedLocationId("all")}
                tone={selectedLocationId === "all" ? "primary" : "secondary"}
              />
            ) : null}
            {locations.map((location) => (
              <ActionButton
                key={location.id}
                label={location.name}
                onPress={() => setSelectedLocationId(location.id)}
                tone={selectedLocationId === location.id ? "primary" : "secondary"}
              />
            ))}
          </View>
        )}
      </Card>

      <Card>
        <SectionTitle title="Available settings areas" subtitle={canAdmin ? "Admin and asset-manager tools are visible on mobile." : "Profile tools only on mobile."} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[
            ...workspace.locations.slice(0, 4).map((item) => ({ id: item.id, label: item.name })),
            ...workspace.departments.slice(0, 4).map((item) => ({ id: item.id, label: item.name })),
            ...workspace.kits.slice(0, 4).map((item) => ({ id: item.id, label: item.name })),
          ].map((item) => (
            <Pill key={item.id} label={item.label} />
          ))}
        </View>
      </Card>

      {canAdmin ? (
        <Card>
          <SectionTitle title="Create location" />
          <TextInput value={newLocationName} onChangeText={setNewLocationName} placeholder="New location name" placeholderTextColor="#69817a" style={inputStyle} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <ActionButton label="Home base" onPress={() => setNewLocationIsHomeBase(true)} tone={newLocationIsHomeBase ? "primary" : "secondary"} />
            <ActionButton label="Normal" onPress={() => setNewLocationIsHomeBase(false)} tone={!newLocationIsHomeBase ? "primary" : "secondary"} />
          </View>
          <ActionButton label="Create location" onPress={() => void saveLocation()} />
        </Card>
      ) : null}

      {canAdmin ? (
        <Card>
          <SectionTitle title="Create department" />
          <TextInput value={newDepartmentName} onChangeText={setNewDepartmentName} placeholder="New department name" placeholderTextColor="#69817a" style={inputStyle} />
          <ActionButton label="Create department" onPress={() => void saveDepartment()} />
        </Card>
      ) : null}

      <Card>
        <SectionTitle title="Locations and departments" />
        <View style={{ gap: 10 }}>
          {workspace.locations.slice(0, 6).map((location) => (
            <ListRow
              key={location.id}
              title={location.name}
              meta={location.active ? "active" : "inactive"}
            />
          ))}
        </View>
        <View style={{ gap: 10 }}>
          {workspace.departments.slice(0, 6).map((department) => (
            <ListRow
              key={department.id}
              title={department.name}
              meta={department.active ? "active" : "inactive"}
            />
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle title="Account actions" />
        <ActionButton label="Log out" onPress={() => void signOut()} tone="danger" />
      </Card>

      {feedback ? (
        <Card>
          <Text style={{ color: "#8fd7ab", lineHeight: 20 }}>{feedback}</Text>
        </Card>
      ) : null}

      {workspace.warnings.length > 0 ? (
        <Card>
          <SectionTitle title="Warnings" />
          <View style={{ gap: 6 }}>
            {workspace.warnings.map((warning) => (
              <Text key={warning} style={{ color: "#d7c28a", lineHeight: 20 }}>
                {warning}
              </Text>
            ))}
          </View>
        </Card>
      ) : null}
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
