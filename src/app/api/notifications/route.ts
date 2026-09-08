import { NextRequest, NextResponse } from "next/server";
import {
  listNotifications,
  markAsRead,
  markAllAsRead,
  addNotification,
} from "@/lib/notifications/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const notifications = listNotifications();
    const unreadCount = notifications.filter((n) => !n.read).length;
    return NextResponse.json({ notifications, unreadCount });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.all) {
      markAllAsRead();
      return NextResponse.json({ success: true });
    }

    if (body.id) {
      const ok = markAsRead(body.id);
      return NextResponse.json({ success: ok });
    }

    if (body.title && body.message) {
      const notif = addNotification({
        title: body.title,
        message: body.message,
        type: body.type,
        appId: body.appId,
        releaseId: body.releaseId,
      });
      return NextResponse.json({ success: true, notification: notif });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
