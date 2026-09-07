"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { EmptyState, Button, ReadinessBar } from "@/components/ui";
import { getApps } from "@/lib/storage/apps";
import type { AppRecord } from "@/lib/types";

export default function AppsPage() {
  const [apps, setApps] = useState<AppRecord[]>([]);

  useEffect(() => {
    setApps(getApps());
  }, []);

  return (
    <PageShell
      title="Apps"
      description="Every application AppFlow is tracking, with its release readiness."
      actions={
        <Link href="/apps/new">
          <Button>+ Add application</Button>
        </Link>
      }
    >
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {apps.map((app) => (
            <Link
              key={app.id}
              href={`/apps/${app.id}`}
              className="border border-border bg-panel p-4 hover:border-border-strong transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[14px] text-text font-medium">
                  {app.name}
                </span>
                <span className="text-[12px] mono text-text-muted">
                  v{app.version}
                </span>
              </div>
              <div className="text-[12px] text-text-faint mono mb-3">
                {app.repositoryId}
              </div>
              {app.analysis && (
                <div className="space-y-2">
                  {app.analysis.hasAndroid && (
                    <ReadinessBar
                      label="Android"
                      pct={app.analysis.androidReadinessPct}
                    />
                  )}
                  {app.analysis.hasIOS && (
                    <ReadinessBar
                      label="iOS"
                      pct={app.analysis.iosReadinessPct}
                    />
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </PageShell>
  );
}
