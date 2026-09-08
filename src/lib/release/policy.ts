import type {
  DeepProjectAnalysis,
  MissingFileDiagnostic,
  Platform,
} from "@/lib/types";

export type ReadinessGateLevel =
  | "DEVELOPMENT"
  | "TESTING"
  | "STORE_SUBMISSION"
  | "PRODUCTION";

export interface ReadinessGateResult {
  level: ReadinessGateLevel;
  title: string;
  allowed: boolean;
  status: "ready" | "warning" | "blocked";
  blockers: string[];
  warnings: string[];
  recommendations: string[];
}

export interface ReleasePolicyReport {
  overallScore: number;
  developmentGate: ReadinessGateResult;
  testingGate: ReadinessGateResult;
  storeSubmissionGate: ReadinessGateResult;
  productionGate: ReadinessGateResult;
  detectedPermissions: {
    android: string[];
    ios: string[];
  };
  detectedSdkRecommendations: string[];
  summary: string;
}

/**
 * Release Policy & Compliance Readiness Engine.
 *
 * Strictly adheres to the Core Product Rule:
 * The platform distinguishes between:
 * - DEVELOPMENT BLOCKER
 * - TESTING BLOCKER
 * - STORE SUBMISSION BLOCKER
 * - PRODUCTION RELEASE BLOCKER
 *
 * Missing privacy policy, screenshots, store descriptions, content ratings,
 * or data safety attestations will NEVER block development compilation or
 * internal testing releases.
 */
export function evaluateReleasePolicy(
  analysis: DeepProjectAnalysis,
  platform: Platform
): ReleasePolicyReport {
  const missingFiles = analysis.missingFiles || [];

  // 1. Development Gate (Code compilation / debug / local archive)
  const devBlockers: string[] = [];
  const requiredFiles = missingFiles.filter(
    (m) => m.severity === "required" && (m.category === "flutter" || m.category === platform)
  );

  for (const req of requiredFiles) {
    if (!req.found) {
      devBlockers.push(`Missing required file: ${req.label} (${req.path})`);
    }
  }

  const devGate: ReadinessGateResult = {
    level: "DEVELOPMENT",
    title: "Development & Local Compilation",
    allowed: devBlockers.length === 0,
    status: devBlockers.length === 0 ? "ready" : "blocked",
    blockers: devBlockers,
    warnings: [],
    recommendations:
      devBlockers.length === 0
        ? ["Project configuration is complete for local compiling and debugging."]
        : ["Restore required project manifests and build scripts."],
  };

  // 2. Testing Gate (Internal App Sharing, Google Play Internal Testing, TestFlight)
  const testBlockers: string[] = [];
  const testWarnings: string[] = [];

  if (!devGate.allowed) {
    testBlockers.push("Cannot test: development compilation requirements are not met.");
  }

  if (platform === "android" && !analysis.androidPackage) {
    testBlockers.push("Android application ID (package name) could not be determined.");
  }
  if (platform === "ios" && !analysis.iosBundleId) {
    testBlockers.push("iOS Bundle Identifier could not be determined.");
  }

  const testGate: ReadinessGateResult = {
    level: "TESTING",
    title: "Testing Track Distribution",
    allowed: testBlockers.length === 0,
    status: testBlockers.length === 0 ? "ready" : "blocked",
    blockers: testBlockers,
    warnings: testWarnings,
    recommendations:
      testBlockers.length === 0
        ? ["Build is eligible for Internal Testing (Google Play) and TestFlight (Apple)."]
        : ["Resolve package/bundle identifier before distributing to testers."],
  };

  // 3. Store Submission Gate (Closed beta, external testing, review submission)
  const storeBlockers: string[] = [];
  const storeWarnings: string[] = [];
  const recommendations: string[] = [];

  const privacyDoc = missingFiles.find((m) => m.id === "privacy-policy");
  if (!privacyDoc || !privacyDoc.found) {
    storeWarnings.push(
      "Privacy Policy document not detected in repository. Required before store review submission."
    );
    recommendations.push(
      "Add a public Privacy Policy URL in Store Listing before requesting external testing review."
    );
  }

  const iconCheck = missingFiles.find((m) => m.id === `${platform}-icon`);
  if (iconCheck && !iconCheck.found) {
    storeWarnings.push(
      `Custom ${platform === "ios" ? "1024x1024 App Store icon" : "Android launcher icon"} is missing.`
    );
  }

  const storeGate: ReadinessGateResult = {
    level: "STORE_SUBMISSION",
    title: "Store Submission Readiness",
    allowed: true, // Non-blocking: warning state permits submission workflow preparation
    status: storeWarnings.length > 0 ? "warning" : "ready",
    blockers: storeBlockers,
    warnings: storeWarnings,
    recommendations,
  };

  // 4. Production Release Gate (Public rollout to end users)
  const prodBlockers: string[] = [];
  const prodWarnings: string[] = [];

  if (!privacyDoc || !privacyDoc.found) {
    prodBlockers.push("Privacy Policy URL must be confirmed and active before public release.");
  }

  const prodGate: ReadinessGateResult = {
    level: "PRODUCTION",
    title: "Production Public Release Gate",
    allowed: prodBlockers.length === 0,
    status: prodBlockers.length === 0 ? "ready" : "blocked",
    blockers: prodBlockers,
    warnings: prodWarnings,
    recommendations: [
      "Verify 12 testers / 14 days closed testing requirement for personal Google Play accounts.",
      "Complete Data Safety & Content Rating declarations in the console before release.",
    ],
  };

  // Permissions analysis recommendations
  const detectedSdkRecommendations: string[] = [];
  const permissions =
    platform === "android"
      ? analysis.detectedPermissions.android
      : analysis.detectedPermissions.ios;

  if (permissions.some((p) => p.toLowerCase().includes("camera"))) {
    detectedSdkRecommendations.push(
      "Camera access detected: Ensure your privacy policy explains how camera captures are processed."
    );
  }
  if (permissions.some((p) => p.toLowerCase().includes("location"))) {
    detectedSdkRecommendations.push(
      "Location access detected: Google Play & Apple require explicit declaration of background vs foreground location usage."
    );
  }

  // Calculate overall policy score (weighted)
  let totalScore = 0;
  if (devGate.status === "ready") totalScore += 35;
  if (testGate.status === "ready") totalScore += 35;
  if (storeGate.status === "ready") totalScore += 15;
  else if (storeGate.status === "warning") totalScore += 10;
  if (prodGate.status === "ready") totalScore += 15;

  let summary = "Ready for development builds and testing tracks.";
  if (prodGate.status === "blocked") {
    summary += " Production release requires completing store metadata & policy attestations.";
  }

  return {
    overallScore: totalScore,
    developmentGate: devGate,
    testingGate: testGate,
    storeSubmissionGate: storeGate,
    productionGate: prodGate,
    detectedPermissions: analysis.detectedPermissions,
    detectedSdkRecommendations,
    summary,
  };
}
