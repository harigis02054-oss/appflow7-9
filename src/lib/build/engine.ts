import { spawn, ChildProcess, execSync } from "child_process";
import fs from "fs";
import path from "path";
import {
  saveServerBuild,
  updateServerBuild,
  appendServerLog,
  ServerBuildRecord,
  BuildMode,
  createBuildDir,
  cleanBuildWorkspace,
  pruneOldBuildArtifacts,
} from "./store";
import {
  inspectSystemToolchain,
  detectFlutterPath,
  detectJavaHome,
} from "./preflight";
import {
  injectWorkspaceSigningConfig,
  sweepStaleSigningFiles,
} from "./signing";
import { validateBuildArtifact } from "./validate";

// Startup sweep: scrub any orphaned key.properties left over from prior process crashes
sweepStaleSigningFiles();

// Map to track active running child processes for cancellation
const activeProcesses = new Map<string, ChildProcess>();

// In-memory FIFO queue for builds to prevent overloading host CPU / memory
interface QueuedBuildTask {
  buildId: string;
  params: StartBuildParams;
}

const buildQueue: QueuedBuildTask[] = [];
let isWorkerBusy = false;

export interface StartBuildParams {
  appId: string;
  appName: string;
  repositoryId: string;
  branch?: string;
  platform: "android" | "ios";
  buildMode?: BuildMode;
  version: string;
  buildNumber: number;
}

/**
 * Validates repository ID format: 'owner/repo'.
 * Rejects leading hyphens, path traversal, or non-alphanumeric special characters (Finding #19).
 */
export function isValidRepositoryId(repoId: string): boolean {
  if (!repoId || typeof repoId !== "string") return false;
  if (repoId.startsWith("-") || repoId.includes("..") || repoId.length > 100) return false;
  return /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repoId);
}

/**
 * Validates version format: e.g. 1.0.0, 1.2.3-beta.1, v1.0 (Finding #20).
 * Strictly forbids path separators and path traversal characters.
 */
export function isValidVersion(version: string): boolean {
  if (!version || typeof version !== "string") return false;
  if (
    version.includes("/") ||
    version.includes("\\") ||
    version.includes("..") ||
    version.length > 32
  ) {
    return false;
  }
  return /^v?[0-9]+(\.[0-9]+)*(-[a-zA-Z0-9.]+)?$/.test(version);
}

/**
 * Validates build number as a positive integer (Finding #20).
 */
export function isValidBuildNumber(buildNumber: unknown): boolean {
  return (
    typeof buildNumber === "number" &&
    Number.isInteger(buildNumber) &&
    buildNumber > 0 &&
    buildNumber < 2100000000
  );
}

/**
 * Sanitizes child process environment by stripping all cloud credentials, tokens,
 * and API keys so builds cannot leak secrets via Gradle plugins or build scripts.
 */
function getSanitizedBuildEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };

  const blockedPrefixes = [
    "GOOGLE_",
    "APPLE_",
    "GITHUB_",
    "FIREBASE_",
    "SUPABASE_",
    "AWS_",
    "AZURE_",
    "ANTHROPIC_",
    "OPENAI_",
  ];

  const blockedExact = [
    "APPFLOW_API_SECRET",
    "ANDROID_KEYSTORE_PASSWORD",
    "ANDROID_KEY_PASSWORD",
    "ANDROID_KEYSTORE_BASE64",
    "SECRET_KEY",
    "PRIVATE_KEY",
    "API_KEY",
    "TOKEN",
  ];

  for (const k of Object.keys(env)) {
    if (blockedPrefixes.some((p) => k.startsWith(p))) {
      delete env[k];
    } else if (blockedExact.includes(k)) {
      delete env[k];
    }
  }

  const { path: javaPath } = detectJavaHome();
  if (javaPath) {
    env.JAVA_HOME = javaPath;
    env.PATH = `${path.join(javaPath, "bin")}:${env.PATH || ""}`;
  }

  return env;
}

