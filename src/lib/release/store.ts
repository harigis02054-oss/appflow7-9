import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { ReleaseModel, ReleaseAuditEvent, ReleaseStage } from "@/lib/types";

const BUILDS_DIR = path.join(process.cwd(), ".builds");
const RELEASES_FILE = path.join(BUILDS_DIR, "releases.json");

function ensureBuildsDir() {
  if (!fs.existsSync(BUILDS_DIR)) {
    fs.mkdirSync(BUILDS_DIR, { recursive: true });
  }
}

export function listReleases(appId?: string): ReleaseModel[] {
  ensureBuildsDir();
  if (!fs.existsSync(RELEASES_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(RELEASES_FILE, "utf-8");
    const releases = JSON.parse(raw) as ReleaseModel[];
    const sorted = releases.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return appId ? sorted.filter((r) => r.appId === appId) : sorted;
  } catch (err) {
    console.error("[release-store] Failed to read releases.json:", err);
    return [];
  }
}

export function getRelease(id: string): ReleaseModel | null {
  const releases = listReleases();
  return releases.find((r) => r.id === id) || null;
}

export function saveRelease(release: ReleaseModel): void {
  ensureBuildsDir();
  const releases = listReleases();
  const idx = releases.findIndex((r) => r.id === release.id);
  if (idx >= 0) {
    releases[idx] = release;
  } else {
    releases.push(release);
  }
  const tempFile = `${RELEASES_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tempFile, JSON.stringify(releases, null, 2), "utf-8");
  fs.renameSync(tempFile, RELEASES_FILE);
}

export function updateRelease(
  id: string,
  patch: Partial<ReleaseModel>
): ReleaseModel | null {
  const release = getRelease(id);
  if (!release) return null;

  const updated: ReleaseModel = {
    ...release,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  saveRelease(updated);
  return updated;
}

export function appendReleaseAudit(
  releaseId: string,
  event: Omit<ReleaseAuditEvent, "id" | "timestamp">
): ReleaseAuditEvent | null {
  const release = getRelease(releaseId);
  if (!release) return null;

  const auditEntry: ReleaseAuditEvent = {
    id: `audit_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
    timestamp: new Date().toISOString(),
    ...event,
  };

  release.auditLogs.push(auditEntry);
  saveRelease(release);
  return auditEntry;
}

export function appendReleaseStageLog(
  releaseId: string,
  stageId: string,
  message: string
): void {
  const release = getRelease(releaseId);
  if (!release) return;

  const stage = release.stages.find((s) => s.id === stageId);
  if (stage) {
    if (!stage.logs) stage.logs = [];
    const timestamp = new Date().toISOString().slice(11, 19);
    stage.logs.push(`[${timestamp}] ${message}`);
    saveRelease(release);
  }
}

export function deleteRelease(id: string): boolean {
  ensureBuildsDir();
  const releases = listReleases();
  const filtered = releases.filter((r) => r.id !== id);
  if (filtered.length === releases.length) return false;

  const tempFile = `${RELEASES_FILE}.tmp.${Date.now()}`;
  fs.writeFileSync(tempFile, JSON.stringify(filtered, null, 2), "utf-8");
  fs.renameSync(tempFile, RELEASES_FILE);
  return true;
}
