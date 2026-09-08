import { compareCommits, GitHubCommit, GitHubCompareFile } from "./client";

export interface ReleaseChangeSummary {
  baseCommit: string;
  headCommit: string;
  totalCommits: number;
  totalFilesChanged: number;
  filesAdded: number;
  filesDeleted: number;
  filesModified: number;
  summaryText: string;
  files: {
    name: string;
    status: string;
    additions: number;
    deletions: number;
  }[];
  changelogNotes: string;
}

export function formatChangelogFromCommits(commits: GitHubCommit[]): string {
  if (!commits || commits.length === 0) {
    return "No changes recorded.";
  }

  const lines = commits.map((c) => {
    const msg = c.commit.message.split("\n")[0].trim();
    const author = c.commit.author.name;
    const shortSha = c.sha.slice(0, 7);
    return `• ${shortSha} - ${msg} (${author})`;
  });

  return lines.join("\n");
}

export function buildChangeSummary(
  baseCommit: string,
  headCommit: string,
  commits: GitHubCommit[],
  files: GitHubCompareFile[]
): ReleaseChangeSummary {
  let added = 0;
  let deleted = 0;
  let modified = 0;

  for (const f of files) {
    if (f.status === "added") added++;
    else if (f.status === "removed") deleted++;
    else modified++;
  }

  const summaryText = `${files.length} files changed (${added} added, ${deleted} deleted, ${modified} modified)`;
  const changelogNotes = formatChangelogFromCommits(commits);

  return {
    baseCommit,
    headCommit,
    totalCommits: commits.length,
    totalFilesChanged: files.length,
    filesAdded: added,
    filesDeleted: deleted,
    filesModified: modified,
    summaryText,
    files: files.map((f) => ({
      name: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
    })),
    changelogNotes,
  };
}

export async function getReleaseChanges(
  owner: string,
  repo: string,
  baseCommit: string,
  headCommit: string
): Promise<ReleaseChangeSummary | null> {
  try {
    const compare = await compareCommits(owner, repo, baseCommit, headCommit);
    return buildChangeSummary(baseCommit, headCommit, compare.commits || [], compare.files || []);
  } catch (err) {
    console.error(`[github-changes] Failed to compare ${baseCommit}...${headCommit}:`, err);
    return null;
  }
}
