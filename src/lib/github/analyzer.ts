import { getFileText, pathExists } from "./client";
import {
  analyzeRepository,
  extractAndroidApplicationId,
  extractIOSBundleId,
  extractPubspecVersion,
  extractPackageJsonVersion,
} from "./detect";
import type {
  DeepProjectAnalysis,
  MissingFileDiagnostic,
  ProjectFramework,
} from "@/lib/types";

export function extractAndroidPermissions(manifestText: string | null): string[] {
  if (!manifestText) return [];
  const permissions: string[] = [];
  const matches = manifestText.matchAll(/<uses-permission[^>]*android:name=["']([^"']+)["']/g);
  for (const m of matches) {
    if (m[1]) {
      const clean = m[1].replace("android.permission.", "");
      if (!permissions.includes(clean)) permissions.push(clean);
    }
  }
  return permissions;
}

export function extractIOSPermissions(infoPlistText: string | null): string[] {
  if (!infoPlistText) return [];
  const permissions: string[] = [];
  const matches = infoPlistText.matchAll(/<key>(NS[A-Za-z]+UsageDescription)<\/key>/g);
  for (const m of matches) {
    if (m[1]) {
      const clean = m[1].replace("UsageDescription", "").replace(/^NS/, "");
      if (!permissions.includes(clean)) permissions.push(clean);
    }
  }
  return permissions;
}

