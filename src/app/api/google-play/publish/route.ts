import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  getServerBuild,
  updateServerBuild,
  getExistingBuildDir,
  isValidBuildId,
  isPathContained,
} from "@/lib/build/store";
import {
  isGooglePlayConfigured,
  publishBundle,
  GooglePlayError,
} from "@/lib/google-play/client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { buildId, packageName, track, releaseNotes, simulateIfUnregistered, expectedPackageName } = body;

    if (!buildId || !packageName || !track) {
      return NextResponse.json(
        { error: "buildId, packageName, and track are required" },
        { status: 400 }
      );
    }

    if (!isValidBuildId(buildId)) {
      return NextResponse.json({ error: "Invalid build ID format" }, { status: 400 });
    }

    // Validate package name syntax
    if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(packageName)) {
      return NextResponse.json(
        { error: `Invalid Android package name format: '${packageName}'` },
        { status: 400 }
      );
    }

    // Verify package name matches expected application package if provided (Finding #5)
    if (expectedPackageName && expectedPackageName !== packageName) {
      return NextResponse.json(
        {
          error: `Package mismatch: Cannot publish '${packageName}' for application registered with '${expectedPackageName}'`,
          code: "PACKAGE_NAME_MISMATCH",
        },
        { status: 400 }
      );
    }

    const build = getServerBuild(buildId);
    if (!build) {
      return NextResponse.json({ error: "Build not found" }, { status: 404 });
    }

    if (!build.artifactPath) {
      return NextResponse.json(
        { error: "Build does not have a generated artifact yet" },
        { status: 400 }
      );
    }

    // Boundary-aware path containment check (Finding #6)
    const safeBuildDir = getExistingBuildDir(buildId);
    if (!safeBuildDir) {
      return NextResponse.json({ error: "Build directory not found" }, { status: 404 });
    }

    const resolvedArtifact = path.resolve(build.artifactPath);
    if (!isPathContained(safeBuildDir, resolvedArtifact) || !fs.existsSync(resolvedArtifact)) {
      return NextResponse.json(
        { error: "Access denied: artifact path outside build directory" },
        { status: 403 }
      );
    }

    // ── DATA-LEVEL HARD-BLOCK FOR DEMO / VERIFICATION ARTIFACTS ──────────────
    if (build.isDemoArtifact) {
      if (!simulateIfUnregistered) {
        return NextResponse.json(
          {
            error:
              "Publishing blocked: This build was created in Verification/Demo mode. Placeholder artifacts cannot be uploaded to live Google Play Console tracks. Connect a mobile repository with native Android/Flutter files to generate production releases.",
            code: "DEMO_ARTIFACT_BLOCKED",
          },
          { status: 400 }
        );
      }

      // Record distinct "simulated" status (Finding #12)
      const updated = updateServerBuild(buildId, {
        googlePlayPublishStatus: "simulated",
        googlePlayPublishedTrack: track,
        googlePlayPublishedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        simulated: true,
        isSimulated: true,
        status: "simulated",
        notice:
          "Simulated pipeline release recorded. Demo artifact was not sent to Google Play API.",
        versionCode: build.buildNumber,
        track,
        build: updated,
      });
    }

    // ── LIVE PRODUCTION ARTIFACT PUBLISHING ──────────────────────────────────
    if (!isGooglePlayConfigured()) {
      return NextResponse.json(
        { error: "Google Play service account is not configured in .env.local" },
        { status: 501 }
      );
    }

    updateServerBuild(buildId, {
      googlePlayPublishStatus: "pending",
      googlePlayPublishedTrack: track,
    });

    const artifactBuffer = fs.readFileSync(resolvedArtifact);

    try {
      const result = await publishBundle({
        packageName,
        track,
        bundleBuffer: artifactBuffer,
        releaseNotes,
      });

      const updated = updateServerBuild(buildId, {
        googlePlayPublishStatus: "success",
        googlePlayPublishedTrack: track,
        googlePlayPublishedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        versionCode: result.versionCode,
        editId: result.editId,
        track: result.track,
        build: updated,
      });
    } catch (publishErr: unknown) {
      // Handle when package is not yet registered in Google Play Console
      if (simulateIfUnregistered) {
        // Record distinct "simulated" status, NOT "success" (Finding #12)
        const updated = updateServerBuild(buildId, {
          googlePlayPublishStatus: "simulated",
          googlePlayPublishedTrack: track,
          googlePlayPublishedAt: new Date().toISOString(),
        });

        return NextResponse.json({
          success: true,
          simulated: true,
          isSimulated: true,
          status: "simulated",
          notice: `Google Play authenticated, but '${packageName}' is not yet created in Play Console. Simulated release recorded for pipeline testing.`,
          versionCode: build.buildNumber,
          track,
          build: updated,
        });
      }

      updateServerBuild(buildId, {
        googlePlayPublishStatus: "failed",
      });

      if (publishErr instanceof GooglePlayError) {
        return NextResponse.json(
          { error: publishErr.message, details: publishErr.details },
          { status: publishErr.status || 500 }
        );
      }

      const msg = publishErr instanceof Error ? publishErr.message : String(publishErr);
      return NextResponse.json(
        { error: "Failed to publish to Google Play", details: msg },
        { status: 500 }
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
