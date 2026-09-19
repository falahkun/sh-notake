import {
  createCipheriv,
  createDecipheriv,
  createHash,
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual
} from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { admins } from "@/db/schema";

export const ADMIN_SESSION_COOKIE = "admin_session";
const DEFAULT_SESSION_SECRET = "share-note-sx-admin-session-secret-salt-2026";

function getSessionMasterKey(): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET || DEFAULT_SESSION_SECRET;
  return createHash("sha256").update(`session:${secret}`).digest();
}

export function hashPassword(password: string, saltHex?: string): { hash: string; salt: string } {
  const salt = saltHex || randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, expectedHash: string, salt: string): boolean {
  const { hash } = hashPassword(password, salt);
  const bufActual = Buffer.from(hash, "hex");
  const bufExpected = Buffer.from(expectedHash, "hex");
  if (bufActual.length !== bufExpected.length) {
    timingSafeEqual(bufActual, bufActual);
    return false;
  }
  return timingSafeEqual(bufActual, bufExpected);
}

export function createSessionToken(username: string, expiresInMs: number = 7 * 24 * 60 * 60 * 1000): string {
  const payload = JSON.stringify({
    username,
    exp: Date.now() + expiresInMs
  });

  const masterKey = getSessionMasterKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey, iv);
  let encrypted = cipher.update(payload, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}.${encrypted}.${authTag}`;
}

export function verifySessionToken(token?: string | null): { valid: boolean; username?: string } {
  if (!token || typeof token !== "string") {
    return { valid: false };
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false };
  }

  try {
    const [ivHex, encryptedHex, authTagHex] = parts;
    const masterKey = getSessionMasterKey();
    const decipher = createDecipheriv("aes-256-gcm", masterKey, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    const data = JSON.parse(decrypted);
    if (!data.username || !data.exp || data.exp < Date.now()) {
      return { valid: false };
    }

    return { valid: true, username: data.username };
  } catch {
    return { valid: false };
  }
}

export async function getOrCreateDefaultAdmin() {
  const existing = await db.select().from(admins).limit(1);
  if (existing.length > 0) {
    return existing[0];
  }

  const defaultUser = process.env.ADMIN_USERNAME || "admin";
  const defaultPass = process.env.ADMIN_PASSWORD || "admin123456";

  const { hash, salt } = hashPassword(defaultPass);
  const [created] = await db
    .insert(admins)
    .values({
      username: defaultUser,
      passwordHash: hash,
      salt
    })
    .returning();

  return created;
}

export async function verifyAdminCredentials(username: string, password: string): Promise<{ success: boolean; admin?: any; error?: string }> {
  await getOrCreateDefaultAdmin();

  const [admin] = await db
    .select()
    .from(admins)
    .where(eq(admins.username, username.trim()))
    .limit(1);

  if (!admin) {
    return { success: false, error: "Username atau password salah" };
  }

  const matches = verifyPassword(password, admin.passwordHash, admin.salt);
  if (!matches) {
    return { success: false, error: "Username atau password salah" };
  }

  return { success: true, admin };
}

export async function changeAdminPassword(
  username: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (newPassword.length < 6) {
    return { success: false, error: "Password baru minimal 6 karakter" };
  }

  const verification = await verifyAdminCredentials(username, currentPassword);
  if (!verification.success || !verification.admin) {
    return { success: false, error: "Password saat ini tidak sesuai" };
  }

  const { hash, salt } = hashPassword(newPassword);
  await db
    .update(admins)
    .set({
      passwordHash: hash,
      salt,
      updatedAt: new Date()
    })
    .where(eq(admins.id, verification.admin.id));

  return { success: true };
}
