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

// ── Release Orchestrator & State Machine (Master Prompt Phases 4-9) ─────────

export type ReleaseState =
  | "CREATED"
  | "ANALYZING"
  | "VALIDATED"
  | "BUILDING"
  | "BUILT"
  | "SIGNED"
  | "TESTED"
  | "UPLOADING"
  | "UPLOADED"
  | "PROCESSING"
  | "READY_FOR_TESTING"
  | "TESTING"
  | "READY_FOR_REVIEW"
  | "APPROVED"
  | "RELEASING"
  | "RELEASED"
  | "FAILED"
  | "BLOCKED"
  | "CANCELLED";

export type ReleaseStageStatus =
  | "pending"
  | "running"
  | "success"
  | "warning"
  | "blocked"
  | "failed"
  | "skipped";

export interface ReleaseStage {
  id: string;
  name: string;
  description: string;
  status: ReleaseStageStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
  warnings?: string[];
  logs?: string[];
}

export interface ReleaseAuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details?: string;
  fromState?: ReleaseState;
  toState?: ReleaseState;
}

export interface ReleaseModel {
  id: string;
  appId: string;
  appName: string;
  repositoryId: string;
  branch: string;
  commitSha?: string;
  commitMessage?: string;
  commitAuthor?: string;
  commitDate?: string;
  platform: Platform;
  track: ReleaseTrack;
  version: string;
  buildNumber: number;
  state: ReleaseState;
  currentStageId: string;
  stages: ReleaseStage[];
  buildId?: string;
  artifactId?: string;
  artifactPath?: string;
  artifactName?: string;
  artifactSize?: number;
  artifactChecksum?: string;
  androidPackage?: string;
  iosBundleId?: string;
  isSimulated: boolean;
  changeSummary?: {
    previousVersion?: string;
    previousCommitSha?: string;
    commitsCount: number;
    changedFiles: string[];
  };
  complianceStatus?: "compliant" | "warning" | "blocked" | "not-checked";
  testingStatus?: "pending" | "passed" | "failed" | "skipped";
  approvalStatus?: "not-required" | "pending" | "approved" | "rejected";
  storeProcessingStatus?: "not-uploaded" | "processing" | "valid" | "failed";
  storeLinks?: {
    internalTestingUrl?: string;
    publicUrl?: string;
    consoleUrl?: string;
  };
  errorSummary?: string;
  auditLogs: ReleaseAuditEvent[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ── Version Management ──────────────────────────────────────────────────────

export type VersionIncrementType = "patch" | "minor" | "major" | "build-only" | "manual";

export interface VersionPlan {
  currentVersion: string;
  currentBuildNumber: number;
  nextVersion: string;
  nextBuildNumber: number;
  incrementType: VersionIncrementType;
  rationale?: string;
}

// ── Deep Repository Intelligence & Diagnostics ──────────────────────────────

export interface MissingFileDiagnostic {
  id: string;
  path: string;
  category: "android" | "ios" | "flutter" | "store-metadata" | "compliance" | "signing";
  label: string;
  found: boolean;
  severity: "required" | "recommended" | "production-only";
  impact: string;
  canBuildAnyway: boolean;
}

export interface DeepProjectAnalysis extends RepositoryAnalysis {
  missingFiles: MissingFileDiagnostic[];
  detectedPermissions: {
    android: string[];
    ios: string[];
  };
  packageProvenance?: {
    androidPackageSource?: string;
    iosBundleIdSource?: string;
  };
  buildReadinessPct: number;
  storeReadinessPct: number;
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

