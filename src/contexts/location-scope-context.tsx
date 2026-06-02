"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type ScopedLocation = {
  id: string;
  name: string;
};

type LocationScopeValue = {
  locations: ScopedLocation[];
  selectedLocationId: string;
  selectedLocationName: string;
  activeLocationId: string | null;
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

  const canSelectAllLocations = isAdmin || roles.includes("staff");
  const lockedLocationId = isAssetManager ? assetManagerLocationId ?? assignedLocationId : isVolunteer ? assignedLocationId : null;
  const isLocationLocked = Boolean(lockedLocationId) && !canSelectAllLocations;
  const effectiveSelectedLocationId = !canSelectAllLocations && !lockedLocationId ? "unassigned" : selectedLocationId;

  useEffect(() => {
    if (!isConfigured || !user) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let cancelled = false;

    void supabase
      .from("locations")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (!cancelled) {
          setLocations((data ?? []) as ScopedLocation[]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isConfigured, user]);

  useEffect(() => {
    if (!user) return;

    const applySelection = (nextLocationId: string) => {
      queueMicrotask(() => {
        setSelectedLocationIdState((current) => (current === nextLocationId ? current : nextLocationId));
      });
    };

    if (isLocationLocked) {
      applySelection(lockedLocationId ?? "all");
      return;
    }

    if (!canSelectAllLocations) {
      applySelection(lockedLocationId ?? "unassigned");
      return;
    }

    const storageKey = getStorageKey(user.id);
    const stored = window.localStorage.getItem(storageKey);
    const isValid = !stored || stored === "all" || locations.some((location) => location.id === stored);
    const nextLocationId = isValid ? stored || "all" : "all";
    applySelection(nextLocationId);
    if (!isValid) window.localStorage.removeItem(storageKey);
  }, [canSelectAllLocations, isLocationLocked, locations, lockedLocationId, user]);

  const setSelectedLocationId = useCallback(
    (locationId: string) => {
      if (!user) return;
      const nextLocationId = canSelectAllLocations ? locationId : lockedLocationId ?? "unassigned";
      setSelectedLocationIdState(nextLocationId);
      window.localStorage.setItem(getStorageKey(user.id), nextLocationId);
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
      canSelectAllLocations,
      isLocationLocked,
      assignedLocationId: lockedLocationId,
      setSelectedLocationId,
    }),
    [canSelectAllLocations, effectiveSelectedLocationId, isLocationLocked, locations, lockedLocationId, selectedLocationName, setSelectedLocationId],
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
