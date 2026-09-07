import { NextResponse } from "next/server";
import { getAppleConfig, verifyAppleConnection } from "@/lib/apple/client";

export async function GET() {
  const config = getAppleConfig();
  if (!config) {
    return NextResponse.json({ configured: false, valid: false });
  }

  const result = await verifyAppleConnection(config);
  return NextResponse.json({
    configured: true,
    valid: result.valid,
    error: result.error,
    issuerIdMasked: result.issuerIdMasked,
  });
}
