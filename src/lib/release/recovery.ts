import type { Platform, ReleaseModel } from "../types";
import { getRelease, listReleases } from "./store";

export interface RollbackRecommendation {
  releaseId: string;
  targetTrack: string;
  platform: Platform;
  previousStableRelease?: {
    id: string;
    version: string;
    buildNumber: number;
    commitSha?: string;
    artifactName?: string;
    completedAt?: string;
  };
  severity: "critical" | "warning" | "info";
  suggestedAction: string;
  remediationSteps: string[];
  autoRollbackAvailable: boolean;
}

/**
 * Finds the latest known healthy or published release for an app on a given platform.
 */
export function getPreviousStableRelease(
  appId: string,
  platform: Platform,
  currentReleaseId?: string
): ReleaseModel | null {
  const all = listReleases()
    .filter((r) => r.appId === appId && r.platform === platform && r.id !== currentReleaseId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Find latest release that reached ready for testing or released
  const stable = all.find(
    (r) =>
      (r.state === "READY_FOR_TESTING" || r.state === "RELEASED" || r.state === "BUILT") &&
      Boolean(r.artifactPath)
  );

  return stable || null;
}

/**
 * Generates automated recovery and rollback recommendations when a release fails or is rejected.
 */
export function generateRollbackRecommendation(releaseId: string): RollbackRecommendation {
  const release = getRelease(releaseId);
  if (!release) {
    return {
      releaseId,
      targetTrack: "unknown",
      platform: "android",
      severity: "warning",
      suggestedAction: "Release record not found.",
      remediationSteps: ["Inspect release store and build logs."],
      autoRollbackAvailable: false,
    };
  }

  const previousStable = getPreviousStableRelease(release.appId, release.platform, release.id);

  let severity: RollbackRecommendation["severity"] = "info";
  let suggestedAction = "No immediate rollback required.";
  const remediationSteps: string[] = [];

  if (release.state === "FAILED" || release.state === "BLOCKED") {
    severity = release.track === "production" || release.track === "app-store" ? "critical" : "warning";

    if (previousStable) {
      suggestedAction = `Restore traffic to previous stable version v${previousStable.version} (#${previousStable.buildNumber}).`;
      remediationSteps.push(
        `Preserve previous binary package '${previousStable.artifactName || "build-artifact"}' as fallback.`
      );
      if (release.track === "production") {
        remediationSteps.push("Halt Google Play phased rollout or pause App Store phased release.");
      }
      remediationSteps.push(
        `Resolve root cause from error summary: "${release.errorSummary || "Review build logs"}"`
      );
      remediationSteps.push(
        `Increment build number to #${Math.max(release.buildNumber, previousStable.buildNumber) + 1} for next patch candidate.`
      );
    } else {
      suggestedAction = "No previous stable release found for rollback. Address compiler/signing error directly.";
      remediationSteps.push("Verify native SDK toolchains (Gradle / Xcode / Flutter).");
      remediationSteps.push("Ensure signing certificates and bundle identifiers are correctly configured.");
    }
  } else {
    suggestedAction = "Release pipeline is active or successfully distributed.";
    remediationSteps.push("Monitor crash analytics and user feedback on testing track.");
  }

  return {
    releaseId,
    targetTrack: release.track,
    platform: release.platform,
    previousStableRelease: previousStable
      ? {
          id: previousStable.id,
          version: previousStable.version,
          buildNumber: previousStable.buildNumber,
          commitSha: previousStable.commitSha,
          artifactName: previousStable.artifactName,
          completedAt: previousStable.completedAt || previousStable.updatedAt,
        }
      : undefined,
    severity,
    suggestedAction,
    remediationSteps,
    autoRollbackAvailable: Boolean(previousStable && previousStable.artifactPath),
  };
}
