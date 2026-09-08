import type { Platform, ReleaseTrack } from "@/lib/types";

export type TrackStatus =
  | "draft"
  | "uploaded"
  | "processing"
  | "available"
  | "completed"
  | "halted";

export interface TesterRecord {
  id: string;
  email: string;
  groupName: string;
  addedAt: string;
  status: "invited" | "accepted" | "active";
}

export interface TesterGroup {
  id: string;
  name: string;
  platform: Platform;
  track: ReleaseTrack;
  testerCount: number;
  testers: TesterRecord[];
  optInUrl?: string;
  createdAt: string;
}

export interface ClosedTestingPrerequisites {
  requiredTesters: number; // e.g. 12 testers
  currentTesters: number;
  requiredDays: number; // e.g. 14 days
  daysCompleted: number;
  startDate?: string;
  isEligibleForProduction: boolean;
  statusSummary: string;
}

export interface StoreLinksInfo {
  internalAppSharingUrl?: string;
  googlePlayOptInUrl?: string;
  googlePlayPublicUrl?: string;
  testFlightPublicUrl?: string;
  appStorePublicUrl?: string;
}

export interface AppTestingOverview {
  appId: string;
  appName: string;
  groups: TesterGroup[];
  closedTesting: ClosedTestingPrerequisites;
  storeLinks: StoreLinksInfo;
  activeReleases: {
    track: ReleaseTrack;
    platform: Platform;
    version: string;
    buildNumber: number;
    status: TrackStatus;
    updatedAt: string;
  }[];
}