export async function deepAnalyzeRepository(
  owner: string,
  repo: string,
  ref?: string
): Promise<DeepProjectAnalysis> {
  const baseAnalysis = await analyzeRepository(owner, repo, ref);

  const [
    hasPrivacyPolicy,
    hasFastlane,
    hasAppIconAndroid,
    hasAppIconIos,
    hasExportOptions,
    manifestText,
    infoPlistText,
    pubspecText,
    gradleText,
    ktsText,
  ] = await Promise.all([
    pathExists(owner, repo, "PRIVACY.md", ref).then((p) => p || pathExists(owner, repo, "privacy-policy.md", ref)),
    pathExists(owner, repo, "fastlane/Fastfile", ref).then((p) => p || pathExists(owner, repo, "android/fastlane/Fastfile", ref)),
    pathExists(owner, repo, "android/app/src/main/res/mipmap-hdpi/ic_launcher.png", ref),
    pathExists(owner, repo, "ios/Runner/Assets.xcassets/AppIcon.appiconset", ref),
    pathExists(owner, repo, "ios/ExportOptions.plist", ref),
    getFileText(owner, repo, "android/app/src/main/AndroidManifest.xml", ref),
    getFileText(owner, repo, "ios/Runner/Info.plist", ref),
    getFileText(owner, repo, "pubspec.yaml", ref),
    getFileText(owner, repo, "android/app/build.gradle", ref),
    getFileText(owner, repo, "android/app/build.gradle.kts", ref),
  ]);

  const androidPermissions = extractAndroidPermissions(manifestText);
  const iosPermissions = extractIOSPermissions(infoPlistText);

  // Provenance of identifiers (Rule #49: Never fabricate identifiers)
  let androidPackageSource: string | undefined;
  if (gradleText && /applicationId\s*[=\s]\s*["']([^"']+)["']/.test(gradleText)) {
    androidPackageSource = "android/app/build.gradle (applicationId)";
  } else if (ktsText && /applicationId\s*=\s*["']([^"']+)["']/.test(ktsText)) {
    androidPackageSource = "android/app/build.gradle.kts (applicationId)";
  } else if (manifestText && /package\s*=\s*["']([^"']+)["']/.test(manifestText)) {
    androidPackageSource = "android/app/src/main/AndroidManifest.xml (package)";
  }

  let iosBundleIdSource: string | undefined;
  if (baseAnalysis.iosBundleId) {
    iosBundleIdSource = "ios/Runner.xcodeproj/project.pbxproj (PRODUCT_BUNDLE_IDENTIFIER)";
  }

  // Diagnostic checklist conforming to Rule #2 (Never block dev/test on missing production-only items)
  const missingFiles: MissingFileDiagnostic[] = [
    {
      id: "pubspec",
      path: "pubspec.yaml",
      category: "flutter",
      label: "Flutter Configuration",
      found: Boolean(pubspecText),
      severity: "required",
      impact: "Defines Flutter dependencies, app version, and build number.",
      canBuildAnyway: false,
    },
    {
      id: "android-dir",
      path: "android/",
      category: "android",
      label: "Android Project Directory",
      found: baseAnalysis.hasAndroid,
      severity: "required",
      impact: "Required for Android Gradle compilation.",
      canBuildAnyway: false,
    },
    {
      id: "android-gradle",
      path: "android/app/build.gradle",
      category: "android",
      label: "Android Build Script",
      found: baseAnalysis.androidChecks.some((c) => c.id === "android-gradle" && c.found),
      severity: "required",
      impact: "Specifies target SDK, compile options, and package applicationId.",
      canBuildAnyway: false,
    },
    {
      id: "android-manifest",
      path: "android/app/src/main/AndroidManifest.xml",
      category: "android",
      label: "Android Manifest",
      found: Boolean(manifestText),
      severity: "required",
      impact: "Defines application activities, permissions, and app name.",
      canBuildAnyway: false,
    },
    {
      id: "android-icon",
      path: "android/app/src/main/res/mipmap-*/ic_launcher.png",
      category: "android",
      label: "Android Launcher Icon",
      found: hasAppIconAndroid,
      severity: "recommended",
      impact: "Default system icon will be used if custom icon is missing.",
      canBuildAnyway: true,
    },
    {
      id: "ios-dir",
      path: "ios/",
      category: "ios",
      label: "iOS Project Directory",
      found: baseAnalysis.hasIOS,
      severity: "required",
      impact: "Required for iOS Xcode / SwiftPM compilation.",
      canBuildAnyway: false,
    },
    {
      id: "ios-xcodeproj",
      path: "ios/Runner.xcodeproj",
      category: "ios",
      label: "Xcode Project File",
      found: baseAnalysis.iosChecks.some((c) => c.id === "ios-xcodeproj" && c.found),
      severity: "required",
      impact: "Xcode project containing build targets and bundle configuration.",
      canBuildAnyway: false,
    },
    {
      id: "ios-info-plist",
      path: "ios/Runner/Info.plist",
      category: "ios",
      label: "iOS Info.plist",
      found: Boolean(infoPlistText),
      severity: "required",
      impact: "Configures bundle display name, permissions descriptions, and capabilities.",
      canBuildAnyway: false,
    },
    {
      id: "ios-icon",
      path: "ios/Runner/Assets.xcassets/AppIcon.appiconset",
      category: "ios",
      label: "iOS App Icon Asset Catalog",
      found: hasAppIconIos,
      severity: "recommended",
      impact: "Apple App Store Connect requires 1024x1024 app store icon before public release.",
      canBuildAnyway: true,
    },
    {
      id: "privacy-policy",
      path: "PRIVACY.md",
      category: "compliance",
      label: "Privacy Policy Document",
      found: hasPrivacyPolicy,
      severity: "production-only",
      impact: "Missing. Production release on Google Play and Apple App Store requires a public privacy policy URL. You may continue with build and testing.",
      canBuildAnyway: true,
    },
    {
      id: "fastlane",
      path: "fastlane/Fastfile",
      category: "store-metadata",
      label: "Fastlane Automation Config",
      found: hasFastlane,
      severity: "recommended",
      impact: "AppFlow provides built-in native publishing; fastlane is optional.",
      canBuildAnyway: true,
    },
  ];

  // Calculate separate Build Readiness vs Store Readiness scores
  const buildChecks = missingFiles.filter((m) => m.severity === "required");
  const buildReadinessPct =
    buildChecks.length === 0
      ? 100
      : Math.round(
          (buildChecks.filter((c) => c.found).length / buildChecks.length) * 100
        );

  const storeChecks = missingFiles;
  const storeReadinessPct =
    storeChecks.length === 0
      ? 100
      : Math.round(
          (storeChecks.filter((c) => c.found).length / storeChecks.length) * 100
        );

  return {
    ...baseAnalysis,
    missingFiles,
    detectedPermissions: {
      android: androidPermissions,
      ios: iosPermissions,
    },
    packageProvenance: {
      androidPackageSource,
      iosBundleIdSource,
    },
    buildReadinessPct,
    storeReadinessPct,
  };
}
