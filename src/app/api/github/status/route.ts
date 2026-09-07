import { NextResponse } from "next/server";
import { isGitHubConfigured } from "@/lib/github/client";

export async function GET() {
  return NextResponse.json({ configured: isGitHubConfigured() });
}
