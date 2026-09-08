import { describe, it, expect, beforeEach } from "vitest";
import {
  LocalStorageProvider,
  SupabaseStorageProvider,
  getStorageProvider,
} from "../provider";
import type { AppRecord } from "../../types";

describe("Production Storage Abstraction & Drivers (Phase 9)", () => {
  const provider = new LocalStorageProvider();

  const testApp: AppRecord = {
    id: "app_storage_provider_test",
    name: "Provider Test App",
    repositoryId: "owner/repo",
    version: "1.0.0",
    androidBuildNumber: 1,
    iosBuildNumber: 1,
    androidPackage: "com.test.provider",
    googlePlayConnection: "not-connected",
    appStoreConnection: "not-connected",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("stores and retrieves app records via LocalStorageProvider", async () => {
    await provider.saveApp(testApp);
    const retrieved = await provider.getApp(testApp.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe("Provider Test App");
    expect(retrieved?.androidPackage).toBe("com.test.provider");

    const allApps = await provider.getApps();
    expect(allApps.some((a) => a.id === testApp.id)).toBe(true);

    // Clean up
    await provider.deleteApp(testApp.id);
  });

  it("retrieves releases and team members via StorageProvider interface", async () => {
    const members = await provider.getTeamMembers();
    expect(Array.isArray(members)).toBe(true);

    const automations = await provider.getAutomations();
    expect(Array.isArray(automations)).toBe(true);

    const notifications = await provider.getNotifications();
    expect(Array.isArray(notifications)).toBe(true);
  });

  it("factory returns LocalStorageProvider when Supabase credentials are not configured", () => {
    const factoryProvider = getStorageProvider();
    expect(factoryProvider).toBeInstanceOf(LocalStorageProvider);
    expect(factoryProvider.name).toBe("local-filesystem");
  });

  it("instantiates SupabaseStorageProvider with target PostgreSQL endpoint", () => {
    const supabaseProvider = new SupabaseStorageProvider(
      "https://example.supabase.co",
      "mock_service_role_key"
    );
    expect(supabaseProvider.name).toBe("supabase-postgresql");
  });
});
