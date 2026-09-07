import { getFileText, pathExists } from "./client";
import type {
  ProjectFramework,
  RepositoryAnalysis,
  RequiredFileCheck,
} from "@/lib/types";

export function scorePct(checks: RequiredFileCheck[]): number {
  if (checks.length === 0) return 0;
  // Required files count fully; recommended files count for half credit,
  // matching the "don't hard-block on missing optional config" requirement.
  let earned = 0;
  let possible = 0;
  for (const c of checks) {
    const weight = c.severity === "required" ? 1 : 0.5;
    possible += weight;
    if (c.found) earned += weight;
  }
  return possible === 0 ? 100 : Math.round((earned / possible) * 100);
}

export function extractPubspecVersion(text: string | null): { version?: string; code?: number } {
  if (!text) return {};
  const match = text.match(/^version:\s*([^\s+]+)(?:\+(\d+))?/m);
  if (!match) return {};
  return {
    version: match[1],
    code: match[2] ? parseInt(match[2], 10) : undefined,
  };
}

export function extractPackageJsonVersion(text: string | null): string | undefined {
  if (!text) return undefined;
  try {
    const parsed = JSON.parse(text);
    return typeof parsed.version === "string" ? parsed.version : undefined;
  } catch {
    return undefined;
  }
}

export function extractAndroidApplicationId(
  gradleText: string | null,
  manifestText: string | null
): string | undefined {
  if (gradleText) {
    const appMatch = gradleText.match(/applicationId\s*[=\s]\s*["']([^"']+)["']/);
    if (appMatch?.[1]) return appMatch[1];

    const nsMatch = gradleText.match(/namespace\s*[=\s]\s*["']([^"']+)["']/);
    if (nsMatch?.[1]) return nsMatch[1];
  }
  if (manifestText) {
    const pkgMatch = manifestText.match(/package\s*=\s*["']([^"']+)["']/);
    if (pkgMatch?.[1]) return pkgMatch[1];
  }
  return undefined;
}

export function extractIOSBundleId(text: string | null): string | undefined {
  if (!text) return undefined;
  const match = text.match(/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*([^\s;]+)/);
  return match?.[1];
}

export async function analyzeRepository(
  owner: string,
  repo: string,
  ref?: string
): Promise<RepositoryAnalysis> {
  const [
    hasPubspec,
    hasPackageJson,
    hasAndroidDir,
    hasIosDir,
    hasGradleGroovy,
    hasGradleKts,
    hasManifest,
    hasKeyProperties,
    hasXcodeproj,
    hasPodfile,
    hasInfoPlist,
  ] = await Promise.all([
    pathExists(owner, repo, "pubspec.yaml", ref),
    pathExists(owner, repo, "package.json", ref),
    pathExists(owner, repo, "android", ref),
    pathExists(owner, repo, "ios", ref),
    pathExists(owner, repo, "android/app/build.gradle", ref),
    pathExists(owner, repo, "android/app/build.gradle.kts", ref),
    pathExists(owner, repo, "android/app/src/main/AndroidManifest.xml", ref),
    pathExists(owner, repo, "android/key.properties", ref),
    pathExists(owner, repo, "ios/Runner.xcodeproj", ref),
    pathExists(owner, repo, "ios/Podfile", ref),
    pathExists(owner, repo, "ios/Runner/Info.plist", ref),
  ]);

  const hasGradle = hasGradleGroovy || hasGradleKts;

  let framework: ProjectFramework = "unknown";
  if (hasPubspec) framework = "flutter";
  else if (hasPackageJson && hasAndroidDir && hasIosDir)
    framework = "react-native";
  else if (hasAndroidDir && !hasIosDir) framework = "native-android";
  else if (hasIosDir && !hasAndroidDir) framework = "native-ios";

  const [pubspecText, gradleText, manifestText, pbxprojText, packageJsonText] =
    await Promise.all([
      hasPubspec ? getFileText(owner, repo, "pubspec.yaml", ref) : null,
      hasGradleKts
        ? getFileText(owner, repo, "android/app/build.gradle.kts", ref)
        : hasGradleGroovy
        ? getFileText(owner, repo, "android/app/build.gradle", ref)
        : null,
      hasManifest
        ? getFileText(owner, repo, "android/app/src/main/AndroidManifest.xml", ref)
        : null,
      hasXcodeproj
        ? getFileText(
            owner,
            repo,
            "ios/Runner.xcodeproj/project.pbxproj",
            ref
          )
        : null,
      hasPackageJson ? getFileText(owner, repo, "package.json", ref) : null,
    ]);

  const pubspecData = extractPubspecVersion(pubspecText);
  const currentVersion =
    pubspecData.version ?? extractPackageJsonVersion(packageJsonText);
  const versionCode = pubspecData.code ?? 1;
  const androidPackage = extractAndroidApplicationId(gradleText, manifestText);
  const iosBundleId = extractIOSBundleId(pbxprojText);

  // Check if AppFlow host has keystore configured
  const hostSigningReady = Boolean(
    process.env.ANDROID_KEYSTORE_PATH &&
    process.env.ANDROID_KEYSTORE_PASSWORD &&
    process.env.ANDROID_KEY_ALIAS
  );

  const androidChecks: RequiredFileCheck[] = [
    {
      id: "android-manifest",
      label: "Android manifest",
      path: "android/app/src/main/AndroidManifest.xml",
      found: hasManifest,
      severity: "required",
    },
    {
      id: "android-gradle",
      label: "Gradle build file",
      path: hasGradleKts ? "android/app/build.gradle.kts" : "android/app/build.gradle",
      found: hasGradle,
      severity: "required",
    },
    {
      id: "android-signing",
      label: "Release signing config",
      path: "android/key.properties",
      found: hasKeyProperties || hostSigningReady,
      severity: "recommended",
    },
  ];

  const iosChecks: RequiredFileCheck[] = [
    {
      id: "ios-xcodeproj",
      label: "Xcode project",
      path: "ios/Runner.xcodeproj",
      found: hasXcodeproj,
      severity: "required",
    },
    {
      id: "ios-podfile",
      label: "Podfile",
      path: "ios/Podfile",
      found: hasPodfile,
      severity: "recommended",
    },
    {
      id: "ios-info-plist",
      label: "Info.plist",
      path: "ios/Runner/Info.plist",
      found: hasInfoPlist,
      severity: "required",
    },
  ];

  return {
    framework,
    hasAndroid: hasAndroidDir,
    hasIOS: hasIosDir,
    androidPackage,
    iosBundleId,
    currentVersion,
    versionCode,
    androidChecks,
    iosChecks,
    androidReadinessPct: hasAndroidDir ? scorePct(androidChecks) : 0,
    iosReadinessPct: hasIosDir ? scorePct(iosChecks) : 0,
    analyzedAt: new Date().toISOString(),
  };
}
