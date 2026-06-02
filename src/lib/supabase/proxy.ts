import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { resolveAccessContext } from "@/lib/access-context";
import { canAccessRoute } from "@/lib/auth";
import { getSupabasePublishableKey, getSupabaseUrl, hasSupabaseEnv } from "@/lib/supabase/config";

const protectedRoutePrefixes = ["/dashboard", "/inventory", "/check-out-in", "/my-assets", "/requests", "/approvals", "/settings"];

function isProtectedRoute(pathname: string) {
  return protectedRoutePrefixes.some((prefix) => pathname.startsWith(prefix));
}

function copyCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
}

function redirectWithCookies(source: NextResponse, request: NextRequest, pathname: string) {
  const redirectUrl = new URL(pathname, request.url);
  const response = NextResponse.redirect(redirectUrl);
  copyCookies(source, response);
  return response;
}

function redirectToLogin(source: NextResponse, request: NextRequest) {
  const redirectUrl = new URL("/login", request.url);
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  redirectUrl.searchParams.set("next", next);
  const response = NextResponse.redirect(redirectUrl);
  copyCookies(source, response);
  return response;
}

export async function updateSession(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.next({ request });
  }

  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  if (!url || !key) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const pathname = request.nextUrl.pathname;
  const protectedRoute = isProtectedRoute(pathname);

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (claimsError || !claims?.sub) {
    if (!protectedRoute) {
      return response;
    }
    return redirectToLogin(response, request);
  }

  const resolved = await resolveAccessContext(supabase, {
    userId: claims.sub,
    allowApprovalFallback: false,
  });

  if (resolved.accessState === "pending_approval") {
    if (pathname !== "/approval-pending") {
      return redirectWithCookies(response, request, "/approval-pending");
    }
    return response;
  }

  if (resolved.accessState === "damage_locked") {
    if (pathname !== "/damage-lock") {
      return redirectWithCookies(response, request, "/damage-lock");
    }
    return response;
  }

  if (pathname === "/login" || pathname === "/approval-pending" || pathname === "/damage-lock") {
    return redirectWithCookies(response, request, "/dashboard");
  }

  if (protectedRoute && !canAccessRoute(pathname, resolved.accessContext.roles ?? [])) {
    return redirectWithCookies(response, request, "/dashboard");
  }

  return response;
}
