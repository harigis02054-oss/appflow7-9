import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getServerBuild, getBuildDir, isValidBuildId } from "@/lib/build/store";

export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  // 1. Validate ID format to prevent directory traversal
  if (!isValidBuildId(id)) {
    return NextResponse.json({ error: "Invalid build ID format" }, { status: 400 });
  }

  // 2. Validate that the build actually exists in the store
  const build = getServerBuild(id);
  if (!build || !build.artifactPath) {
    return NextResponse.json(
      { error: "Artifact not found or build not yet completed" },
      { status: 404 }
    );
  }

  // 3. Assert that the artifact path is strictly within the build directory
  const safeBuildDir = path.resolve(getBuildDir(id));
  const resolvedArtifact = path.resolve(build.artifactPath);

  if (!resolvedArtifact.startsWith(safeBuildDir) || !fs.existsSync(resolvedArtifact)) {
    return NextResponse.json(
      { error: "Access denied: invalid artifact location" },
      { status: 403 }
    );
  }

  const fileBuffer = fs.readFileSync(resolvedArtifact);
  const fileName = build.artifactName || `build-${id}.aab`;

  return new Response(fileBuffer, {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": fileName.endsWith(".apk")
        ? "application/vnd.android.package-archive"
        : "application/octet-stream",
      "Content-Length": String(fileBuffer.length),
    },
  });
}
