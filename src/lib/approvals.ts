"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ApprovalTab = "recipient" | "asset_requests" | "special_requests" | "returns" | "damage_locks";
export type ApprovalAction = "send_reminder" | "approve" | "decline" | "request_changes" | "accept_return" | "resolve_available" | "resolve_damaged" | "resolve_lost";

export type ApprovalQueueItem = {
  id: string;
  tab: ApprovalTab;
  requester: string;
  summary: string;
  meta: string;
  status: string;
  reviewTitle: string;
  reviewBody: string;
  actions: ApprovalAction[];
  note?: string;
  locationId?: string | null;
  locationName?: string | null;
  target:
    | { kind: "approval"; id: string }
    | { kind: "damage_case"; id: string }
    | { kind: "none" };
};

export type ApprovalsWorkspaceData = {
  queues: Record<ApprovalTab, ApprovalQueueItem[]>;
  source: "live" | "mixed" | "fallback";
  warnings: string[];
};

type ApprovalRow = {
  id: string;
  approval_type: string | null;
  status: string | null;
  assigned_to: string | null;
  request_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  review_notes: string | null;
};

type RequestRow = {
  id: string;
  workflow_type: string | null;
  source_location_id: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  surname: string | null;
  full_name?: string | null;
};

type LocationRow = {
  id: string;
  name: string;
};

type DamageCaseRow = {
  id: string;
  asset_id: string | null;
  responsible_user_id: string | null;
  status: string | null;
  user_statement: string | null;
  created_at: string | null;
};

type DamageAssetRow = {
  id: string;
  code?: string | null;
  tag?: string | null;
  name: string | null;
  current_location_id?: string | null;
  department_id?: string | null;
};

type DamageReportRow = {
  id: string;
  asset_code: string | null;
  asset_name: string | null;
  created_at: string | null;
  status: string | null;
  damage_type: string | null;
  description: string | null;
};

const emptyQueues = (): Record<ApprovalTab, ApprovalQueueItem[]> => ({
  recipient: [],
  asset_requests: [],
  special_requests: [],
  returns: [],
  damage_locks: [],
});

export const fallbackApprovalsWorkspace: ApprovalsWorkspaceData = {
  source: "fallback",
  warnings: ["Supabase is not configured yet, so Approvals is using the rebuild preview dataset."],
  queues: {
    recipient: [
      {
        id: "r1",
        tab: "recipient",
        requester: "Sarah Ops",
        summary: "Tripod + Battery Kit",
        meta: "Recipient: Barend N | Sent 2026-06-01 09:40",
        status: "Awaiting Recipient",
        reviewTitle: "Recipient approval review",
        reviewBody: "This panel stays decision-complete in v2. Recipient items are reviewed inline, with bulk reminders allowed but no admin override approve/decline bulk action.",
        actions: ["send_reminder"],
        target: { kind: "none" },
      },
    ],
    asset_requests: [
      {
        id: "a1",
        tab: "asset_requests",
        requester: "Michael D",
        summary: "Sunday camera package | 3 assets",
        meta: "Need Date: 2026-06-02 | Location: Centurion | Status: Pending",
        status: "Pending",
        reviewTitle: "Asset request review",
        reviewBody: "Asset Requests review panels show request brief plus requester and asset context, with inline Approve, Decline, and Request Changes actions.",
        actions: ["approve", "decline", "request_changes"],
        target: { kind: "none" },
      },
    ],
    special_requests: [
      {
        id: "s1",
        tab: "special_requests",
        requester: "John D",
        summary: "Permanent reassignment | Wireless Mic",
        meta: "Location: Krugersdorp | Status: Pending",
        status: "Pending",
        reviewTitle: "Special request review",
        reviewBody: "Special Requests panels carry workflow-specific details plus asset context. This queue is where stationed-use and permanent-reassignment logic converges on the approval side.",
        actions: ["approve", "decline", "request_changes"],
        target: { kind: "none" },
      },
    ],
    returns: [
      {
        id: "rt1",
        tab: "returns",
        requester: "Barend N",
        summary: "2 assets return request",
        meta: "Return Date: 2026-06-02 | Return Location: Office | Status: Pending",
        status: "Pending",
        reviewTitle: "Return approval review",
        reviewBody: "Accept Return remains the terminal action in the baseline. Final sign-in location is selected here by the approver and auto-sign-in happens from this surface.",
        actions: ["accept_return", "decline"],
        target: { kind: "none" },
      },
    ],
    damage_locks: [
      {
        id: "d1",
        tab: "damage_locks",
        requester: "Lerato M",
        summary: "Wireless Mic damage case",
        meta: "Lock Date: 2026-05-28 | Form Submitted | Under Review",
        status: "Under Review",
        reviewTitle: "Damage lock review",
        reviewBody: "Damage Locks panels show user form, asset context, and final resolution actions. This is where the manager/admin resolves to Available, Damaged, or Lost.",
        actions: ["resolve_available", "resolve_damaged", "resolve_lost"],
        note: "Battery latch broken during return intake.",
        target: { kind: "none" },
      },
    ],
  },
};

