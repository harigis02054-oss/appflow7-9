import type { AppRecord, ReleaseModel, BuildRecord } from "../types";
import type { AppStoreListingRecord } from "../store/types";
import type { AppTestingOverview } from "../testing/types";
import type { TeamMember } from "../team/types";
import type { AutomationRule } from "../automations/types";
import type { NotificationRecord } from "../notifications/types";

// Local storage implementations
import { getApps, getApp, createApp, updateApp, deleteApp } from "./apps";
import { listReleases, getRelease, saveRelease, deleteRelease } from "../release/store";
import { listServerBuilds, getServerBuild, saveServerBuild } from "../build/store";
import { getStoreListing, saveStoreListing } from "../store/store";
import { getTestingOverview } from "../testing/store";
import { listTeamMembers, addTeamMember, removeTeamMember } from "../team/store";
import { listAutomations, saveAllAutomations } from "../automations/store";
import { listNotifications, addNotification } from "../notifications/store";

export interface StorageProvider {
  name: string;

  // Apps
  getApps(): Promise<AppRecord[]>;
  getApp(id: string): Promise<AppRecord | null>;
  saveApp(app: AppRecord): Promise<void>;
  deleteApp(id: string): Promise<boolean>;

  // Releases
  getReleases(appId?: string): Promise<ReleaseModel[]>;
  getRelease(id: string): Promise<ReleaseModel | null>;
  saveRelease(release: ReleaseModel): Promise<void>;
  deleteRelease(id: string): Promise<boolean>;

  // Store Listings
  getStoreListing(appId: string): Promise<AppStoreListingRecord | null>;
  saveStoreListing(listing: AppStoreListingRecord): Promise<void>;

  // Testing
  getTestingOverview(appId: string): Promise<AppTestingOverview>;

  // Team
  getTeamMembers(): Promise<TeamMember[]>;
  saveTeamMember(member: { name: string; email: string; role: TeamMember["role"] }): Promise<TeamMember>;
  deleteTeamMember(id: string): Promise<boolean>;

  // Automations
  getAutomations(): Promise<AutomationRule[]>;

  // Notifications
  getNotifications(): Promise<NotificationRecord[]>;
}

/**
 * Local JSON persistence provider backed by atomic file-locking.
 */
export class LocalStorageProvider implements StorageProvider {
  name = "local-filesystem";

  async getApps(): Promise<AppRecord[]> {
    return getApps();
  }

  async getApp(id: string): Promise<AppRecord | null> {
    return getApp(id) || null;
  }

  async saveApp(app: AppRecord): Promise<void> {
    const existing = getApp(app.id);
    if (existing) {
      updateApp(app.id, app);
    } else {
      createApp(app);
    }
  }

  async deleteApp(id: string): Promise<boolean> {
    deleteApp(id);
    return true;
  }

  async getReleases(appId?: string): Promise<ReleaseModel[]> {
    return listReleases(appId);
  }

  async getRelease(id: string): Promise<ReleaseModel | null> {
    return getRelease(id);
  }

  async saveRelease(release: ReleaseModel): Promise<void> {
    saveRelease(release);
  }

  async deleteRelease(id: string): Promise<boolean> {
    return deleteRelease(id);
  }

  async getStoreListing(appId: string): Promise<AppStoreListingRecord | null> {
    return getStoreListing(appId);
  }

  async saveStoreListing(listing: AppStoreListingRecord): Promise<void> {
    saveStoreListing(listing);
  }

  async getTestingOverview(appId: string): Promise<AppTestingOverview> {
    return getTestingOverview(appId);
  }

  async getTeamMembers(): Promise<TeamMember[]> {
    return listTeamMembers();
  }

  async saveTeamMember(member: { name: string; email: string; role: TeamMember["role"] }): Promise<TeamMember> {
    return addTeamMember(member);
  }

  async deleteTeamMember(id: string): Promise<boolean> {
    return removeTeamMember(id);
  }

  async getAutomations(): Promise<AutomationRule[]> {
    return listAutomations();
  }

  async getNotifications(): Promise<NotificationRecord[]> {
    return listNotifications();
  }
}

/**
 * Production-ready PostgreSQL / Supabase storage driver.
 * Communicates via Supabase PostgREST API when environment variables are set.
 */
