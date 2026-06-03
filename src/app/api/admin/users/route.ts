import { NextResponse } from "next/server";

import type { AppRole } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminEnv } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const allowedRoles: AppRole[] = ["admin", "main_admin"];

function isAppRole(value: string): value is AppRole {
  return ["admin", "main_admin", "asset_manager", "staff", "volunteer"].includes(value);
}

function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const values = crypto.getRandomValues(new Uint32Array(18));
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}

async function deleteCreatedUser(userId: string) {
  const adminSupabase = getSupabaseAdminClient();
  if (!adminSupabase) return;
  await adminSupabase.auth.admin.deleteUser(userId);
}

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured for server auth." }, { status: 503 });
  }

  const {
    data: { user: currentUser },
    error: currentUserError,
  } = await supabase.auth.getUser();

  if (currentUserError) {
    return NextResponse.json({ error: currentUserError.message }, { status: 401 });
  }

  if (!currentUser) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { data: roleRows, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", currentUser.id);
  if (roleError) {
    return NextResponse.json({ error: roleError.message }, { status: 500 });
  }

  const currentRoles = ((roleRows ?? []) as Array<{ role: AppRole }>).map((row) => row.role);
  if (!currentRoles.some((role) => allowedRoles.includes(role))) {
    return NextResponse.json({ error: "Only admins can create users." }, { status: 403 });
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json(
      {
        error: "User creation needs `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in the server environment.",
      },
      { status: 500 },
    );
  }

  const adminSupabase = getSupabaseAdminClient();
  if (!adminSupabase) {
    return NextResponse.json({ error: "Supabase admin client could not be initialized." }, { status: 500 });
  }

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
      approved: false,
      locked: false,
      department: null,
    },
    temporaryPassword: inputPassword ? null : temporaryPassword,
    message: inputPassword
      ? "User created. Share the chosen password securely."
      : "User created. Share the generated temporary password securely.",
  });
}
