import { driver, newId, nowIso } from "./storage";
import type { AppRecord } from "@/lib/types";

const COLLECTION = "apps";

export function getApps(): AppRecord[] {
  return driver.getAll<AppRecord>(COLLECTION);
}

export function getApp(id: string): AppRecord | undefined {
  return getApps().find((a) => a.id === id);
}

export function createApp(
  input: Pick<AppRecord, "name" | "repositoryId"> & Partial<AppRecord>
): AppRecord {
  const app: AppRecord = {
    id: input.id || newId(),
    name: input.name,
    repositoryId: input.repositoryId,
    version: input.version ?? "1.0.0",
    androidBuildNumber: input.androidBuildNumber ?? 1,
    iosBuildNumber: input.iosBuildNumber ?? 1,
    androidPackage: input.androidPackage,
    iosBundleId: input.iosBundleId,
    googlePlayConnection: input.googlePlayConnection ?? "not-connected",
    appStoreConnection: input.appStoreConnection ?? "not-connected",
    analysis: input.analysis,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const apps = getApps();
  apps.push(app);
  driver.setAll(COLLECTION, apps);
  return app;
}

export function updateApp(
  id: string,
  patch: Partial<AppRecord>
): AppRecord | undefined {
  const apps = getApps();
  const idx = apps.findIndex((a) => a.id === id);
  if (idx === -1) return undefined;
  apps[idx] = { ...apps[idx], ...patch, updatedAt: nowIso() };
  driver.setAll(COLLECTION, apps);
  return apps[idx];
}

export function deleteApp(id: string): void {
  driver.setAll(
    COLLECTION,
    getApps().filter((a) => a.id !== id)
  );
}
