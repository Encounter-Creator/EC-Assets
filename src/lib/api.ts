import { NotificationCategory, UserProfile } from "../domain/types";
import { isSupabaseEnabled, supabase } from "./supabase";

export type AccessContext = {
  approved: boolean;
  locked: boolean;
  role: UserProfile["role"];
  home_base: string | null;
  department: string | null;
  full_name: string;
  email: string;
};

export type RequestRecord = {
  id: string;
  workflow_type: string;
  status: string;
  source_location_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type DraftRecord = {
  id: string;
  workflow_type: string;
  status: string;
  payload: Record<string, unknown>;
  updated_at: string;
};

export type NotificationItem = {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  urgent: boolean;
  created_at: string;
  resolved_at: string | null;
};

export type ApprovalRecord = {
  id: string;
  approval_type: string;
  status: string;
  assigned_to: string | null;
  request_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  review_notes: string | null;
};

export type DamageCaseRecord = {
  id: string;
  asset_id: string;
  responsible_user_id: string | null;
  status: string;
  user_statement: string | null;
  resolved_state: string | null;
  created_at: string;
  updated_at: string;
};

export async function getMyAccessContext(): Promise<AccessContext | null> {
  if (!isSupabaseEnabled || !supabase) {
    return null;
  }

  const { data, error } = await supabase.rpc("get_my_access_context");
  if (error) {
    throw error;
  }

  return (data as AccessContext | null) ?? null;
}

export async function registerPushToken(expoToken: string, platform: string) {
  if (!isSupabaseEnabled || !supabase) {
    return;
  }

  const { error } = await supabase.rpc("register_push_token", {
    p_expo_token: expoToken,
    p_platform: platform,
  });

  if (error) {
    throw error;
  }
}

export async function saveRequestDraft(workflowType: string, sourceLocationId: string | null, payload: Record<string, unknown>) {
  if (!isSupabaseEnabled || !supabase) {
    return null;
  }

  const { data, error } = await supabase.rpc("save_request_draft", {
    p_workflow_type: workflowType,
    p_source_location_id: sourceLocationId,
    p_payload: payload,
  });

  if (error) {
    throw error;
  }

  return data as DraftRecord;
}

export async function submitDraft(draftId: string) {
  if (!isSupabaseEnabled || !supabase) {
    return null;
  }

  const { data, error } = await supabase.rpc("submit_request_from_draft", {
    p_draft_id: draftId,
  });

  if (error) {
    throw error;
  }

  return data as RequestRecord;
}

export async function listMyRequests(): Promise<RequestRecord[]> {
  if (!isSupabaseEnabled || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("requests")
    .select("id, workflow_type, status, source_location_id, payload, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as RequestRecord[] | null) ?? [];
}

export async function listMyNotifications(): Promise<NotificationItem[]> {
  if (!isSupabaseEnabled || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("id, category, title, body, urgent, created_at, resolved_at")
    .is("resolved_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as NotificationItem[] | null) ?? [];
}

export async function resolveNotification(notificationId: string) {
  if (!isSupabaseEnabled || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("notifications")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", notificationId)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function listApprovals(): Promise<ApprovalRecord[]> {
  if (!isSupabaseEnabled || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("approvals")
    .select("id, approval_type, status, assigned_to, request_id, payload, created_at, updated_at, review_notes")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as ApprovalRecord[] | null) ?? [];
}

export async function reviewApproval(approvalId: string, status: "Approved" | "Declined" | "Request Changes", reviewNotes?: string) {
  if (!isSupabaseEnabled || !supabase) {
    return null;
  }

  const { data, error } = await supabase.rpc("review_approval", {
    p_approval_id: approvalId,
    p_status: status,
    p_review_notes: reviewNotes ?? null,
  });

  if (error) {
    throw error;
  }

  return data as ApprovalRecord;
}

export async function listDamageCases(): Promise<DamageCaseRecord[]> {
  if (!isSupabaseEnabled || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("damage_cases")
    .select("id, asset_id, responsible_user_id, status, user_statement, resolved_state, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as DamageCaseRecord[] | null) ?? [];
}

export async function queueNotification(input: {
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  urgent?: boolean;
  actionUrl?: string | null;
  email?: string | null;
  pushTokens?: string[] | null;
}) {
  if (!isSupabaseEnabled || !supabase) {
    return null;
  }

  const { data, error } = await supabase.rpc("queue_notification", {
    p_user_id: input.userId,
    p_category: input.category,
    p_title: input.title,
    p_body: input.body,
    p_urgent: input.urgent ?? false,
    p_action_url: input.actionUrl ?? null,
    p_email: input.email ?? null,
    p_push_tokens: input.pushTokens ?? null,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function submitDamageForm(caseId: string, statement: string) {
  if (!isSupabaseEnabled || !supabase) {
    return null;
  }

  const { data, error } = await supabase.rpc("submit_damage_form", {
    p_case_id: caseId,
    p_statement: statement,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function resolveDamageCase(caseId: string, resolvedState: "Available" | "Damaged", conditionNote?: string) {
  if (!isSupabaseEnabled || !supabase) {
    return null;
  }

  const { data, error } = await supabase.rpc("resolve_damage_case", {
    p_case_id: caseId,
    p_resolved_state: resolvedState,
    p_condition_note: conditionNote ?? null,
  });

  if (error) {
    throw error;
  }

  return data;
}
