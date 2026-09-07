import fs from "fs";

export interface ArtifactValidationResult {
  valid: boolean;
  format: "aab" | "apk" | "ipa" | "unknown";
  sizeBytes: number;
  error?: string;
  hasManifest?: boolean;
}

/**
 * Validates an AAB, APK, or IPA binary artifact before it is marked ready or submitted to app stores.
 * Checks magic bytes (ZIP container structure PK\x03\x04) and inspects table of contents
 * for essential bundle components without requiring external binary dependencies.
 */
export function validateBuildArtifact(filePath: string): ArtifactValidationResult {
  if (!filePath || !fs.existsSync(filePath)) {
    return { valid: false, format: "unknown", sizeBytes: 0, error: "Artifact file does not exist" };
  }

  const stat = fs.statSync(filePath);
  if (stat.size < 1024) {
    return {
      valid: false,
      format: "unknown",
      sizeBytes: stat.size,
      error: `Artifact file is too small (${stat.size} bytes). Expected complete binary package.`,
    };
  }

  const fd = fs.openSync(filePath, "r");
  const headerBuf = Buffer.alloc(4);
  fs.readSync(fd, headerBuf, 0, 4, 0);

  // ZIP files (including APK, AAB, and IPA) must begin with PK\x03\x04 (0x50 0x4B 0x03 0x04)
  const isZip =
    headerBuf[0] === 0x50 &&
    headerBuf[1] === 0x4b &&
    headerBuf[2] === 0x03 &&
    headerBuf[3] === 0x04;

  if (!isZip) {
    fs.closeSync(fd);
    return {
      valid: false,
      format: "unknown",
      sizeBytes: stat.size,
      error: "Artifact is not a valid ZIP container (missing PK\\x03\\x04 signature)",
    };
  }

  // Scan central directory or sample headers to identify bundle characteristics
  // Read first 64KB and last 64KB where headers and central directory reside
  const sampleSize = Math.min(stat.size, 65536);
  const headBuf = Buffer.alloc(sampleSize);
  fs.readSync(fd, headBuf, 0, sampleSize, 0);

  const tailBuf = Buffer.alloc(sampleSize);
  const tailOffset = Math.max(0, stat.size - sampleSize);
  fs.readSync(fd, tailBuf, 0, sampleSize, tailOffset);
  fs.closeSync(fd);

  const combined = Buffer.concat([headBuf, tailBuf]).toString("latin1");

  const isAab =
    filePath.endsWith(".aab") ||
    combined.includes("BundleConfig.pb") ||
    combined.includes("base/manifest/AndroidManifest.xml");

  const isApk =
    filePath.endsWith(".apk") ||
    combined.includes("AndroidManifest.xml") ||
    combined.includes("classes.dex");

  const isIpa =
    filePath.endsWith(".ipa") ||
    combined.includes("Payload/") ||
    combined.includes("Info.plist");

  const format = isAab ? "aab" : isApk ? "apk" : isIpa ? "ipa" : "unknown";
  const hasManifest =
    combined.includes("AndroidManifest.xml") ||
    combined.includes("base/manifest/AndroidManifest.xml") ||
    combined.includes("Info.plist");

  if (isAab && !hasManifest && !combined.includes("BundleConfig.pb")) {
    return {
      valid: false,
      format: "aab",
      sizeBytes: stat.size,
      error: "Android App Bundle is missing required BundleConfig.pb or AndroidManifest",
    };
  }

  if (isApk && !hasManifest) {
    return {
      valid: false,
      format: "apk",
      sizeBytes: stat.size,
      error: "Android APK package is missing required AndroidManifest.xml",
    };
  }

  if (isIpa && !hasManifest && !combined.includes("Payload/")) {
    return {
      valid: false,
      format: "ipa",
      sizeBytes: stat.size,
      error: "iOS IPA package is missing required Payload/ or Info.plist",
    };
  }

  return {
    valid: true,
    format,
    sizeBytes: stat.size,
    hasManifest,
  };
}
