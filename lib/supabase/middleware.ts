import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Supabase auth middleware.
 * Refreshes the auth session on every request.
 * Redirects unauthenticated users from protected routes.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the auth session — this is important for SSR
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Admin routes — check for admin claim or admin session
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") {
      return supabaseResponse;
    }

    // Check if user is authenticated and has admin role
    // For now, use a simple admin cookie check alongside Supabase auth
    const adminSession = request.cookies.get("oppy_admin_session")?.value;
    if (!user && !adminSession) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return supabaseResponse;
  }

  // User-protected routes
  const USER_PROTECTED = ["/dashboard", "/saved", "/profile", "/onboarding"];
  if (USER_PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return supabaseResponse;
}
