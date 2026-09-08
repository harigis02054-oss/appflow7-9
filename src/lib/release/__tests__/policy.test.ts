import { describe, it, expect } from "vitest";
import { evaluateReleasePolicy } from "../policy";
import type { DeepProjectAnalysis } from "@/lib/types";

describe("Release Policy & Readiness Engine", () => {
  const mockAnalysis: DeepProjectAnalysis = {
    framework: "flutter",
    hasAndroid: true,
    hasIOS: true,
    androidPackage: "com.example.app",
    iosBundleId: "com.example.app",
    currentVersion: "1.0.0",
    versionCode: 1,
    androidChecks: [],
    iosChecks: [],
    androidReadinessPct: 100,
    iosReadinessPct: 100,
    analyzedAt: new Date().toISOString(),
    missingFiles: [
      {
        id: "pubspec",
        path: "pubspec.yaml",
        category: "flutter",
        label: "Flutter Config",
        found: true,
        severity: "required",
        impact: "Core config",
        canBuildAnyway: false,
      },
      {
        id: "android-dir",
        path: "android/",
        category: "android",
        label: "Android Dir",
        found: true,
        severity: "required",
        impact: "Android build files",
        canBuildAnyway: false,
      },
      {
        id: "privacy-policy",
        path: "PRIVACY.md",
        category: "compliance",
        label: "Privacy Policy",
        found: false,
        severity: "production-only",
        impact: "Missing privacy policy URL",
        canBuildAnyway: true,
      },
    ],
    detectedPermissions: {
      android: ["INTERNET", "CAMERA"],
      ios: ["Camera"],
    },
    buildReadinessPct: 100,
    storeReadinessPct: 67,
  };

  it("allows development and testing gates even when privacy policy is missing (Rule #2)", () => {
    const report = evaluateReleasePolicy(mockAnalysis, "android");

    expect(report.developmentGate.allowed).toBe(true);
    expect(report.developmentGate.status).toBe("ready");

    expect(report.testingGate.allowed).toBe(true);
    expect(report.testingGate.status).toBe("ready");

    // Store submission gate warns
    expect(report.storeSubmissionGate.status).toBe("warning");
    expect(report.storeSubmissionGate.warnings.length).toBeGreaterThan(0);

    // Production gate is blocked
    expect(report.productionGate.allowed).toBe(false);
    expect(report.productionGate.status).toBe("blocked");
    expect(report.productionGate.blockers).toContain(
      "Privacy Policy URL must be confirmed and active before public release."
    );
  });

  it("generates privacy recommendations when camera permission is detected", () => {
    const report = evaluateReleasePolicy(mockAnalysis, "android");
    expect(
      report.detectedSdkRecommendations.some((r) => r.toLowerCase().includes("camera"))
    ).toBe(true);
  });
});
