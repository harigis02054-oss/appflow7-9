import { describe, it, expect, beforeAll } from "vitest";
import { runAndroidBuildPipeline } from "../engine";
import { getServerBuild } from "../store";
import fs from "fs";
import path from "path";

beforeAll(() => {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const l of lines) {
      const trimmed = l.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
});

describe("Build Engine Integration: Non-Android Repository Blocked Behavior", () => {
  it("transitions to 'blocked' status (not 'success') when repo lacks android/ directory (Finding #11, #14)", async () => {
    // harigis02054-oss/hari1234 on main branch is a web project with no android/ folder
    const build = await runAndroidBuildPipeline({
      appId: "test_web_app",
      appName: "Non Android App",
      repositoryId: "harigis02054-oss/hari1234",
      branch: "main",
      platform: "android",
      buildMode: "release-aab",
      version: "1.0.0",
      buildNumber: 1,
    });

    expect(build.status).toBe("queued");

    // Poll until terminal status
    let finalBuild = getServerBuild(build.id);
    const start = Date.now();
    while (finalBuild && (finalBuild.status === "queued" || finalBuild.status === "running")) {
      if (Date.now() - start > 30000) break; // 30s timeout
      await new Promise((r) => setTimeout(r, 500));
      finalBuild = getServerBuild(build.id);
    }

    expect(finalBuild).toBeDefined();
    // Must be 'blocked', NOT 'success' with a fake demo artifact
    expect(finalBuild!.status).toBe("blocked");
    expect(finalBuild!.errorSummary).toContain("android");
  }, 40000);
});
