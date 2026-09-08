import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  verifyArtifactChecksum,
  pruneEphemeralWorkspaces,
  getRetentionStats,
} from "../retention";
import { globalWorkerQueue } from "../../worker/queue";
import {
  generateRollbackRecommendation,
  getPreviousStableRelease,
} from "../../release/recovery";
import { saveRelease } from "../../release/store";
import type { ReleaseModel } from "../../types";

describe("Reliability, Worker Queue & Retention Engine (Phase 8)", () => {
  const testDir = path.join(process.cwd(), ".builds", "test_reliability");

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  describe("Artifact Checksum Verification", () => {
    it("computes accurate SHA-256 for a binary package and verifies integrity", () => {
      const filePath = path.join(testDir, "sample-release.ipa");
      const content = Buffer.from("IPA_BINARY_PAYLOAD_TEST_APPFLOW");
      fs.writeFileSync(filePath, content);

      const expectedSha = crypto.createHash("sha256").update(content).digest("hex");

      const res = verifyArtifactChecksum(filePath, expectedSha);
      expect(res.valid).toBe(true);
      expect(res.sha256).toBe(expectedSha);
      expect(res.sizeBytes).toBe(content.length);
      expect(res.error).toBeUndefined();

      // Cleanup
      fs.unlinkSync(filePath);
    });

    it("detects checksum mismatch for corrupted or tampered artifacts", () => {
      const filePath = path.join(testDir, "tampered-release.aab");
      fs.writeFileSync(filePath, "AAB_CONTENT_CORRUPTED");

      const res = verifyArtifactChecksum(filePath, "incorrect_expected_hash_value");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Checksum mismatch");

      // Cleanup
      fs.unlinkSync(filePath);
    });

    it("handles missing artifact files gracefully", () => {
      const res = verifyArtifactChecksum("/non/existent/path/binary.aab");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("File not found");
    });
  });

  describe("Worker Queue Architecture", () => {
    it("enqueues jobs and manages running and queued counts under concurrency limits", () => {
      const statsBefore = globalWorkerQueue.getStats();

      const job1 = globalWorkerQueue.enqueueJob("build", { test: true });
      expect(job1.status).toBe("running");

      const job2 = globalWorkerQueue.enqueueJob("build", { test: true });
      expect(job2.status).toBe("running");

      // 3rd job exceeds concurrency of 2 and enters queued state
      const job3 = globalWorkerQueue.enqueueJob("build", { test: true });
      expect(job3.status).toBe("queued");

      // Complete job1 -> job3 should transition to running
      globalWorkerQueue.markJobComplete(job1.id, { artifact: "out.aab" });
      expect(globalWorkerQueue.getJob(job1.id)?.status).toBe("completed");
      expect(globalWorkerQueue.getJob(job3.id)?.status).toBe("running");

      // Clean up jobs
      globalWorkerQueue.markJobComplete(job2.id);
      globalWorkerQueue.markJobComplete(job3.id);
    });

    it("cancels queued and running jobs with user rationale", () => {
      const job = globalWorkerQueue.enqueueJob("upload", { releaseId: "rel_123" });
      const cancelled = globalWorkerQueue.cancelJob(job.id, "User requested cancellation");
      expect(cancelled).toBe(true);

      const status = globalWorkerQueue.getJob(job.id);
      expect(status?.status).toBe("cancelled");
      expect(status?.error).toBe("User requested cancellation");
    });
  });

  describe("Release Rollback & Recovery Recommendations", () => {
    const mockAppId = "app_recovery_test";

    beforeEach(() => {
      const now = new Date().toISOString();
      const releases: ReleaseModel[] = [
        {
          id: "rel_v1_stable",
          appId: mockAppId,
          appName: "RecoveryApp",
          repositoryId: "owner/repo",
          branch: "main",
          platform: "android",
          track: "production",
          version: "1.0.0",
          buildNumber: 10,
          state: "RELEASED",
          currentStageId: "production",
          stages: [],
          artifactPath: "/path/to/v1.0.0.aab",
          artifactName: "app-v1.0.0.aab",
          isSimulated: false,
          auditLogs: [],
          createdAt: new Date(Date.now() - 50000).toISOString(),
          updatedAt: now,
        },
        {
          id: "rel_v2_broken",
          appId: mockAppId,
          appName: "RecoveryApp",
          repositoryId: "owner/repo",
          branch: "main",
          platform: "android",
          track: "production",
          version: "1.1.0",
          buildNumber: 11,
          state: "FAILED",
          currentStageId: "build",
          stages: [],
          isSimulated: false,
          errorSummary: "Compilation error: missing native library dependency",
          auditLogs: [],
          createdAt: now,
          updatedAt: now,
        },
      ];

      releases.forEach((r) => saveRelease(r));
    });

    it("identifies previous stable release", () => {
      const stable = getPreviousStableRelease(mockAppId, "android", "rel_v2_broken");
      expect(stable).toBeDefined();
      expect(stable?.version).toBe("1.0.0");
      expect(stable?.buildNumber).toBe(10);
    });

    it("generates actionable rollback advice for broken release", () => {
      const rec = generateRollbackRecommendation("rel_v2_broken");
      expect(rec.severity).toBe("critical");
      expect(rec.suggestedAction).toContain("Restore traffic to previous stable version v1.0.0");
      expect(rec.previousStableRelease?.version).toBe("1.0.0");
      expect(rec.autoRollbackAvailable).toBe(true);
      expect(rec.remediationSteps.some((s) => s.includes("Halt Google Play phased rollout"))).toBe(true);
    });
  });
});
