import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";

const DEFAULT_SECRET = "share-note-sx-master-default-secret-32-chars-long";

function getMasterKey(): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET || DEFAULT_SECRET;
  return createHash("sha256").update(secret).digest();
}

function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

function encryptRawKey(rawKey: string): { encryptedKey: string; iv: string } {
  const masterKey = getMasterKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey, iv);
  let encrypted = cipher.update(rawKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return {
    encryptedKey: `${encrypted}:${authTag}`,
    iv: iv.toString("hex")
  };
}

export function decryptRawKey(encryptedKeyWithTag: string, ivHex: string): string {
  const masterKey = getMasterKey();
  const [encrypted, authTag] = encryptedKeyWithTag.split(":");
  if (!encrypted || !authTag) {
    throw new Error("Invalid encrypted key format");
  }

  const decipher = createDecipheriv("aes-256-gcm", masterKey, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export async function createApiKey({
  name,
  expiresInDays
}: {
  name: string;
  expiresInDays?: number | null;
}) {
  const trimmedName = name.trim() || "Default API Key";
  // Generate high-entropy secret key
  const entropy = randomBytes(24).toString("base64url");
  const rawKey = `snx_sec_${entropy}`;
  const keyPrefix = `${rawKey.slice(0, 12)}...${rawKey.slice(-4)}`;

  const keyHash = hashKey(rawKey);
  const { encryptedKey, iv: encryptionIv } = encryptRawKey(rawKey);

  let expiresAt: Date | null = null;
  if (expiresInDays && expiresInDays > 0) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  }

  const [inserted] = await db
    .insert(apiKeys)
    .values({
      name: trimmedName,
      keyPrefix,
      keyHash,
      encryptedKey,
      encryptionIv,
      expiresAt
    })
    .returning();

  return {
    id: inserted.id,
    name: inserted.name,
    rawKey, // Returned only once at creation!
    keyPrefix: inserted.keyPrefix,
    createdAt: inserted.createdAt,
    expiresAt: inserted.expiresAt
  };
}

export type VerifyApiKeyResult =
  | { valid: true; key: { id: string; name: string; keyPrefix: string } }
  | { valid: false; reason: "missing" | "invalid" | "revoked" | "expired"; message: string };

export async function verifyApiKey(rawKey?: string | null): Promise<VerifyApiKeyResult> {
  if (!rawKey || typeof rawKey !== "string" || !rawKey.trim()) {
    return {
      valid: false,
      reason: "missing",
      message: "Missing API secret key in 'x-api-key' or 'Authorization: Bearer' header"
    };
  }

  const cleanKey = rawKey.trim();
  const keyHash = hashKey(cleanKey);

  const [record] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (!record) {
    return {
      valid: false,
      reason: "invalid",
      message: "Invalid API secret key"
    };
  }

  if (record.revokedAt) {
    return {
      valid: false,
      reason: "revoked",
      message: "API secret key has been revoked"
    };
  }

  if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
    return {
      valid: false,
      reason: "expired",
      message: "API secret key has expired"
    };
  }

  // Asynchronously update lastUsedAt without blocking
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, record.id))
    .catch(() => {});

  return {
    valid: true,
    key: {
      id: record.id,
      name: record.name,
      keyPrefix: record.keyPrefix
    }
  };
}

export async function revokeApiKey(id: string) {
  const [updated] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeys.id, id))
    .returning();

  return updated;
}

export async function listApiKeys() {
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      createdAt: apiKeys.createdAt,
      expiresAt: apiKeys.expiresAt,
      revokedAt: apiKeys.revokedAt,
      lastUsedAt: apiKeys.lastUsedAt
    })
    .from(apiKeys)
    .orderBy(desc(apiKeys.createdAt));
}