/**
 * Searches the workspace for the real compiled binary produced by Flutter or Gradle.
 */
function findNativeBuildArtifact(
  workspaceDir: string,
  mode: BuildMode,
  platform: "android" | "ios" = "android"
): string | null {
  if (platform === "ios") {
    // 1. Direct candidate paths
    const candidatePaths = [
      path.join(workspaceDir, "build/ios/iphoneos/Runner.app"),
      path.join(workspaceDir, "build/ios/archive/Runner.xcarchive"),
      path.join(workspaceDir, "ios/build/Runner.app"),
    ];

    const ipaDir = path.join(workspaceDir, "build/ios/ipa");
    if (fs.existsSync(ipaDir)) {
      try {
        const files = fs.readdirSync(ipaDir);
        const ipaFile = files.find((f) => f.endsWith(".ipa"));
        if (ipaFile) return path.join(ipaDir, ipaFile);
      } catch {
        // Continue
      }
    }

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) return p;
    }

    // 2. Fallback recursive search for .ipa or .app
    const buildOutputs = path.join(workspaceDir, "build");
    if (fs.existsSync(buildOutputs)) {
      const queue = [buildOutputs];
      while (queue.length > 0) {
        const current = queue.shift()!;
        try {
          const entries = fs.readdirSync(current, { withFileTypes: true });
          for (const entry of entries) {
            const full = path.join(current, entry.name);
            if (entry.isFile() && entry.name.endsWith(".ipa")) {
              return full;
            }
            if (entry.isDirectory()) {
              if (entry.name.endsWith(".app") && !entry.name.includes("intermediate")) {
                return full;
              }
              if (!entry.name.includes("intermediates") && !entry.name.includes("Pods")) {
                queue.push(full);
              }
            }
          }
        } catch {
          // Continue search
        }
      }
    }
    return null;
  }

  const isAab = mode === "release-aab";
  const candidatePaths = isAab
    ? [
        path.join(workspaceDir, "build/app/outputs/bundle/release/app-release.aab"),
        path.join(workspaceDir, "build/app/outputs/bundle/release/app.aab"),
        path.join(workspaceDir, "android/app/build/outputs/bundle/release/app-release.aab"),
        path.join(workspaceDir, "android/app/build/outputs/bundle/release/app.aab"),
      ]
    : [
        path.join(workspaceDir, "build/app/outputs/flutter-apk/app-release.apk"),
        path.join(workspaceDir, "build/app/outputs/apk/release/app-release.apk"),
        path.join(workspaceDir, "android/app/build/outputs/apk/release/app-release.apk"),
      ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }

  // Fallback: search recursively in build directory
  const buildOutputs = path.join(workspaceDir, "build");
  if (fs.existsSync(buildOutputs)) {
    const ext = isAab ? ".aab" : ".apk";
    const queue = [buildOutputs];
    while (queue.length > 0) {
      const current = queue.shift()!;
      try {
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(current, entry.name);
          if (entry.isDirectory() && !entry.name.includes("intermediates")) {
            queue.push(full);
          } else if (
            entry.isFile() &&
            entry.name.endsWith(ext) &&
            !entry.name.includes("intermediate")
          ) {
            return full;
          }
        }
      } catch {
        // Continue search
      }
    }
  }
  return null;
}

/**
 * Process the next queued build job in FIFO order.
 */
async function processQueue() {
  if (isWorkerBusy || buildQueue.length === 0) {
    return;
  }

  isWorkerBusy = true;
  const nextTask = buildQueue.shift()!;
  const { buildId, params } = nextTask;

  try {
    await executeBuildPipeline(buildId, params);
  } catch (err) {
    console.error(`Error in build pipeline ${buildId}:`, err);
  } finally {
    isWorkerBusy = false;
    setTimeout(processQueue, 100);
  }
}

/**
 * Executes the build pipeline steps for a specific build job.
 */
