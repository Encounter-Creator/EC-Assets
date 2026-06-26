import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "./auth-context";
import { getSupabaseClient, hasSupabaseEnv } from "../lib/supabase";
import { readJson, writeJson } from "../lib/storage";

type ScopedLocation = {
  id: string;
  name: string;
};

type LocationScopeValue = {
  locations: ScopedLocation[];
  selectedLocationId: string;
  selectedLocationName: string;
  activeLocationId: string | null;
  isReady: boolean;
  canSelectAllLocations: boolean;
  isLocationLocked: boolean;
  assignedLocationId: string | null;
  setSelectedLocationId: (locationId: string) => void;
};

const LocationScopeContext = createContext<LocationScopeValue | undefined>(undefined);

const getStorageKey = (userId: string) => `assets-location-scope:${userId}`;

export function LocationScopeProvider({ children }: { children: ReactNode }) {
  const { user, roles, isAdmin, isAssetManager, isVolunteer, assetManagerLocationId, assignedLocationId, isConfigured } = useAuth();
  const [locations, setLocations] = useState<ScopedLocation[]>([]);
  const [selectedLocationId, setSelectedLocationIdState] = useState("all");
  const [isReady, setIsReady] = useState(false);

  const canSelectAllLocations = isAdmin || roles.includes("staff");
  const lockedLocationId = isAssetManager ? assetManagerLocationId ?? assignedLocationId : isVolunteer ? assignedLocationId : null;
  const isLocationLocked = Boolean(lockedLocationId) && !canSelectAllLocations;
  const effectiveSelectedLocationId = !canSelectAllLocations && !lockedLocationId ? "unassigned" : selectedLocationId;

  useEffect(() => {
    if (!isConfigured || !user || !hasSupabaseEnv()) {
      queueMicrotask(() => {
        setIsReady(true);
      });
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      queueMicrotask(() => {
        setIsReady(true);
      });
      return;
    }

    let cancelled = false;

    void supabase
      .from("locations")
      .select("id, name")
      .order("name")
      .then(async (result: any) => {
        const { data, error } = result;
        if (cancelled) return;
        if (error) {
          queueMicrotask(() => {
            setIsReady(true);
          });
          return;
        }

        const nextLocations = (data ?? []) as ScopedLocation[];
        setLocations(nextLocations);

        if (isLocationLocked) {
          const nextLocationId = lockedLocationId ?? "all";
          queueMicrotask(() => {
            setSelectedLocationIdState((current) => (current === nextLocationId ? current : nextLocationId));
            setIsReady(true);
          });
          return;
        }

        if (!canSelectAllLocations) {
          const nextLocationId = lockedLocationId ?? "unassigned";
          queueMicrotask(() => {
            setSelectedLocationIdState((current) => (current === nextLocationId ? current : nextLocationId));
            setIsReady(true);
          });
          return;
        }

        const storageKey = getStorageKey(user.id);
        const stored = await readJson<string | null>(storageKey, null);
        const assignedDefault = lockedLocationId ?? assignedLocationId ?? "all";
        const isValid =
          !stored ||
          stored === "all" ||
          stored === "unassigned" ||
          nextLocations.some((location) => location.id === stored);
        const nextLocationId = isValid ? stored || assignedDefault : assignedDefault;

        queueMicrotask(() => {
          setSelectedLocationIdState((current) => (current === nextLocationId ? current : nextLocationId));
          setIsReady(true);
        });

        if (!isValid) {
          await writeJson(storageKey, assignedDefault);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [assignedLocationId, canSelectAllLocations, isConfigured, isLocationLocked, lockedLocationId, user]);

  const setSelectedLocationId = useCallback(
    (locationId: string) => {
      if (!user) return;
      const nextLocationId = canSelectAllLocations ? locationId : lockedLocationId ?? "unassigned";
      setSelectedLocationIdState(nextLocationId);
      void writeJson(getStorageKey(user.id), nextLocationId);
    },
    [canSelectAllLocations, lockedLocationId, user],
  );

  const selectedLocationName = useMemo(() => {
    if (effectiveSelectedLocationId === "all") return "All locations";
    if (effectiveSelectedLocationId === "unassigned") return "No location assigned";
    return locations.find((location) => location.id === effectiveSelectedLocationId)?.name ?? "No location assigned";
  }, [effectiveSelectedLocationId, locations]);

  const value = useMemo<LocationScopeValue>(
    () => ({
      locations,
      selectedLocationId: effectiveSelectedLocationId,
      selectedLocationName,
      activeLocationId: effectiveSelectedLocationId === "all" ? null : effectiveSelectedLocationId,
      isReady,
      canSelectAllLocations,
      isLocationLocked,
      assignedLocationId: lockedLocationId,
      setSelectedLocationId,
    }),
    [canSelectAllLocations, effectiveSelectedLocationId, isLocationLocked, isReady, locations, lockedLocationId, selectedLocationName, setSelectedLocationId],
  );

  return <LocationScopeContext.Provider value={value}>{children}</LocationScopeContext.Provider>;
}

export function useLocationScope() {
  const context = useContext(LocationScopeContext);
  if (!context) {
    throw new Error("useLocationScope must be used within LocationScopeProvider.");
  }
  return context;
}
