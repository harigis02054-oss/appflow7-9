// Core domain types for AppFlow.
// These are storage-agnostic on purpose: the same shapes will be used
// whether the backing store is localStorage, Supabase, or Firebase.

export type Platform = "android" | "ios";

export type ProjectFramework =
  | "flutter"
  | "react-native"
  | "native-android"
  | "native-ios"
  | "unknown";

export type ReadinessStatus = "ready" | "warning" | "blocked";

export interface RequiredFileCheck {
  id: string;
  label: string;
  path: string;
  found: boolean;
  severity: "required" | "recommended";
}

export interface RepositoryAnalysis {
  framework: ProjectFramework;
  hasAndroid: boolean;
  hasIOS: boolean;
  androidPackage?: string;
  iosBundleId?: string;
  currentVersion?: string;
  versionCode?: number;
  androidChecks: RequiredFileCheck[];
  iosChecks: RequiredFileCheck[];
  androidReadinessPct: number;
  iosReadinessPct: number;
  analyzedAt: string; // ISO timestamp
}

export interface Repository {
  id: string; // `${owner}/${repo}`
  owner: string;
  name: string;
  defaultBranch: string;
  lastCommitSha?: string;
  lastSyncedAt?: string;
  htmlUrl: string;
  private: boolean;
}

export type AppStoreConnection = "connected" | "not-connected";

export interface AppRecord {
  id: string; // uuid
  name: string;
  repositoryId: string; // Repository.id
  version: string; // marketing version, e.g. "1.0.0"
  androidBuildNumber: number;
  iosBuildNumber: number;
  androidPackage?: string;
  iosBundleId?: string;
  googlePlayConnection: AppStoreConnection;
  appStoreConnection: AppStoreConnection;
  analysis?: RepositoryAnalysis;
  createdAt: string;
  updatedAt: string;
}

export type BuildStatus =
  | "queued"
  | "running"
  | "success"
  | "failed"
  | "cancelled"
  | "blocked";

export interface BuildLogLine {
  timestamp: string;
  message: string;
  level: "info" | "warn" | "error";
}

export interface BuildRecord {
  id: string;
  appId: string;
  platform: Platform;
  status: BuildStatus;
  version: string;
  buildNumber: number;
  commitSha?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  buildMode?: string;
  artifactPath?: string;
  artifactName?: string;
  artifactSize?: number;
  isDemoArtifact?: boolean;
  commitAuthor?: string;
  commitMessage?: string;
  googlePlayPublishStatus?: "not-published" | "pending" | "success" | "failed" | "simulated";
  googlePlayPublishedTrack?: string;
  googlePlayPublishedAt?: string;
  logs: BuildLogLine[];
}

export type ReleaseTrack =
  | "internal-testing"
  | "closed-testing"
  | "production"
  | "testflight"
  | "app-store";

export interface ReleaseRecord {
  id: string;
  appId: string;
  platform: Platform;
  track: ReleaseTrack;
  version: string;
  buildNumber: number;
  buildId?: string;
  status: "pending" | "success" | "failed";
  isSimulated?: boolean;
  notes?: string;
  googlePlayEditId?: string;
  createdAt: string;
}

export type ActivitySeverity = "info" | "success" | "warning" | "danger";

export interface ActivityEntry {
  id: string;
  message: string;
  appId?: string;
  severity: ActivitySeverity;
  timestamp: string;
}

export interface SettingsRecord {
  githubConnected: boolean;
  googlePlayConnected: boolean;
  appStoreConnected: boolean;
}
