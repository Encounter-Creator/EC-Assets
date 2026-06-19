"use client";

import Image from "next/image";
import Link from "next/link";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { usePathname, useSearchParams } from "next/navigation";
import { Bell, ChevronRight, ClipboardList, LayoutGrid, LogOut, MapPin, Menu, Package, ScanLine, Settings, ShieldCheck, UserSquare2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import { useLocationScope } from "@/contexts/location-scope-context";
import { getPrimaryRoleLabel, type AppRole } from "@/lib/auth";
import { dismissNotification as persistDismissNotification, loadNotificationFeed, loadNotifications, matchesNotificationTarget, saveNotifications, clearNotifications as persistClearNotifications, type AppNotification } from "@/lib/notifications";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  show: (roles: AppRole[]) => boolean;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid, show: () => true },
  { href: "/inventory", label: "Inventory", icon: Package, show: (roles) => roles.includes("admin") || roles.includes("main_admin") || roles.includes("asset_manager") || roles.includes("staff") },
  { href: "/check-out-in", label: "Check-out/In", icon: ScanLine, show: (roles) => roles.includes("admin") || roles.includes("main_admin") || roles.includes("asset_manager") },
  { href: "/my-assets", label: "My Assets", icon: UserSquare2, show: () => true },
  { href: "/requests", label: "Requests", icon: ClipboardList, show: (roles) => roles.includes("admin") || roles.includes("main_admin") || roles.includes("staff") },
  { href: "/approvals", label: "Approvals", icon: ShieldCheck, show: (roles) => roles.includes("admin") || roles.includes("main_admin") || roles.includes("asset_manager") },
  { href: "/settings", label: "Settings", icon: Settings, show: () => true },
] as const;

