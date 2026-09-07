import { describe, it, expect } from "vitest";
import path from "path";
import { isValidBuildId, isPathContained } from "../store";
import {
  isValidRepositoryId,
  isValidVersion,
  isValidBuildNumber,
} from "../engine";
import { validateBuildArtifact } from "../validate";
import fs from "fs";
import os from "os";

describe("Build Security & Sanitization Guards", () => {
  describe("isValidBuildId", () => {
    it("accepts valid alphanumeric and dash/underscore build IDs", () => {
      expect(isValidBuildId("build_12345678_abc")).toBe(true);
      expect(isValidBuildId("custom-build-id-01")).toBe(true);
    });

    it("rejects path traversal attempts", () => {
      expect(isValidBuildId("../etc/passwd")).toBe(false);
      expect(isValidBuildId("../../builds")).toBe(false);
      expect(isValidBuildId("build/123")).toBe(false);
      expect(isValidBuildId("..\\windows\\system32")).toBe(false);
    });

    it("rejects shell injection and whitespace characters", () => {
      expect(isValidBuildId("build;rm -rf /")).toBe(false);
      expect(isValidBuildId("build`whoami`")).toBe(false);
      expect(isValidBuildId("build 123")).toBe(false);
      expect(isValidBuildId("")).toBe(false);
    });
  });

  describe("isPathContained (Boundary-Aware Traversal Check)", () => {
    const baseDir = "/Users/madan.r/Desktop/appflow/.builds";

    it("accepts canonical descendant paths", () => {
      expect(isPathContained(baseDir, "/Users/madan.r/Desktop/appflow/.builds/build_1/artifact")).toBe(true);
      expect(isPathContained(baseDir, "/Users/madan.r/Desktop/appflow/.builds/build_2/logs.jsonl")).toBe(true);
    });

    it("rejects sibling prefix confusion attacks (e.g. .builds-evil)", () => {
      expect(isPathContained(baseDir, "/Users/madan.r/Desktop/appflow/.builds-evil/payload")).toBe(false);
      expect(isPathContained(baseDir, "/Users/madan.r/Desktop/appflow/.builds_attacker")).toBe(false);
    });

    it("rejects parent directory traversal", () => {
      expect(isPathContained(baseDir, "/Users/madan.r/Desktop/appflow/src/engine.ts")).toBe(false);
      expect(isPathContained(baseDir, "/etc/passwd")).toBe(false);
    });
  });

  describe("isValidRepositoryId (Finding #19)", () => {
    it("accepts valid GitHub owner/repo format", () => {
      expect(isValidRepositoryId("harigis02054-oss/hari1234")).toBe(true);
      expect(isValidRepositoryId("flutter/flutter")).toBe(true);
      expect(isValidRepositoryId("org.name/project-repo_1")).toBe(true);
    });

    it("rejects leading hyphens to prevent git command-line argument injection", () => {
      expect(isValidRepositoryId("--upload-pack=sh/repo")).toBe(false);
      expect(isValidRepositoryId("-o/repo")).toBe(false);
    });

    it("rejects path traversal or single-name repos", () => {
      expect(isValidRepositoryId("../repo")).toBe(false);
      expect(isValidRepositoryId("just-repo-name")).toBe(false);
      expect(isValidRepositoryId("owner/repo/extra")).toBe(false);
      expect(isValidRepositoryId("owner/repo;whoami")).toBe(false);
    });
  });

  describe("isValidVersion (Finding #20)", () => {
    it("accepts standard semver strings", () => {
      expect(isValidVersion("1.0.0")).toBe(true);
      expect(isValidVersion("v2.1.4")).toBe(true);
      expect(isValidVersion("1.0.0-beta.1")).toBe(true);
      expect(isValidVersion("3.0")).toBe(true);
    });

    it("rejects directory traversal and path separators in version strings", () => {
      expect(isValidVersion("../../../../tmp/x")).toBe(false);
      expect(isValidVersion("1.0.0/build")).toBe(false);
      expect(isValidVersion("1.0.0\\win")).toBe(false);
      expect(isValidVersion("1.0.0;rm")).toBe(false);
      expect(isValidVersion("")).toBe(false);
    });
  });

  describe("isValidBuildNumber (Finding #20)", () => {
    it("accepts positive integers", () => {
      expect(isValidBuildNumber(1)).toBe(true);
      expect(isValidBuildNumber(100)).toBe(true);
      expect(isValidBuildNumber(999999)).toBe(true);
    });

    it("rejects zero, negative, float, and non-numeric inputs", () => {
      expect(isValidBuildNumber(0)).toBe(false);
      expect(isValidBuildNumber(-5)).toBe(false);
      expect(isValidBuildNumber(1.5)).toBe(false);
      expect(isValidBuildNumber("1")).toBe(false);
      expect(isValidBuildNumber(null)).toBe(false);
      expect(isValidBuildNumber(NaN)).toBe(false);
    });
  });

  describe("validateBuildArtifact (Finding #4)", () => {
    it("rejects non-existent files", () => {
      const result = validateBuildArtifact("/non/existent/file.aab");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("rejects files under 1KB", () => {
      const tmpFile = path.join(os.tmpdir(), "small_test.aab");
      fs.writeFileSync(tmpFile, "short content");
      const result = validateBuildArtifact(tmpFile);
      fs.unlinkSync(tmpFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too small");
    });

    it("rejects files missing PK\\x03\\x04 ZIP magic header", () => {
      const tmpFile = path.join(os.tmpdir(), "fake_zip.aab");
      const buf = Buffer.alloc(2048, 0x41); // 'A's
      fs.writeFileSync(tmpFile, buf);
      const result = validateBuildArtifact(tmpFile);
      fs.unlinkSync(tmpFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("missing PK");
    });
  });
});
