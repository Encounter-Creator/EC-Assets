import { NextResponse } from "next/server";

import { isAppRole, requireAdminContext, generateTemporaryPassword } from "../helpers";

export const dynamic = "force-dynamic";

type UpdateBody =
  | {
      action?: "approve";
      role?: string;
      displayName?: string;
      surname?: string;
      assignedLocationId?: string | null;
      assetManagerLocationId?: string | null;
    }
  | {
      action: "revoke";
    }
  | {
      action: "password";
      password?: string;
    };

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  const adminContext = await requireAdminContext();
  if ("error" in adminContext) {
    return NextResponse.json({ error: adminContext.error }, { status: adminContext.status });
  }

  const { adminSupabase, currentUser } = adminContext;
  const { userId } = await context.params;
  const body = (await request.json()) as UpdateBody;

  if (!userId) {
    return NextResponse.json({ error: "User is required." }, { status: 400 });
  }

  if (body.action === "revoke") {
    if (userId === currentUser.id) {
      return NextResponse.json({ error: "You cannot revoke your own access." }, { status: 400 });
    }

    const { error } = await adminSupabase.from("user_roles").delete().eq("user_id", userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "User access revoked." });
  }

  if (body.action === "password") {
    const temporaryPassword = body.password?.trim() || generateTemporaryPassword();
    const { error } = await adminSupabase.auth.admin.updateUserById(userId, {
      password: temporaryPassword,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      message: body.password?.trim() ? "Password updated." : "Temporary password generated.",
      temporaryPassword: body.password?.trim() ? null : temporaryPassword,
    });
  }

  const role = body.role?.trim() ?? "";
  const displayName = body.displayName?.trim() ?? "";
  const surname = body.surname?.trim() ?? "";
  const assignedLocationId = body.assignedLocationId?.trim() || null;
  const nextManagerLocationId = body.assetManagerLocationId?.trim() || null;

  if (!displayName) {
    return NextResponse.json({ error: "First name is required." }, { status: 400 });
  }

  if (!isAppRole(role)) {
    return NextResponse.json({ error: "Choose a valid role." }, { status: 400 });
  }

  if (role === "asset_manager" && !nextManagerLocationId && !assignedLocationId) {
    return NextResponse.json({ error: "Asset managers need a home base location." }, { status: 400 });
  }

  const assetManagerLocationId = role === "asset_manager" ? nextManagerLocationId || assignedLocationId : null;

  const { error: profileError } = await adminSupabase.from("profiles").update({
    display_name: displayName || null,
    surname: surname || null,
    full_name: [displayName, surname].filter(Boolean).join(" ") || displayName,
    assigned_location_id: assignedLocationId,
    asset_manager_location_id: assetManagerLocationId,
  }).eq("id", userId);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const { error: deleteRoleError } = await adminSupabase.from("user_roles").delete().eq("user_id", userId);
  if (deleteRoleError) {
    return NextResponse.json({ error: deleteRoleError.message }, { status: 400 });
  }

  const { error: insertRoleError } = await adminSupabase.from("user_roles").insert({
    user_id: userId,
    role,
  });
  if (insertRoleError) {
    return NextResponse.json({ error: insertRoleError.message }, { status: 400 });
  }

  return NextResponse.json({ message: "User access approved." });
}

export async function DELETE(_request: Request, context: { params: Promise<{ userId: string }> }) {
  const adminContext = await requireAdminContext();
  if ("error" in adminContext) {
    return NextResponse.json({ error: adminContext.error }, { status: adminContext.status });
  }

  const { adminSupabase, currentUser } = adminContext;
  const { userId } = await context.params;

  if (!userId) {
    return NextResponse.json({ error: "User is required." }, { status: 400 });
  }

  if (userId === currentUser.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  const { data: targetRoles, error: targetRolesError } = await adminSupabase.from("user_roles").select("role").eq("user_id", userId);
  if (targetRolesError) {
    return NextResponse.json({ error: targetRolesError.message }, { status: 400 });
  }

  if (((targetRoles ?? []) as Array<{ role: string }>).some((row) => row.role === "main_admin")) {
    return NextResponse.json({ error: "Main admin accounts cannot be deleted here." }, { status: 400 });
  }

  const { error } = await adminSupabase.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ message: "User deleted." });
}
