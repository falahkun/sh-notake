import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  ADMIN_SESSION_COOKIE,
  changeAdminPassword,
  verifySessionToken
} from "@/lib/auth-service";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Password saat ini wajib diisi"),
  newPassword: z.string().min(6, "Password baru minimal 6 karakter")
});

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
    const session = verifySessionToken(sessionCookie);

    if (!session.valid || !session.username) {
      return NextResponse.json({ error: "Sesi telah berakhir, silakan login kembali" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Input tidak valid" },
        { status: 400 }
      );
    }

    const result = await changeAdminPassword(
      session.username,
      parsed.data.currentPassword,
      parsed.data.newPassword
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Gagal mengubah password" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Password admin berhasil diperbarui!" });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan internal" }, { status: 500 });
  }
}