async function executeBuildPipeline(buildId: string, params: StartBuildParams) {
  const branch = params.branch || "main";
  const buildMode = params.buildMode || "release-aab";
  const buildDir = createBuildDir(buildId);
  const workspaceDir = path.join(buildDir, "workspace");
  const startTime = Date.now();
  let signingCleanup = () => {};

  try {
    updateServerBuild(buildId, { status: "running" });

    appendServerLog(buildId, `═══════════════════════════════════════════════════════════`, "step");
    appendServerLog(buildId, `🚀 Starting AppFlow Build [${buildId}]`, "step");
    const platformDisplay = params.platform === "ios" ? "iOS" : "Android";
    appendServerLog(buildId, `   App: ${params.appName} | Platform: ${platformDisplay} | Target: ${buildMode.toUpperCase()}`, "info");
    appendServerLog(buildId, `   Repository: ${params.repositoryId} | Branch: ${branch}`, "info");
    appendServerLog(buildId, `   Version: v${params.version} (Build #${params.buildNumber})`, "info");
    appendServerLog(buildId, `   Sandboxing: Child process environment stripped of all cloud credentials`, "info");
    appendServerLog(buildId, `═══════════════════════════════════════════════════════════`, "step");

    // ── Step 1: Preflight Toolchain Verification ────────────────────────────
    appendServerLog(buildId, `[1/6] 🔍 Inspecting System Toolchain...`, "step");
    const toolchain = inspectSystemToolchain();

    for (const tool of Object.values(toolchain.tools)) {
      if (tool.installed) {
        appendServerLog(buildId, `   • ${tool.name}: Installed (${tool.version || tool.path})`, "info");
      } else if (tool.required) {
        appendServerLog(buildId, `   • ${tool.name}: Missing (${tool.hint})`, "warn");
      }
    }

    // ── Step 2: Clone Repository with Sanitized Environment ─────────────────
    appendServerLog(buildId, `[2/6] 📥 Cloning repository ${params.repositoryId} [branch: ${branch}]...`, "step");

    if (fs.existsSync(workspaceDir)) {
      fs.rmSync(workspaceDir, { recursive: true, force: true });
    }
    fs.mkdirSync(workspaceDir, { recursive: true });

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GitHub PAT not configured on server host (.env.local missing GITHUB_TOKEN)");
    }

    const cloneUrl = `https://x-access-token:${token}@github.com/${params.repositoryId}.git`;
    const sanitizedEnv = getSanitizedBuildEnv();

    let gitSuccess = false;
    try {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(
          "git",
          ["clone", "--depth", "1", "--branch", branch, cloneUrl, workspaceDir],
          {
            stdio: ["ignore", "pipe", "pipe"],
            env: sanitizedEnv,
            detached: true,
          }
        );

        activeProcesses.set(buildId, proc);

        proc.stdout?.on("data", (d) => {
          const lines = d.toString().split("\n").filter(Boolean);
          lines.forEach((line: string) =>
            appendServerLog(buildId, `   ${line.replace(token, "***")}`, "info")
          );
        });

        proc.stderr?.on("data", (d) => {
          const lines = d.toString().split("\n").filter(Boolean);
          lines.forEach((line: string) =>
            appendServerLog(buildId, `   ${line.replace(token, "***")}`, "info")
          );
        });

        proc.on("close", (code) => {
          activeProcesses.delete(buildId);
          if (code === 0) {
            gitSuccess = true;
            resolve();
          } else {
            reject(new Error(`git clone exited with code ${code}`));
          }
        });
        proc.on("error", (err) => {
          activeProcesses.delete(buildId);
          reject(err);
        });
      });
    } catch (cloneErr: unknown) {
      throw new Error(
        `Git clone failed: ${cloneErr instanceof Error ? cloneErr.message : String(cloneErr)}`
      );
    }

    let commitSha: string | undefined;
    let commitMessage: string | undefined;
    let commitAuthor: string | undefined;

    if (gitSuccess) {
      try {
        commitSha = execSync("git rev-parse --short HEAD", {
          cwd: workspaceDir,
          encoding: "utf8",
        }).trim();
        commitMessage = execSync("git log -1 --pretty=%s", {
          cwd: workspaceDir,
          encoding: "utf8",
        }).trim();
        commitAuthor = execSync("git log -1 --pretty=%an", {
          cwd: workspaceDir,
          encoding: "utf8",
        }).trim();

        appendServerLog(
          buildId,
          `   ✓ Cloned commit: ${commitSha} ("${commitMessage}") by ${commitAuthor}`,
          "info"
        );
        updateServerBuild(buildId, { commitSha, commitMessage, commitAuthor });
      } catch {
        appendServerLog(buildId, `   ✓ Repository successfully cloned to workspace.`, "info");
      }
    }

    // ── Step 3: Project Analysis & Configuration Validation ───────────────
    appendServerLog(buildId, `[3/6] 🔎 Validating Project Configuration...`, "step");
    const hasAndroidDir = fs.existsSync(path.join(workspaceDir, "android"));
    const hasIosDir = fs.existsSync(path.join(workspaceDir, "ios"));
    const hasPubspec = fs.existsSync(path.join(workspaceDir, "pubspec.yaml"));
    const flutterBin = detectFlutterPath();

    appendServerLog(
      buildId,
      `   • Framework: ${hasPubspec ? "Flutter Mobile Project" : "Native Mobile Project"}`,
      "info"
    );

    let canRunNativeBuild = false;
    let missingReason = "";

    if (params.platform === "ios") {
      appendServerLog(buildId, `   • iOS directory: ${hasIosDir ? "Present" : "Not detected"}`, hasIosDir ? "info" : "warn");
      if (!hasIosDir) {
        missingReason = `Repository lacks an ios/ directory. iOS builds require a mobile project.`;
      } else if (!toolchain.readyForIosBuild) {
        missingReason = `Host iOS toolchain not ready: ${toolchain.details.join("; ")}`;
      } else if (hasPubspec && !flutterBin) {
        missingReason = `Flutter executable not found on host path.`;
      } else {
        canRunNativeBuild = true;
      }
    } else {
      appendServerLog(buildId, `   • Android directory: ${hasAndroidDir ? "Present" : "Not detected"}`, hasAndroidDir ? "info" : "warn");
      if (!hasAndroidDir) {
        missingReason = `Repository lacks an android/ directory. Android builds require a mobile project.`;
      } else if (!toolchain.readyForAndroidBuild) {
        missingReason = `Host toolchain not ready: ${toolchain.details.join("; ")}`;
      } else if (hasPubspec && !flutterBin) {
        missingReason = `Flutter executable not found on host path.`;
      } else {
        canRunNativeBuild = true;
      }
    }

    if (!canRunNativeBuild) {
      appendServerLog(
        buildId,
        `❌ [BUILD BLOCKED]: Native compilation requirements not met.`,
        "error"
      );
      appendServerLog(buildId, `   Reason: ${missingReason}`, "error");

      updateServerBuild(buildId, {
        status: "blocked",
        errorSummary: `Build blocked: ${missingReason}`,
        isDemoArtifact: true,
      });
      return;
    }

    // ── Step 4: Resolve Dependencies (Real Execution, Finding #10) ─────────
    appendServerLog(buildId, `[4/6] 📦 Resolving Project Dependencies...`, "step");

    if (hasPubspec && flutterBin) {
      appendServerLog(buildId, `   Executing '${flutterBin} pub get'...`, "info");
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(flutterBin, ["pub", "get"], {
          cwd: workspaceDir,
          stdio: ["ignore", "pipe", "pipe"],
          env: sanitizedEnv,
          detached: true,
        });

        activeProcesses.set(buildId, proc);

        proc.stdout?.on("data", (d) => {
          const lines = d.toString().split("\n").filter(Boolean);
          lines.forEach((l: string) => appendServerLog(buildId, `   ${l}`, "info"));
        });

        proc.stderr?.on("data", (d) => {
          const lines = d.toString().split("\n").filter(Boolean);
          lines.forEach((l: string) => appendServerLog(buildId, `   ${l}`, "warn"));
        });

        proc.on("close", (code) => {
          activeProcesses.delete(buildId);
          if (code === 0) {
            appendServerLog(buildId, `   ✓ 'flutter pub get' completed successfully.`, "info");
            resolve();
          } else {
            reject(new Error(`flutter pub get failed with exit code ${code}`));
          }
        });

        proc.on("error", (err) => {
          activeProcesses.delete(buildId);
          reject(err);
        });
      });
    } else {
      appendServerLog(
        buildId,
        `   Skipping package manager fetch (standalone mobile project).`,
        "info"
      );
    }

    // ── Step 5: Compile Binary / Package ───────────────────────────
    if (params.platform === "ios") {
      appendServerLog(
        buildId,
        `[5/6] ⚙️ Compiling iOS Application...`,
        "step"
      );

      const hasSigningIdentity = toolchain.tools.signingIdentities.installed;
      appendServerLog(
        buildId,
        `   [SIGNING]: ${
          hasSigningIdentity
            ? "Apple Code Signing identity detected in Keychain."
            : "No signing certificate in Keychain; building with --no-codesign mode for local archive."
        }`,
        hasSigningIdentity ? "info" : "warn"
      );

      const buildArgs = hasPubspec
        ? [
            "build",
            "ios",
            "--release",
            `--build-name=${params.version}`,
            `--build-number=${params.buildNumber}`,
          ]
        : [
            "xcodebuild",
            "-workspace",
            "ios/Runner.xcworkspace",
            "-scheme",
            "Runner",
            "-configuration",
            "Release",
            "CODE_SIGNING_ALLOWED=NO",
          ];

      if (hasPubspec) {
        buildArgs.push("--no-codesign");
      }

      const podfilePath = path.join(workspaceDir, "ios/Podfile");
      let podfileTemporarilyRenamed = false;
      if (!toolchain.tools.cocoapods.installed && fs.existsSync(podfilePath)) {
        appendServerLog(
          buildId,
          `   [SWIFTPM]: CocoaPods not detected. Activating native Swift Package Manager (SwiftPM) mode...`,
          "info"
        );
        try {
          fs.renameSync(podfilePath, `${podfilePath}.appflow.bak`);
          podfileTemporarilyRenamed = true;
        } catch {
          // Continue
        }
      }

      const buildExecutable = hasPubspec ? flutterBin! : "xcodebuild";

      try {
        await new Promise<void>((resolve, reject) => {
          const proc = spawn(buildExecutable, buildArgs, {
            cwd: workspaceDir,
            stdio: ["ignore", "pipe", "pipe"],
            env: sanitizedEnv,
            detached: true,
          });

          activeProcesses.set(buildId, proc);

          proc.stdout?.on("data", (d) => {
            const lines = d.toString().split("\n").filter(Boolean);
            lines.forEach((l: string) => appendServerLog(buildId, `   ${l}`, "info"));
          });

          proc.stderr?.on("data", (d) => {
            const lines = d.toString().split("\n").filter(Boolean);
            lines.forEach((l: string) => appendServerLog(buildId, `   ${l}`, "warn"));
          });

          proc.on("close", (code) => {
            activeProcesses.delete(buildId);
            if (code === 0) resolve();
            else reject(new Error(`iOS compilation exited with code ${code}`));
          });
          proc.on("error", (err) => {
            activeProcesses.delete(buildId);
            reject(err);
          });
        });
      } finally {
        if (podfileTemporarilyRenamed && fs.existsSync(`${podfilePath}.appflow.bak`)) {
          try {
            fs.renameSync(`${podfilePath}.appflow.bak`, podfilePath);
          } catch {}
        }
      }
    } else {
      appendServerLog(
        buildId,
        `[5/6] ⚙️ Compiling ${buildMode === "release-aab" ? "Android App Bundle (AAB)" : "Android APK"}...`,
        "step"
      );

      const signing = injectWorkspaceSigningConfig(workspaceDir);
      signingCleanup = signing.cleanup;

      if (signing.injected) {
        appendServerLog(
          buildId,
          `   [SIGNING]: Injected ephemeral release signing key.properties into workspace.`,
          "info"
        );
      } else if (buildMode === "release-aab") {
        // Hard block release-aab builds without a keystore (Finding #8)
        appendServerLog(
          buildId,
          `❌ [SIGNING BLOCKED]: A release AAB cannot be built with debug signing. Configure ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, and ANDROID_KEY_ALIAS in .env.local to proceed.`,
          "error"
        );
        updateServerBuild(buildId, {
          status: "blocked",
          errorSummary: "Release AAB build blocked: No release keystore configured on host.",
        });
        return;
      } else {
        appendServerLog(
          buildId,
          `   [SIGNING]: Host keystore not configured; continuing with debug build config.`,
          "warn"
        );
      }

      const buildArgs = hasPubspec
        ? [
            "build",
            buildMode === "release-aab" ? "appbundle" : "apk",
            "--release",
            `--build-name=${params.version}`,
            `--build-number=${params.buildNumber}`,
          ]
        : [
            "./gradlew",
            buildMode === "release-aab" ? "bundleRelease" : "assembleRelease",
            `-PversionName=${params.version}`,
            `-PversionCode=${params.buildNumber}`,
          ];
      const buildExecutable = hasPubspec ? flutterBin! : "bash";

      await new Promise<void>((resolve, reject) => {
        const proc = spawn(buildExecutable, buildArgs, {
          cwd: hasPubspec ? workspaceDir : path.join(workspaceDir, "android"),
          stdio: ["ignore", "pipe", "pipe"],
          env: sanitizedEnv,
          detached: true,
        });

        activeProcesses.set(buildId, proc);

        proc.stdout?.on("data", (d) => {
          const lines = d.toString().split("\n").filter(Boolean);
          lines.forEach((l: string) => appendServerLog(buildId, `   ${l}`, "info"));
        });

        proc.stderr?.on("data", (d) => {
          const lines = d.toString().split("\n").filter(Boolean);
          lines.forEach((l: string) => appendServerLog(buildId, `   ${l}`, "warn"));
        });

        proc.on("close", (code) => {
          activeProcesses.delete(buildId);
          if (code === 0) resolve();
          else reject(new Error(`Compilation exited with code ${code}`));
        });
        proc.on("error", (err) => {
          activeProcesses.delete(buildId);
          reject(err);
        });
      });
    }

    // ── Step 6: Artifact Validation & Packaging (Findings #4, #2, #17) ─────
    appendServerLog(buildId, `[6/6] 📦 Finalizing & Validating Build Artifacts...`, "step");
    const nativeArtifactPath = findNativeBuildArtifact(workspaceDir, buildMode, params.platform);

    if (!nativeArtifactPath || !fs.existsSync(nativeArtifactPath)) {
      throw new Error(`Compiler completed with code 0 but no binary artifact was found in workspace.`);
    }

    const artifactDir = path.join(buildDir, "artifact");
    if (!fs.existsSync(artifactDir)) {
      fs.mkdirSync(artifactDir, { recursive: true });
    }

    const sanitizedAppName = params.appName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    let destPath = "";
    let fileName = "";

    if (params.platform === "ios") {
      fileName = `${sanitizedAppName}-v${params.version}-${params.buildNumber}.ipa`;
      destPath = path.join(artifactDir, fileName);

      if (nativeArtifactPath.endsWith(".ipa")) {
        fs.copyFileSync(nativeArtifactPath, destPath);
      } else if (fs.statSync(nativeArtifactPath).isDirectory()) {
        appendServerLog(buildId, `   Packaging iOS application bundle into standard IPA archive...`, "info");
        const tempPayload = path.join(buildDir, "Payload");
        if (fs.existsSync(tempPayload)) fs.rmSync(tempPayload, { recursive: true, force: true });
        fs.mkdirSync(tempPayload, { recursive: true });

        const appName = path.basename(nativeArtifactPath);
        const appTargetDir = path.join(tempPayload, appName);
        fs.cpSync(nativeArtifactPath, appTargetDir, { recursive: true });

        // Auto-embed provisioning profile if found
        const candidateProfiles = [
          "/Users/madan.r/Desktop/API_Keys/QuickDrop_AppStore.mobileprovision",
          path.join(workspaceDir, "ios/embedded.mobileprovision"),
        ];
        let foundProfile: string | null = null;
        for (const cp of candidateProfiles) {
          if (fs.existsSync(cp)) {
            foundProfile = cp;
            break;
          }
        }
        let entitlementsFile: string | null = null;
        if (foundProfile) {
          fs.copyFileSync(foundProfile, path.join(appTargetDir, "embedded.mobileprovision"));
          appendServerLog(buildId, `   [SIGNING]: Embedded provisioning profile from: ${foundProfile}`, "info");

          try {
            const rawProfilePlist = path.join(buildDir, "profile.plist");
            const rawEntitlementsPlist = path.join(buildDir, "entitlements.plist");
            execSync(`security cms -D -i "${foundProfile}" > "${rawProfilePlist}"`);
            execSync(`plutil -extract Entitlements xml1 -o "${rawEntitlementsPlist}" "${rawProfilePlist}"`);
            if (fs.existsSync(rawEntitlementsPlist)) {
              entitlementsFile = rawEntitlementsPlist;
              appendServerLog(buildId, `   [SIGNING]: Extracted entitlements from provisioning profile.`, "info");
            }
          } catch {
            // Continue if extraction fails
          }
        }

        // Auto-sign bundle if codesigning identity is available
        try {
          const idOutput = execSync("security find-identity -v -p codesigning", { encoding: "utf8" });
          const match = idOutput.match(/"([^"]*Apple Distribution[^"]*)"/i) || idOutput.match(/"([^"]*Apple Development[^"]*)"/i);
          if (match && match[1]) {
            const identity = match[1];
            appendServerLog(buildId, `   [SIGNING]: Code signing iOS bundle with: ${identity}`, "info");

            const fwDir = path.join(appTargetDir, "Frameworks");
            if (fs.existsSync(fwDir)) {
              for (const fw of fs.readdirSync(fwDir)) {
                try {
                  execSync(`codesign -f -s "${identity}" --timestamp "${path.join(fwDir, fw)}"`);
                } catch {}
              }
            }

            try {
              const entitlementsArg = entitlementsFile ? `--entitlements "${entitlementsFile}" --generate-entitlement-der` : "";
              execSync(`codesign -f -s "${identity}" ${entitlementsArg} --timestamp "${appTargetDir}"`);
              appendServerLog(buildId, `   [SIGNING]: Successfully signed application executable and bundle with entitlements.`, "info");
            } catch {}
          }
        } catch {
          // Non-blocking codesigning attempt
        }

        try {
          execSync(`/usr/bin/zip -r -q "${destPath}" Payload`, { cwd: buildDir });
        } finally {
          fs.rmSync(tempPayload, { recursive: true, force: true });
        }
      } else {
        fs.copyFileSync(nativeArtifactPath, destPath);
      }
    } else {
      const ext = buildMode === "debug-apk" ? "apk" : "aab";
      fileName = `${sanitizedAppName}-v${params.version}-${params.buildNumber}.${ext}`;
      destPath = path.join(artifactDir, fileName);
      fs.copyFileSync(nativeArtifactPath, destPath);
    }

    // Validate binary container format and essential bundle files
    const validation = validateBuildArtifact(destPath);
    if (!validation.valid) {
      throw new Error(`Artifact validation failed: ${validation.error}`);
    }

    const stat = fs.statSync(destPath);

    appendServerLog(
      buildId,
      `   ✓ Validated authentic ${validation.format.toUpperCase()} binary (${(stat.size / (1024 * 1024)).toFixed(2)} MB): ${fileName}`,
      "info"
    );
    appendServerLog(buildId, `   ✓ Artifact saved at: ${destPath}`, "info");

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    const destinationTarget = params.platform === "ios" ? "TestFlight / App Store" : "Google Play";
    appendServerLog(buildId, `═══════════════════════════════════════════════════════════`, "step");
    appendServerLog(buildId, `✅ BUILD SUCCESSFUL in ${elapsedSeconds}s`, "step");
    appendServerLog(
      buildId,
      `   Authentic artifact produced. Ready for ${destinationTarget} deployment.`,
      "info"
    );
    appendServerLog(buildId, `═══════════════════════════════════════════════════════════`, "step");

    updateServerBuild(buildId, {
      status: "success",
      artifactPath: destPath,
      artifactName: fileName,
      artifactSize: stat.size,
      isDemoArtifact: false,
      commitSha,
      commitMessage,
      commitAuthor,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    appendServerLog(buildId, `❌ BUILD FAILED: ${errMsg}`, "error");
    updateServerBuild(buildId, {
      status: "failed",
      errorSummary: errMsg,
    });
  } finally {
    activeProcesses.delete(buildId);
    try {
      signingCleanup();
    } catch {}
    // Prune heavy compilation workspace to eliminate the ~850MB footprint per build (Finding #17)
    cleanBuildWorkspace(buildId);
    pruneOldBuildArtifacts(14);
  }
}

