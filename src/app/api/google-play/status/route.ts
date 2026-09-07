import { NextResponse } from "next/server";
import {
  isGooglePlayConfigured,
  verifyGooglePlayAuth,
} from "@/lib/google-play/client";

export async function GET() {
  const configured = isGooglePlayConfigured();
  if (!configured) {
    return NextResponse.json({
      configured: false,
      valid: false,
      message: "Google Play service account not configured",
    });
  }

  const auth = await verifyGooglePlayAuth();
  return NextResponse.json({
    configured: true,
    valid: auth.valid,
    clientEmail: auth.clientEmail,
    projectId: auth.projectId,
    error: auth.error,
  });
}
