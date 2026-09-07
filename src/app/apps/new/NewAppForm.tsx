"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { Button, ReadinessBar } from "@/components/ui";
import { upsertRepository } from "@/lib/storage/repositories";
import { createApp } from "@/lib/storage/apps";
import { logActivity } from "@/lib/storage/activity";
import type { RepositoryAnalysis } from "@/lib/types";

export default function NewAppForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [repoInput, setRepoInput] = useState(searchParams.get("repo") ?? "");
  const [analysis, setAnalysis] = useState<RepositoryAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appName, setAppName] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");

  async function runAnalysis(repoId: string) {
    if (!repoId.includes("/")) {
      setError('Enter a repository as "owner/repo"');
      return;
    }
    const [owner, repo] = repoId.split("/");
    setAnalyzing(true);
    setError(null);
    setAnalysis(null);
    try {
      const res = await fetch(
        `/api/github/repos/${owner}/${repo}/analyze?ref=${defaultBranch}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setAnalysis(data.analysis);
      if (!appName) setAppName(repo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  useEffect(() => {
    if (repoInput.includes("/")) {
      runAnalysis(repoInput);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCreate() {
    if (!analysis || !repoInput.includes("/")) return;
    const [owner, name] = repoInput.split("/");

    upsertRepository({
      id: repoInput,
      owner,
      name,
      defaultBranch,
      htmlUrl: `https://github.com/${repoInput}`,
      private: false,
    });

    const app = createApp({
      name: appName || name,
      repositoryId: repoInput,
      version: analysis.currentVersion ?? "1.0.0",
      androidBuildNumber: analysis.versionCode ?? 1,
      androidPackage: analysis.androidPackage,
      iosBundleId: analysis.iosBundleId,
      analysis,
    });

    logActivity(`Created application "${app.name}" from ${repoInput}`, "success", app.id);
    router.push(`/apps/${app.id}`);
  }

  return (
    <PageShell
      title="Add application"
      description="Connect a repository and AppFlow will detect its framework and release readiness."
    >
      <div className="max-w-xl">
        <label className="block text-[12px] text-text-muted mb-1">
          Repository (owner/repo)
        </label>
        <div className="flex gap-2 mb-4">
          <input
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder="harigjs02054-oss/quick-app"
            className="flex-1 bg-panel border border-border-strong px-3 py-2 text-[13px] mono text-text placeholder:text-text-faint focus:outline-none focus:border-signal-info"
          />
          <Button
            variant="secondary"
            onClick={() => runAnalysis(repoInput)}
            disabled={analyzing}
          >
            {analyzing ? "Analyzing…" : "Analyze"}
          </Button>
        </div>

        {error && (
          <div className="border border-signal-danger/40 bg-signal-danger/10 text-signal-danger text-[13px] px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {analysis && (
          <div className="border border-border bg-panel p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] text-text font-medium">
                Project detected
              </span>
              <span className="text-[12px] mono text-text-muted">
                {analysis.framework}
              </span>
            </div>

            <div className="space-y-3 mb-4">
              {analysis.hasAndroid && (
                <ReadinessBar label="Android" pct={analysis.androidReadinessPct} />
              )}
              {analysis.hasIOS && (
                <ReadinessBar label="iOS" pct={analysis.iosReadinessPct} />
              )}
              {!analysis.hasAndroid && !analysis.hasIOS && (
                <p className="text-[12px] text-text-faint">
                  No Android or iOS project detected at the repository root.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <div>
                <div className="text-text-faint mb-1">Android</div>
                {analysis.androidChecks.map((c) => (
                  <div key={c.id} className="flex items-center gap-1.5">
                    <span
                      className={c.found ? "text-signal-success" : "text-signal-danger"}
                    >
                      {c.found ? "✓" : "✗"}
                    </span>
                    <span className="text-text-muted">{c.label}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-text-faint mb-1">iOS</div>
                {analysis.iosChecks.map((c) => (
                  <div key={c.id} className="flex items-center gap-1.5">
                    <span
                      className={c.found ? "text-signal-success" : "text-signal-danger"}
                    >
                      {c.found ? "✓" : "✗"}
                    </span>
                    <span className="text-text-muted">{c.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-text-faint mt-4">
              Missing files won&apos;t block you from creating the app or
              running test builds — they just lower the release readiness
              score above.
            </p>
          </div>
        )}

        {analysis && (
          <>
            <label className="block text-[12px] text-text-muted mb-1">
              Application name
            </label>
            <input
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="w-full bg-panel border border-border-strong px-3 py-2 text-[13px] text-text mb-4 focus:outline-none focus:border-signal-info"
            />
            <label className="block text-[12px] text-text-muted mb-1">
              Default branch
            </label>
            <input
              value={defaultBranch}
              onChange={(e) => setDefaultBranch(e.target.value)}
              className="w-full bg-panel border border-border-strong px-3 py-2 text-[13px] mono text-text mb-6 focus:outline-none focus:border-signal-info"
            />
            <Button onClick={handleCreate}>Create application</Button>
          </>
        )}
      </div>
    </PageShell>
  );
}