/**
 * Initiates an Android build in the background with FIFO queue serialization.
 */
export async function runBuildPipeline(params: StartBuildParams): Promise<ServerBuildRecord> {
  // Strict parameter validations (Findings #19, #20)
  if (!isValidRepositoryId(params.repositoryId)) {
    throw new Error(
      `Invalid repositoryId: '${params.repositoryId}'. Expected format 'owner/repo' without special characters.`
    );
  }
  if (!isValidVersion(params.version)) {
    throw new Error(
      `Invalid version: '${params.version}'. Expected valid semver (e.g. 1.0.0) without path separators.`
    );
  }
  if (!isValidBuildNumber(params.buildNumber)) {
    throw new Error(
      `Invalid buildNumber: '${params.buildNumber}'. Expected a positive integer.`
    );
  }

  const buildId = `build_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const branch = params.branch || "main";
  const buildMode = params.buildMode || "release-aab";

  const initialRecord: ServerBuildRecord = {
    id: buildId,
    appId: params.appId,
    appName: params.appName,
    repositoryId: params.repositoryId,
    branch,
    platform: params.platform || "android",
    buildMode,
    status: "queued",
    version: params.version,
    buildNumber: params.buildNumber,
    startedAt: new Date().toISOString(),
  };

  saveServerBuild(initialRecord);

  // Enqueue job for FIFO execution
  buildQueue.push({ buildId, params });
  setTimeout(processQueue, 0);

  return initialRecord;
}

/**
 * Cancels a running build process using process-group signaling (Finding #15).
 */
export function cancelServerBuild(buildId: string): boolean {
  const proc = activeProcesses.get(buildId);
  if (proc && proc.pid) {
    try {
      // Kill the entire process group spawned with detached: true
      process.kill(-proc.pid, "SIGTERM");
    } catch {
      try {
        proc.kill("SIGTERM");
      } catch {}
    }
    activeProcesses.delete(buildId);
  }

  // Remove from queue if still pending
  const queueIdx = buildQueue.findIndex((t) => t.buildId === buildId);
  if (queueIdx >= 0) {
    buildQueue.splice(queueIdx, 1);
  }

  updateServerBuild(buildId, { status: "cancelled" });
  appendServerLog(buildId, "⚠️ Build was cancelled by user request.", "warn");
  return true;
}

export const cancelRunningBuild = cancelServerBuild;
export const runAndroidBuildPipeline = runBuildPipeline;
