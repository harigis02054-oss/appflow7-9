import fs from "fs";
import path from "path";

export interface KeystoreConfig {
  configured: boolean;
  storeFilePath?: string;
  storePassword?: string;
  keyAlias?: string;
  keyPassword?: string;
}

/**
 * Reads release keystore credentials from server environment.
 * These secrets live in .env.local on the build host and are never checked into Git.
 */
export function getKeystoreConfig(): KeystoreConfig {
  const storePath = process.env.ANDROID_KEYSTORE_PATH;
  const storeBase64 = process.env.ANDROID_KEYSTORE_BASE64;
  const storePassword = process.env.ANDROID_KEYSTORE_PASSWORD;
  const keyAlias = process.env.ANDROID_KEY_ALIAS;
  const keyPassword = process.env.ANDROID_KEY_PASSWORD || storePassword;

  const hasKeystore = Boolean(
    (storePath && fs.existsSync(storePath)) || storeBase64
  );

  const configured = Boolean(hasKeystore && storePassword && keyAlias);

  return {
    configured,
    storeFilePath: storePath,
    storePassword,
    keyAlias,
    keyPassword,
  };
}

/**
 * Injects ephemeral key.properties and keystore into the workspace android/ directory
 * for the duration of the compilation step.
 * Written with strict 0600 file mode permissions (owner read/write only).
 */
export function injectWorkspaceSigningConfig(workspaceDir: string): {
  injected: boolean;
  cleanup: () => void;
} {
  const config = getKeystoreConfig();
  if (!config.configured) {
    return { injected: false, cleanup: () => {} };
  }

  const androidDir = path.join(workspaceDir, "android");
  if (!fs.existsSync(androidDir)) {
    return { injected: false, cleanup: () => {} };
  }

  const keyPropsFile = path.join(androidDir, "key.properties");
  let temporaryKeystorePath: string | null = null;
  let finalStorePath = config.storeFilePath;

  // If provided as base64, write to a temporary file with strict 0600 permissions
  if (!finalStorePath && process.env.ANDROID_KEYSTORE_BASE64) {
    temporaryKeystorePath = path.join(androidDir, "release-upload.jks");
    fs.writeFileSync(
      temporaryKeystorePath,
      Buffer.from(process.env.ANDROID_KEYSTORE_BASE64, "base64"),
      { mode: 0o600 }
    );
    finalStorePath = temporaryKeystorePath;
  }

  if (!finalStorePath) {
    return { injected: false, cleanup: () => {} };
  }

  // Create key.properties format expected by Gradle/Flutter with 0600 permissions
  const keyPropsContent = [
    `storeFile=${finalStorePath}`,
    `storePassword=${config.storePassword}`,
    `keyAlias=${config.keyAlias}`,
    `keyPassword=${config.keyPassword}`,
  ].join("\n");

  fs.writeFileSync(keyPropsFile, keyPropsContent, {
    encoding: "utf-8",
    mode: 0o600,
  });

  const cleanup = () => {
    try {
      if (fs.existsSync(keyPropsFile)) {
        fs.unlinkSync(keyPropsFile);
      }
      if (temporaryKeystorePath && fs.existsSync(temporaryKeystorePath)) {
        fs.unlinkSync(temporaryKeystorePath);
      }
    } catch {
      // Best effort cleanup
    }
  };

  return { injected: true, cleanup };
}

/**
 * Startup sweep: Scans `.builds/` directory and scrubs any lingering key.properties
 * or temporary keystores from previous runs if the server died uncleanly (OOM, SIGKILL).
 */
export function sweepStaleSigningFiles(baseDir = path.join(process.cwd(), ".builds")): number {
  if (!fs.existsSync(baseDir)) return 0;
  let cleanedCount = 0;

  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const workspaceAndroid = path.join(baseDir, entry.name, "workspace", "android");
        if (fs.existsSync(workspaceAndroid)) {
          const keyProps = path.join(workspaceAndroid, "key.properties");
          const tempJks = path.join(workspaceAndroid, "release-upload.jks");

          if (fs.existsSync(keyProps)) {
            try {
              fs.unlinkSync(keyProps);
              cleanedCount++;
            } catch {}
          }
          if (fs.existsSync(tempJks)) {
            try {
              fs.unlinkSync(tempJks);
              cleanedCount++;
            } catch {}
          }
        }
      }
    }
  } catch (err) {
    console.error("[signing] Startup sweep error:", err);
  }

  return cleanedCount;
}
