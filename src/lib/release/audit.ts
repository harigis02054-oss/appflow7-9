import crypto from "crypto";
import type { ReleaseAuditEvent, ReleaseState } from "@/lib/types";
import { getRelease, saveRelease } from "./store";

export interface LogAuditParams {
  releaseId: string;
  actor: string;
  action: string;
  details?: string;
  fromState?: ReleaseState;
  toState?: ReleaseState;
}

/**
 * Appends an immutable audit event to the specified release record.
 */
export function logReleaseAudit(params: LogAuditParams): ReleaseAuditEvent | null {
  const release = getRelease(params.releaseId);
  if (!release) return null;

  const now = new Date().toISOString();
  const entry: ReleaseAuditEvent = {
    id: `audit_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
    timestamp: now,
    actor: params.actor,
    action: params.action,
    details: params.details,
    fromState: params.fromState,
    toState: params.toState,
  };

  if (!release.auditLogs) {
    release.auditLogs = [];
  }

  release.auditLogs.push(entry);
  release.updatedAt = now;
  saveRelease(release);

  return entry;
}

/**
 * Retrieves the complete chronological audit trail for a release.
 */
export function getReleaseAuditTrail(releaseId: string): ReleaseAuditEvent[] {
  const release = getRelease(releaseId);
  if (!release || !release.auditLogs) return [];
  return [...release.auditLogs].sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));
}