function isMissingSchemaError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("does not exist") ||
    normalized.includes("could not find the function") ||
    normalized.includes("schema cache") ||
    normalized.includes("relation") ||
    normalized.includes("column")
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function formatProfileName(profile: ProfileRow | null | undefined) {
  const name = [profile?.display_name?.trim(), profile?.surname?.trim()].filter(Boolean).join(" ");
  return name || profile?.full_name?.trim() || "Unknown user";
}

function lower(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function getPayloadText(payload: Record<string, unknown> | null | undefined, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = payload?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

function getPayloadLocationId(payload: Record<string, unknown> | null | undefined) {
  return getPayloadText(payload, ["location_id", "source_location_id", "target_location_id"], "") || null;
}

function classifyApprovalTab(approvalType: string, workflowType: string) {
  const normalizedApproval = lower(approvalType);
  const normalizedWorkflow = lower(workflowType);

  if (normalizedApproval.includes("recipient")) return "recipient";
  if (normalizedApproval.includes("return") || normalizedWorkflow.includes("return")) return "returns";
  if (
    normalizedApproval.includes("special") ||
    normalizedApproval.includes("stationed") ||
    normalizedApproval.includes("permanent") ||
    normalizedWorkflow.includes("special") ||
    normalizedWorkflow.includes("stationed") ||
    normalizedWorkflow.includes("permanent")
  ) {
    return "special_requests";
  }
  return "asset_requests";
}

async function loadReferenceMaps(supabase: SupabaseClient, profileIds: string[], locationIds: string[]) {
  const [profilesResult, locationsResult] = await Promise.all([
    profileIds.length > 0
      ? supabase.from("profiles").select("id, display_name, surname, full_name").in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    locationIds.length > 0
      ? supabase.from("locations").select("id, name").in("id", locationIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (locationsResult.error) throw locationsResult.error;

  return {
    profiles: Object.fromEntries(((profilesResult.data ?? []) as ProfileRow[]).map((row) => [row.id, formatProfileName(row)])),
    locations: Object.fromEntries(((locationsResult.data ?? []) as LocationRow[]).map((row) => [row.id, row.name])),
  };
}

async function loadApprovalQueues(supabase: SupabaseClient, activeLocationId: string | null) {
  const queues = emptyQueues();

  const [{ data: approvalRows, error: approvalsError }, { data: requestRows, error: requestsError }] = await Promise.all([
    supabase
      .from("approvals")
      .select("id, approval_type, status, assigned_to, request_id, payload, created_at, review_notes")
      .in("status", ["Pending", "Awaiting Recipient", "Request Changes"])
      .order("created_at", { ascending: false }),
    supabase.from("requests").select("id, workflow_type, source_location_id"),
  ]);

  if (approvalsError) throw approvalsError;
  if (requestsError) throw requestsError;

  const approvals = (approvalRows ?? []) as ApprovalRow[];
  const requests = (requestRows ?? []) as RequestRow[];
  const requestMap = Object.fromEntries(requests.map((row) => [row.id, row]));

  const profileIds = [
    ...new Set(
      approvals.flatMap((row) => [
        row.assigned_to,
        getPayloadText(row.payload, ["requested_by", "assigned_by", "recipient_id"], "") || null,
      ]).filter(Boolean),
    ),
  ] as string[];

  const locationIds = [
    ...new Set(
      approvals.flatMap((row) => {
        const request = row.request_id ? requestMap[row.request_id] : undefined;
        return [request?.source_location_id ?? null, getPayloadLocationId(row.payload)];
      }).filter(Boolean),
    ),
  ] as string[];

  const maps = await loadReferenceMaps(supabase, profileIds, locationIds);

  for (const row of approvals) {
    const request = row.request_id ? requestMap[row.request_id] : undefined;
    const locationId = request?.source_location_id ?? getPayloadLocationId(row.payload);
    if (activeLocationId && locationId && locationId !== activeLocationId) continue;

    const tab = classifyApprovalTab(row.approval_type ?? "", request?.workflow_type ?? "");
    const requesterId = getPayloadText(row.payload, ["requested_by", "assigned_by"], "") || null;
    const recipientId = row.assigned_to ?? (getPayloadText(row.payload, ["recipient_id"], "") || null);
    const requesterName =
      (requesterId ? maps.profiles[requesterId] : "") ||
      getPayloadText(row.payload, ["requested_by_name", "assigned_by_name", "requester_name"], "Unknown user");
    const recipientName =
      (recipientId ? maps.profiles[recipientId] : "") ||
      getPayloadText(row.payload, ["recipient_name"], "Recipient");
    const assetName = getPayloadText(row.payload, ["asset_name", "package_name", "item_name"], "Request item");
    const tag = getPayloadText(row.payload, ["tag", "asset_tag"], "");
    const locationName = locationId ? maps.locations[locationId] ?? "Unknown location" : getPayloadText(row.payload, ["location_name", "source_location_name"], "No location");
    const workflowLabel = request?.workflow_type?.replace(/_/g, " ") ?? row.approval_type ?? "approval";

    queues[tab].push({
      id: row.id,
      tab,
      requester: requesterName,
      summary: tag ? `${assetName} | ${tag}` : assetName,
      meta:
        tab === "recipient"
          ? `Recipient: ${recipientName} | Sent ${formatDateTime(row.created_at)}`
          : `Workflow: ${workflowLabel} | Location: ${locationName} | Sent ${formatDateTime(row.created_at)}`,
      status: row.status ?? "Pending",
      reviewTitle:
        tab === "recipient"
          ? "Recipient approval review"
          : tab === "returns"
            ? "Return approval review"
            : tab === "special_requests"
              ? "Special request review"
              : "Asset request review",
      reviewBody:
        tab === "recipient"
          ? "Recipient approvals are visible here for queue monitoring and reminder follow-up. Final decision happens from the recipient side."
          : tab === "returns"
            ? "Accept Return remains the terminal action. This surface is where the manager/admin resolves the return request."
            : tab === "special_requests"
              ? "Special request approvals are grouped here for stationed-use and permanent-reassignment decisions."
              : "Asset request approvals are grouped here for inline approval, decline, or request-changes handling.",
      actions:
        tab === "recipient"
          ? ["send_reminder"]
          : tab === "returns"
            ? ["accept_return", "decline"]
            : ["approve", "decline", "request_changes"],
      note: row.review_notes ?? getPayloadText(row.payload, ["notes", "reason", "event_context"], ""),
      locationId,
      locationName,
      target: { kind: "approval", id: row.id },
    });
  }

  return queues;
}

async function loadDamageQueues(supabase: SupabaseClient, activeLocationId: string | null) {
  const queues = emptyQueues();

  try {
    const { data: damageRows, error: damageError } = await supabase
      .from("damage_cases")
      .select("id, asset_id, responsible_user_id, status, user_statement, created_at")
      .in("status", ["Locked", "Form Pending", "Form Submitted", "Under Review"])
      .order("created_at", { ascending: false });

    if (damageError) throw damageError;

    const cases = (damageRows ?? []) as DamageCaseRow[];
    const assetIds = [...new Set(cases.map((row) => row.asset_id).filter(Boolean))] as string[];
    const userIds = [...new Set(cases.map((row) => row.responsible_user_id).filter(Boolean))] as string[];

    const [{ data: assetRows, error: assetsError }, maps] = await Promise.all([
      assetIds.length > 0
        ? supabase.from("assets").select("id, code, tag, name, current_location_id, department_id").in("id", assetIds)
        : Promise.resolve({ data: [], error: null }),
      loadReferenceMaps(supabase, userIds, []),
    ]);

    if (assetsError) throw assetsError;

    const assets = (assetRows ?? []) as DamageAssetRow[];
    const locationIds = [...new Set(assets.map((row) => row.current_location_id).filter(Boolean))] as string[];
    const locationMaps = await loadReferenceMaps(supabase, [], locationIds);
    const assetMap = Object.fromEntries(assets.map((row) => [row.id, row]));

    for (const row of cases) {
      const asset = row.asset_id ? assetMap[row.asset_id] : undefined;
      const locationId = asset?.current_location_id ?? null;
      if (activeLocationId && locationId && locationId !== activeLocationId) continue;

      const tag = asset?.code ?? asset?.tag ?? "No tag";
      const name = asset?.name ?? "Damage case";
      const locationName = locationId ? locationMaps.locations[locationId] ?? "Unknown location" : "No location";

      queues.damage_locks.push({
        id: row.id,
        tab: "damage_locks",
        requester: row.responsible_user_id ? maps.profiles[row.responsible_user_id] ?? "Unknown user" : "Unknown user",
        summary: `${name} | ${tag}`,
        meta: `Location: ${locationName} | Opened ${formatDateTime(row.created_at)}`,
        status: row.status ?? "Under Review",
        reviewTitle: "Damage lock review",
        reviewBody: "Damage Locks panels show user form, asset context, and final resolution actions. This is where the manager/admin resolves to Available, Damaged, or Lost.",
        actions: ["resolve_available", "resolve_damaged", "resolve_lost"],
        note: row.user_statement ?? "",
        locationId,
        locationName,
        target: { kind: "damage_case", id: row.id },
      });
    }

    return queues;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Damage queues could not be loaded.";
    if (!isMissingSchemaError(message)) {
      throw error;
    }
  }

  const { data, error } = await supabase
    .from("damage_reports")
    .select("id, asset_code, asset_name, created_at, status, damage_type, description")
    .in("status", ["pending", "completed", "under review"])
    .order("created_at", { ascending: false });

  if (error) throw error;

  for (const row of (data ?? []) as DamageReportRow[]) {
    queues.damage_locks.push({
      id: row.id,
      tab: "damage_locks",
      requester: "Assigned operator",
      summary: `${row.asset_name ?? "Damage case"} | ${row.asset_code ?? "No tag"}`,
      meta: `Opened ${formatDateTime(row.created_at)}`,
      status: row.status ?? "Under Review",
      reviewTitle: "Damage lock review",
      reviewBody: "This damage queue is loading from the newer damage-report surface. Resolution wiring still depends on whether the legacy damage-case RPCs are available.",
      actions: ["resolve_available", "resolve_damaged", "resolve_lost"],
      note: row.description?.trim() || row.damage_type?.trim() || "",
      target: { kind: "none" },
    });
  }

  return queues;
}

export async function loadApprovalsWorkspace(supabase: SupabaseClient, activeLocationId: string | null): Promise<ApprovalsWorkspaceData> {
  const warnings: string[] = [];

  const [approvalResult, damageResult] = await Promise.allSettled([
    loadApprovalQueues(supabase, activeLocationId),
    loadDamageQueues(supabase, activeLocationId),
  ]);

  const approvalQueues =
    approvalResult.status === "fulfilled"
      ? approvalResult.value
      : (() => {
          const message = approvalResult.reason instanceof Error ? approvalResult.reason.message : "Approval queues could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Approval queues are still using fallback data because the live approval tables are not fully available yet." : message);
          return emptyQueues();
        })();

  const damageQueues =
    damageResult.status === "fulfilled"
      ? damageResult.value
      : (() => {
          const message = damageResult.reason instanceof Error ? damageResult.reason.message : "Damage queues could not be loaded.";
          warnings.push(isMissingSchemaError(message) ? "Damage locks are still using fallback data because the live damage tables are not fully available yet." : message);
          return emptyQueues();
        })();

  const queues = emptyQueues();
  for (const tab of Object.keys(queues) as ApprovalTab[]) {
    queues[tab] = [...approvalQueues[tab], ...damageQueues[tab]];
  }

  const successCount = [approvalResult, damageResult].filter((result) => result.status === "fulfilled").length;
  const hasAnyLiveRows = (Object.values(queues).flat().length > 0);
  if (successCount === 0 || !hasAnyLiveRows) {
    return {
      ...fallbackApprovalsWorkspace,
      source: successCount === 0 ? "fallback" : "mixed",
      warnings: [...fallbackApprovalsWorkspace.warnings, ...warnings],
    };
  }

  const source = successCount === 2 ? "live" : "mixed";
  return {
    queues,
    source,
    warnings,
  };
}

export async function reviewApprovalItem(
  supabase: SupabaseClient,
  input: {
    approvalId: string;
    status: "Approved" | "Declined" | "Request Changes";
    reviewNotes?: string;
  },
) {
  return supabase.rpc("review_approval", {
    p_approval_id: input.approvalId,
    p_status: input.status,
    p_review_notes: input.reviewNotes?.trim() || null,
  });
}

export async function resolveDamageCaseItem(
  supabase: SupabaseClient,
  input: {
    caseId: string;
    resolvedState: "Available" | "Damaged";
    conditionNote?: string;
  },
) {
  return supabase.rpc("resolve_damage_case", {
    p_case_id: input.caseId,
    p_resolved_state: input.resolvedState,
    p_condition_note: input.conditionNote?.trim() || null,
  });
}
