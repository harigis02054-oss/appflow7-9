import { NextResponse } from "next/server";
import {
  isGooglePlayConfigured,
  verifyAppAccess,
  GooglePlayError,
} from "@/lib/google-play/client";

export async function POST(req: Request) {
  if (!isGooglePlayConfigured()) {
    return NextResponse.json(
      { error: "Google Play service account is not configured" },
      { status: 501 }
    );
  }

  try {
    const body = await req.json();
    const { packageName } = body;
    if (!packageName) {
      return NextResponse.json(
        { error: "packageName is required" },
        { status: 400 }
      );
    }

    const result = await verifyAppAccess(packageName);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof GooglePlayError) {
      return NextResponse.json(
        { accessible: false, error: err.message, details: err.details },
        { status: err.status || 500 }
      );
    }
    return NextResponse.json(
      { accessible: false, error: "Unexpected error verifying app access" },
      { status: 500 }
    );
  }
}
