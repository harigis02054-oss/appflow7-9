import { describe, it, expect } from "vitest";
import {
  scorePct,
  extractPubspecVersion,
  extractPackageJsonVersion,
  extractAndroidApplicationId,
  extractIOSBundleId,
} from "../detect";
import type { RequiredFileCheck } from "@/lib/types";

describe("Repository Detection & Metadata Extraction", () => {
  describe("scorePct", () => {
    it("returns 0 for empty checks array", () => {
      expect(scorePct([])).toBe(0);
    });

    it("calculates 100% when all checks pass", () => {
      const checks: RequiredFileCheck[] = [
        { id: "1", label: "Manifest", path: "m.xml", found: true, severity: "required" },
        { id: "2", label: "Gradle", path: "build.gradle", found: true, severity: "required" },
      ];
      expect(scorePct(checks)).toBe(100);
    });

    it("weights recommended checks as half-credit (0.5 weight)", () => {
      const checks: RequiredFileCheck[] = [
        { id: "1", label: "Manifest", path: "m.xml", found: true, severity: "required" },
        { id: "2", label: "Signing", path: "key.properties", found: false, severity: "recommended" },
      ];
      // 1.0 earned out of 1.5 possible = 67%
      expect(scorePct(checks)).toBe(67);
    });

    it("returns 0% when no checks pass", () => {
      const checks: RequiredFileCheck[] = [
        { id: "1", label: "Manifest", path: "m.xml", found: false, severity: "required" },
      ];
      expect(scorePct(checks)).toBe(0);
    });
  });

  describe("extractPubspecVersion", () => {
    it("extracts version and build number from standard pubspec format", () => {
      const pubspec = `
name: appflow_test
description: "A test project"
version: 1.2.3+45
environment:
  sdk: '>=3.0.0 <4.0.0'
`;
      const result = extractPubspecVersion(pubspec);
      expect(result.version).toBe("1.2.3");
      expect(result.code).toBe(45);
    });

    it("handles version without build number", () => {
      const pubspec = "version: 2.0.0\n";
      const result = extractPubspecVersion(pubspec);
      expect(result.version).toBe("2.0.0");
      expect(result.code).toBeUndefined();
    });

    it("returns empty object for missing or null text", () => {
      expect(extractPubspecVersion(null)).toEqual({});
      expect(extractPubspecVersion("name: test\n")).toEqual({});
    });
  });

  describe("extractPackageJsonVersion", () => {
    it("extracts version from package.json text", () => {
      const pkgJson = JSON.stringify({ name: "my-app", version: "3.1.4" });
      expect(extractPackageJsonVersion(pkgJson)).toBe("3.1.4");
    });

    it("returns undefined for invalid JSON or missing version", () => {
      expect(extractPackageJsonVersion(null)).toBeUndefined();
      expect(extractPackageJsonVersion("{ invalid json")).toBeUndefined();
      expect(extractPackageJsonVersion(JSON.stringify({ name: "my-app" }))).toBeUndefined();
    });
  });

  describe("extractAndroidApplicationId", () => {
    it("extracts applicationId from Kotlin DSL build.gradle.kts", () => {
      const kts = `
android {
    namespace = "com.example.namespace"
    defaultConfig {
        applicationId = "com.appflow.test"
        minSdk = 21
    }
}
`;
      expect(extractAndroidApplicationId(kts, null)).toBe("com.appflow.test");
    });

    it("extracts namespace if applicationId is absent", () => {
      const kts = `
android {
    namespace = "com.appflow.testapp"
}
`;
      expect(extractAndroidApplicationId(kts, null)).toBe("com.appflow.testapp");
    });

    it("falls back to AndroidManifest.xml package attribute", () => {
      const manifest = `<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.manifest.app">`;
      expect(extractAndroidApplicationId(null, manifest)).toBe("com.manifest.app");
    });
  });

  describe("extractIOSBundleId", () => {
    it("extracts PRODUCT_BUNDLE_IDENTIFIER from project.pbxproj", () => {
      const pbxproj = `PRODUCT_BUNDLE_IDENTIFIER = com.appflow.ios;`;
      expect(extractIOSBundleId(pbxproj)).toBe("com.appflow.ios");
    });

    it("returns undefined for null text", () => {
      expect(extractIOSBundleId(null)).toBeUndefined();
    });
  });
});
