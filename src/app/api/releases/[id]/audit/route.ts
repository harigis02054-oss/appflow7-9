import { NextRequest, NextResponse } from "next/server";
import { getReleaseAuditTrail } from "@/lib/release/audit";
import { getRelease } from "@/lib/release/store";

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

    const auditTrail = getReleaseAuditTrail(id);
    return NextResponse.json({
      releaseId: id,
      totalEvents: auditTrail.length,
      auditTrail,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
