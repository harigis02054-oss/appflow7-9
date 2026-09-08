import { NextRequest, NextResponse } from "next/server";
import { listReleases } from "@/lib/release/store";
import { createReleasePipeline } from "@/lib/release/orchestrator";
import type { Platform, ReleaseTrack } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get("appId") || undefined;
    const releases = listReleases(appId);
    return NextResponse.json({ releases, total: releases.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      appId,
      appName,
      repositoryId,
      branch,
      commitSha,
      commitMessage,
      commitAuthor,
      platform,
      track,
      version,
      buildNumber,
      androidPackage,
      iosBundleId,
      actor,
    } = body;

    if (!appId || !appName || !repositoryId || !platform || !version || !buildNumber) {
      return NextResponse.json(
        { error: "Missing required fields: appId, appName, repositoryId, platform, version, buildNumber" },
        { status: 400 }
      );
    }

    const release = await createReleasePipeline({
      appId,
      appName,
      repositoryId,
      branch: branch || "main",
      commitSha,
      commitMessage,
      commitAuthor,
      platform: platform as Platform,
      track: (track || (platform === "ios" ? "testflight" : "internal-testing")) as ReleaseTrack,
      version: String(version),
      buildNumber: Number(buildNumber),
      androidPackage,
      iosBundleId,
      actor: actor || "User",
    });

    return NextResponse.json({ success: true, release }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
