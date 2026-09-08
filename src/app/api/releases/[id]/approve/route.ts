import { NextRequest, NextResponse } from "next/server";
import { recordReleaseApproval } from "@/lib/release/orchestrator";
import { getCurrentUser } from "@/lib/team/store";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const currentUser = getCurrentUser();

    const decision = body.decision === "rejected" ? "rejected" : "approved";
    const notes = body.notes;
    const actor = body.actor || currentUser.name;
    const role = body.role || currentUser.role;

    const res = recordReleaseApproval(id, {
      decision,
      notes,
      actor,
      role,
    });

    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, release: res.release });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
