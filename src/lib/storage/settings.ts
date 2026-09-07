import { driver } from "./storage";
import type { SettingsRecord } from "@/lib/types";

const COLLECTION = "settings";

const DEFAULTS: SettingsRecord = {
  githubConnected: false,
  googlePlayConnected: false,
  appStoreConnected: false,
};

// Settings is a single record, but we store it inside an array collection
// like everything else for consistency with the storage driver interface.
export function getSettings(): SettingsRecord {
  const rows = driver.getAll<SettingsRecord>(COLLECTION);
  return rows[0] ?? DEFAULTS;
}

export function updateSettings(patch: Partial<SettingsRecord>): SettingsRecord {
  const merged = { ...getSettings(), ...patch };
  driver.setAll(COLLECTION, [merged]);
  return merged;
}
