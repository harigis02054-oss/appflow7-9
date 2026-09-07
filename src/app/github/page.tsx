"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { EmptyState, Button } from "@/components/ui";

interface RepoSummary {
  id: string;
  owner: string;
  name: string;
  defaultBranch: string;
  private: boolean;
  htmlUrl: string;
  updatedAt: string;
}

export default function GitHubPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [repos, setRepos] = useState<RepoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const statusRes = await fetch("/api/github/status");
      const status = await statusRes.json();
      setConfigured(status.configured);

      if (!status.configured) {
        setLoading(false);
        return;
      }

      const reposRes = await fetch("/api/github/repos");
      if (!reposRes.ok) {
        const body = await reposRes.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${reposRes.status})`);
      }
      const data = await reposRes.json();
      setRepos(data.repositories);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <PageShell
      title="GitHub"
      description="Repositories visible to the server-side token in .env.local."
      actions={
        <Button variant="secondary" onClick={load} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      }
    >
      {configured === false && (
        <EmptyState
          title="GitHub isn't connected yet"
          description="Add GITHUB_TOKEN to .env.local on the server and restart the dev server. The token never touches the browser — only this Next.js server reads it."
          action={
            <Link href="/credentials">
              <Button variant="secondary">Go to Credentials</Button>
            </Link>
          }
        />
      )}

      {error && (
        <div className="border border-signal-danger/40 bg-signal-danger/10 text-signal-danger text-[13px] px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {configured && !error && repos.length === 0 && !loading && (
        <EmptyState
          title="No repositories found"
          description="The token is configured, but GitHub returned no repositories for this account."
        />
      )}

      {repos.length > 0 && (
        <div className="border border-border bg-panel divide-y divide-border">
          {repos.map((repo) => (
            <div
              key={repo.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div>
                <div className="text-[13px] text-text mono">{repo.id}</div>
                <div className="text-[12px] text-text-faint">
                  default branch: {repo.defaultBranch}
                  {repo.private && " · private"}
                </div>
              </div>
              <Link href={`/apps/new?repo=${encodeURIComponent(repo.id)}`}>
                <Button variant="secondary">Connect</Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
