"use client";

import type { ReadonlyURLSearchParams } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppRole } from "@/lib/auth";
import { loadApprovalsWorkspace } from "@/lib/approvals";
import { loadCheckOperationsWorkspace } from "@/lib/check-operations";
import { loadMyAssetsWorkspace } from "@/lib/my-assets";
import { loadRequestsWorkspace } from "@/lib/requests";

export type AppNotificationCategory = "approvals" | "returns" | "damage" | "reminder" | "system";
export type AppNotificationPriority = "high" | "medium" | "low";

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  category: AppNotificationCategory;
  priority: AppNotificationPriority;
  createdAt: string;
  href?: string;
  read: boolean;
};

type NotificationStorageState = {
  notifications: AppNotification[];
  dismissedIds: string[];
};

type LoadNotificationFeedInput = {
  supabase: SupabaseClient;
  userId: string;
  roles: AppRole[];
  activeLocationId: string | null;
};

function toNotificationTimestamp(value: string | null | undefined, fallback = new Date().toISOString()) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function getStorageKey(userId: string) {
  return `assets-notifications:${userId}`;
}

function seedNotifications(roles: AppRole[]): AppNotification[] {
  const seeded: AppNotification[] = [
    {
      id: "notif-system-1",
      title: "Baseline shell active",
      body: "Notifications now merge live workspace activity with local read and dismiss state.",
      category: "system",
      priority: "low",
      createdAt: new Date("2026-06-02T10:00:00Z").toISOString(),
      read: false,
      href: "/dashboard",
    },
  ];

  if (roles.includes("admin") || roles.includes("main_admin") || roles.includes("asset_manager")) {
    seeded.push({
      id: "notif-reminder-1",
      title: "Recipient reminders supported",
      body: "Recipient queue rows now support reminder follow-up and compatible queues support bulk actions.",
      category: "reminder",
      priority: "medium",
      createdAt: new Date("2026-06-02T09:10:00Z").toISOString(),
      read: false,
      href: "/approvals?tab=recipient",
    });
  }

  return seeded;
}

function defaultStorageState(): NotificationStorageState {
  return {
    notifications: [],
    dismissedIds: [],
  };
}

function readStorageState(userId: string): NotificationStorageState {
  const raw = window.localStorage.getItem(getStorageKey(userId));
  if (!raw) return defaultStorageState();

  try {
    const parsed = JSON.parse(raw) as NotificationStorageState | AppNotification[];
    if (Array.isArray(parsed)) {
      return {
        notifications: parsed,
        dismissedIds: [],
      };
    }

    return {
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      dismissedIds: Array.isArray(parsed.dismissedIds) ? parsed.dismissedIds : [],
    };
  } catch {
    return defaultStorageState();
  }
}

function writeStorageState(userId: string, state: NotificationStorageState) {
  window.localStorage.setItem(getStorageKey(userId), JSON.stringify(state));
}

