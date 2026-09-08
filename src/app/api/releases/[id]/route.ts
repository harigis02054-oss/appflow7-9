import { NextRequest, NextResponse } from "next/server";
import { getRelease, updateRelease, deleteRelease } from "@/lib/release/store";
import { getServerBuild } from "@/lib/build/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const release = getRelease(id);

    if (!release) {
      return NextResponse.json({ error: "Release not found" }, { status: 404 });
    }

    // Live sync with underlying build job if one is attached
    if (release.buildId) {
      const build = getServerBuild(release.buildId);
      if (build) {
        let changed = false;

        // Sync build stage
        const buildStage = release.stages.find((s) => s.id === "build");
        if (buildStage && buildStage.status !== "success" && build.status === "success") {
          buildStage.status = "success";
          buildStage.completedAt = build.completedAt;
          buildStage.durationMs = build.durationMs;

          // Also complete sign and test stages
          const signStage = release.stages.find((s) => s.id === "sign");
          if (signStage) {
            signStage.status = "success";
            signStage.completedAt = build.completedAt;
          }

          const testStage = release.stages.find((s) => s.id === "test");
          if (testStage) {
            testStage.status = "success";
            testStage.completedAt = build.completedAt;
          }

          release.state = "READY_FOR_TESTING";
          release.currentStageId = "upload";
          release.artifactPath = build.artifactPath;
          release.artifactName = build.artifactName;
          release.artifactSize = build.artifactSize;
          changed = true;
        } else if (buildStage && build.status === "failed" && buildStage.status !== "failed") {
          buildStage.status = "failed";
          buildStage.error = build.errorSummary || "Build failed";
          release.state = "FAILED";
          release.errorSummary = build.errorSummary;
          changed = true;
        }

        if (changed) {
          updateRelease(id, release);
        }
      }
    }

    return NextResponse.json({ release });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = deleteRelease(id);
    if (!success) {
      return NextResponse.json({ error: "Release not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
