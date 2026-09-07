"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { EmptyState } from "@/components/ui";
import { getReleases, createRelease } from "@/lib/storage/releases";
import { getApps } from "@/lib/storage/apps";
import type { ReleaseRecord, AppRecord, ReleaseTrack, Platform } from "@/lib/types";
import { ShieldCheck, ArrowUpRight, FlaskConical } from "lucide-react";

export default function ReleasesPage() {
  const [releases, setReleases] = useState<ReleaseRecord[]>([]);
  const [apps, setApps] = useState<AppRecord[]>([]);

  function refresh() {
    setReleases(getReleases());
    setApps(getApps());
  }

  useEffect(() => {
    refresh();

    // Check server builds for published releases
    async function syncPublished() {
      try {
        const res = await fetch("/api/builds");
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.builds)) {
          interface ServerPublishedBuild {
            id: string;
            appId: string;
            platform?: Platform;
            googlePlayPublishStatus?: string;
            googlePlayPublishedTrack?: string;
            version: string;
            buildNumber: number;
            isDemoArtifact?: boolean;
          }
          const published = data.builds.filter(
            (b: ServerPublishedBuild) => b.googlePlayPublishStatus === "success"
          );
          const currentReleases = getReleases();

          published.forEach((pb: ServerPublishedBuild) => {
            const exists = currentReleases.some((r) => r.buildId === pb.id);
            if (!exists) {
              createRelease({
                appId: pb.appId,
                platform: pb.platform || "android",
                track: (pb.googlePlayPublishedTrack || "internal-testing") as ReleaseTrack,
                version: pb.version,
                buildNumber: pb.buildNumber,
                buildId: pb.id,
                status: "success",
                isSimulated: Boolean(pb.isDemoArtifact),
              });
            }
          });
          refresh();
        }
      } catch {}
    }
    syncPublished();
  }, []);

  const appName = (appId: string) =>
    apps.find((a) => a.id === appId)?.name ?? appId;

  const trackStyles: Record<string, { label: string; style: string }> = {
    "internal-testing": {
      label: "Internal Testing",
      style: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    },
    "closed-testing": {
      label: "Closed (Alpha)",
      style: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    },
    production: {
      label: "Production",
      style: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    },
  };

  return (
    <PageShell
      title="Releases"
      description="Track-by-track rollouts to Google Play Console and App Store Connect."
    >
      {releases.length === 0 ? (
        <EmptyState
          title="No releases recorded yet"
          description="Build an application and click 'Publish to Google Play' to deploy your first release track."
        />
      ) : (
        <div className="border border-border bg-panel divide-y divide-border">
          {releases.map((r) => {
            const trackInfo = trackStyles[r.track] || {
              label: r.track,
              style: "bg-zinc-800 text-zinc-300 border-zinc-700",
            };

            const isSimulated = Boolean(r.isSimulated);

            return (
              <div
                key={r.id}
                className={`flex items-center justify-between px-4 py-3.5 hover:bg-panel-raised/50 transition-colors ${
                  isSimulated ? "border-l-2 border-l-amber-500/60" : "border-l-2 border-l-emerald-500"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-2 border ${
                      isSimulated
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    }`}
                  >
                    {isSimulated ? (
                      <FlaskConical className="w-4 h-4" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/apps/${r.appId}`}
                        className="text-[13px] font-medium text-text hover:text-signal-info flex items-center gap-1"
                      >
                        {appName(r.appId)}
                        <ArrowUpRight className="w-3 h-3 text-text-muted" />
                      </Link>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 border rounded uppercase ${trackInfo.style}`}
                      >
                        {trackInfo.label}
                      </span>
                    </div>

                    <div className="text-[11px] text-text-muted font-mono flex items-center gap-2 mt-1">
                      <span>v{r.version} (Build #{r.buildNumber})</span>
                      <span>·</span>
                      <span className="uppercase text-text-faint">{r.platform}</span>
                      {r.buildId && (
                        <>
                          <span>·</span>
                          <span className="text-zinc-500">
                            Build: {r.buildId.slice(0, 14)}
                          </span>
                        </>
                      )}
                      {isSimulated && (
                        <span className="text-amber-400/90 font-sans italic">
                          (Simulated test release · did not upload to Google Play)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {isSimulated ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-amber-400 px-2 py-0.5 border border-dashed border-amber-500/40 rounded">
                      Simulated Release
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-signal-success font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-signal-success" />
                      Google Play Verified
                    </span>
                  )}

                  <span className="text-[11px] text-text-faint mono">
                    {new Date(r.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
