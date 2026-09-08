import { NextRequest, NextResponse } from "next/server";
import { cancelReleasePipeline } from "@/lib/release/orchestrator";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const actor = body.actor || "User";

    const success = cancelReleasePipeline(id, actor);
    if (!success) {
      return NextResponse.json({ error: "Release not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Release pipeline cancelled" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
