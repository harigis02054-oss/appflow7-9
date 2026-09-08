import type { VersionIncrementType, VersionPlan, Platform } from "@/lib/types";

export interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

export function parseSemver(version: string): ParsedSemver {
  const clean = version.trim().replace(/^v/, "");
  const match = clean.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([a-zA-Z0-9.]+))?/);

  if (!match) {
    return { major: 1, minor: 0, patch: 0 };
  }

  return {
    major: parseInt(match[1] || "1", 10),
    minor: parseInt(match[2] || "0", 10),
    patch: parseInt(match[3] || "0", 10),
    prerelease: match[4],
  };
}

export function calculateNextVersion(
  currentVersion: string,
  type: VersionIncrementType
): string {
  const parsed = parseSemver(currentVersion);

  switch (type) {
    case "major":
      return `${parsed.major + 1}.0.0`;
    case "minor":
      return `${parsed.major}.${parsed.minor + 1}.0`;
    case "patch":
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
    case "build-only":
    case "manual":
    default:
      return currentVersion;
  }
}

export function createVersionPlan(
  currentVersion: string,
  currentBuildNumber: number,
  type: VersionIncrementType = "patch",
  manualVersion?: string,
  manualBuildNumber?: number
): VersionPlan {
  const nextVersion =
    type === "manual" && manualVersion
      ? manualVersion
      : calculateNextVersion(currentVersion, type);

  const nextBuildNumber =
    type === "manual" && manualBuildNumber
      ? manualBuildNumber
      : currentBuildNumber + 1;

  let rationale = `Incremented ${type} from ${currentVersion} (#${currentBuildNumber})`;
  if (type === "build-only") {
    rationale = `Kept marketing version ${currentVersion}, incremented build number to #${nextBuildNumber}`;
  } else if (type === "manual") {
    rationale = `Manually specified version ${nextVersion} (#${nextBuildNumber})`;
  }

  return {
    currentVersion,
    currentBuildNumber,
    nextVersion,
    nextBuildNumber,
    incrementType: type,
    rationale,
  };
}

export function formatVersionDisplay(
  version: string,
  buildNumber: number,
  platform: Platform
): string {
  if (platform === "ios") {
    return `v${version} (Build ${buildNumber} · CFBundleVersion: ${buildNumber})`;
  }
  return `v${version} (Build #${buildNumber} · versionCode: ${buildNumber})`;
}
