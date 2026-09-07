import fs from "fs";
import path from "path";

export interface ServerBuildLogLine {
  index: number;
  timestamp: string;
  message: string;
  level: "info" | "warn" | "error" | "step";
}

export type BuildMode = "release-aab" | "debug-apk" | "dry-run" | "release-ipa" | "debug-ios";

export interface ServerBuildRecord {
  id: string;
  appId: string;
  appName: string;
  repositoryId: string;
  branch: string;
  platform: "android" | "ios";
  buildMode: BuildMode;
  status: "queued" | "running" | "success" | "failed" | "blocked" | "cancelled";
  version: string;
  buildNumber: number;
  commitSha?: string;
  commitMessage?: string;
  commitAuthor?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  artifactPath?: string;
  artifactName?: string;
  artifactSize?: number;
  isDemoArtifact?: boolean;
  errorSummary?: string;
  googlePlayPublishStatus?: "not-published" | "pending" | "success" | "failed" | "simulated";
  googlePlayPublishedTrack?: string;
  googlePlayPublishedAt?: string;
}

/**
 * Validates build ID format to prevent directory traversal and arbitrary path injection.
 */
export function isValidBuildId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{4,64}$/.test(id);
}

const BUILDS_DIR = path.join(process.cwd(), ".builds");
const JOBS_FILE = path.join(BUILDS_DIR, "jobs.json");

function ensureBuildsDir() {
  if (!fs.existsSync(BUILDS_DIR)) {
    fs.mkdirSync(BUILDS_DIR, { recursive: true });
  }
}

/**
 * Robust boundary-aware path containment check using path.relative (Finding #6).
 * Prevents directory traversal attacks, including sibling directory prefix confusion.
 */
export function isPathContained(baseDir: string, targetPath: string): boolean {
  const rel = path.relative(path.resolve(baseDir), path.resolve(targetPath));
  return !rel.startsWith("..") && !path.isAbsolute(rel) && rel !== "";
}

/**
 * Creates the build directory explicitly for a new build job (Finding #7).
 */
