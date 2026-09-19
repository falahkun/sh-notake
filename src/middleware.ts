import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateAdminRequest, basicAuthUnauthorizedResponse } from "@/lib/admin-auth";
import { verifyApiKey } from "@/lib/api-keys";
import { ADMIN_SESSION_COOKIE, verifySessionToken } from "@/lib/auth-service";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 1. Allow CORS Preflight requests
  if (request.method === "OPTIONS") {
    return NextResponse.next();
  }

  // 2. Auth API endpoints are public / handle own session
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // 3. /login page: Redirect to /dashboard if already logged in
  if (pathname === "/login") {
    const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const session = verifySessionToken(sessionToken);
    if (session.valid) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // 4. Protected web pages: /dashboard, /profile, /admin
  const isProtectedWebPage =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/");

  if (isProtectedWebPage) {
    const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const session = verifySessionToken(sessionToken);

    // Accept session cookie or basic auth for /admin
    const adminCheck = validateAdminRequest(request);

    if (!session.valid && !adminCheck.authenticated) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 5. Admin API routes: /api/admin/* (session cookie or Basic Auth)
  if (pathname.startsWith("/api/admin")) {
    const { authenticated } = validateAdminRequest(request);
    if (!authenticated) {
      return basicAuthUnauthorizedResponse();
    }
    return NextResponse.next();
  }

  // 6. Public read for shared note ciphertext (required so recipients can fetch ciphertext to decrypt with #fragment key)
  const isPublicShareRead =
    request.method === "GET" &&
    pathname.startsWith("/api/shares/") &&
    pathname !== "/api/shares";

  if (isPublicShareRead) {
    return NextResponse.next();
  }

  // 7. Allow authenticated admin session on API routes
  const adminAuth = validateAdminRequest(request);
  if (adminAuth.authenticated) {
    return NextResponse.next();
  }

  // 8. Protect all other /api routes (e.g. POST pushes) with encrypted Secret Key
  if (pathname.startsWith("/api")) {
    const authHeader = request.headers.get("authorization");
    let rawKey = request.headers.get("x-api-key");

    if (!rawKey && authHeader?.startsWith("Bearer ")) {
      rawKey = authHeader.slice(7).trim();
    }

    if (!rawKey) {
      rawKey = request.nextUrl.searchParams.get("api_key");
    }

    const verification = await verifyApiKey(rawKey);

    if (!verification.valid) {
      const statusCode = verification.reason === "missing" || verification.reason === "invalid" ? 401 : 403;
      return NextResponse.json(
        {
          error: verification.message,
          reason: verification.reason
        },
        { status: statusCode }
      );
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-api-key-id", verification.key.id);
    requestHeaders.set("x-api-key-name", verification.key.name);

    return NextResponse.next({
      request: {
        headers: requestHeaders
      }
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/dashboard",
    "/dashboard/:path*",
    "/profile",
    "/profile/:path*",
    "/admin",
    "/admin/:path*",
    "/api/:path*"
  ],
  runtime: "nodejs"
};
