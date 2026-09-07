import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export interface ToolCheck {
  id: string;
  name: string;
  installed: boolean;
  version?: string;
  path?: string;
  required: boolean;
  hint?: string;
}

export interface ToolchainStatus {
  readyForAndroidBuild: boolean;
  readyForIosBuild: boolean;
  tools: {
    git: ToolCheck;
    flutter: ToolCheck;
    java: ToolCheck;
    androidSdk: ToolCheck;
    xcode: ToolCheck;
    cocoapods: ToolCheck;
    signingIdentities: ToolCheck;
  };
  details: string[];
}

function tryExec(cmd: string): string | null {
  try {
    return execSync(cmd, { encoding: "utf8", timeout: 3000, stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

export function detectFlutterPath(): string | null {
  if (process.env.FLUTTER_BIN_PATH && fs.existsSync(process.env.FLUTTER_BIN_PATH)) {
    return process.env.FLUTTER_BIN_PATH;
  }
  const defaultUserPath = path.join(os.homedir(), "development/flutter/bin/flutter");
  if (fs.existsSync(defaultUserPath)) {
    return defaultUserPath;
  }
  const whichResult = tryExec("which flutter");
  if (whichResult && fs.existsSync(whichResult)) {
    return whichResult;
  }
  return null;
}

export function detectAndroidSdkPath(): string | null {
  if (process.env.ANDROID_HOME && fs.existsSync(process.env.ANDROID_HOME)) {
    return process.env.ANDROID_HOME;
  }
  if (process.env.ANDROID_SDK_ROOT && fs.existsSync(process.env.ANDROID_SDK_ROOT)) {
    return process.env.ANDROID_SDK_ROOT;
  }
  const defaultMacPath = path.join(os.homedir(), "Library/Android/sdk");
  if (fs.existsSync(defaultMacPath)) {
    return defaultMacPath;
  }
  return null;
}

export function detectXcode(): { path: string | null; version: string | null; installed: boolean } {
  const devPath = tryExec("xcode-select -p");
  if (!devPath || !fs.existsSync(devPath)) {
    return { path: null, version: null, installed: false };
  }
  const ver = tryExec("xcodebuild -version");
  const firstLine = ver ? ver.split("\n")[0] : "Xcode Developer Tools";
  return { path: devPath, version: firstLine, installed: true };
}

export function detectCocoaPods(): { path: string | null; version: string | null; installed: boolean } {
  const whichPod = tryExec("which pod");
  if (whichPod && fs.existsSync(whichPod)) {
    const ver = tryExec("pod --version");
    return { path: whichPod, version: ver || undefined, installed: true };
  }
  const candidatePaths = [
    "/usr/local/bin/pod",
    "/opt/homebrew/bin/pod",
    path.join(os.homedir(), ".local/bin/pod"),
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      const ver = tryExec(`"${p}" --version`);
      return { path: p, version: ver || undefined, installed: true };
    }
  }
  return { path: null, version: null, installed: false };
}

export function detectIosSigningIdentities(): { count: number; identities: string[]; hasDistribution: boolean } {
  const output = tryExec("security find-identity -v -p codesigning");
  if (!output) {
    return { count: 0, identities: [], hasDistribution: false };
  }
  const lines = output.split("\n").filter((l) => /^\s*\d+\)/.test(l));
  const identities = lines.map((l) => l.trim());
  const hasDistribution = identities.some((id) =>
    id.toLowerCase().includes("apple distribution") || id.toLowerCase().includes("iphone distribution")
  );
  return { count: identities.length, identities, hasDistribution };
}

export function detectJavaHome(): { path: string | null; version: string | null; installed: boolean } {
  if (process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)) {
    const v = tryExec(`"${path.join(process.env.JAVA_HOME, "bin/java")}" -version 2>&1 | head -1`);
    const valid = Boolean(v && !v.includes("Unable to locate"));
    return { path: process.env.JAVA_HOME, version: valid ? v : null, installed: valid };
  }

  const macJavaHome = tryExec("/usr/libexec/java_home 2>/dev/null");
  if (macJavaHome && fs.existsSync(macJavaHome)) {
    const v = tryExec(`"${path.join(macJavaHome, "bin/java")}" -version 2>&1 | head -1`);
    const valid = Boolean(v && !v.includes("Unable to locate"));
    return { path: macJavaHome, version: valid ? v : null, installed: valid };
  }

  const whichJava = tryExec("which java");
  if (whichJava) {
    const v = tryExec("java -version 2>&1 | head -1");
    const valid = Boolean(v && !v.includes("Unable to locate"));
    if (valid) return { path: whichJava, version: v, installed: true };
  }

  // Common user/dev installation locations
  const candidateDirs = [
    path.join(os.homedir(), "development/jdk-17/Contents/Home"),
    path.join(os.homedir(), "development/jdk-17"),
    "/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home",
    "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home",
    "/opt/homebrew/opt/openjdk@17",
  ];

  for (const dir of candidateDirs) {
    const binJava = path.join(dir, "bin/java");
    if (fs.existsSync(binJava)) {
      const v = tryExec(`"${binJava}" -version 2>&1 | head -1`);
      const valid = Boolean(v && !v.includes("Unable to locate"));
      if (valid) return { path: dir, version: v, installed: true };
    }
  }

  return { path: null, version: null, installed: false };
}

export function inspectSystemToolchain(): ToolchainStatus {
  const gitPath = tryExec("which git");
  const gitVer = gitPath ? tryExec("git --version") : null;

  const flutterBin = detectFlutterPath();
  const flutterVer = flutterBin ? tryExec(`"${flutterBin}" --version 2>&1 | head -1`) : null;

  const { path: javaPath, version: javaVer, installed: javaInstalled } = detectJavaHome();
  const androidSdkPath = detectAndroidSdkPath();

  const { path: xcodePath, version: xcodeVer, installed: xcodeInstalled } = detectXcode();
  const { path: podPath, version: podVer, installed: podInstalled } = detectCocoaPods();
  const { count: certCount, hasDistribution } = detectIosSigningIdentities();

  const gitCheck: ToolCheck = {
    id: "git",
    name: "Git",
    installed: Boolean(gitPath),
    version: gitVer ?? undefined,
    path: gitPath ?? undefined,
    required: true,
    hint: "Install git using Xcode command line tools or brew install git.",
  };

  const flutterCheck: ToolCheck = {
    id: "flutter",
    name: "Flutter SDK",
    installed: Boolean(flutterBin),
    version: flutterVer ?? undefined,
    path: flutterBin ?? undefined,
    required: false,
    hint: "Required for Flutter apps. Download from flutter.dev.",
  };

  const javaCheck: ToolCheck = {
    id: "java",
    name: "Java JDK (v17 recommended)",
    installed: javaInstalled,
    version: javaVer ?? undefined,
    path: javaPath ?? undefined,
    required: true,
    hint: "Required for Android Gradle builds. Install via 'brew install openjdk@17'.",
  };

  const androidSdkCheck: ToolCheck = {
    id: "android-sdk",
    name: "Android SDK",
    installed: Boolean(androidSdkPath),
    path: androidSdkPath ?? undefined,
    required: true,
    hint: "Install Android Studio or set ANDROID_HOME in .env.local.",
  };

  const xcodeCheck: ToolCheck = {
    id: "xcode",
    name: "Xcode & Command Line Tools",
    installed: xcodeInstalled,
    version: xcodeVer ?? undefined,
    path: xcodePath ?? undefined,
    required: true,
    hint: "Required for iOS compilation. Install via Mac App Store or developer.apple.com.",
  };

  const cocoapodsCheck: ToolCheck = {
    id: "cocoapods",
    name: "CocoaPods",
    installed: podInstalled,
    version: podVer ?? undefined,
    path: podPath ?? undefined,
    required: false,
    hint: "Required for iOS projects with native Pod dependencies. Install via 'sudo gem install cocoapods'.",
  };

  const signingIdentitiesCheck: ToolCheck = {
    id: "signing-identities",
    name: "Apple Code Signing Identity",
    installed: certCount > 0,
    version: certCount > 0 ? `${certCount} identity found${hasDistribution ? " (includes Distribution)" : ""}` : undefined,
    required: false,
    hint: "Optional for local testing (uses --no-codesign). Required for App Store / TestFlight exports.",
  };

  const details: string[] = [];
  if (!gitCheck.installed) details.push("Git is missing.");
  if (!flutterCheck.installed) details.push("Flutter SDK not found on path.");
  if (!javaCheck.installed) details.push("Java runtime not detected. Gradle compilation requires JDK 17.");
  if (!androidSdkCheck.installed) details.push("Android SDK directory not found.");
  if (!xcodeCheck.installed) details.push("Xcode is not installed or configured on host.");

  const readyForAndroidBuild = Boolean(gitCheck.installed && javaCheck.installed && androidSdkCheck.installed);
  const readyForIosBuild = Boolean(gitCheck.installed && xcodeCheck.installed);

  return {
    readyForAndroidBuild,
    readyForIosBuild,
    tools: {
      git: gitCheck,
      flutter: flutterCheck,
      java: javaCheck,
      androidSdk: androidSdkCheck,
      xcode: xcodeCheck,
      cocoapods: cocoapodsCheck,
      signingIdentities: signingIdentitiesCheck,
    },
    details,
  };
}