export function createBuildDir(buildId: string): string {
  if (!isValidBuildId(buildId)) {
    throw new Error(`Invalid buildId format: '${buildId}'`);
  }
  ensureBuildsDir();
  const dir = path.join(BUILDS_DIR, buildId);
  if (!isPathContained(BUILDS_DIR, dir)) {
    throw new Error("Path traversal attempted");
  }
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Read-only build directory resolver. Returns null if directory does not exist (Finding #7).
 */
export function getExistingBuildDir(buildId: string): string | null {
  if (!isValidBuildId(buildId)) {
    return null;
  }
  const dir = path.join(BUILDS_DIR, buildId);
  if (!isPathContained(BUILDS_DIR, dir)) {
    return null;
  }
  return fs.existsSync(dir) ? dir : null;
}

/**
 * Legacy compatibility resolver. Uses boundary-aware isPathContained.
 */
export function getBuildDir(buildId: string): string {
  return createBuildDir(buildId);
}

export function listServerBuilds(appId?: string): ServerBuildRecord[] {
  ensureBuildsDir();
  if (!fs.existsSync(JOBS_FILE)) {
    return [];
  }
  try {
    const content = fs.readFileSync(JOBS_FILE, "utf-8");
    const builds = JSON.parse(content) as ServerBuildRecord[];
    const sorted = builds.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
    return appId ? sorted.filter((b) => b.appId === appId) : sorted;
  } catch {
    return [];
  }
}

export function getServerBuild(id: string): ServerBuildRecord | null {
  const builds = listServerBuilds();
  return builds.find((b) => b.id === id) || null;
}

export function saveServerBuild(build: ServerBuildRecord): void {
  ensureBuildsDir();
  const builds = listServerBuilds();
  const idx = builds.findIndex((b) => b.id === build.id);
  if (idx >= 0) {
    builds[idx] = build;
  } else {
    builds.push(build);
  }
  fs.writeFileSync(JOBS_FILE, JSON.stringify(builds, null, 2), "utf-8");
}

export function updateServerBuild(
  id: string,
  patch: Partial<ServerBuildRecord>
): ServerBuildRecord | null {
  const build = getServerBuild(id);
  if (!build) return null;
  const updated: ServerBuildRecord = { ...build, ...patch };
  if (
    (patch.status === "success" ||
      patch.status === "failed" ||
      patch.status === "blocked" ||
      patch.status === "cancelled") &&
    !updated.completedAt
  ) {
    updated.completedAt = new Date().toISOString();
    updated.durationMs =
      new Date(updated.completedAt).getTime() -
      new Date(updated.startedAt).getTime();
  }
  saveServerBuild(updated);
  return updated;
}

// In-memory line index cache to eliminate re-reading entire log files on each append (Finding #13)
const logLineIndexCache = new Map<string, number>();

export function appendServerLog(
  buildId: string,
  message: string,
  level: "info" | "warn" | "error" | "step" = "info"
): ServerBuildLogLine {
  const dir = createBuildDir(buildId);
  const logFile = path.join(dir, "logs.jsonl");

  let lineCount = logLineIndexCache.get(buildId);
  if (lineCount === undefined) {
    lineCount = fs.existsSync(logFile)
      ? fs.readFileSync(logFile, "utf-8").split("\n").filter(Boolean).length
      : 0;
  }

  const logLine: ServerBuildLogLine = {
    index: lineCount,
    timestamp: new Date().toISOString(),
    message,
    level,
  };

  logLineIndexCache.set(buildId, lineCount + 1);
  fs.appendFileSync(logFile, JSON.stringify(logLine) + "\n", "utf-8");
  return logLine;
}

export function getServerLogs(
  buildId: string,
  sinceIndex = 0
): { lines: ServerBuildLogLine[]; totalLines: number } {
  const dir = getExistingBuildDir(buildId);
  if (!dir) {
    return { lines: [], totalLines: 0 };
  }
  const logFile = path.join(dir, "logs.jsonl");

  if (!fs.existsSync(logFile)) {
    return { lines: [], totalLines: 0 };
  }

  try {
    const raw = fs.readFileSync(logFile, "utf-8");
    const allLines: ServerBuildLogLine[] = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as ServerBuildLogLine;
        } catch {
          return null;
        }
      })
      .filter((item): item is ServerBuildLogLine => item !== null);

    const filtered = allLines.filter((l) => l.index >= sinceIndex);
    return { lines: filtered, totalLines: allLines.length };
  } catch {
    return { lines: [], totalLines: 0 };
  }
}

/**
 * Removes the heavy cloned workspace after artifact extraction (Finding #17).
 * This eliminates the 800MB+ per-build footprint while preserving logs and artifacts.
 */
export function cleanBuildWorkspace(buildId: string): void {
  const dir = getExistingBuildDir(buildId);
  if (!dir) return;
  const workspaceDir = path.join(dir, "workspace");
  if (fs.existsSync(workspaceDir)) {
    try {
      fs.rmSync(workspaceDir, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
  }
}

/**
 * Prunes build artifact files older than maxDays, retaining records but freeing disk space.
 * Also cleans stale workspace directories (Finding #17).
 */
export function pruneOldBuildArtifacts(maxDays = 14): number {
  ensureBuildsDir();
  const builds = listServerBuilds();
  const cutoffTime = Date.now() - maxDays * 24 * 60 * 60 * 1000;
  const workspaceCutoffTime = Date.now() - 1 * 24 * 60 * 60 * 1000; // Workspaces pruned after 24 hours
  let prunedCount = 0;

  for (const build of builds) {
    const buildTime = new Date(build.startedAt).getTime();
    const buildDir = getExistingBuildDir(build.id);

    // Clean stale workspaces older than 24 hours
    if (buildDir && buildTime < workspaceCutoffTime) {
      cleanBuildWorkspace(build.id);
    }

    // Clean old artifact files older than maxDays
    if (buildTime < cutoffTime && build.artifactPath && fs.existsSync(build.artifactPath)) {
      try {
        fs.unlinkSync(build.artifactPath);
        prunedCount++;
      } catch {}
    }
  }

  return prunedCount;
}