export function AppShell({
  children,
  title,
  kicker,
}: {
  children: React.ReactNode;
  title: string;
  kicker: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const { damageLockCase, isDamageLocked, profileName, roles, user } = useAuth();
  const { activeLocationId, locations, selectedLocationId, setSelectedLocationId } = useLocationScope();
  const notificationRefreshInFlightRef = useRef(false);
  const lastNotificationRefreshAtRef = useRef(0);
  const visibleNavItems = navItems.filter((item) => item.show(roles));
  const mobilePrimaryNav = visibleNavItems.slice(0, 4);
  const roleLabel = getPrimaryRoleLabel(roles);
  const visibleNotifications = useMemo(
    () =>
      notifications.map((item) =>
        !item.read && matchesNotificationTarget(pathname, searchParams, item.href) ? { ...item, read: true } : item,
      ),
    [notifications, pathname, searchParams],
  );
  const unreadCount = useMemo(() => visibleNotifications.filter((item) => !item.read).length, [visibleNotifications]);

  const mergeLoadedNotifications = useCallback((nextNotifications: AppNotification[]) => {
    setNotifications((current) => {
      const damageLockNotification =
        isDamageLocked && damageLockCase
          ? [
              {
                id: `damage-lock:${damageLockCase.id}`,
                title: "Damage lock requires your statement",
                body: `${damageLockCase.assetTag} is blocking normal workflows until you complete the damage form.`,
                category: "damage" as const,
                priority: "high" as const,
                createdAt: damageLockCase.openedAt ?? new Date().toISOString(),
                href: "/damage-lock",
                read: false,
              },
            ]
          : [];

      const nextById = new Map([...nextNotifications, ...damageLockNotification].map((item) => [item.id, item]));
      for (const item of current) {
        if (nextById.has(item.id)) {
          nextById.set(item.id, { ...nextById.get(item.id)!, read: item.read });
        }
      }
      return [...nextById.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });
  }, [damageLockCase, isDamageLocked]);

  const refreshNotificationFeed = useCallback(async (force = false) => {
    if (!user) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const now = Date.now();
    if (!force) {
      if (notificationRefreshInFlightRef.current) return;
      if (now - lastNotificationRefreshAtRef.current < 15000) return;
    }

    notificationRefreshInFlightRef.current = true;
    lastNotificationRefreshAtRef.current = now;
    try {
      const nextNotifications = await loadNotificationFeed({
        supabase,
        userId: user.id,
        roles,
        activeLocationId,
      });

      mergeLoadedNotifications(nextNotifications);
    } finally {
      notificationRefreshInFlightRef.current = false;
    }
  }, [activeLocationId, mergeLoadedNotifications, roles, user]);

  useEffect(() => {
    if (!user) return;
    const nextNotifications = loadNotifications(user.id, roles);
    queueMicrotask(() => {
      setNotifications(nextNotifications);
    });
  }, [roles, user]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      void refreshNotificationFeed(true).catch(() => {
        if (!cancelled) {
          // Keep the existing local notification state if the live refresh fails.
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [refreshNotificationFeed]);

  useEffect(() => {
    if (!user) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      refreshTimeout = setTimeout(() => {
        void refreshNotificationFeed();
      }, 1500);
    };

    let channel: RealtimeChannel | null = supabase.channel(`assets-notifications:${user.id}:${activeLocationId ?? "all"}`);
    for (const table of ["approvals", "requests", "return_requests", "damage_cases", "kit_deployments", "assets"]) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        scheduleRefresh,
      );
    }
    channel.subscribe();

    return () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [activeLocationId, refreshNotificationFeed, user]);

  useEffect(() => {
    if (!user) return;
    saveNotifications(user.id, visibleNotifications);
  }, [user, visibleNotifications]);

  const markNotificationRead = (notificationId: string) => {
    setNotifications((current) =>
      current.map((item) => (item.id === notificationId ? { ...item, read: true } : item)),
    );
  };

  const dismissNotification = (notificationId: string) => {
    setNotifications((current) => {
      if (user) {
        persistDismissNotification(user.id, notificationId, current);
      }
      return current.filter((item) => item.id !== notificationId);
    });
  };

  const markAllNotificationsRead = () => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  };

  const clearNotifications = () => {
    setNotifications((current) => {
      if (user) {
        persistClearNotifications(user.id, current);
      }
      return [];
    });
  };

  return (
    <div className="app-mobile-shell relative flex min-h-screen text-foreground">
      <aside className="sticky top-4 ml-4 mr-3 mt-4 hidden h-[calc(100dvh-2rem)] w-[260px] shrink-0 md:flex">
        <Sidebar pathname={pathname} navItems={visibleNavItems} />
      </aside>

      {mobileOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation overlay"
          />
          <aside className="fixed inset-y-0 right-0 z-50 w-80 max-w-[88vw] border-l border-primary/12 bg-[hsl(var(--sidebar-background))] p-4 shadow-[var(--shadow-strong)] md:hidden">
            <div className="mb-4 flex items-center justify-between">
              <Brand />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-full border border-primary/18 bg-card/70 p-2 text-muted-foreground"
                aria-label="Close navigation"
              >
                <X size={18} />
              </button>
            </div>
            <Sidebar pathname={pathname} navItems={visibleNavItems} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </>
      )}

      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto pt-[var(--app-safe-top)]">
        <header className="sticky top-0 z-30 px-3 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between gap-3 rounded-[1.75rem] border border-primary/14 bg-background/92 px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur-xl">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="rounded-full border border-primary/18 bg-card/70 p-2 text-muted-foreground md:hidden"
                aria-label="Open navigation"
              >
                <Menu size={18} />
              </button>
              <Image src="/icon-512.png" alt="Assets" width={36} height={36} className="size-9 shrink-0 object-contain" priority />
              <div className="min-w-0">
                <div className="truncate font-mono text-[11px] uppercase tracking-[0.22em] text-primary/72">{kicker}</div>
                <div className="truncate font-display text-xl text-foreground glow-soft">{title}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((current) => !current)}
                  className="relative rounded-full border border-primary/18 bg-card/70 p-2 text-muted-foreground"
                  aria-label="Open notifications"
                >
                  <Bell size={16} />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full border border-primary/20 bg-primary px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary-foreground">
                      {unreadCount}
                    </span>
                  )}
                </button>
                {notificationsOpen && (
                  <div className="absolute right-0 top-[calc(100%+0.75rem)] z-40 w-[22rem] max-w-[88vw] rounded-[1.4rem] border border-primary/16 bg-background/96 p-4 shadow-[var(--shadow-strong)] backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/72">Notifications</div>
                        <div className="mt-1 text-sm text-foreground">{unreadCount} unread</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNotificationsOpen(false)}
                        className="rounded-full border border-primary/12 p-2 text-muted-foreground"
                        aria-label="Close notifications"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        className="rounded-full border border-primary/18 px-3 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
                      >
                        Mark all read
                      </button>
                      <button
                        type="button"
                        onClick={clearNotifications}
                        className="rounded-full border border-destructive/20 px-3 py-1 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive/10"
                      >
                        Clear all
                      </button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {visibleNotifications.length === 0 ? (
                        <div className="rounded-[1rem] border border-dashed border-primary/14 px-4 py-8 text-center text-sm text-muted-foreground">
                          No notifications saved.
                        </div>
                      ) : (
                        visibleNotifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={cn(
                              "block rounded-[1rem] border px-4 py-3 transition-colors",
                              notification.read ? "border-primary/10 bg-card/35" : "border-primary/20 bg-primary/8",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <Link
                                href={notification.href ?? pathname}
                                prefetch={false}
                                onClick={() => {
                                  markNotificationRead(notification.id);
                                  setNotificationsOpen(false);
                                }}
                                className="min-w-0 flex-1"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-medium text-foreground">{notification.title}</span>
                                  <span className={cn(
                                    "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
                                    notification.priority === "high"
                                      ? "border-destructive/22 text-destructive"
                                      : notification.priority === "medium"
                                        ? "border-amber-500/22 text-amber-300"
                                        : "border-primary/18 text-primary/80",
                                  )}>
                                    {notification.priority}
                                  </span>
                                </div>
                                <div className="mt-2 text-sm text-muted-foreground">{notification.body}</div>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-primary/72">
                                  <span>{notification.category}</span>
                                  <span>{new Date(notification.createdAt).toLocaleString()}</span>
                                </div>
                              </Link>
                              <div className="flex shrink-0 items-start gap-2">
                                {!notification.read && <span className="mt-1 size-2 rounded-full bg-primary" />}
                                <button
                                  type="button"
                                  onClick={() => dismissNotification(notification.id)}
                                  className="rounded-full border border-primary/12 p-1.5 text-muted-foreground transition-colors hover:bg-primary/8 hover:text-foreground"
                                  aria-label={`Dismiss ${notification.title}`}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="hidden items-center gap-2 rounded-full border border-primary/18 bg-card/70 px-4 py-2 md:inline-flex">
                <span className="text-sm">{profileName || "Operator"}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary/70">{roleLabel}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-3 pb-[calc(var(--app-mobile-nav-height)+1rem)] sm:px-6 sm:pb-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-primary/12 bg-background/96 px-2 pb-[var(--app-safe-bottom)] pt-2 shadow-[0_-14px_34px_rgba(0,0,0,0.28)] backdrop-blur-xl md:hidden">
          <div className="mx-auto grid max-w-md grid-cols-5 gap-1 pb-1">
            {mobilePrimaryNav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className={cn(
                    "flex min-h-[4rem] flex-col items-center justify-center gap-1 rounded-xl px-1 pb-1.5 pt-2 text-[10px] font-semibold transition-colors",
                    active ? "bg-primary/14 text-primary" : "text-muted-foreground hover:bg-primary/8 hover:text-foreground",
                  )}
                >
                  <item.icon size={17} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            {visibleNavItems.length > 4 ? (
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="flex min-h-[4rem] flex-col items-center justify-center gap-1 rounded-xl px-1 pb-1.5 pt-2 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-primary/8 hover:text-foreground"
              >
                <ChevronRight size={17} />
                <span>More</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSelectedLocationId(selectedLocationId === "all" ? locations[0]?.id ?? "all" : "all")}
                className="flex min-h-[4rem] flex-col items-center justify-center gap-1 rounded-xl px-1 pb-1.5 pt-2 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-primary/8 hover:text-foreground"
              >
                <MapPin size={17} />
                <span>Scope</span>
              </button>
            )}
          </div>
        </nav>
      </div>
    </div>
  );
}

function Sidebar({
  pathname,
  navItems,
  onNavigate,
}: {
  pathname: string;
  navItems: NavItem[];
  onNavigate?: () => void;
}) {
  const { signOut } = useAuth();
  const { canSelectAllLocations, isLocationLocked, locations, selectedLocationId, selectedLocationName, setSelectedLocationId } = useLocationScope();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.8rem] border border-primary/16 bg-card/60 text-sidebar-foreground shadow-[var(--shadow-soft)] backdrop-blur-sm">
      <div className="border-b border-primary/12 p-4">
        <Brand />
      </div>
      <nav className="flex-1 space-y-2 overflow-y-auto p-3">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-[1.2rem] border px-4 py-3 text-sm font-medium transition-colors",
                active
                  ? "border-primary/20 bg-primary/12 text-primary shadow-[0_0_24px_hsl(var(--primary)/0.1)]"
                  : "border-transparent text-muted-foreground hover:bg-primary/6 hover:text-foreground",
              )}
            >
              <item.icon size={16} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="shrink-0 px-3 pb-3">
        <div className="rounded-[1.2rem] border border-primary/18 bg-background/50 px-3 py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/72">Location scope</div>
          <div className="mt-1 truncate text-sm text-foreground">{selectedLocationName}</div>
          {canSelectAllLocations && locations.length > 0 && (
            <div className="mt-3 flex flex-nowrap gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedLocationId("all")}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                  selectedLocationId === "all" ? "border-primary/30 bg-primary/12 text-primary" : "border-primary/12 text-muted-foreground hover:text-foreground",
                )}
              >
                All
              </button>
              {locations.slice(0, 3).map((location) => (
                  <button
                    key={location.id}
                    type="button"
                    onClick={() => setSelectedLocationId(location.id)}
                    className={cn(
                    "shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                    selectedLocationId === location.id ? "border-primary/30 bg-primary/12 text-primary" : "border-primary/12 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {location.name}
                </button>
              ))}
            </div>
          )}
          {isLocationLocked && (
            <div className="mt-2 text-xs text-muted-foreground">Locked to assigned location by role.</div>
          )}
        </div>
      </div>
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex w-full items-center gap-3 rounded-[1.2rem] border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/12"
        >
          <LogOut size={16} />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <Image src="/icon-512.png" alt="Assets" width={44} height={44} className="size-11 shrink-0 object-contain" priority />
      <div className="min-w-0">
        <div className="font-display text-2xl uppercase tracking-[0.2em] text-primary glow">Assets</div>
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary/70">Encounter Church</div>
      </div>
    </div>
  );
}
