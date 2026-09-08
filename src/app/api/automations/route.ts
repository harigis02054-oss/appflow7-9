import { NextRequest, NextResponse } from "next/server";
import {
  listAutomations,
  toggleAutomation,
  createAutomationRule,
} from "@/lib/automations/store";
import { evaluateAutomationEvent } from "@/lib/automations/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const automations = listAutomations();
    return NextResponse.json({ automations });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.action === "toggle") {
      if (!body.id || body.enabled === undefined) {
        return NextResponse.json({ error: "Missing id or enabled parameter" }, { status: 400 });
      }
      const updated = toggleAutomation(body.id, Boolean(body.enabled));
      return NextResponse.json({ success: Boolean(updated), automation: updated });
    }

    if (body.action === "trigger-event") {
      if (!body.type || !body.appId) {
        return NextResponse.json({ error: "Missing event type or appId" }, { status: 400 });
      }
      const results = await evaluateAutomationEvent({
        type: body.type,
        appId: body.appId,
        branch: body.branch,
        releaseId: body.releaseId,
        buildId: body.buildId,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, results });
    }

    if (!body.name || !body.trigger || !body.actions) {
      return NextResponse.json({ error: "Missing required rule parameters" }, { status: 400 });
    }

    const rule = createAutomationRule({
      name: body.name,
      description: body.description || "",
      appId: body.appId,
      trigger: body.trigger,
      actions: body.actions,
    });

    return NextResponse.json({ success: true, automation: rule });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
