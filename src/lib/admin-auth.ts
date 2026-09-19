import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

const DEFAULT_ADMIN_USER = "admin";
const DEFAULT_ADMIN_PASS = "admin123456";

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Keep timing safe
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function validateBasicAuth(request: Request): { authenticated: boolean } {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return { authenticated: false };
  }

  try {
    const base64Credentials = authHeader.slice(6).trim();
    const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
    const colonIndex = credentials.indexOf(":");
    if (colonIndex === -1) {
      return { authenticated: false };
    }

    const username = credentials.slice(0, colonIndex);
    const password = credentials.slice(colonIndex + 1);

    const expectedUser = process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USER;
    const expectedPass = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASS;

    const userMatch = safeCompare(username, expectedUser);
    const passMatch = safeCompare(password, expectedPass);

    return { authenticated: userMatch && passMatch };
  } catch {
    return { authenticated: false };
  }
}

import { ADMIN_SESSION_COOKIE, verifySessionToken } from "./auth-service";

export function getCookieFromRequest(request: Request, cookieName: string): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";");
  for (const c of cookies) {
    const [name, ...rest] = c.trim().split("=");
    if (name === cookieName) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

export function validateAdminRequest(request: Request): {
  authenticated: boolean;
  username?: string;
  authMethod: "session" | "basic" | "none";
} {
  // 1. Check session cookie
  const sessionToken = getCookieFromRequest(request, ADMIN_SESSION_COOKIE);
  if (sessionToken) {
    const session = verifySessionToken(sessionToken);
    if (session.valid && session.username) {
      return { authenticated: true, username: session.username, authMethod: "session" };
    }
  }

  // 2. Fallback to basic auth
  const basic = validateBasicAuth(request);
  if (basic.authenticated) {
    return {
      authenticated: true,
      username: process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USER,
      authMethod: "basic"
    };
  }

  return { authenticated: false, authMethod: "none" };
}

export function basicAuthUnauthorizedResponse(): NextResponse {
  return new NextResponse("Authentication Required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Administrator Area", charset="UTF-8"',
      "Content-Type": "text/plain"
    }
  });
}