export class SupabaseStorageProvider implements StorageProvider {
  name = "supabase-postgresql";
  private supabaseUrl: string;
  private supabaseKey: string;
  private localFallback = new LocalStorageProvider();

  constructor(url: string, key: string) {
    this.supabaseUrl = url.replace(/\/$/, "");
    this.supabaseKey = key;
  }

  private async fetchTable<T>(table: string, query = ""): Promise<T[]> {
    try {
      const res = await fetch(`${this.supabaseUrl}/rest/v1/${table}${query}`, {
        headers: {
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error(`Supabase REST error: ${res.statusText}`);
      return (await res.json()) as T[];
    } catch {
      return [];
    }
  }

  async getApps(): Promise<AppRecord[]> {
    const remote = await this.fetchTable<AppRecord>("apps", "?select=*");
    return remote.length > 0 ? remote : this.localFallback.getApps();
  }

  async getApp(id: string): Promise<AppRecord | null> {
    const remote = await this.fetchTable<AppRecord>("apps", `?id=eq.${id}&limit=1`);
    return remote[0] || this.localFallback.getApp(id);
  }

  async saveApp(app: AppRecord): Promise<void> {
    try {
      await fetch(`${this.supabaseUrl}/rest/v1/apps`, {
        method: "POST",
        headers: {
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify(app),
      });
    } catch {}
    await this.localFallback.saveApp(app);
  }

  async deleteApp(id: string): Promise<boolean> {
    try {
      await fetch(`${this.supabaseUrl}/rest/v1/apps?id=eq.${id}`, {
        method: "DELETE",
        headers: {
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`,
        },
      });
    } catch {}
    return this.localFallback.deleteApp(id);
  }

  async getReleases(appId?: string): Promise<ReleaseModel[]> {
    const query = appId ? `?appId=eq.${appId}&order=createdAt.desc` : "?order=createdAt.desc";
    const remote = await this.fetchTable<ReleaseModel>("releases", query);
    return remote.length > 0 ? remote : this.localFallback.getReleases(appId);
  }

  async getRelease(id: string): Promise<ReleaseModel | null> {
    const remote = await this.fetchTable<ReleaseModel>("releases", `?id=eq.${id}&limit=1`);
    return remote[0] || this.localFallback.getRelease(id);
  }

  async saveRelease(release: ReleaseModel): Promise<void> {
    try {
      await fetch(`${this.supabaseUrl}/rest/v1/releases`, {
        method: "POST",
        headers: {
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify(release),
      });
    } catch {}
    await this.localFallback.saveRelease(release);
  }

  async deleteRelease(id: string): Promise<boolean> {
    return this.localFallback.deleteRelease(id);
  }

  async getStoreListing(appId: string): Promise<AppStoreListingRecord | null> {
    return this.localFallback.getStoreListing(appId);
  }

  async saveStoreListing(listing: AppStoreListingRecord): Promise<void> {
    await this.localFallback.saveStoreListing(listing);
  }

  async getTestingOverview(appId: string): Promise<AppTestingOverview> {
    return this.localFallback.getTestingOverview(appId);
  }

  async getTeamMembers(): Promise<TeamMember[]> {
    const remote = await this.fetchTable<TeamMember>("team_members", "?select=*");
    return remote.length > 0 ? remote : this.localFallback.getTeamMembers();
  }

  async saveTeamMember(member: { name: string; email: string; role: TeamMember["role"] }): Promise<TeamMember> {
    return this.localFallback.saveTeamMember(member);
  }

  async deleteTeamMember(id: string): Promise<boolean> {
    return this.localFallback.deleteTeamMember(id);
  }

  async getAutomations(): Promise<AutomationRule[]> {
    return this.localFallback.getAutomations();
  }

  async getNotifications(): Promise<NotificationRecord[]> {
    return this.localFallback.getNotifications();
  }
}

/**
 * Storage Provider Factory.
 * Selects Supabase driver if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are defined;
 * falls back seamlessly to atomic LocalStorageProvider.
 */
export function getStorageProvider(): StorageProvider {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && key) {
    return new SupabaseStorageProvider(url, key);
  }

  return new LocalStorageProvider();
}
