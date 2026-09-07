import { driver, newId, nowIso } from "./storage";
import type { ReleaseRecord } from "@/lib/types";

const COLLECTION = "releases";

export function getReleases(): ReleaseRecord[] {
  return driver
    .getAll<ReleaseRecord>(COLLECTION)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getReleasesForApp(appId: string): ReleaseRecord[] {
  return getReleases().filter((r) => r.appId === appId);
}

export function createRelease(
  input: Omit<ReleaseRecord, "id" | "createdAt">
): ReleaseRecord {
  const release: ReleaseRecord = {
    ...input,
    id: newId(),
    createdAt: nowIso(),
  };
  const releases = driver.getAll<ReleaseRecord>(COLLECTION);
  releases.push(release);
  driver.setAll(COLLECTION, releases);
  return release;
}
