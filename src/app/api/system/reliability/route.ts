import { NextRequest, NextResponse } from "next/server";
import { globalWorkerQueue } from "@/lib/worker/queue";
import {
  getRetentionStats,
  pruneEphemeralWorkspaces,
  pruneStaleArtifacts,
} from "@/lib/build/retention";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workerStats = globalWorkerQueue.getStats();
    const recentJobs = globalWorkerQueue.listJobs(10);
    const retentionStats = getRetentionStats();

    return NextResponse.json({
      workerStats,
      recentJobs,
      retentionStats,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "prune-workspaces";

    if (action === "prune-workspaces") {
      const maxAgeHours = body.maxAgeHours || 24;
      const res = pruneEphemeralWorkspaces({ maxAgeHours });
      return NextResponse.json({ success: true, result: res });
    }

    if (action === "prune-artifacts") {
      const maxAgeDays = body.maxAgeDays || 14;
      const res = pruneStaleArtifacts({ maxAgeDays });
      return NextResponse.json({ success: true, result: res });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
