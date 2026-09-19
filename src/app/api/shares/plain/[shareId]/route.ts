import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { sharedNotes } from "@/db/schema";
import { encryptNoteWithKey } from "@/lib/crypto";
import { extractPlainContent, updatePlainShareSchema } from "@/lib/share";

function getBaseUrl(request: Request) {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "http";
  if (host) {
    return `${proto}://${host}`;
  }
  return new URL(request.url).origin;
}

export async function PUT(request: Request, context: { params: Promise<{ shareId: string }> }) {
  try {
    const { shareId } = await context.params;
    const rows = await db.select().from(sharedNotes).where(eq(sharedNotes.shareId, shareId)).limit(1);
    const existing = rows[0];

    if (!existing) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updatePlainShareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const plainText = extractPlainContent(data);
    const updateValues: Partial<typeof sharedNotes.$inferInsert> = {};

    if (data.expiresAt !== undefined) {
      updateValues.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    }

    let finalKey = data.key;

    if (plainText) {
      const encrypted = await encryptNoteWithKey(plainText, data.key);
      updateValues.ciphertext = encrypted.ciphertext;
      updateValues.iv = encrypted.iv;
      finalKey = encrypted.key;
    }

    await db.update(sharedNotes).set(updateValues).where(eq(sharedNotes.shareId, shareId));

    const baseUrl = getBaseUrl(request);
    const url = finalKey ? `${baseUrl}/s/${shareId}#${finalKey}` : undefined;

    return NextResponse.json({
      shareId,
      updated: true,
      url,
      key: finalKey,
      expiresAt: updateValues.expiresAt ? updateValues.expiresAt.toISOString() : (existing.expiresAt?.toISOString() ?? null)
    });
  } catch (error) {
    console.error("Failed to update plain share:", error);
    return NextResponse.json({ error: "Unable to update share" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ shareId: string }> }) {
  return PUT(request, context);
}
