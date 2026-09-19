import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { sharedNotes } from "@/db/schema";
import { encryptNoteWithKey } from "@/lib/crypto";
import { extractPlainContent, updateShareSchema } from "@/lib/share";

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

export async function GET(_: Request, context: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await context.params;
  const rows = await db.select().from(sharedNotes).where(eq(sharedNotes.shareId, shareId)).limit(1);
  const note = rows[0];

  if (!note) return NextResponse.json({ error: "Share not found" }, { status: 404 });
  if (note.expiresAt && note.expiresAt <= new Date()) {
    return NextResponse.json({ error: "Share expired" }, { status: 410 });
  }

  return NextResponse.json({
    shareId: note.shareId,
    ciphertext: note.ciphertext,
    iv: note.iv,
    expiresAt: note.expiresAt?.toISOString() ?? null
  });
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
    const parsed = updateShareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const updateValues: Partial<typeof sharedNotes.$inferInsert> = {};

    if (data.expiresAt !== undefined) {
      updateValues.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    }

    // 1. Zero-Knowledge update (ciphertext & iv)
    if (data.ciphertext && data.iv) {
      updateValues.ciphertext = data.ciphertext;
      updateValues.iv = data.iv;

      await db.update(sharedNotes).set(updateValues).where(eq(sharedNotes.shareId, shareId));

      return NextResponse.json({
        shareId,
        updated: true,
        expiresAt: updateValues.expiresAt ? updateValues.expiresAt.toISOString() : (existing.expiresAt?.toISOString() ?? null)
      });
    }

    // 2. Plaintext update (server-side re-encryption)
    const plainText = extractPlainContent(data);
    if (plainText) {
      // If user supplied existing key, re-encrypt with the same key to preserve URL fragment;
      // otherwise, generate a fresh key.
      const encrypted = await encryptNoteWithKey(plainText, data.key);
      updateValues.ciphertext = encrypted.ciphertext;
      updateValues.iv = encrypted.iv;

      await db.update(sharedNotes).set(updateValues).where(eq(sharedNotes.shareId, shareId));

      const baseUrl = getBaseUrl(request);
      const url = `${baseUrl}/s/${shareId}#${encrypted.key}`;

      return NextResponse.json({
        shareId,
        updated: true,
        url,
        key: encrypted.key,
        expiresAt: updateValues.expiresAt ? updateValues.expiresAt.toISOString() : (existing.expiresAt?.toISOString() ?? null)
      });
    }

    // 3. Expiration-only update
    if (Object.keys(updateValues).length > 0) {
      await db.update(sharedNotes).set(updateValues).where(eq(sharedNotes.shareId, shareId));
      return NextResponse.json({
        shareId,
        updated: true,
        expiresAt: updateValues.expiresAt ? updateValues.expiresAt.toISOString() : (existing.expiresAt?.toISOString() ?? null)
      });
    }

    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  } catch (error) {
    console.error("Failed to update note:", error);
    return NextResponse.json({ error: "Unable to update share" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ shareId: string }> }) {
  return PUT(request, context);
}
