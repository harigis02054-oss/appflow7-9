import { describe, it, expect, beforeEach } from "vitest";
import { hasPermission, ROLE_PERMISSIONS, type TeamRole } from "../types";
import {
  listTeamMembers,
  addTeamMember,
  updateTeamMemberRole,
  removeTeamMember,
  saveAllTeamMembers,
} from "../store";
import {
  createReleasePipeline,
  recordReleaseApproval,
} from "../../release/orchestrator";
import { saveRelease } from "../../release/store";
import { evaluateAutomationEvent } from "../../automations/engine";
import { saveAllAutomations } from "../../automations/store";
import { listNotifications, saveAllNotifications } from "../../notifications/store";

describe("Team RBAC, Approval Gates & Automations (Phase 7)", () => {
  beforeEach(() => {
    saveAllTeamMembers([]);
    saveAllNotifications([]);
    saveAllAutomations([]);
  });

  describe("Role-Based Access Control (RBAC)", () => {
    it("owner has full administrative and release publishing capabilities", () => {
      expect(hasPermission("owner", "create_app")).toBe(true);
      expect(hasPermission("owner", "delete_app")).toBe(true);
      expect(hasPermission("owner", "manage_credentials")).toBe(true);
      expect(hasPermission("owner", "trigger_build")).toBe(true);
      expect(hasPermission("owner", "approve_release")).toBe(true);
      expect(hasPermission("owner", "publish_production")).toBe(true);
    });

    it("developer can trigger builds but cannot approve releases or publish to production", () => {
      expect(hasPermission("developer", "trigger_build")).toBe(true);
      expect(hasPermission("developer", "manage_testers")).toBe(true);
      expect(hasPermission("developer", "approve_release")).toBe(false);
      expect(hasPermission("developer", "publish_production")).toBe(false);
      expect(hasPermission("developer", "manage_credentials")).toBe(false);
    });

    it("qa lead can approve releases but cannot delete apps or manage credentials", () => {
      expect(hasPermission("qa", "approve_release")).toBe(true);
      expect(hasPermission("qa", "manage_testers")).toBe(true);
      expect(hasPermission("qa", "delete_app")).toBe(false);
      expect(hasPermission("qa", "manage_credentials")).toBe(false);
    });

    it("release manager has approval and production publishing permissions", () => {
      expect(hasPermission("release_manager", "approve_release")).toBe(true);
      expect(hasPermission("release_manager", "publish_production")).toBe(true);
      expect(hasPermission("release_manager", "trigger_build")).toBe(true);
    });

    it("viewer has read-only access to releases", () => {
      expect(hasPermission("viewer", "view_releases")).toBe(true);
      expect(hasPermission("viewer", "trigger_build")).toBe(false);
      expect(hasPermission("viewer", "approve_release")).toBe(false);
      expect(hasPermission("viewer", "manage_testers")).toBe(false);
    });
  });

  describe("Team Member Persistence", () => {
    it("adds team member and prevents duplicate by email", () => {
      const mem1 = addTeamMember({
        name: "Test User",
        email: "test@example.com",
        role: "developer",
      });
      expect(mem1.name).toBe("Test User");
      expect(mem1.role).toBe("developer");

      const mem2 = addTeamMember({
        name: "Test User Updated",
        email: "TEST@EXAMPLE.COM",
        role: "qa",
      });
      expect(mem2.id).toBe(mem1.id);
      expect(mem2.role).toBe("qa");
    });

    it("updates role and removes member", () => {
      const mem = addTeamMember({
        name: "Temporary Contributor",
        email: "temp@example.com",
        role: "viewer",
      });

      const updated = updateTeamMemberRole(mem.id, "developer");
      expect(updated?.role).toBe("developer");

      const removed = removeTeamMember(mem.id);
      expect(removed).toBe(true);
      expect(listTeamMembers().some((m) => m.id === mem.id)).toBe(false);
    });
  });

  describe("Production Release Approval Gate", () => {
    it("rejects approval attempt when actor role lacks approve_release permission", async () => {
      const release = await createReleasePipeline({
        appId: "app_rbac_test",
        appName: "Test App",
        repositoryId: "owner/test",
        platform: "android",
        track: "production",
        version: "1.0.0",
        buildNumber: 1,
      });

      const res = recordReleaseApproval(release.id, {
        decision: "approved",
        actor: "Junior Dev",
        role: "developer", // Not authorized to approve!
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("not authorized to approve releases");
    });

    it("records successful approval when role is QA or Release Manager", async () => {
      const release = await createReleasePipeline({
        appId: "app_rbac_test_2",
        appName: "Test App",
        repositoryId: "owner/test",
        platform: "android",
        track: "production",
        version: "1.0.0",
        buildNumber: 1,
      });

      const res = recordReleaseApproval(release.id, {
        decision: "approved",
        actor: "QA Lead",
        role: "qa",
        notes: "All test suites passed on physical devices.",
      });

      expect(res.success).toBe(true);
      expect(res.release?.approvalStatus).toBe("approved");
      const approveStage = res.release?.stages.find((s) => s.id === "approve");
      expect(approveStage?.status).toBe("success");
    });

    it("blocks release when rejected during review", async () => {
      const release = await createReleasePipeline({
        appId: "app_rbac_test_3",
        appName: "Test App",
        repositoryId: "owner/test",
        platform: "android",
        track: "production",
        version: "1.0.0",
        buildNumber: 1,
      });

      const res = recordReleaseApproval(release.id, {
        decision: "rejected",
        actor: "Release Manager",
        role: "release_manager",
        notes: "Performance regression observed in login screen.",
      });

      expect(res.success).toBe(true);
      expect(res.release?.approvalStatus).toBe("rejected");
      expect(res.release?.state).toBe("BLOCKED");
    });
  });

  describe("Automations Engine", () => {
    it("evaluates git push event and creates notification", async () => {
      saveAllAutomations([
        {
          id: "rule_test_push",
          name: "Push Alert",
          description: "Notifies team on main branch push",
          trigger: { type: "github_push", branch: "main" },
          actions: [{ type: "send_notification", params: { template: "New commit pushed to main" } }],
          enabled: true,
          createdAt: new Date().toISOString(),
        },
      ]);

      const results = await evaluateAutomationEvent({
        type: "github_push",
        appId: "app_auto_1",
        branch: "main",
        timestamp: new Date().toISOString(),
      });

      expect(results.length).toBe(1);
      expect(results[0].matched).toBe(true);
      expect(results[0].actionsExecuted).toContain("send_notification");

      const notifications = listNotifications();
      expect(notifications.length).toBe(1);
      expect(notifications[0].message).toBe("New commit pushed to main");
    });
  });
});
