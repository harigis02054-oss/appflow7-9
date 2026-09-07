import { NextResponse } from "next/server";
import { getServerLogs, getServerBuild, isValidBuildId } from "@/lib/build/store";

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  if (!isValidBuildId(id)) {
    return NextResponse.json({ error: "Invalid build ID format" }, { status: 400 });
  }

  const build = getServerBuild(id);
  if (!build) {
    return NextResponse.json({ error: "Build not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const sinceIndex = parseInt(searchParams.get("since") || "0", 10);

  const logs = getServerLogs(id, isNaN(sinceIndex) ? 0 : sinceIndex);

  return NextResponse.json({
    buildId: id,
    status: build.status,
    completedAt: build.completedAt,
    durationMs: build.durationMs,
    artifactPath: build.artifactPath,
    artifactName: build.artifactName,
    artifactSize: build.artifactSize,
    isDemoArtifact: build.isDemoArtifact,
    ...logs,
  });
}
