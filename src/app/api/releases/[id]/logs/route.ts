import { NextRequest, NextResponse } from "next/server";
import { getRelease } from "@/lib/release/store";
import { getServerLogs } from "@/lib/build/store";

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

    const stageLogs: Record<string, string[]> = {};
    for (const stage of release.stages) {
      stageLogs[stage.id] = stage.logs || [];
    }

    let buildLogs: unknown[] = [];
    if (release.buildId) {
      buildLogs = getServerLogs(release.buildId).lines;
    }

    return NextResponse.json({
      releaseId: id,
      state: release.state,
      stageLogs,
      buildLogs,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
