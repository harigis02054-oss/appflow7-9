// Server-only GitHub client.
//
// IMPORTANT: this file reads GITHUB_TOKEN from process.env and must only
// ever run on the server (Next.js route handlers under src/app/api/**).
// Never import this from a "use client" component or expose the token to
// the browser. The UI talks to /api/github/*, and those routes call the
// functions here.

const GITHUB_API = "https://api.github.com";

export class GitHubNotConfiguredError extends Error {
  constructor() {
    super("GITHUB_TOKEN is not set on the server. Add it to .env.local.");
    this.name = "GitHubNotConfiguredError";
  }
}

export class GitHubApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
  }
}

function getToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new GitHubNotConfiguredError();
  return token;
}

async function ghFetch<T>(path: string): Promise<T> {
  const token = getToken();
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    // Repo lists/branches/commits change; avoid stale Next.js data cache.
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GitHubApiError(
      `GitHub API ${path} failed: ${res.status} ${res.statusText} ${body}`,
      res.status
    );
  }
  return res.json() as Promise<T>;
}

export interface GitHubRepoSummary {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  default_branch: string;
  private: boolean;
  html_url: string;
  updated_at: string;
}

export function isGitHubConfigured(): boolean {
  return Boolean(process.env.GITHUB_TOKEN);
}

export async function listRepositories(): Promise<GitHubRepoSummary[]> {
  // /user/repos covers all repos the token's owner has access to.
  return ghFetch<GitHubRepoSummary[]>(
    "/user/repos?per_page=100&sort=updated&affiliation=owner"
  );
}

export interface GitHubBranch {
  name: string;
  commit: { sha: string };
}

export async function getBranches(
  owner: string,
  repo: string
): Promise<GitHubBranch[]> {
  return ghFetch<GitHubBranch[]>(`/repos/${owner}/${repo}/branches`);
}

export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
  html_url: string;
}

export interface GitHubCompareFile {
  filename: string;
  status: "added" | "removed" | "modified" | "renamed" | string;
  additions: number;
  deletions: number;
  changes: number;
}

export interface GitHubCompareResult {
  status: string;
  total_commits: number;
  commits: GitHubCommit[];
  files: GitHubCompareFile[];
}

export async function compareCommits(
  owner: string,
  repo: string,
  base: string,
  head: string
): Promise<GitHubCompareResult> {
  return ghFetch<GitHubCompareResult>(
    `/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`
  );
}

export async function getCommits(
  owner: string,
  repo: string,
  branch: string,
  perPage = 10
): Promise<GitHubCommit[]> {
  return ghFetch<GitHubCommit[]>(
    `/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(
      branch
    )}&per_page=${perPage}`
  );
}

export interface GitHubContentFile {
  type: "file" | "dir" | "symlink" | "submodule";
  name: string;
  path: string;
  content?: string; // base64, only present for files fetched directly
  encoding?: string;
}

/**
 * Fetches a single file or directory listing. Returns null on 404
 * instead of throwing, since "file not found" is an expected outcome
 * when probing for optional project files.
 */
export async function getContents(
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<GitHubContentFile | GitHubContentFile[] | null> {
  try {
    const qs = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    return await ghFetch<GitHubContentFile | GitHubContentFile[]>(
      `/repos/${owner}/${repo}/contents/${path}${qs}`
    );
  } catch (err) {
    if (err instanceof GitHubApiError && err.status === 404) return null;
    throw err;
  }
}

export async function getFileText(
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<string | null> {
  const result = await getContents(owner, repo, path, ref);
  if (!result || Array.isArray(result) || !result.content) return null;
  return Buffer.from(result.content, "base64").toString("utf-8");
}

export async function pathExists(
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<boolean> {
  const result = await getContents(owner, repo, path, ref);
  return result !== null;
}
