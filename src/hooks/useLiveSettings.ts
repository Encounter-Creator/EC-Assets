import { useQuery } from "@tanstack/react-query";

import {
  listSettingsConfig,
  listSettingsConsumables,
  listSettingsDepartments,
  listSettingsDuplicates,
  listSettingsKits,
  listSettingsLocations,
  listSettingsUsers,
} from "../lib/api";
import { isSupabaseEnabled } from "../lib/supabase";

export function useLiveSettings() {
  const users = useQuery({
    queryKey: ["settings-users"],
    queryFn: listSettingsUsers,
    enabled: isSupabaseEnabled,
  });

  const locations = useQuery({
    queryKey: ["settings-locations"],
    queryFn: listSettingsLocations,
    enabled: isSupabaseEnabled,
  });

  const departments = useQuery({
    queryKey: ["settings-departments"],
    queryFn: listSettingsDepartments,
    enabled: isSupabaseEnabled,
  });

  const kits = useQuery({
    queryKey: ["settings-kits"],
    queryFn: listSettingsKits,
    enabled: isSupabaseEnabled,
  });

  const consumables = useQuery({
    queryKey: ["settings-consumables"],
    queryFn: listSettingsConsumables,
    enabled: isSupabaseEnabled,
  });

  const duplicates = useQuery({
    queryKey: ["settings-duplicates"],
    queryFn: listSettingsDuplicates,
    enabled: isSupabaseEnabled,
  });

  const config = useQuery({
    queryKey: ["settings-config"],
    queryFn: listSettingsConfig,
    enabled: isSupabaseEnabled,
  });

  return {
    users,
    locations,
    departments,
    kits,
    consumables,
    duplicates,
    config,
  };
}
