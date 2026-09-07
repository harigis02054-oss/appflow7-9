import { NextResponse } from "next/server";
import { listServerBuilds } from "@/lib/build/store";
import { runBuildPipeline, StartBuildParams } from "@/lib/build/engine";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const appId = searchParams.get("appId") || undefined;
  const builds = listServerBuilds(appId);
  return NextResponse.json({ builds });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as StartBuildParams;
    if (!body.appId || !body.appName || !body.repositoryId) {
      return NextResponse.json(
        { error: "appId, appName, and repositoryId are required" },
        { status: 400 }
      );
    }

    const build = await runBuildPipeline({
      appId: body.appId,
      appName: body.appName,
      repositoryId: body.repositoryId,
      branch: body.branch || "main",
      platform: body.platform || "android",
      buildMode: body.buildMode || (body.platform === "ios" ? "release-ipa" : "release-aab"),
      version: body.version || "1.0.0",
      buildNumber: body.buildNumber || 1,
    });

    return NextResponse.json({ build });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isValidationError =
      msg.includes("Invalid repositoryId") ||
      msg.includes("Invalid version") ||
      msg.includes("Invalid buildNumber");

    return NextResponse.json(
      { error: "Failed to start build", details: msg },
      { status: isValidationError ? 400 : 500 }
    );
  }
}
