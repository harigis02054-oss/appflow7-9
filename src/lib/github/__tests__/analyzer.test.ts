import { describe, it, expect } from "vitest";
import {
  extractAndroidPermissions,
  extractIOSPermissions,
} from "../analyzer";

describe("Deep Repository Analyzer Intelligence", () => {
  it("extracts Android permissions from AndroidManifest.xml correctly", () => {
    const manifest = `
      <manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.example.app">
        <uses-permission android:name="android.permission.INTERNET" />
        <uses-permission android:name="android.permission.CAMERA" />
        <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
      </manifest>
    `;

    const permissions = extractAndroidPermissions(manifest);
    expect(permissions).toEqual(["INTERNET", "CAMERA", "ACCESS_FINE_LOCATION"]);
  });

  it("extracts iOS usage descriptions from Info.plist correctly", () => {
    const plist = `
      <plist version="1.0">
      <dict>
        <key>NSCameraUsageDescription</key>
        <string>Scan barcodes</string>
        <key>NSLocationWhenInUseUsageDescription</key>
        <string>Show user location</string>
      </dict>
      </plist>
    `;

    const permissions = extractIOSPermissions(plist);
    expect(permissions).toEqual(["Camera", "LocationWhenInUse"]);
  });

  it("returns empty array when manifest or plist is missing/null", () => {
    expect(extractAndroidPermissions(null)).toEqual([]);
    expect(extractIOSPermissions(null)).toEqual([]);
  });
});
