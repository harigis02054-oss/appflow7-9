// Storage abstraction.
//
// Every collection (apps, repositories, builds, releases, activity, settings)
// reads and writes through this single driver interface. Today it's backed by
// localStorage. When you move to Supabase or Firebase, only this file's
// implementation changes — nothing in lib/storage/apps.ts, repositories.ts,
// etc. or in the UI needs to know where the data actually lives.

export interface StorageDriver {
  getAll<T>(collection: string): T[];
  setAll<T>(collection: string, items: T[]): void;
  clear(collection: string): void;
}

const NAMESPACE = "appflow";

function isBrowser() {
  return typeof window !== "undefined";
}

class LocalStorageDriver implements StorageDriver {
  private memoryStore: Map<string, string> = new Map();

  private key(collection: string) {
    return `${NAMESPACE}:${collection}`;
  }

  getAll<T>(collection: string): T[] {
    try {
      let raw: string | null = null;
      if (isBrowser()) {
        raw = window.localStorage.getItem(this.key(collection));
      } else {
        raw = this.memoryStore.get(this.key(collection)) || null;
      }
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch (err) {
      console.error(`[storage] failed to read "${collection}"`, err);
      return [];
    }
  }

  setAll<T>(collection: string, items: T[]): void {
    try {
      const serialized = JSON.stringify(items);
      if (isBrowser()) {
        window.localStorage.setItem(this.key(collection), serialized);
        window.dispatchEvent(
          new CustomEvent("appflow:storage-change", { detail: { collection } })
        );
      } else {
        this.memoryStore.set(this.key(collection), serialized);
      }
    } catch (err) {
      console.error(`[storage] failed to write "${collection}"`, err);
    }
  }

  clear(collection: string): void {
    if (isBrowser()) {
      window.localStorage.removeItem(this.key(collection));
    } else {
      this.memoryStore.delete(this.key(collection));
    }
  }
}

// Swap this line for a Supabase/Firebase-backed driver later.
// e.g. export const driver: StorageDriver = new SupabaseDriver(supabaseClient);
export const driver: StorageDriver = new LocalStorageDriver();

export function newId(): string {
  if (isBrowser() && "randomUUID" in window.crypto) {
    return window.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
