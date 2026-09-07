import { describe, it, expect } from "vitest";
import { inspectSystemToolchain, detectXcode, detectIosSigningIdentities } from "../preflight";
import { validateBuildArtifact } from "../validate";
import { generateAppleJWT } from "../../apple/client";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

describe("iOS Toolchain Preflight Diagnostics", () => {
  it("detects Xcode installation state on macOS host", () => {
    const xcode = detectXcode();
    expect(xcode).toHaveProperty("installed");
    if (xcode.installed) {
      expect(xcode.path).toBeTruthy();
      expect(xcode.version).toBeTruthy();
    }
  });

  it("inspects iOS signing identities in macOS keychain", () => {
    const identities = detectIosSigningIdentities();
    expect(typeof identities.count).toBe("number");
    expect(Array.isArray(identities.identities)).toBe(true);
    expect(typeof identities.hasDistribution).toBe("boolean");
  });

  it("inspectSystemToolchain includes iOS toolchain checks", () => {
    const toolchain = inspectSystemToolchain();
    expect(toolchain).toHaveProperty("readyForIosBuild");
    expect(typeof toolchain.readyForIosBuild).toBe("boolean");
    expect(toolchain.tools).toHaveProperty("xcode");
    expect(toolchain.tools).toHaveProperty("cocoapods");
    expect(toolchain.tools).toHaveProperty("signingIdentities");
  });
});

describe("iOS Artifact Validation", () => {
  it("validates an authentic IPA zip container with Info.plist", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appflow-ios-test-"));
    const ipaPath = path.join(tmpDir, "test-app.ipa");

    // Create a minimal zip container starting with PK\x03\x04 signature containing Info.plist
    const zipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    const payloadInfo = Buffer.from("Payload/Runner.app/Info.plist CFBundleIdentifier com.quickdrop.app");
    const padding = Buffer.alloc(2048, 0x20);
    fs.writeFileSync(ipaPath, Buffer.concat([zipHeader, payloadInfo, padding]));

    const result = validateBuildArtifact(ipaPath);
    expect(result.valid).toBe(true);
    expect(result.format).toBe("ipa");
    expect(result.hasManifest).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects corrupted or non-zip iOS files", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "appflow-ios-test-"));
    const fakePath = path.join(tmpDir, "bad.ipa");
    fs.writeFileSync(fakePath, Buffer.alloc(2048, 0x00));

    const result = validateBuildArtifact(fakePath);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("PK\\x03\\x04");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("Apple App Store Connect JWT Generator", () => {
  it("generates correctly structured JWT with required claims", () => {
    // Generate dummy EC private key for testing
    const { privateKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    const jwt = generateAppleJWT({
      issuerId: "test-issuer-12345",
      keyId: "KEY12345",
      privateKey,
    });

    const parts = jwt.split(".");
    expect(parts.length).toBe(3);

    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    expect(header.alg).toBe("ES256");
    expect(header.kid).toBe("KEY12345");
    expect(header.typ).toBe("JWT");

    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    expect(payload.iss).toBe("test-issuer-12345");
    expect(payload.aud).toBe("appstoreconnect-v1");
    expect(typeof payload.iat).toBe("number");
    expect(typeof payload.exp).toBe("number");
    expect(payload.exp - payload.iat).toBe(600); // 10 minutes
  });
});
