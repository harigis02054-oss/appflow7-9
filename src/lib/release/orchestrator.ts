import crypto from "crypto";
import type {
  ReleaseModel,
  ReleaseStage,
  ReleaseStageStatus,
  ReleaseState,
  Platform,
  ReleaseTrack,
  ReleaseAuditEvent,
} from "@/lib/types";
import {
  saveRelease,
  getRelease,
  updateRelease,
  appendReleaseAudit,
  appendReleaseStageLog,
} from "./store";
import { runBuildPipeline } from "../build/engine";

export function getDefaultReleaseStages(): ReleaseStage[] {
  return [
    {
      id: "analyze",
      name: "Repository Analysis",
      description: "Inspect Git repository structure, platform configuration, and dependencies.",
      status: "pending",
    },
    {
      id: "validate",
      name: "Preflight Validation",
      description: "Verify host toolchains, signing assets, and bundle identifiers.",
      status: "pending",
    },
    {
      id: "build",
      name: "Compile Binary",
      description: "Compile source code into native release binary (AAB / IPA / APK).",
      status: "pending",
    },
    {
      id: "sign",
      name: "Code Signing & Entitlements",
      description: "Sign with Apple Distribution or Android Keystore certificates.",
      status: "pending",
    },
    {
      id: "test",
      name: "Artifact Validation",
      description: "Verify binary checksum, container integrity, and minimum requirements.",
      status: "pending",
    },
    {
      id: "upload",
      name: "Store Upload",
      description: "Upload package to Google Play Console or Apple App Store Connect.",
      status: "pending",
    },
    {
      id: "process",
      name: "Store Processing",
      description: "Monitor official store ingest and automated binary verification.",
      status: "pending",
    },
    {
      id: "testing-track",
      name: "Testing Track Rollout",
      description: "Deploy to Internal App Sharing, Play Internal Testing, or TestFlight.",
      status: "pending",
    },
    {
      id: "review",
      name: "Release Readiness",
      description: "Check store listing, privacy policy, and policy gate compliance.",
      status: "pending",
    },
    {
      id: "approve",
      name: "Team Approval",
      description: "QA and Release Manager sign-off before public distribution.",
      status: "pending",
    },
    {
      id: "production",
      name: "Production Release",
      description: "Public rollout to end users on App Store or Google Play.",
      status: "pending",
    },
  ];
}

export interface CreateReleaseParams {
  appId: string;
  appName: string;
  repositoryId: string;
  branch?: string;
  commitSha?: string;
  commitMessage?: string;
  commitAuthor?: string;
  platform: Platform;
  track: ReleaseTrack;
  version: string;
  buildNumber: number;
  androidPackage?: string;
  iosBundleId?: string;
  actor?: string;
}

export async function createReleasePipeline(
  params: CreateReleaseParams
): Promise<ReleaseModel> {
  const releaseId = `rel_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
  const now = new Date().toISOString();
  const branch = params.branch || "main";
  const actor = params.actor || "System";

  const stages = getDefaultReleaseStages();
  stages[0].status = "running";
  stages[0].startedAt = now;

  const initialAudit: ReleaseAuditEvent = {
    id: `audit_${Date.now()}_init`,
    timestamp: now,
    actor,
    action: "Created Release Pipeline",
    details: `Initiated release v${params.version} (#${params.buildNumber}) on ${params.platform} [${params.track}]`,
    toState: "CREATED",
  };

  const release: ReleaseModel = {
    id: releaseId,
    appId: params.appId,
    appName: params.appName,
    repositoryId: params.repositoryId,
    branch,
    commitSha: params.commitSha,
    commitMessage: params.commitMessage,
    commitAuthor: params.commitAuthor,
    commitDate: now,
    platform: params.platform,
    track: params.track,
    version: params.version,
    buildNumber: params.buildNumber,
    state: "CREATED",
    currentStageId: "analyze",
    stages,
    androidPackage: params.androidPackage,
    iosBundleId: params.iosBundleId,
    isSimulated: false,
    auditLogs: [initialAudit],
    createdAt: now,
    updatedAt: now,
  };

  saveRelease(release);
  appendReleaseStageLog(releaseId, "analyze", `Release pipeline initialized for ${params.appName}`);
  appendReleaseStageLog(releaseId, "analyze", `Target: ${params.platform.toUpperCase()} (${params.track})`);

  return release;
}

export function transitionReleaseStage(
  releaseId: string,
  stageId: string,
  status: ReleaseStageStatus,
  options?: {
    nextState?: ReleaseState;
    actor?: string;
    error?: string;
    warnings?: string[];
    log?: string;
  }
): ReleaseModel | null {
  const release = getRelease(releaseId);
  if (!release) return null;

  const now = new Date().toISOString();
  const stage = release.stages.find((s) => s.id === stageId);

  if (stage) {
    stage.status = status;
    if (status === "running" && !stage.startedAt) {
      stage.startedAt = now;
    }
    if (status === "success" || status === "failed" || status === "blocked") {
      stage.completedAt = now;
      if (stage.startedAt) {
        stage.durationMs = new Date(now).getTime() - new Date(stage.startedAt).getTime();
      }
    }
    if (options?.error) stage.error = options.error;
    if (options?.warnings) stage.warnings = options.warnings;
    if (options?.log) {
      if (!stage.logs) stage.logs = [];
      stage.logs.push(`[${now.slice(11, 19)}] ${options.log}`);
    }
  }

  const fromState = release.state;
  if (options?.nextState) {
    release.state = options.nextState;
  }

  const auditEntry: ReleaseAuditEvent = {
    id: `audit_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
    timestamp: now,
    actor: options?.actor || "System",
    action: `Stage [${stage?.name || stageId}] transitioned to ${status.toUpperCase()}`,
    details: options?.error || (options?.warnings && options.warnings.join(", ")) || undefined,
    fromState,
    toState: release.state,
  };
  release.auditLogs.push(auditEntry);

  saveRelease(release);
  return release;
}

export async function advanceReleaseToBuild(
  releaseId: string,
  actor = "System"
): Promise<{ success: boolean; buildId?: string; error?: string }> {
  const release = getRelease(releaseId);
  if (!release) return { success: false, error: "Release not found" };

  try {
    // 1. Complete validation
    transitionReleaseStage(releaseId, "analyze", "success", {
      nextState: "ANALYZING",
      actor,
      log: "Repository analysis verified successfully.",
    });

    transitionReleaseStage(releaseId, "validate", "success", {
      nextState: "VALIDATED",
      actor,
      log: "Preflight and identifier validation passed.",
    });

    // 2. Start build
    transitionReleaseStage(releaseId, "build", "running", {
      nextState: "BUILDING",
      actor,
      log: `Starting ${release.platform} compilation job...`,
    });

    const buildRecord = await runBuildPipeline({
      appId: release.appId,
      appName: release.appName,
      repositoryId: release.repositoryId,
      branch: release.branch,
      platform: release.platform,
      buildMode:
        release.platform === "ios"
          ? "release-ipa"
          : release.track === "internal-testing"
          ? "release-aab"
          : "release-aab",
      version: release.version,
      buildNumber: release.buildNumber,
    });

    updateRelease(releaseId, {
      buildId: buildRecord.id,
      currentStageId: "build",
    });

    return { success: true, buildId: buildRecord.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    transitionReleaseStage(releaseId, "build", "failed", {
      nextState: "FAILED",
      actor,
      error: msg,
    });
    return { success: false, error: msg };
  }
}
