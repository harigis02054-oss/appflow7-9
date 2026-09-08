import { describe, it, expect, beforeEach } from "vitest";
import {
  createReleasePipeline,
  transitionReleaseStage,
  getDefaultReleaseStages,
} from "../orchestrator";
import { getRelease, deleteRelease } from "../store";

describe("Release Orchestrator State Machine", () => {
  it("initializes release with all 11 default stages in pending/running status", async () => {
    const defaultStages = getDefaultReleaseStages();
    expect(defaultStages.length).toBe(11);
    expect(defaultStages.map((s) => s.id)).toEqual([
      "analyze",
      "validate",
      "build",
      "sign",
      "test",
      "upload",
      "process",
      "testing-track",
      "review",
      "approve",
      "production",
    ]);

    const release = await createReleasePipeline({
      appId: "test-app-id",
      appName: "TestApp",
      repositoryId: "owner/repo",
      platform: "android",
      track: "internal-testing",
      version: "1.0.0",
      buildNumber: 1,
      actor: "Test Runner",
    });

    expect(release.id).toMatch(/^rel_\d+_[a-f0-9]{6}$/);
    expect(release.state).toBe("CREATED");
    expect(release.stages[0].status).toBe("running"); // analyze started
    expect(release.stages[1].status).toBe("pending"); // validate pending
    expect(release.auditLogs.length).toBe(1);
    expect(release.auditLogs[0].action).toBe("Created Release Pipeline");

    // Clean up
    deleteRelease(release.id);
  });

  it("transitions stages and records audit trail with duration", async () => {
    const release = await createReleasePipeline({
      appId: "test-app-id-2",
      appName: "TestApp2",
      repositoryId: "owner/repo",
      platform: "ios",
      track: "testflight",
      version: "2.1.0",
      buildNumber: 42,
    });

    const updated = transitionReleaseStage(release.id, "analyze", "success", {
      nextState: "ANALYZING",
      actor: "CI System",
      log: "Repository structure confirmed.",
    });

    expect(updated).not.toBeNull();
    expect(updated?.stages.find((s) => s.id === "analyze")?.status).toBe("success");
    expect(updated?.state).toBe("ANALYZING");
    expect(updated?.auditLogs.length).toBe(2);

    const validated = transitionReleaseStage(release.id, "validate", "success", {
      nextState: "VALIDATED",
      actor: "CI System",
    });

    expect(validated?.state).toBe("VALIDATED");

    // Clean up
    deleteRelease(release.id);
  });
});
