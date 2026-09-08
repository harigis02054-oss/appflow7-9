import { describe, it, expect } from "vitest";
import {
  buildChangeSummary,
  formatChangelogFromCommits,
} from "../changes";

describe("Git Change Tracking & Changelog Generator", () => {
  it("formats human-readable changelog bullets from commit messages", () => {
    const commits = [
      {
        sha: "a1b2c3d4e5f6",
        commit: {
          message: "feat: add secure transfer protocol\nDetailed description here",
          author: { name: "Hari Kumar", date: "2026-09-08T10:00:00Z" },
        },
        html_url: "https://github.com/test/test/commit/a1b2c3d",
      },
      {
        sha: "e5f6a1b2c3d4",
        commit: {
          message: "fix: resolve crash on background resume",
          author: { name: "Jane Developer", date: "2026-09-08T09:30:00Z" },
        },
        html_url: "https://github.com/test/test/commit/e5f6a1b",
      },
    ];

    const changelog = formatChangelogFromCommits(commits);
    expect(changelog).toContain("• a1b2c3d - feat: add secure transfer protocol (Hari Kumar)");
    expect(changelog).toContain("• e5f6a1b - fix: resolve crash on background resume (Jane Developer)");
  });

  it("calculates accurate file change statistics", () => {
    const files = [
      { filename: "lib/main.dart", status: "modified", additions: 10, deletions: 2, changes: 12 },
      { filename: "lib/new_service.dart", status: "added", additions: 50, deletions: 0, changes: 50 },
      { filename: "lib/old_service.dart", status: "removed", additions: 0, deletions: 40, changes: 40 },
    ];

    const summary = buildChangeSummary("base-sha", "head-sha", [], files);
    expect(summary.totalFilesChanged).toBe(3);
    expect(summary.filesAdded).toBe(1);
    expect(summary.filesDeleted).toBe(1);
    expect(summary.filesModified).toBe(1);
    expect(summary.summaryText).toBe("3 files changed (1 added, 1 deleted, 1 modified)");
  });
});
