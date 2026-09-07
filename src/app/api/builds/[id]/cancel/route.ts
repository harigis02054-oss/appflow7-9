import { NextResponse } from "next/server";
import { cancelRunningBuild } from "@/lib/build/engine";

export async function POST(
  _req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const cancelled = cancelRunningBuild(id);

  return NextResponse.json({
    success: cancelled,
    message: cancelled ? "Build cancellation initiated" : "Build could not be cancelled",
  });
}
