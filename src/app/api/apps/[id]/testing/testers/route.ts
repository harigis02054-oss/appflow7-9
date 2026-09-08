import { NextResponse } from "next/server";
import { addTester, removeTester, createTesterGroup, getTestingOverview } from "@/lib/testing/store";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (body.type === "group") {
      if (!body.name || !body.platform || !body.track) {
        return NextResponse.json({ error: "Missing name, platform, or track for group" }, { status: 400 });
      }
      const group = createTesterGroup(id, {
        name: body.name,
        platform: body.platform,
        track: body.track,
        optInUrl: body.optInUrl,
      });
      return NextResponse.json({ success: true, group });
    }

    // Default: add individual tester
    if (!body.email) {
      return NextResponse.json({ error: "Email is required to add tester" }, { status: 400 });
    }

    const tester = addTester(id, {
      email: body.email,
      groupName: body.groupName,
      platform: body.platform,
      track: body.track,
    });

    const overview = getTestingOverview(id);
    return NextResponse.json({ success: true, tester, overview });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add tester" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const testerId = searchParams.get("testerId");

    if (!testerId) {
      return NextResponse.json({ error: "testerId query param is required" }, { status: 400 });
    }

    const removed = removeTester(id, testerId);
    const overview = getTestingOverview(id);
    return NextResponse.json({ success: removed, overview });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to remove tester" },
      { status: 500 }
    );
  }
}
