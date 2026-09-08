import { NextResponse } from "next/server";
import { getTestingOverview, updateTestingSettings } from "@/lib/testing/store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const overview = getTestingOverview(id);
    return NextResponse.json(overview);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to retrieve testing overview" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = updateTestingSettings(id, {
      startDate: body.startDate,
      storeLinks: body.storeLinks,
    });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update testing settings" },
      { status: 500 }
    );
  }
}
