import { NextResponse } from "next/server";
import {
  isGooglePlayConfigured,
  listTracks,
  GooglePlayError,
} from "@/lib/google-play/client";

export async function GET(req: Request) {
  if (!isGooglePlayConfigured()) {
    return NextResponse.json(
      { error: "Google Play service account is not configured" },
      { status: 501 }
    );
  }

  const { searchParams } = new URL(req.url);
  const packageName = searchParams.get("package");
  if (!packageName) {
    return NextResponse.json(
      { error: "package query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const tracks = await listTracks(packageName);
    return NextResponse.json({ tracks });
  } catch (err) {
    if (err instanceof GooglePlayError) {
      return NextResponse.json(
        { error: err.message, details: err.details },
        { status: err.status || 500 }
      );
    }
    return NextResponse.json(
      { error: "Failed to list Google Play tracks" },
      { status: 500 }
    );
  }
}
