"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { EmptyState, BuildStatusBadge } from "@/components/ui";
import { getBuilds, createBuild, updateBuild } from "@/lib/storage/builds";
import { getApps } from "@/lib/storage/apps";
import type { BuildRecord, AppRecord } from "@/lib/types";
import { BuildConsole } from "@/components/BuildConsole";
import { Terminal, Download, ShieldCheck } from "lucide-react";

export default function BuildsPage() {
  const [builds, setBuilds] = useState<BuildRecord[]>([]);
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [consoleBuildId, setConsoleBuildId] = useState<string | null>(null);

  function refresh() {
    setBuilds(getBuilds());
    setApps(getApps());
  }

  useEffect(() => {
    refresh();

    // Sync server builds
    async function syncServer() {
      try {
        const res = await fetch("/api/builds");
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.builds)) {
          interface ServerBuildListItem {
            id: string;
            appId: string;
            platform: "android" | "ios";
            status: "running" | "success" | "failed" | "cancelled" | "blocked";
            version: string;
            buildNumber: number;
            startedAt: string;
            completedAt?: string;
            durationMs?: number;
            artifactPath?: string;
            artifactName?: string;
            artifactSize?: number;
            googlePlayPublishStatus?: "success" | "failed" | "simulated";
            googlePlayPublishedTrack?: string;
          }
          data.builds.forEach((sb: ServerBuildListItem) => {
            const existing = getBuilds().find((b) => b.id === sb.id);
            if (!existing) {
              createBuild({
                id: sb.id,
                appId: sb.appId,
                platform: sb.platform,
                status: sb.status,
                version: sb.version,
                buildNumber: sb.buildNumber,
                startedAt: sb.startedAt,
                completedAt: sb.completedAt,
                durationMs: sb.durationMs,
                artifactPath: sb.artifactPath,
                artifactName: sb.artifactName,
                artifactSize: sb.artifactSize,
                googlePlayPublishStatus: sb.googlePlayPublishStatus,
                googlePlayPublishedTrack: sb.googlePlayPublishedTrack,
              });
            } else {
              updateBuild(sb.id, {
                status: sb.status,
                completedAt: sb.completedAt,
                durationMs: sb.durationMs,
                artifactPath: sb.artifactPath,
                artifactName: sb.artifactName,
                artifactSize: sb.artifactSize,
                googlePlayPublishStatus: sb.googlePlayPublishStatus,
                googlePlayPublishedTrack: sb.googlePlayPublishedTrack,
              });
            }
          });
          refresh();
        }
      } catch {}
    }

    syncServer();
  }, []);

  const appName = (appId: string) =>
    apps.find((a) => a.id === appId)?.name ?? appId;

  return (
    <PageShell
      title="Builds"
      description="Every build recorded across all applications, newest first."
    >
      {builds.length === 0 ? (
        <EmptyState
          title="No builds yet"
          description="Start a build from an application page to see it appear here."
        />
      ) : (
        <div className="border border-border bg-panel divide-y divide-border">
          {builds.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-panel-raised/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="mono text-text-faint uppercase text-[11px] w-14">
                  {b.platform}
                </span>
                <div>
                  <Link
                    href={`/apps/${b.appId}`}
                    className="text-[13px] text-text hover:text-signal-info font-medium"
                  >
                    {appName(b.appId)}
                  </Link>
                  <div className="text-[11px] text-text-faint mono flex items-center gap-2 mt-0.5">
                    <span>v{b.version} ({b.buildNumber})</span>
                    <span>·</span>
                    <span>{b.id.slice(0, 16)}</span>
                    {b.commitSha && (
                      <span className="text-cyan-400/90">· {b.commitSha}</span>
                    )}
                    {b.durationMs && (
                      <span>· {(b.durationMs / 1000).toFixed(1)}s</span>
                    )}
                    {b.isDemoArtifact && (
                      <span className="text-amber-400 font-sans italic">· (demo mode)</span>
                    )}
                    {b.googlePlayPublishStatus === "success" && (
                      <span className="text-signal-success flex items-center gap-1 font-sans">
                        · <ShieldCheck className="w-3 h-3" /> Published ({b.googlePlayPublishedTrack || "internal"})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <BuildStatusBadge status={b.status} />

                {/* Download artifact */}
                {b.status === "success" && (
                  <a
                    href={`/api/builds/${b.id}/artifact`}
                    download
                    className="p-1.5 text-zinc-400 hover:text-cyan-400 border border-border hover:border-cyan-500/50 transition-colors"
                    title="Download bundle package"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                )}

                {/* Open Console */}
                <button
                  onClick={() => setConsoleBuildId(b.id)}
                  className="p-1.5 text-zinc-400 hover:text-white border border-border hover:border-zinc-500 transition-colors"
                  title="View console logs"
                >
                  <Terminal className="w-3.5 h-3.5" />
                </button>

                <span className="text-[11px] text-text-faint mono hidden sm:inline">
                  {new Date(b.startedAt).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {consoleBuildId && (
        <BuildConsole
          buildId={consoleBuildId}
          isOpen={Boolean(consoleBuildId)}
          onClose={() => setConsoleBuildId(null)}
        />
      )}
    </PageShell>
  );
}
