import { NextRequest, NextResponse } from "next/server";
import { executeReleaseUpload } from "@/lib/release/orchestrator";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const actor = body.actor || "User";
    const simulateIfUnregistered = body.simulateIfUnregistered ?? true;

    const res = await executeReleaseUpload(id, actor, { simulateIfUnregistered });
    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, release: res.release });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