function mergeNotifications(userId: string, baseNotifications: AppNotification[]) {
  const storedState = readStorageState(userId);
  const storedById = new Map(storedState.notifications.map((notification) => [notification.id, notification]));
  const dismissedIds = new Set(storedState.dismissedIds);

  const merged = baseNotifications
    .filter((notification) => !dismissedIds.has(notification.id))
    .map((notification) => {
      const existing = storedById.get(notification.id);
      return existing ? { ...notification, read: existing.read } : notification;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  writeStorageState(userId, {
    notifications: merged,
    dismissedIds: [...dismissedIds],
  });

  return merged;
}

function buildApprovalsNotifications(input: {
  roles: AppRole[];
  activeLocationId: string | null;
  approvals: Awaited<ReturnType<typeof loadApprovalsWorkspace>>;
}) {
  const notifications: AppNotification[] = [];
  const isManagerRole = input.roles.includes("admin") || input.roles.includes("main_admin") || input.roles.includes("asset_manager");
  if (!isManagerRole) return notifications;

  const approvalRows = [...input.approvals.queues.asset_requests, ...input.approvals.queues.special_requests, ...input.approvals.queues.returns];
  if (approvalRows.length > 0) {
    const topItem = approvalRows[0];
    notifications.push({
      id: `live-approvals:${input.activeLocationId ?? "all"}`,
      title: `${approvalRows.length} approval item${approvalRows.length === 1 ? "" : "s"} waiting`,
      body: `Top queue item: ${topItem.summary}`,
      category: "approvals",
      priority: approvalRows.length >= 5 ? "high" : "medium",
      createdAt: new Date().toISOString(),
      href: `/approvals?tab=${topItem.tab}&itemId=${encodeURIComponent(topItem.id)}`,
      read: false,
    });
  }

  if (input.approvals.queues.damage_locks.length > 0) {
    const topDamage = input.approvals.queues.damage_locks[0];
    notifications.push({
      id: `live-damage-queue:${input.activeLocationId ?? "all"}`,
      title: `${input.approvals.queues.damage_locks.length} damage case${input.approvals.queues.damage_locks.length === 1 ? "" : "s"} under review`,
      body: `Next damage review: ${topDamage.summary}`,
      category: "damage",
      priority: "high",
      createdAt: new Date().toISOString(),
      href: `/approvals?tab=damage_locks&itemId=${encodeURIComponent(topDamage.id)}`,
      read: false,
    });
  }

  if (input.approvals.queues.recipient.length > 0) {
    const topRecipient = input.approvals.queues.recipient[0];
    notifications.push({
      id: `live-recipient:${input.activeLocationId ?? "all"}`,
      title: `${input.approvals.queues.recipient.length} recipient follow-up item${input.approvals.queues.recipient.length === 1 ? "" : "s"}`,
      body: `Reminder queue: ${topRecipient.summary}`,
      category: "reminder",
      priority: "medium",
      createdAt: new Date().toISOString(),
      href: `/approvals?tab=recipient&itemId=${encodeURIComponent(topRecipient.id)}`,
      read: false,
    });
  }

  return notifications;
}

function buildOperationsNotifications(input: {
  roles: AppRole[];
  activeLocationId: string | null;
  operations: Awaited<ReturnType<typeof loadCheckOperationsWorkspace>>;
}) {
  const notifications: AppNotification[] = [];
  const isManagerRole = input.roles.includes("admin") || input.roles.includes("main_admin") || input.roles.includes("asset_manager");
  if (!isManagerRole) return notifications;

  const pendingReturns = input.operations.returnMonitor.filter((row) => row.status === "Pending" || row.workflow_status === "Pending");
  if (pendingReturns.length > 0) {
    const topReturn = pendingReturns[0];
    notifications.push({
      id: `live-return-monitor:${input.activeLocationId ?? "all"}`,
      title: `${pendingReturns.length} return request${pendingReturns.length === 1 ? "" : "s"} waiting intake`,
      body: `Next return queue item: ${topReturn.preferred_return_location ?? "No preferred location"} | ${topReturn.status}`,
      category: "returns",
      priority: pendingReturns.length >= 5 ? "high" : "medium",
      createdAt: toNotificationTimestamp(topReturn.created_at),
      href: "/check-out-in?tab=returns",
      read: false,
    });
  }

  const activeDeployments = input.operations.sundayKitDeployments.filter((row) => row.status.toLowerCase() === "deployed");
  if (activeDeployments.length > 0) {
    const topDeployment = activeDeployments[0];
    notifications.push({
      id: `live-sunday-kits:${input.activeLocationId ?? "all"}`,
      title: `${activeDeployments.length} Sunday Kit deployment${activeDeployments.length === 1 ? "" : "s"} still open`,
      body: `${topDeployment.kit_name} at ${topDeployment.deployed_location} has ${topDeployment.item_count - topDeployment.returned_count} item${topDeployment.item_count - topDeployment.returned_count === 1 ? "" : "s"} still out.`,
      category: "system",
      priority: "medium",
      createdAt: toNotificationTimestamp(topDeployment.created_at),
      href: "/check-out-in?tab=sunday_kits",
      read: false,
    });
  }

  const signInBacklog = input.operations.signInAssets.filter((asset) => asset.state === "Assigned" || asset.state === "Traveling");
  if (signInBacklog.length > 0) {
    const topAsset = signInBacklog[0];
    notifications.push({
      id: `live-sign-in-backlog:${input.activeLocationId ?? "all"}`,
      title: `${signInBacklog.length} asset${signInBacklog.length === 1 ? "" : "s"} ready for sign-in`,
      body: `${topAsset.name} (${topAsset.tag}) is still out and available for operational return handling.`,
      category: "system",
      priority: signInBacklog.length >= 10 ? "high" : "low",
      createdAt: new Date().toISOString(),
      href: "/check-out-in?tab=standard&mode=sign_in",
      read: false,
    });
  }

  return notifications;
}

function buildPersonalNotifications(input: {
  myAssets: Awaited<ReturnType<typeof loadMyAssetsWorkspace>>;
  requests?: Awaited<ReturnType<typeof loadRequestsWorkspace>> | null;
}) {
  const notifications: AppNotification[] = [];

  if (input.myAssets.pendingItems.length > 0) {
    const topPending = input.myAssets.pendingItems[0];
    notifications.push({
      id: "live-my-pending",
      title: `${input.myAssets.pendingItems.length} pending item${input.myAssets.pendingItems.length === 1 ? "" : "s"} need your response`,
      body: `${topPending.title} from ${topPending.requestedBy}`,
      category: "approvals",
      priority: "high",
      createdAt: new Date().toISOString(),
      href: "/my-assets?tab=pending",
      read: false,
    });
  }

  const activeDamageHistory = input.myAssets.damageRecords.filter((item) => item.status === "Form Submitted" || item.status === "Under Review");
  if (activeDamageHistory.length > 0) {
    const topDamage = activeDamageHistory[0];
    notifications.push({
      id: "live-my-damage",
      title: `${activeDamageHistory.length} damage incident${activeDamageHistory.length === 1 ? "" : "s"} still active`,
      body: `${topDamage.tag} is ${topDamage.status.toLowerCase()}.`,
      category: "damage",
      priority: "medium",
      createdAt: new Date().toISOString(),
      href: "/my-assets?tab=damage",
      read: false,
    });
  }

  const recentRequestUpdate = input.requests?.requestHistory.find((item) => item.status === "Approved" || item.status === "Declined" || item.status === "Completed");
  if (recentRequestUpdate) {
    notifications.push({
      id: `live-request-update:${recentRequestUpdate.id}`,
      title: `${recentRequestUpdate.type === "return" ? "Return" : recentRequestUpdate.type === "special" ? "Special request" : "Asset request"} updated`,
      body: `${recentRequestUpdate.title} is now ${recentRequestUpdate.status}.`,
      category: recentRequestUpdate.type === "return" ? "returns" : "system",
      priority: recentRequestUpdate.status === "Declined" ? "high" : "medium",
      createdAt: new Date().toISOString(),
      href: "/requests?tab=history",
      read: false,
    });
  }

  return notifications;
}

export function loadNotifications(userId: string, roles: AppRole[]) {
  return mergeNotifications(userId, seedNotifications(roles));
}

export async function loadNotificationFeed(input: LoadNotificationFeedInput) {
  const tasks = [
    loadMyAssetsWorkspace(input.supabase, input.userId),
    loadRequestsWorkspace(input.supabase, input.userId, input.activeLocationId),
    input.roles.includes("admin") || input.roles.includes("main_admin") || input.roles.includes("asset_manager")
      ? loadCheckOperationsWorkspace(input.supabase)
      : Promise.resolve(null),
    input.roles.includes("admin") || input.roles.includes("main_admin") || input.roles.includes("asset_manager")
      ? loadApprovalsWorkspace(input.supabase, input.activeLocationId)
      : Promise.resolve(null),
  ] as const;

  const [myAssetsResult, requestsResult, operationsResult, approvalsResult] = await Promise.allSettled(tasks);

  const baseNotifications = [...seedNotifications(input.roles)];

  if (myAssetsResult.status === "fulfilled") {
    baseNotifications.push(
      ...buildPersonalNotifications({
        myAssets: myAssetsResult.value,
        requests: requestsResult.status === "fulfilled" ? requestsResult.value : null,
      }),
    );
  }

  if (approvalsResult.status === "fulfilled" && approvalsResult.value) {
    baseNotifications.push(
      ...buildApprovalsNotifications({
        roles: input.roles,
        activeLocationId: input.activeLocationId,
        approvals: approvalsResult.value,
      }),
    );
  }

  if (operationsResult.status === "fulfilled" && operationsResult.value) {
    baseNotifications.push(
      ...buildOperationsNotifications({
        roles: input.roles,
        activeLocationId: input.activeLocationId,
        operations: operationsResult.value,
      }),
    );
  }

  return mergeNotifications(input.userId, baseNotifications);
}

export function saveNotifications(userId: string, notifications: AppNotification[]) {
  const current = readStorageState(userId);
  writeStorageState(userId, {
    notifications,
    dismissedIds: current.dismissedIds,
  });
}

export function dismissNotification(userId: string, notificationId: string, notifications: AppNotification[]) {
  const current = readStorageState(userId);
  const nextDismissedIds = Array.from(new Set([...current.dismissedIds, notificationId]));
  writeStorageState(userId, {
    notifications: notifications.filter((item) => item.id !== notificationId),
    dismissedIds: nextDismissedIds,
  });
}

export function clearNotifications(userId: string, notifications: AppNotification[]) {
  const current = readStorageState(userId);
  const nextDismissedIds = Array.from(new Set([...current.dismissedIds, ...notifications.map((item) => item.id)]));
  writeStorageState(userId, {
    notifications: [],
    dismissedIds: nextDismissedIds,
  });
}

export function matchesNotificationTarget(
  pathname: string,
  searchParams: URLSearchParams | ReadonlyURLSearchParams,
  href?: string,
) {
  if (!href) return false;

  const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  const targetUrl = new URL(href, base);
  if (targetUrl.pathname !== pathname) return false;

  for (const [key, value] of targetUrl.searchParams.entries()) {
    if (searchParams.get(key) !== value) {
      return false;
    }
  }

  return true;
}
