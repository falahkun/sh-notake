import { NextResponse } from "next/server";
import { revokeApiKey } from "@/lib/api-keys";
import { validateAdminRequest, basicAuthUnauthorizedResponse } from "@/lib/admin-auth";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authenticated } = validateAdminRequest(request);
  if (!authenticated) {
    return basicAuthUnauthorizedResponse();
  }

  try {
    const { id } = await params;
    const revoked = await revokeApiKey(id);
    if (!revoked) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, key: revoked });
  } catch (error) {
    console.error("Failed to revoke API key:", error);
    return NextResponse.json({ error: "Failed to revoke API key" }, { status: 500 });
  }
}
