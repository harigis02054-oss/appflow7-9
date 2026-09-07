import { driver, newId, nowIso } from "./storage";
import type { ActivityEntry, ActivitySeverity } from "@/lib/types";

const COLLECTION = "activity";
const MAX_ENTRIES = 500;

export function getActivity(): ActivityEntry[] {
  return driver
    .getAll<ActivityEntry>(COLLECTION)
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

export function logActivity(
  message: string,
  severity: ActivitySeverity = "info",
  appId?: string
): ActivityEntry {
  const entry: ActivityEntry = {
    id: newId(),
    message,
    appId,
    severity,
    timestamp: nowIso(),
  };
  const entries = driver.getAll<ActivityEntry>(COLLECTION);
  entries.push(entry);
  // Keep the log bounded so localStorage doesn't grow unbounded.
  const trimmed = entries.slice(-MAX_ENTRIES);
  driver.setAll(COLLECTION, trimmed);
  return entry;
}
