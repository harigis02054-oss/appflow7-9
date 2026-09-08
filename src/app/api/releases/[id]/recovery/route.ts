import { NextRequest, NextResponse } from "next/server";
import { generateRollbackRecommendation } from "@/lib/release/recovery";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const recommendation = generateRollbackRecommendation(id);
    return NextResponse.json(recommendation);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
