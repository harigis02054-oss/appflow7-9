import { driver, nowIso } from "./storage";
import type { Repository } from "@/lib/types";

const COLLECTION = "repositories";

export function getRepositories(): Repository[] {
  return driver.getAll<Repository>(COLLECTION);
}

export function getRepository(id: string): Repository | undefined {
  return getRepositories().find((r) => r.id === id);
}

export function upsertRepository(repo: Repository): Repository {
  const repos = getRepositories();
  const idx = repos.findIndex((r) => r.id === repo.id);
  const withSync = { ...repo, lastSyncedAt: nowIso() };
  if (idx === -1) {
    repos.push(withSync);
  } else {
    repos[idx] = withSync;
  }
  driver.setAll(COLLECTION, repos);
  return withSync;
}

export function deleteRepository(id: string): void {
  driver.setAll(
    COLLECTION,
    getRepositories().filter((r) => r.id !== id)
  );
}
