import { describe, it, expect, beforeEach } from "vitest";
import {
  computeClosedTestingPrerequisites,
  addTester,
  removeTester,
  createTesterGroup,
  getTestingOverview,
  saveAllTestingData,
} from "../store";
import type { TesterRecord } from "../types";

describe("Testing & Distribution Engine (Phase 6)", () => {
  beforeEach(() => {
    saveAllTestingData([]);
  });

  describe("computeClosedTestingPrerequisites", () => {
    it("reports incomplete when under 12 testers", () => {
      const testers: TesterRecord[] = [
        { id: "1", email: "t1@test.com", groupName: "alpha", addedAt: new Date().toISOString(), status: "active" },
        { id: "2", email: "t2@test.com", groupName: "alpha", addedAt: new Date().toISOString(), status: "active" },
      ];

      const res = computeClosedTestingPrerequisites(testers, undefined);
      expect(res.requiredTesters).toBe(12);
      expect(res.currentTesters).toBe(2);
      expect(res.daysCompleted).toBe(0);
      expect(res.isEligibleForProduction).toBe(false);
      expect(res.statusSummary).toContain("10 more testers needed");
    });

    it("reports incomplete when 12 testers enrolled but fewer than 14 days elapsed", () => {
      const testers: TesterRecord[] = Array.from({ length: 14 }).map((_, i) => ({
        id: `id_${i}`,
        email: `tester_${i}@example.com`,
        groupName: "alpha",
        addedAt: new Date().toISOString(),
        status: "active",
      }));

      // 5 days ago
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const res = computeClosedTestingPrerequisites(testers, fiveDaysAgo);

      expect(res.currentTesters).toBe(14);
      expect(res.daysCompleted).toBe(5);
      expect(res.isEligibleForProduction).toBe(false);
      expect(res.statusSummary).toContain("9 days remaining");
    });

    it("reports eligible for production when 12+ testers and 14+ continuous days elapsed", () => {
      const testers: TesterRecord[] = Array.from({ length: 12 }).map((_, i) => ({
        id: `id_${i}`,
        email: `tester_${i}@domain.com`,
        groupName: "alpha",
        addedAt: new Date().toISOString(),
        status: "active",
      }));

      // 15 days ago
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
      const res = computeClosedTestingPrerequisites(testers, fifteenDaysAgo);

      expect(res.currentTesters).toBe(12);
      expect(res.daysCompleted).toBe(14);
      expect(res.isEligibleForProduction).toBe(true);
      expect(res.statusSummary).toContain("Eligible for Production release");
    });
  });

  describe("addTester and removeTester", () => {
    const testAppId = "test_app_123";

    it("adds tester to group and recalculates group tester count", () => {
      const tester = addTester(testAppId, {
        email: "alice@company.com",
        groupName: "Internal Testers",
        platform: "android",
        track: "internal-testing",
      });

      expect(tester.email).toBe("alice@company.com");
      expect(tester.groupName).toBe("Internal Testers");

      const overview = getTestingOverview(testAppId);
      const group = overview.groups.find((g) => g.name === "Internal Testers");
      expect(group).toBeDefined();
      expect(group?.testerCount).toBe(1);
      expect(group?.testers[0].email).toBe("alice@company.com");
    });

    it("deduplicates tester when added multiple times with different casing", () => {
      addTester(testAppId, { email: "bob@company.com", groupName: "Internal Testers" });
      addTester(testAppId, { email: "BOB@COMPANY.COM", groupName: "Internal Testers" });

      const overview = getTestingOverview(testAppId);
      const group = overview.groups.find((g) => g.name === "Internal Testers");
      expect(group?.testerCount).toBe(1);
    });

    it("removes tester by ID", () => {
      const tester = addTester(testAppId, { email: "charlie@company.com", groupName: "Internal Testers" });
      expect(getTestingOverview(testAppId).groups[0].testerCount).toBeGreaterThanOrEqual(1);

      const removed = removeTester(testAppId, tester.id);
      expect(removed).toBe(true);

      const overview = getTestingOverview(testAppId);
      const found = overview.groups.some((g) => g.testers.some((t) => t.id === tester.id));
      expect(found).toBe(false);
    });

    it("creates custom tester group", () => {
      const group = createTesterGroup(testAppId, {
        name: "Security Red Team",
        platform: "ios",
        track: "closed-testing",
        optInUrl: "https://testflight.apple.com/join/security",
      });

      expect(group.name).toBe("Security Red Team");
      expect(group.platform).toBe("ios");
      expect(group.optInUrl).toBe("https://testflight.apple.com/join/security");

      const overview = getTestingOverview(testAppId);
      expect(overview.groups.some((g) => g.id === group.id)).toBe(true);
    });
  });
});
