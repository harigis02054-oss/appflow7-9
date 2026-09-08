import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { Platform, ReleaseTrack } from "../types";
import type {
  AppTestingOverview,
  ClosedTestingPrerequisites,
  StoreLinksInfo,
  TesterGroup,
  TesterRecord,
} from "./types";
import { getApp } from "../storage/apps";
import { listReleases } from "../release/store";

const BUILDS_DIR = path.join(process.cwd(), ".builds");
const TESTING_FILE = path.join(BUILDS_DIR, "testing.json");

interface AppTestingData {
  appId: string;
  groups: TesterGroup[];
  closedTestingStartDate?: string;
  storeLinks?: StoreLinksInfo;
  updatedAt: string;
}

function ensureBuildsDir() {
  if (!fs.existsSync(BUILDS_DIR)) {
    fs.mkdirSync(BUILDS_DIR, { recursive: true });
  }
}

export function listAllTestingData(): AppTestingData[] {
  ensureBuildsDir();
  if (!fs.existsSync(TESTING_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(TESTING_FILE, "utf-8");
    return JSON.parse(raw) as AppTestingData[];
  } catch (err) {
    console.error("[testing-store] Failed to read testing.json:", err);
    return [];
  }
}

export function saveAllTestingData(records: AppTestingData[]) {
  ensureBuildsDir();
  const tempPath = `${TESTING_FILE}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(records, null, 2), "utf-8");
  fs.renameSync(tempPath, TESTING_FILE);
}

function getAppData(appId: string, platform: Platform = "android"): { all: AppTestingData[]; appData: AppTestingData } {
  const all = listAllTestingData();
  let appData = all.find((d) => d.appId === appId);
  if (!appData) {
    const defaultGroups: TesterGroup[] = [
      {
        id: `grp_${crypto.randomBytes(4).toString("hex")}`,
        name: platform === "ios" ? "TestFlight Internal" : "Internal Testers",
        platform,
        track: "internal-testing",
        testerCount: 0,
        testers: [],
        createdAt: new Date().toISOString(),
      },
      {
        id: `grp_${crypto.randomBytes(4).toString("hex")}`,
        name: platform === "ios" ? "External Beta" : "Closed Alpha/Beta Testers",
        platform,
        track: "closed-testing",
        testerCount: 0,
        testers: [],
        createdAt: new Date().toISOString(),
      },
    ];

    appData = {
      appId,
      groups: defaultGroups,
      updatedAt: new Date().toISOString(),
    };

    all.push(appData);
    saveAllTestingData(all);
  }

  return { all, appData };
}

export function computeClosedTestingPrerequisites(
  testers: TesterRecord[],
  startDateStr?: string
): ClosedTestingPrerequisites {
  const requiredTesters = 12;
  const requiredDays = 14;

  // Deduplicate testers by lowercase email
  const uniqueEmails = new Set(testers.map((t) => t.email.toLowerCase().trim()));
  const currentTesters = uniqueEmails.size;

  let daysCompleted = 0;
  if (startDateStr) {
    const start = new Date(startDateStr).getTime();
    const diffMs = Date.now() - start;
    if (diffMs > 0) {
      daysCompleted = Math.min(requiredDays, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }
  }

  const isEligibleForProduction = currentTesters >= requiredTesters && daysCompleted >= requiredDays;

  let statusSummary: string;
  if (isEligibleForProduction) {
    statusSummary = "Closed testing requirement satisfied (12+ testers active for 14+ continuous days). Eligible for Production release.";
  } else {
    const missingTesters = Math.max(0, requiredTesters - currentTesters);
    const missingDays = Math.max(0, requiredDays - daysCompleted);
    const testerPart = missingTesters > 0 ? `${missingTesters} more tester${missingTesters > 1 ? "s" : ""} needed` : "Tester count met";
    const dayPart = missingDays > 0 ? `${missingDays} day${missingDays > 1 ? "s" : ""} remaining` : "14-day testing period complete";
    statusSummary = `${testerPart} • ${dayPart}`;
  }

  return {
    requiredTesters,
    currentTesters,
    requiredDays,
    daysCompleted,
    startDate: startDateStr,
    isEligibleForProduction,
    statusSummary,
  };
}

export function getTestingOverview(appId: string): AppTestingOverview {
  const app = getApp(appId);
  const appName = app?.name || "Application";
  const platform = (app?.iosBundleId ? "ios" : "android") as Platform;
  const bundleId = app?.androidPackage || app?.iosBundleId || "com.example.app";

  const { appData: data } = getAppData(appId, platform);

  // Collect all testers across all groups
  const allTesters: TesterRecord[] = [];
  data.groups.forEach((g) => {
    g.testerCount = g.testers.length;
    allTesters.push(...g.testers);
  });

  const closedTesting = computeClosedTestingPrerequisites(allTesters, data.closedTestingStartDate);

  // Generate authentic official store link structures
  const defaultStoreLinks: StoreLinksInfo = {
    googlePlayOptInUrl: platform === "android" ? `https://play.google.com/apps/testing/${bundleId}` : undefined,
    googlePlayPublicUrl: platform === "android" ? `https://play.google.com/store/apps/details?id=${bundleId}` : undefined,
    testFlightPublicUrl: platform === "ios" ? (data.storeLinks?.testFlightPublicUrl || undefined) : undefined,
    appStorePublicUrl: platform === "ios" ? (data.storeLinks?.appStorePublicUrl || undefined) : undefined,
    internalAppSharingUrl: data.storeLinks?.internalAppSharingUrl,
    ...data.storeLinks,
  };

  // Find active releases for this app
  const appReleases = listReleases()
    .filter((r) => r.appId === appId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const activeReleases: AppTestingOverview["activeReleases"] = appReleases.slice(0, 5).map((r) => {
    let trackStatus: AppTestingOverview["activeReleases"][0]["status"] = "uploaded";
    if (r.state === "READY_FOR_TESTING" || r.state === "RELEASED") {
      trackStatus = "available";
    } else if (r.state === "PROCESSING") {
      trackStatus = "processing";
    } else if (r.state === "FAILED" || r.state === "CANCELLED") {
      trackStatus = "halted";
    } else if (r.state === "CREATED") {
      trackStatus = "draft";
    }

    return {
      track: r.track,
      platform: r.platform,
      version: r.version,
      buildNumber: r.buildNumber,
      status: trackStatus,
      updatedAt: r.updatedAt,
    };
  });

  return {
    appId,
    appName,
    groups: data.groups,
    closedTesting,
    storeLinks: defaultStoreLinks,
    activeReleases,
  };
}

export function addTester(
  appId: string,
  input: {
    email: string;
    groupName?: string;
    platform?: Platform;
    track?: ReleaseTrack;
  }
): TesterRecord {
  const { all, appData } = getAppData(appId, input.platform || "android");

  const groupName = input.groupName || (appData.groups[0]?.name || "Internal Testers");
  let group = appData.groups.find((g) => g.name.toLowerCase() === groupName.toLowerCase());

  if (!group) {
    const newGroup: TesterGroup = {
      id: `grp_${crypto.randomBytes(4).toString("hex")}`,
      name: groupName,
      platform: input.platform || "android",
      track: input.track || "internal-testing",
      testerCount: 0,
      testers: [],
      createdAt: new Date().toISOString(),
    };
    appData.groups.push(newGroup);
    group = newGroup;
  }

  const newTester: TesterRecord = {
    id: `tst_${crypto.randomBytes(5).toString("hex")}`,
    email: input.email.trim().toLowerCase(),
    groupName: group.name,
    addedAt: new Date().toISOString(),
    status: "invited",
  };

  // Prevent duplicate in same group
  const existingIdx = group.testers.findIndex((t) => t.email.toLowerCase() === newTester.email);
  if (existingIdx >= 0) {
    group.testers[existingIdx] = newTester;
  } else {
    group.testers.push(newTester);
  }

  group.testerCount = group.testers.length;
  appData.updatedAt = new Date().toISOString();

  // If closed testing start date isn't set and we now have testers, set it
  if (!appData.closedTestingStartDate && group.track === "closed-testing") {
    appData.closedTestingStartDate = new Date().toISOString();
  }

  saveAllTestingData(all);
  return newTester;
}

export function removeTester(appId: string, testerId: string): boolean {
  const all = listAllTestingData();
  const appData = all.find((d) => d.appId === appId);
  if (!appData) return false;

  let removed = false;
  appData.groups.forEach((g) => {
    const before = g.testers.length;
    g.testers = g.testers.filter((t) => t.id !== testerId);
    if (g.testers.length !== before) {
      g.testerCount = g.testers.length;
      removed = true;
    }
  });

  if (removed) {
    appData.updatedAt = new Date().toISOString();
    saveAllTestingData(all);
  }

  return removed;
}

export function createTesterGroup(
  appId: string,
  input: {
    name: string;
    platform: Platform;
    track: ReleaseTrack;
    optInUrl?: string;
  }
): TesterGroup {
  const { all, appData } = getAppData(appId, input.platform);

  const newGroup: TesterGroup = {
    id: `grp_${crypto.randomBytes(4).toString("hex")}`,
    name: input.name,
    platform: input.platform,
    track: input.track,
    testerCount: 0,
    testers: [],
    optInUrl: input.optInUrl,
    createdAt: new Date().toISOString(),
  };

  appData.groups.push(newGroup);
  appData.updatedAt = new Date().toISOString();
  saveAllTestingData(all);

  return newGroup;
}

export function updateTestingSettings(
  appId: string,
  settings: {
    startDate?: string;
    storeLinks?: Partial<StoreLinksInfo>;
  }
): AppTestingOverview {
  const { all, appData } = getAppData(appId);

  if (settings.startDate !== undefined) {
    appData.closedTestingStartDate = settings.startDate;
  }

  if (settings.storeLinks) {
    appData.storeLinks = {
      ...(appData.storeLinks || {}),
      ...settings.storeLinks,
    };
  }

  appData.updatedAt = new Date().toISOString();
  saveAllTestingData(all);

  return getTestingOverview(appId);
}
