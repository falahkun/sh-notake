import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { sharedNotes } from "@/db/schema";
import { encryptNote } from "@/lib/crypto";
import { createPlainShareSchema, extractPlainContent } from "@/lib/share";

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createPlainShareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload: 'text', 'content', 'plaintext', or 'markdown' string is required" },
        { status: 400 }
      );
    }

    const rawText = extractPlainContent(parsed.data);
    if (!rawText) {
      return NextResponse.json(
        { error: "Content must not be empty" },
        { status: 400 }
      );
    }

    // Encrypt plaintext on server using AES-256-GCM
    const encrypted = await encryptNote(rawText);

    const shareId = randomBytes(18).toString("base64url");
    const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;

    // Store encrypted note in database
    await db.insert(sharedNotes).values({
      shareId,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      expiresAt
    });

    const baseUrl = getBaseUrl(request);
    const url = `${baseUrl}/s/${shareId}#${encrypted.key}`;

    return NextResponse.json(
      {
        shareId,
        url,
        key: encrypted.key,
        expiresAt: expiresAt?.toISOString() ?? null
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create plain share:", error);
    return NextResponse.json({ error: "Unable to create share" }, { status: 500 });
  }
}
