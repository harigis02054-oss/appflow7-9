import { NextResponse } from "next/server";
import { getServerBuild, isValidBuildId } from "@/lib/build/store";

export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  if (!isValidBuildId(id)) {
    return NextResponse.json({ error: "Invalid build ID format" }, { status: 400 });
  }

  const build = getServerBuild(id);
  if (!build) {
    return NextResponse.json({ error: "Build not found" }, { status: 404 });
  }

  return NextResponse.json({ build });
}
