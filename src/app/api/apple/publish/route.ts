import { NextResponse } from "next/server";
import { getAppleConfig, verifyAppleConnection } from "@/lib/apple/client";
import { getServerBuild, updateServerBuild } from "@/lib/build/store";
import { execSync } from "child_process";
import fs from "fs";

export async function POST(req: Request) {
  try {
    const {
      buildId,
      appId,
      track = "testflight",
      simulateIfUnregistered = false,
    } = await req.json();

    if (!buildId || !appId) {
      return NextResponse.json({ error: "Missing buildId or appId" }, { status: 400 });
    }

    const build = getServerBuild(buildId);
    if (!build) {
      return NextResponse.json({ error: `Build '${buildId}' not found.` }, { status: 404 });
    }

    const artifactPath = build.artifactPath;
    if (!artifactPath || !fs.existsSync(artifactPath)) {
      return NextResponse.json(
        { error: "Build artifact not found on disk. Rebuild the app before publishing." },
        { status: 400 }
      );
    }

    const config = getAppleConfig();

    // Check if we should simulate
    if (build.isDemoArtifact || simulateIfUnregistered || !config) {
      updateServerBuild(buildId, {
        googlePlayPublishStatus: "simulated",
        googlePlayPublishedTrack: track,
        googlePlayPublishedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        isSimulated: true,
        track,
        versionCode: build.buildNumber,
        notice: !config
          ? "App Store Connect credentials not configured in .env.local. Release was simulated."
          : "Release was simulated per user request.",
      });
    }

    // Verify Apple credentials
    const connCheck = await verifyAppleConnection(config);
    if (!connCheck.valid) {
      if (simulateIfUnregistered) {
        return NextResponse.json({
          success: true,
          isSimulated: true,
          track,
          versionCode: build.buildNumber,
          notice: `App Store Connect rejected authentication (${connCheck.error}). Simulated release recorded.`,
        });
      }

      return NextResponse.json(
        {
          error: `App Store Connect authentication failed: ${connCheck.error || "Invalid credentials"}. Verify APPLE_KEY_ID and APPLE_ISSUER_ID.`,
        },
        { status: 401 }
      );
    }

    // Attempt upload with xcrun altool
    try {
      const keyPath = process.env.APPLE_PRIVATE_KEY_PATH;
      if (!keyPath || !fs.existsSync(keyPath)) {
        throw new Error("APPLE_PRIVATE_KEY_PATH file not found on server disk for altool upload.");
      }

      const cmd = `xcrun altool --upload-package "${artifactPath}" --type ios --api-key "${config.keyId}" --api-issuer "${config.issuerId}" --p8-file-path "${keyPath}" --output-format json`;
      const stdout = execSync(cmd, { encoding: "utf8", timeout: 180000 });

      updateServerBuild(buildId, {
        googlePlayPublishStatus: "success",
        googlePlayPublishedTrack: track,
        googlePlayPublishedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        isSimulated: false,
        track,
        versionCode: build.buildNumber,
        raw: stdout,
      });
    } catch (uploadErr: unknown) {
      let errMsg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);

      // Attempt to extract clean message from altool output
      const errWithStdout = uploadErr as { stdout?: string; stderr?: string };
      const rawOutput = (errWithStdout?.stdout || "") + "\n" + (errWithStdout?.stderr || "");
      try {
        const jsonMatch = rawOutput.match(/\{[\s\S]*"product-errors"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed["product-errors"] && parsed["product-errors"][0]?.message) {
            errMsg = parsed["product-errors"][0].message;
          }
        }
      } catch {
        // Fallback to errMsg
      }

      if (simulateIfUnregistered) {
        return NextResponse.json({
          success: true,
          isSimulated: true,
          track,
          versionCode: build.buildNumber,
          notice: `altool upload encountered error (${errMsg}). Recorded as simulated release.`,
        });
      }

      return NextResponse.json(
        { error: `TestFlight upload failed: ${errMsg}` },
        { status: 500 }
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown server error" },
      { status: 500 }
    );
  }
}
