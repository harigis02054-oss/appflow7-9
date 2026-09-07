import { driver, newId, nowIso } from "./storage";
import type { BuildRecord, BuildStatus, BuildLogLine } from "@/lib/types";

const COLLECTION = "builds";

export function getBuilds(): BuildRecord[] {
  return driver
    .getAll<BuildRecord>(COLLECTION)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

export function getBuildsForApp(appId: string): BuildRecord[] {
  return getBuilds().filter((b) => b.appId === appId);
}

export function getBuild(id: string): BuildRecord | undefined {
  return getBuilds().find((b) => b.id === id);
}

export function createBuild(
  input: Pick<BuildRecord, "appId" | "platform" | "version" | "buildNumber"> &
    Partial<BuildRecord>
): BuildRecord {
  const build: BuildRecord = {
    id: input.id || newId(),
    appId: input.appId,
    platform: input.platform,
    status: input.status ?? "queued",
    version: input.version,
    buildNumber: input.buildNumber,
    commitSha: input.commitSha,
    startedAt: input.startedAt || nowIso(),
    completedAt: input.completedAt,
    durationMs: input.durationMs,
    artifactPath: input.artifactPath,
    artifactName: input.artifactName,
    artifactSize: input.artifactSize,
    isDemoArtifact: input.isDemoArtifact,
    commitAuthor: input.commitAuthor,
    commitMessage: input.commitMessage,
    googlePlayPublishStatus: input.googlePlayPublishStatus,
    googlePlayPublishedTrack: input.googlePlayPublishedTrack,
    googlePlayPublishedAt: input.googlePlayPublishedAt,
    logs: input.logs ?? [],
  };
  const builds = driver.getAll<BuildRecord>(COLLECTION);
  builds.push(build);
  driver.setAll(COLLECTION, builds);
  return build;
}

export function appendBuildLog(id: string, line: BuildLogLine): void {
  const builds = driver.getAll<BuildRecord>(COLLECTION);
  const idx = builds.findIndex((b) => b.id === id);
  if (idx === -1) return;
  builds[idx].logs.push(line);
  driver.setAll(COLLECTION, builds);
}

export function setBuildStatus(id: string, status: BuildStatus): void {
  const builds = driver.getAll<BuildRecord>(COLLECTION);
  const idx = builds.findIndex((b) => b.id === id);
  if (idx === -1) return;
  builds[idx].status = status;
  if (status === "success" || status === "failed" || status === "cancelled" || status === "blocked") {
    builds[idx].completedAt = nowIso();
  }
  driver.setAll(COLLECTION, builds);
}

export function updateBuild(
  id: string,
  patch: Partial<BuildRecord>
): BuildRecord | undefined {
  const builds = driver.getAll<BuildRecord>(COLLECTION);
  const idx = builds.findIndex((b) => b.id === id);
  if (idx === -1) return undefined;
  builds[idx] = { ...builds[idx], ...patch };
  driver.setAll(COLLECTION, builds);
  return builds[idx];
}

export function deleteBuild(id: string): void {
  const builds = driver.getAll<BuildRecord>(COLLECTION);
  driver.setAll(
    COLLECTION,
    builds.filter((b) => b.id !== id)
  );
}
