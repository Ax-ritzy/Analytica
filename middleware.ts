import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/config";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const { url, key, isConfigured } = getSupabaseEnv();

  // If Supabase credentials are not configured yet, allow dev access so user can view setup guidance
  if (!isConfigured) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  const facultyRoutes = [
    "/dashboard",
    "/courses",
    "/lesson-planner",
    "/question-studio",
    "/analytics",
    "/assistant",
  ];
  const isFacultyRoute = facultyRoutes.some((r) => path === r || path.startsWith(`${r}/`));
  const isAdminRoute = path === "/admin" || path.startsWith("/admin/");

  // 1. Unauthenticated users cannot access protected portals
  if (!user && (isFacultyRoute || isAdminRoute)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", path);
    if (isAdminRoute) {
      redirectUrl.searchParams.set("portal", "admin");
    }
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Role verification for administrator portal
  if (user && isAdminRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role?.toLowerCase();
    const isAdmin = role === "admin";
    const isActive = profile?.is_active ?? true;

    if (!isAdmin || !isActive) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      redirectUrl.searchParams.set("error", "admin_required");
      return NextResponse.redirect(redirectUrl);
    }
  }

  // 3. Authenticated users going to /login redirected to their portal
  if (user && path === "/login") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role?.toLowerCase();
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = role === "admin" ? "/admin" : "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
