import { NextRequest, NextResponse } from "next/server";
import {
  listTeamMembers,
  addTeamMember,
  updateTeamMemberRole,
  removeTeamMember,
  getCurrentUser,
} from "@/lib/team/store";
import type { TeamRole } from "@/lib/team/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const members = listTeamMembers();
    const currentUser = getCurrentUser();
    return NextResponse.json({ members, currentUser });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, id, name, email, role } = body;

    if (action === "update-role") {
      if (!id || !role) {
        return NextResponse.json({ error: "Missing member id or role" }, { status: 400 });
      }
      const updated = updateTeamMemberRole(id, role as TeamRole);
      return NextResponse.json({ success: Boolean(updated), member: updated });
    }

    if (!name || !email || !role) {
      return NextResponse.json({ error: "Missing name, email, or role" }, { status: 400 });
    }

    const member = addTeamMember({ name, email, role: role as TeamRole });
    return NextResponse.json({ success: true, member });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing member id" }, { status: 400 });
    }

    const removed = removeTeamMember(id);
    return NextResponse.json({ success: removed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
