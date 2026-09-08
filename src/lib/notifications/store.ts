import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { NotificationRecord, NotificationType } from "./types";

const BUILDS_DIR = path.join(process.cwd(), ".builds");
const NOTIFICATIONS_FILE = path.join(BUILDS_DIR, "notifications.json");

function ensureBuildsDir() {
  if (!fs.existsSync(BUILDS_DIR)) {
    fs.mkdirSync(BUILDS_DIR, { recursive: true });
  }
}

export function listNotifications(): NotificationRecord[] {
  ensureBuildsDir();
  if (!fs.existsSync(NOTIFICATIONS_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(NOTIFICATIONS_FILE, "utf-8");
    return JSON.parse(raw) as NotificationRecord[];
  } catch (err) {
    console.error("[notifications-store] Failed to read notifications.json:", err);
    return [];
  }
}

export function saveAllNotifications(records: NotificationRecord[]) {
  ensureBuildsDir();
  const tempPath = `${NOTIFICATIONS_FILE}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(records, null, 2), "utf-8");
  fs.renameSync(tempPath, NOTIFICATIONS_FILE);
}

export function addNotification(input: {
  title: string;
  message: string;
  type?: NotificationType;
  appId?: string;
  releaseId?: string;
}): NotificationRecord {
  const records = listNotifications();
  const newNotif: NotificationRecord = {
    id: `notif_${crypto.randomBytes(4).toString("hex")}`,
    title: input.title,
    message: input.message,
    type: input.type || "info",
    appId: input.appId,
    releaseId: input.releaseId,
    read: false,
    createdAt: new Date().toISOString(),
  };

  records.unshift(newNotif);
  // Cap at 100 notifications
  if (records.length > 100) {
    records.length = 100;
  }
  saveAllNotifications(records);
  return newNotif;
}

export function markAsRead(id: string): boolean {
  const records = listNotifications();
  const notif = records.find((n) => n.id === id);
  if (!notif) return false;
  notif.read = true;
  saveAllNotifications(records);
  return true;
}

export function markAllAsRead(): void {
  const records = listNotifications();
  records.forEach((n) => (n.read = true));
  saveAllNotifications(records);
}
