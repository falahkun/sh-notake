import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiKey, listApiKeys } from "@/lib/api-keys";
import { validateAdminRequest, basicAuthUnauthorizedResponse } from "@/lib/admin-auth";

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  expiresInDays: z.number().int().min(1).max(3650).nullable().optional()
});

export async function GET(request: Request) {
  const { authenticated } = validateAdminRequest(request);
  if (!authenticated) {
    return basicAuthUnauthorizedResponse();
  }

  try {
    const keys = await listApiKeys();
    return NextResponse.json({ keys });
  } catch (error) {
    console.error("Failed to list API keys:", error);
    return NextResponse.json({ error: "Failed to list API keys" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { authenticated } = validateAdminRequest(request);
  if (!authenticated) {
    return basicAuthUnauthorizedResponse();
  }

  try {
    const body = await request.json();
    const parsed = createKeySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const newKey = await createApiKey({
      name: parsed.data.name,
      expiresInDays: parsed.data.expiresInDays
    });

    return NextResponse.json({ key: newKey }, { status: 201 });
  } catch (error) {
    console.error("Failed to create API key:", error);
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }
}
