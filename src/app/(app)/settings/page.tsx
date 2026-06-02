"use client";

import { Archive, FileText, MapPin, Package, QrCode, RefreshCcw, Settings2, Shield, UserRound, Users, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import { getFallbackSettingsWorkspace, loadSettingsWorkspace, type SettingsWorkspaceData } from "@/lib/settings";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import { SectionShell } from "../layout";

type SettingsTab =
  | "profile"
  | "users"
  | "roles"
  | "locations"
  | "departments"
  | "kits"
  | "consumables"
  | "reports"
  | "duplicates"
  | "config";

const tabs = [
  { id: "profile", label: "Profile", icon: UserRound, show: () => true },
  { id: "users", label: "Users", icon: Users, show: (isAdmin: boolean, isAssetManager: boolean) => isAdmin || isAssetManager },
  { id: "roles", label: "Roles", icon: Shield, show: (isAdmin: boolean) => isAdmin },
  { id: "locations", label: "Locations", icon: MapPin, show: (isAdmin: boolean) => isAdmin },
  { id: "departments", label: "Departments", icon: Archive, show: (isAdmin: boolean) => isAdmin },
  { id: "kits", label: "Kits", icon: Package, show: (isAdmin: boolean) => isAdmin },
  { id: "consumables", label: "Consumables", icon: Wrench, show: (isAdmin: boolean, isAssetManager: boolean) => isAdmin || isAssetManager },
  { id: "reports", label: "Reports", icon: FileText, show: (isAdmin: boolean) => isAdmin },
  { id: "duplicates", label: "Duplicates", icon: Archive, show: (isAdmin: boolean) => isAdmin },
  { id: "config", label: "Config", icon: Settings2, show: (isAdmin: boolean) => isAdmin },
] as const;

export default function SettingsPage() {
  const { isAdmin, isAssetManager, profileName, roles, isConfigured, user, assignedLocationId } = useAuth();
  const [workspace, setWorkspace] = useState<SettingsWorkspaceData>(getFallbackSettingsWorkspace());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  const visibleTabs = useMemo(
    () => tabs.filter((tab) => tab.show(isAdmin, isAssetManager)),
    [isAdmin, isAssetManager],
  );

  const roleLabel = roles.includes("main_admin")
    ? "Main Admin"
    : roles.includes("admin")
      ? "Admin"
      : roles.includes("asset_manager")
        ? "Asset Manager"
        : roles.includes("staff")
          ? "Staff"
          : "Volunteer";

  const homeBaseName = useMemo(
    () => workspace.locations.find((location) => location.id === assignedLocationId)?.name ?? workspace.users.find((entry) => entry.email === user?.email)?.home_base ?? "No home base assigned",
    [assignedLocationId, user?.email, workspace.locations, workspace.users],
  );

  useEffect(() => {
    let cancelled = false;

    const loadWorkspace = async () => {
      if (!isConfigured || !user) {
        if (!cancelled) {
          setWorkspace(getFallbackSettingsWorkspace());
          setLoading(false);
        }
        return;
      }

      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (!cancelled) {
          setWorkspace(getFallbackSettingsWorkspace());
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
      setWorkspace(getFallbackSettingsWorkspace());
      setLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setWorkspace(getFallbackSettingsWorkspace());
      setLoading(false);
      return;
    }

    setLoading(true);
    const nextWorkspace = await loadSettingsWorkspace(supabase);
    setWorkspace(nextWorkspace);
    setLoading(false);
  };

  return (
    <SectionShell title="Settings" kicker="Profile + role-aware operational tabs">
      <div className="space-y-4 sm:space-y-6">
        <section className="app-panel p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="app-kicker">Settings</div>
              <h1 className="app-title mt-2">Role-aware settings workspace now loads live read-side data.</h1>
              <p className="app-subtitle mt-3">
                `Profile` remains visible to all roles, while the operational/admin tabs now pull live section lists where the backend surface exists and fall back safely where it does not.
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-primary/18 bg-primary/8 px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/72">Current profile</div>
              <div className="mt-2 text-sm text-primary">{profileName || "Operator"} | {roleLabel}</div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void refreshWorkspace()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full border border-primary/18 bg-card/55 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw size={14} className={cn(loading && "animate-spin")} />
              {loading ? "Refreshing" : "Refresh"}
            </button>
            <span className="rounded-full border border-primary/12 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Source: {workspace.source === "live" ? "Live data" : workspace.source === "mixed" ? "Mixed data" : "Fallback preview"}
            </span>
          </div>

          {workspace.warnings.length > 0 && (
            <div className="mt-4 rounded-[1.2rem] border border-amber-500/20 bg-amber-500/8 px-4 py-4 text-sm text-amber-100/85">
              <div className="space-y-1">
                {workspace.warnings.map((warning) => (
                  <div key={warning}>{warning}</div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="app-panel overflow-hidden">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,0.36fr)_minmax(0,0.64fr)]">
            <div className="border-b border-primary/12 xl:border-b-0 xl:border-r">
              <div className="p-4 sm:p-5">
                <div className="app-kicker">Tabs</div>
                <div className="mt-2 text-sm text-muted-foreground">Visibility is role-aware. Profile stays visible for everyone.</div>
              </div>

              <div className="space-y-2 px-4 pb-4 sm:px-5 sm:pb-5">
                {visibleTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[1.1rem] border px-4 py-3 text-left text-sm font-medium transition-colors",
                      activeTab === tab.id ? "border-primary/24 bg-primary/12 text-primary" : "border-transparent text-muted-foreground hover:bg-primary/6 hover:text-foreground",
                    )}
                  >
                    <tab.icon size={16} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 sm:p-5">
              {activeTab === "profile" && (
                <div className="space-y-4">
                  <div className="app-kicker">Profile</div>
                  <div className="font-display text-3xl text-foreground glow-soft">Personal operator profile</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FieldCard label="Name" value={profileName || "Operator"} />
                    <FieldCard label="Role" value={roleLabel} />
                    <FieldCard label="Email" value={user?.email ?? "No email available"} />
                    <FieldCard label="Home base" value={homeBaseName} />
                  </div>
                  <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 p-4 text-sm text-muted-foreground">
                    This tab now uses live identity context where available. Final live profile editing and notification preferences still need a dedicated write path.
                  </div>
                </div>
              )}

              {activeTab === "users" && (
                <DataSection
                  title="Users"
                  body="Users uses one shared record structure with split admin versus manager edit sets. The list below now reads from the live settings RPC when available."
                  rows={workspace.users.slice(0, 8).map((entry) => `${entry.full_name} | ${entry.role} | ${entry.home_base ?? "No home base"} | ${entry.locked ? "Locked" : "Active"}`)}
                />
              )}
              {activeTab === "roles" && (
                <DataSection
                  title="Roles"
                  body="Roles remain fixed system roles in v1. There is no custom role or permission editor in the new baseline."
                  rows={["Admin | full operational access", "Asset Manager | one-location operations", "Staff | requests + inventory browse", "Volunteer | assigned-items only"]}
                />
              )}
              {activeTab === "locations" && (
                <DataSection
                  title="Locations"
                  body="Locations remains the admin-managed home for add, disable, retire, and force-retirement handling. The list below now reads from the live settings RPC when available."
                  rows={workspace.locations.slice(0, 8).map((entry) => `${entry.name} | ${entry.active ? "Active" : "Inactive"} | ${entry.is_home_base ? "Home base enabled" : "Temporary only"}`)}
                />
              )}
              {activeTab === "departments" && (
                <DataSection
                  title="Departments"
                  body="Departments remains the admin-managed list for create, rename, merge, archive, and organization controls."
                  rows={workspace.departments.slice(0, 8).map((entry) => `${entry.name} | ${entry.active ? "Active" : "Inactive"}`)}
                />
              )}
              {activeTab === "kits" && (
                <DataSection
                  title="Kits"
                  body="Kits remains the saved kit builder and lifecycle workspace for create, edit, and retire actions."
                  rows={workspace.kits.slice(0, 8).map((entry) => `${entry.name} | ${entry.home_base ?? "No home base"} | ${entry.item_count} item${entry.item_count === 1 ? "" : "s"}`)}
                />
              )}
              {activeTab === "consumables" && (
                <DataSection
                  title="Consumables"
                  body="Consumables remains the operational catalog plus stock-rules workspace available to admins and managers."
                  rows={workspace.consumables.slice(0, 8).map((entry) => `${entry.name} | ${entry.stock_on_hand} ${entry.unit} | Reorder at ${entry.reorder_level}`)}
                />
              )}
              {activeTab === "reports" && (
                <DataSection
                  title="Reports"
                  body="Reports remains the filtered report/export workspace for damage reports, asset history, and accountability history, with CSV, XLSX, and PDF export targets."
                  rows={["Damage reports | export pending", "Asset history | export pending", "Accountability history | export pending"]}
                />
              )}
              {activeTab === "duplicates" && (
                <DataSection
                  title="Duplicates"
                  body="Duplicates remains the admin review queue for compare-and-merge operations, preserving history and leaving merged tombstones."
                  rows={workspace.duplicates.slice(0, 8).map((entry) => `${entry.primary_asset} | ${entry.duplicate_asset} | ${entry.status}`)}
                />
              )}
              {activeTab === "config" && (
                <div className="space-y-4">
                  <DataSection
                    title="Config"
                    body="Config remains the business-rules plus technical/admin switch area and the home for bulk QR export tooling in the baseline."
                    rows={workspace.config.slice(0, 8).map((entry) => `${entry.key} | ${JSON.stringify(entry.value)}`)}
                  />
                  <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 p-4">
                    <div className="flex items-center gap-3">
                      <QrCode size={18} className="text-primary" />
                      <div>
                        <div className="font-display text-xl text-foreground glow-soft">Bulk QR export</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          Packed A4 PDF sheets, filtered by created-date range and standard filters, with 20mm x 20mm labels and UUID-encoded QR payloads.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </SectionShell>
  );
}

function DataSection({
  title,
  body,
  rows,
}: {
  title: string;
  body: string;
  rows: string[];
}) {
  return (
    <div className="space-y-4">
      <div className="app-kicker">{title}</div>
      <div className="font-display text-3xl text-foreground glow-soft">{title} workspace</div>
      <div className="rounded-[1.2rem] border border-primary/12 bg-card/45 p-4 text-sm text-muted-foreground">{body}</div>
      <div className="space-y-2">
        {rows.length === 0 ? (
          <div className="rounded-[1rem] border border-dashed border-primary/14 px-4 py-8 text-center text-sm text-muted-foreground">
            No rows available.
          </div>
        ) : (
          rows.map((row, index) => (
            <div key={`${title}-${index}`} className="rounded-[1rem] border border-primary/12 bg-card/45 px-4 py-3 text-sm text-foreground">
              {row}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FieldCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-primary/12 bg-card/45 px-4 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm text-foreground">{value}</div>
    </div>
  );
}
