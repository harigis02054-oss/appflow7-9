import { describe, it, expect } from "vitest";
import {
  parseSemver,
  calculateNextVersion,
  createVersionPlan,
  formatVersionDisplay,
} from "../versioning";

describe("Version Management Engine", () => {
  it("parses valid semver strings correctly", () => {
    expect(parseSemver("1.0.4")).toEqual({
      major: 1,
      minor: 0,
      patch: 4,
      prerelease: undefined,
    });

    expect(parseSemver("v2.3.1-beta.2")).toEqual({
      major: 2,
      minor: 3,
      patch: 1,
      prerelease: "beta.2",
    });

    expect(parseSemver("invalid")).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
    });
  });

  it("calculates patch, minor, and major version increments", () => {
    expect(calculateNextVersion("1.0.4", "patch")).toBe("1.0.5");
    expect(calculateNextVersion("1.0.4", "minor")).toBe("1.1.0");
    expect(calculateNextVersion("1.0.4", "major")).toBe("2.0.0");
    expect(calculateNextVersion("1.0.4", "build-only")).toBe("1.0.4");
  });

  it("generates a comprehensive version plan with build numbers", () => {
    const patchPlan = createVersionPlan("1.0.4", 27, "patch");
    expect(patchPlan.currentVersion).toBe("1.0.4");
    expect(patchPlan.currentBuildNumber).toBe(27);
    expect(patchPlan.nextVersion).toBe("1.0.5");
    expect(patchPlan.nextBuildNumber).toBe(28);

    const minorPlan = createVersionPlan("1.0.4", 27, "minor");
    expect(minorPlan.nextVersion).toBe("1.1.0");
    expect(minorPlan.nextBuildNumber).toBe(28);

    const buildOnlyPlan = createVersionPlan("1.0.4", 27, "build-only");
    expect(buildOnlyPlan.nextVersion).toBe("1.0.4");
    expect(buildOnlyPlan.nextBuildNumber).toBe(28);
  });

  it("formats display strings for Android and iOS targets", () => {
    expect(formatVersionDisplay("1.0.5", 28, "android")).toContain("versionCode: 28");
    expect(formatVersionDisplay("1.0.5", 28, "ios")).toContain("CFBundleVersion: 28");
  });
});
