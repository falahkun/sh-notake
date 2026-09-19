import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { sharedNotes } from "@/db/schema";
import { createShareSchema } from "@/lib/share";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createShareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid share payload" }, { status: 400 });
    }

    const shareId = randomBytes(18).toString("base64url");
    const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;

    await db.insert(sharedNotes).values({
      shareId,
      ciphertext: parsed.data.ciphertext,
      iv: parsed.data.iv,
      expiresAt
    });

    return NextResponse.json({ shareId, expiresAt: expiresAt?.toISOString() ?? null }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create share" }, { status: 500 });
  }
}
