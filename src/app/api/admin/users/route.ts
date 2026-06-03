import { NextResponse } from "next/server";

import { generateTemporaryPassword, isAppRole, requireAdminContext } from "./helpers";

export const dynamic = "force-dynamic";

async function deleteCreatedUser(userId: string) {
  const context = await requireAdminContext();
  const adminSupabase = "adminSupabase" in context ? context.adminSupabase : null;
  if (!adminSupabase) return;
  await adminSupabase.auth.admin.deleteUser(userId);
}

export async function POST(request: Request) {
  const context = await requireAdminContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  const { adminSupabase } = context;

  const body = (await request.json()) as {
    email?: string;
    displayName?: string;
    surname?: string;
    role?: string;
    locationId?: string | null;
    password?: string;
  };

  const email = body.email?.trim().toLowerCase() ?? "";
  const displayName = body.displayName?.trim() ?? "";
  const surname = body.surname?.trim() ?? "";
  const fullName = [displayName, surname].filter(Boolean).join(" ");
  const nextRole = body.role?.trim() ?? "";
  const locationId = body.locationId?.trim() || null;
  const inputPassword = body.password?.trim() ?? "";

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  if (!displayName) {
    return NextResponse.json({ error: "First name is required." }, { status: 400 });
  }

  if (!isAppRole(nextRole)) {
    return NextResponse.json({ error: "Choose a valid role." }, { status: 400 });
  }

  if (nextRole === "asset_manager" && !locationId) {
    return NextResponse.json({ error: "Asset managers need a home base location." }, { status: 400 });
  }

  const assignedLocationId = locationId;
  const assetManagerLocationId = nextRole === "asset_manager" ? locationId : null;
  const temporaryPassword = inputPassword || generateTemporaryPassword();

  const { data: createdData, error: createError } = await adminSupabase.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
  });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  const createdUser = createdData.user;
  if (!createdUser) {
    return NextResponse.json({ error: "Auth user could not be created." }, { status: 500 });
  }

  const { error: profileError } = await adminSupabase.from("profiles").upsert({
    id: createdUser.id,
    display_name: displayName,
    surname: surname || null,
    full_name: fullName || displayName,
    assigned_location_id: assignedLocationId,
    asset_manager_location_id: assetManagerLocationId,
  });

  if (profileError) {
    await deleteCreatedUser(createdUser.id);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const { error: userRoleError } = await adminSupabase.from("user_roles").insert({
    user_id: createdUser.id,
    role: nextRole,
  });

  if (userRoleError) {
    await deleteCreatedUser(createdUser.id);
    return NextResponse.json({ error: userRoleError.message }, { status: 400 });
  }

  const locationName =
    locationId
      ? (
          await adminSupabase.from("locations").select("name").eq("id", locationId).maybeSingle()
        ).data?.name ?? null
      : null;

  return NextResponse.json({
    user: {
      id: createdUser.id,
      email,
      full_name: fullName || displayName,
      role: nextRole,
      home_base: locationName,
      approved: true,
      locked: false,
      department: null,
    },
    temporaryPassword: inputPassword ? null : temporaryPassword,
    message: inputPassword
      ? "User created. Share the chosen password securely."
      : "User created. Share the generated temporary password securely.",
  });
}
