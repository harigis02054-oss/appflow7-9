"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { StatCard, EmptyState, Button } from "@/components/ui";
import { getApps } from "@/lib/storage/apps";
import { getBuilds } from "@/lib/storage/builds";
import { getReleases } from "@/lib/storage/releases";
import { getActivity } from "@/lib/storage/activity";
import type { AppRecord, BuildRecord, ReleaseRecord, ActivityEntry } from "@/lib/types";

export default function DashboardPage() {
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [builds, setBuilds] = useState<BuildRecord[]>([]);
  const [releases, setReleases] = useState<ReleaseRecord[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    setApps(getApps());
    setBuilds(getBuilds());
    setReleases(getReleases());
    setActivity(getActivity());
  }, []);

  const failedBuilds = builds.filter((b) => b.status === "failed").length;

  return (
    <PageShell
      title="Dashboard"
      description="Overview of every app, build, and release AppFlow is tracking."
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard label="Apps" value={apps.length} />
        <StatCard label="Builds" value={builds.length} tone="building" />
        <StatCard label="Releases" value={releases.length} tone="success" />
        <StatCard
          label="Failed builds"
          value={failedBuilds}
          tone={failedBuilds > 0 ? "danger" : "idle"}
        />
      </div>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-medium text-text-muted uppercase tracking-wide">
            Applications
          </h2>
          <Link href="/apps">
            <span className="text-[12px] text-signal-info hover:underline">
              View all
            </span>
          </Link>
        </div>

        {apps.length === 0 ? (
          <EmptyState
            title="No applications yet"
            description="Connect a GitHub repository to detect its project type and start tracking builds and releases."
            action={
              <Link href="/apps/new">
                <Button>+ Add application</Button>
              </Link>
            }
          />
        ) : (
          <div className="border border-border bg-panel divide-y divide-border">
            {apps.slice(0, 5).map((app) => (
              <Link
                key={app.id}
                href={`/apps/${app.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-panel-raised/50"
              >
                <div>
                  <div className="text-[13px] text-text">{app.name}</div>
                  <div className="text-[12px] text-text-faint mono">
                    {app.repositoryId}
                  </div>
                </div>
                <div className="text-[12px] text-text-muted mono">
                  v{app.version}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[13px] font-medium text-text-muted uppercase tracking-wide mb-3">
          Recent activity
        </h2>
        {activity.length === 0 ? (
          <p className="text-[13px] text-text-faint">
            Nothing has happened yet.
          </p>
        ) : (
          <div className="border border-border bg-panel divide-y divide-border">
            {activity.slice(0, 8).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 px-4 py-2.5 text-[13px]"
              >
                <span
                  className={`w-1.5 h-1.5 shrink-0 ${
                    {
                      info: "bg-signal-info",
                      success: "bg-signal-success",
                      warning: "bg-signal-building",
                      danger: "bg-signal-danger",
                    }[entry.severity]
                  }`}
                />
                <span className="text-text">{entry.message}</span>
                <span className="ml-auto text-text-faint mono text-[11px]">
                  {new Date(entry.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
