import { NotificationCategory, UserProfile } from "../domain/types";
import { isSupabaseEnabled, supabase } from "./supabase";

export type AccessContext = {
  id?: string;
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

export type StandardAssetRecord = {
  id: string;
  tag: string;
  name: string;
  serial_number: string;
  state: string;
  current_location: string | null;
  holder: string | null;
  department: string | null;
};

export type StandardRecipientRecord = {
  id: string;
  full_name: string;
  email: string;
  role: UserProfile["role"];
  home_base: string | null;
  department: string | null;
};

export type StandardLocationRecord = {
  id: string;
  name: string;
};

export type InventoryAssetRecord = {
  id: string;
  tag: string;
  name: string;
  serial_number: string;
  item_type: string;
  state: string;
  current_location: string | null;
  holder: string | null;
  department: string | null;
  condition_note: string | null;
};

export type AssetHistoryRecord = {
  id: string;
  asset_id: string;
  action: string;
  notes: string | null;
  performed_by: string | null;
  created_at: string;
};

export type SettingsUserRecord = {
  id: string;
  full_name: string;
  email: string;
  role: UserProfile["role"];
  home_base: string | null;
  department: string | null;
  approved: boolean;
  locked: boolean;
};

export type SettingsLocationRecord = {
  id: string;
  name: string;
  active: boolean;
  is_home_base: boolean;
};

export type SettingsDepartmentRecord = {
  id: string;
  name: string;
  active: boolean;
};

export type SettingsKitRecord = {
  id: string;
  name: string;
  home_base: string | null;
  active: boolean;
  item_count: number;
};

export type SettingsConsumableRecord = {
  id: string;
  name: string;
  department: string | null;
  unit: string;
  stock_on_hand: number;
  reorder_level: number;
  active: boolean;
};

export type SettingsDuplicateRecord = {
  id: string;
  primary_asset: string;
  duplicate_asset: string;
  status: string;
  notes: string | null;
  created_at: string;
};

export type SettingsConfigRecord = {
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  updated_at: string;
};

export type ReturnRequestMonitorRecord = {
  id: string;
  request_id: string | null;
  preferred_return_location: string | null;
  status: string;
  note: string | null;
  created_at: string;
  workflow_status: string | null;
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

export async function recipientReviewAssignments(input: {
  approvalIds: string[];
  decision: "Approved" | "Declined";
  reason?: string;
}) {
  if (!isSupabaseEnabled || !supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc("recipient_review_assignments", {
    p_approval_ids: input.approvalIds,
    p_decision: input.decision,
    p_reason: input.reason ?? null,
  });

  if (error) {
    throw error;
  }

  return (data as ApprovalRecord[] | null) ?? [];
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

export async function listStandardSignOutAssets(): Promise<StandardAssetRecord[]> {
  if (!isSupabaseEnabled || !supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc("list_standard_sign_out_assets");
  if (error) {
    throw error;
  }

  return (data as StandardAssetRecord[] | null) ?? [];
}

export async function listStandardSignInAssets(): Promise<StandardAssetRecord[]> {
  if (!isSupabaseEnabled || !supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc("list_standard_sign_in_assets");
  if (error) {
    throw error;
  }

  return (data as StandardAssetRecord[] | null) ?? [];
}

export async function listStandardRecipients(): Promise<StandardRecipientRecord[]> {
  if (!isSupabaseEnabled || !supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc("list_standard_recipients");
  if (error) {
    throw error;
  }

  return (data as StandardRecipientRecord[] | null) ?? [];
}

export async function listStandardLocations(): Promise<StandardLocationRecord[]> {
  if (!isSupabaseEnabled || !supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc("list_standard_locations");
  if (error) {
    throw error;
  }

  return (data as StandardLocationRecord[] | null) ?? [];
}

export async function listMyAssignedAssets(): Promise<StandardAssetRecord[]> {
  if (!isSupabaseEnabled || !supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc("list_my_assigned_assets");
  if (error) {
    throw error;
  }

  return (data as StandardAssetRecord[] | null) ?? [];
}

export async function listInventoryAssets(): Promise<InventoryAssetRecord[]> {
  if (!isSupabaseEnabled || !supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc("list_inventory_assets");
  if (error) {
    throw error;
  }

  return (data as InventoryAssetRecord[] | null) ?? [];
}

export async function getAssetDetail(assetId: string): Promise<InventoryAssetRecord | null> {
  if (!isSupabaseEnabled || !supabase) {
    return null;
  }

  const { data, error } = await supabase.rpc("get_asset_detail", {
    p_asset_id: assetId,
  });
  if (error) {
    throw error;
  }

  return (data as InventoryAssetRecord | null) ?? null;
}

export async function listAssetHistory(assetId: string): Promise<AssetHistoryRecord[]> {
  if (!isSupabaseEnabled || !supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc("list_asset_history", {
    p_asset_id: assetId,
  });
  if (error) {
    throw error;
  }

  return (data as AssetHistoryRecord[] | null) ?? [];
}

export async function listSettingsUsers(): Promise<SettingsUserRecord[]> {
  if (!isSupabaseEnabled || !supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc("list_settings_users");
  if (error) {
    throw error;
  }

  return (data as SettingsUserRecord[] | null) ?? [];
}

export async function listSettingsLocations(): Promise<SettingsLocationRecord[]> {
  if (!isSupabaseEnabled || !supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc("list_settings_locations");
  if (error) {
    throw error;
  }

  return (data as SettingsLocationRecord[] | null) ?? [];
}

export async function listSettingsDepartments(): Promise<SettingsDepartmentRecord[]> {
  if (!isSupabaseEnabled || !supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc("list_settings_departments");
  if (error) {
    throw error;
  }

  return (data as SettingsDepartmentRecord[] | null) ?? [];
}

export async function listSettingsKits(): Promise<SettingsKitRecord[]> {
  if (!isSupabaseEnabled || !supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc("list_settings_kits");
  if (error) {
    throw error;
  }

  return (data as SettingsKitRecord[] | null) ?? [];
}

export async function listSettingsConsumables(): Promise<SettingsConsumableRecord[]> {
  if (!isSupabaseEnabled || !supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc("list_settings_consumables");
  if (error) {
    throw error;
  }

  return (data as SettingsConsumableRecord[] | null) ?? [];
}

export async function listSettingsDuplicates(): Promise<SettingsDuplicateRecord[]> {
  if (!isSupabaseEnabled || !supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc("list_settings_duplicates");
  if (error) {
    throw error;
  }

  return (data as SettingsDuplicateRecord[] | null) ?? [];
}

export async function listSettingsConfig(): Promise<SettingsConfigRecord[]> {
  if (!isSupabaseEnabled || !supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc("list_settings_config");
  if (error) {
    throw error;
  }

  return (data as SettingsConfigRecord[] | null) ?? [];
}

export async function listReturnRequestMonitor(): Promise<ReturnRequestMonitorRecord[]> {
  if (!isSupabaseEnabled || !supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc("list_return_request_monitor");
  if (error) {
    throw error;
  }

  return (data as ReturnRequestMonitorRecord[] | null) ?? [];
}

export async function standardSignOutAssets(input: {
  assetIds: string[];
  holderId: string;
  note?: string;
}) {
  if (!isSupabaseEnabled || !supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc("standard_sign_out_assets", {
    p_asset_ids: input.assetIds,
    p_holder_id: input.holderId,
    p_note: input.note ?? null,
  });
  if (error) {
    throw error;
  }

  return (data as StandardAssetRecord[] | null) ?? [];
}

export async function standardSignInAssets(input: {
  assetIds: string[];
  finalLocationId: string;
  outcome: "Available" | "Damaged";
  note?: string;
}) {
  if (!isSupabaseEnabled || !supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc("standard_sign_in_assets", {
    p_asset_ids: input.assetIds,
    p_final_location_id: input.finalLocationId,
    p_outcome: input.outcome,
    p_note: input.note ?? null,
  });
  if (error) {
    throw error;
  }

  return (data as StandardAssetRecord[] | null) ?? [];
}
