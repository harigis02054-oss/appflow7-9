import { NextRequest, NextResponse } from "next/server";
import { getRelease } from "@/lib/release/store";
import {
  advanceReleaseToBuild,
  transitionReleaseStage,
} from "@/lib/release/orchestrator";
import type { ReleaseState, ReleaseStageStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const release = getRelease(id);

    if (!release) {
      return NextResponse.json({ error: "Release not found" }, { status: 404 });
    }

    const body = await request.json();
    const { action, stageId, status, nextState, actor, log, error } = body;

    if (action === "advance-to-build") {
      const res = await advanceReleaseToBuild(id, actor || "User");
      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 500 });
      }
      return NextResponse.json({ success: true, buildId: res.buildId });
    }

    if (!stageId || !status) {
      return NextResponse.json(
        { error: "Missing stageId or status for transition" },
        { status: 400 }
      );
    }

    const updated = transitionReleaseStage(
      id,
      stageId,
      status as ReleaseStageStatus,
      {
        nextState: nextState as ReleaseState,
        actor: actor || "User",
        log,
        error,
      }
    );

    return NextResponse.json({ success: true, release: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
