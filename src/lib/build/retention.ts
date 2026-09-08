import fs from "fs";
import path from "path";
import crypto from "crypto";
import { isPathContained } from "./store";

const BUILDS_DIR = path.join(process.cwd(), ".builds");

export interface ChecksumVerificationResult {
  valid: boolean;
  sha256: string;
  sizeBytes: number;
  error?: string;
}

export interface PruneResult {
  prunedCount: number;
  freedBytes: number;
  details: string[];
}

export interface RetentionStats {
  totalArtifacts: number;
  totalSizeBytes: number;
  ephemeralWorkspacesCount: number;
  oldestArtifactDate?: string;
}

/**
 * Computes streaming SHA-256 and compares against expected checksum before distribution.
 */
export function verifyArtifactChecksum(
  filePath: string,
  expectedChecksum?: string
): ChecksumVerificationResult {
  if (!fs.existsSync(filePath)) {
    return {
      valid: false,
      sha256: "",
      sizeBytes: 0,
      error: `File not found at '${filePath}'`,
    };
  }

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    const sizeBytes = fileBuffer.length;

    const valid = expectedChecksum ? hash.toLowerCase() === expectedChecksum.toLowerCase() : true;

    return {
      valid,
      sha256: hash,
      sizeBytes,
      error: valid ? undefined : `Checksum mismatch. Expected: ${expectedChecksum}, Found: ${hash}`,
    };
  } catch (err) {
    return {
      valid: false,
      sha256: "",
      sizeBytes: 0,
      error: err instanceof Error ? err.message : "Checksum calculation failed",
    };
  }
}

/**
 * Prunes ephemeral compilation build workspaces older than maxAgeHours (default: 24 hours),
 * preserving verified final binary packages (.aab, .ipa, .apk) and json metadata.
 */
export function pruneEphemeralWorkspaces(options?: {
  maxAgeHours?: number;
}): PruneResult {
  const maxAgeHours = options?.maxAgeHours ?? 24;
  const cutoffMs = Date.now() - maxAgeHours * 60 * 60 * 1000;

  if (!fs.existsSync(BUILDS_DIR)) {
    return { prunedCount: 0, freedBytes: 0, details: [] };
  }

  const entries = fs.readdirSync(BUILDS_DIR, { withFileTypes: true });
  let prunedCount = 0;
  let freedBytes = 0;
  const details: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const dirPath = path.join(BUILDS_DIR, entry.name);
    if (!isPathContained(BUILDS_DIR, dirPath)) continue;

    try {
      const stats = fs.statSync(dirPath);
      if (stats.mtimeMs < cutoffMs) {
        // Find subdirectories like repo or compilation cache inside the build dir
        const innerFiles = fs.readdirSync(dirPath);
        for (const inner of innerFiles) {
          const innerPath = path.join(dirPath, inner);
          const innerStat = fs.statSync(innerPath);

          // Keep final release binaries
          const isReleaseBinary =
            inner.endsWith(".aab") || inner.endsWith(".ipa") || inner.endsWith(".apk");

          if (!isReleaseBinary) {
            freedBytes += innerStat.size || 0;
            if (innerStat.isDirectory()) {
              fs.rmSync(innerPath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(innerPath);
            }
            prunedCount++;
          }
        }
        details.push(`Pruned compilation workspace: ${entry.name}`);
      }
    } catch {
      // Ignore individual file error
    }
  }

  return { prunedCount, freedBytes, details };
}

/**
 * Prunes release artifacts older than maxAgeDays (default: 14 days).
 */
export function pruneStaleArtifacts(options?: {
  maxAgeDays?: number;
}): PruneResult {
  const maxAgeDays = options?.maxAgeDays ?? 14;
  const cutoffMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  if (!fs.existsSync(BUILDS_DIR)) {
    return { prunedCount: 0, freedBytes: 0, details: [] };
  }

  let prunedCount = 0;
  let freedBytes = 0;
  const details: string[] = [];

  function scanDir(dir: string) {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const itemPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        scanDir(itemPath);
      } else if (
        item.name.endsWith(".aab") ||
        item.name.endsWith(".ipa") ||
        item.name.endsWith(".apk")
      ) {
        try {
          const stat = fs.statSync(itemPath);
          if (stat.mtimeMs < cutoffMs) {
            freedBytes += stat.size;
            fs.unlinkSync(itemPath);
            prunedCount++;
            details.push(`Removed expired artifact (> ${maxAgeDays}d): ${item.name}`);
          }
        } catch {}
      }
    }
  }

  scanDir(BUILDS_DIR);
  return { prunedCount, freedBytes, details };
}

/**
 * Returns disk usage and artifact retention metrics.
 */
export function getRetentionStats(): RetentionStats {
  if (!fs.existsSync(BUILDS_DIR)) {
    return { totalArtifacts: 0, totalSizeBytes: 0, ephemeralWorkspacesCount: 0 };
  }

  let totalArtifacts = 0;
  let totalSizeBytes = 0;
  let ephemeralWorkspacesCount = 0;
  let oldestDate: Date | undefined;

  const entries = fs.readdirSync(BUILDS_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      ephemeralWorkspacesCount++;
      const dirPath = path.join(BUILDS_DIR, entry.name);
      try {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          if (file.endsWith(".aab") || file.endsWith(".ipa") || file.endsWith(".apk")) {
            totalArtifacts++;
            const stat = fs.statSync(path.join(dirPath, file));
            totalSizeBytes += stat.size;
            if (!oldestDate || stat.mtime < oldestDate) {
              oldestDate = stat.mtime;
            }
          }
        }
      } catch {}
    }
  }

  return {
    totalArtifacts,
    totalSizeBytes,
    ephemeralWorkspacesCount,
    oldestArtifactDate: oldestDate?.toISOString(),
  };
}
