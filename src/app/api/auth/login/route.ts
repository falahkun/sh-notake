import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ADMIN_SESSION_COOKIE,
  createSessionToken,
  verifyAdminCredentials
} from "@/lib/auth-service";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Username dan password wajib diisi" },
        { status: 400 }
      );
    }

    const result = await verifyAdminCredentials(parsed.data.username, parsed.data.password);
    if (!result.success || !result.admin) {
      return NextResponse.json(
        { error: result.error || "Kredensial tidak valid" },
        { status: 401 }
      );
    }

    const token = createSessionToken(result.admin.username);
    const response = NextResponse.json({
      success: true,
      username: result.admin.username,
      redirect: "/dashboard"
    });

    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan internal" }, { status: 500 });
  }
}
