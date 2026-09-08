"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { EmptyState, Button } from "@/components/ui";
import { getApps } from "@/lib/storage/apps";
import type { ReleaseModel, AppRecord, ReleaseTrack } from "@/lib/types";
import {
  ShieldCheck,
  ArrowUpRight,
  FlaskConical,
  Layers,
  ChevronRight,
  Plus,
  RefreshCw,
} from "lucide-react";

export default function ReleasesPage() {
  const [orchestratedReleases, setOrchestratedReleases] = useState<ReleaseModel[]>([]);
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadReleases() {
    try {
      setApps(getApps());
      const res = await fetch("/api/releases");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.releases)) {
          setOrchestratedReleases(data.releases);
        }
      }
    } catch (err) {
      console.error("Failed to load releases:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReleases();
    const interval = setInterval(loadReleases, 5000);
    return () => clearInterval(interval);
  }, []);

  const appName = (appId: string, fallbackName?: string) =>
    apps.find((a) => a.id === appId)?.name ?? fallbackName ?? appId;

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
    testflight: {
      label: "TestFlight",
      style: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    },
    "app-store": {
      label: "App Store",
      style: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    },
  };

  const stateColors: Record<string, string> = {
    CREATED: "bg-zinc-800 text-zinc-300 border-zinc-700",
    ANALYZING: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    VALIDATED: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    BUILDING: "bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse",
    BUILT: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    SIGNED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    TESTED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    READY_FOR_TESTING: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    TESTING: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    READY_FOR_REVIEW: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    APPROVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    RELEASED: "bg-emerald-500 text-black font-semibold",
    FAILED: "bg-signal-danger/10 text-signal-danger border-signal-danger/30",
    BLOCKED: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    CANCELLED: "bg-zinc-800 text-zinc-400 border-zinc-700",
  };

  return (
    <PageShell
      title="Release Pipelines"
      description="Centrally managed, multi-stage release orchestrator for Android (Google Play) and iOS (TestFlight / App Store)."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={loadReleases}
            className="text-xs h-8"
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link href="/apps">
            <Button variant="primary" className="text-xs h-8">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              New Release from App
            </Button>
          </Link>
        </div>
      }
    >
      {loading && orchestratedReleases.length === 0 ? (
        <div className="p-12 text-center text-text-muted text-xs flex items-center justify-center">
          <RefreshCw className="w-4 h-4 animate-spin mr-2" />
          Loading releases...
        </div>
      ) : orchestratedReleases.length === 0 ? (
        <EmptyState
          title="No orchestrated releases recorded yet"
          description="Navigate to an application and click 'Start Release Pipeline' to orchestrate your first release through testing and store tracks."
        />
      ) : (
        <div className="border border-border bg-panel divide-y divide-border">
          {orchestratedReleases.map((r) => {
            const trackInfo = trackStyles[r.track] || {
              label: r.track,
              style: "bg-zinc-800 text-zinc-300 border-zinc-700",
            };

            const completedStages = r.stages.filter((s) => s.status === "success").length;
            const progressPct = Math.round((completedStages / r.stages.length) * 100);

            return (
              <Link
                key={r.id}
                href={`/releases/${r.id}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3.5 hover:bg-panel-raised/60 transition-colors border-l-2 border-l-cyan-500 group gap-3"
              >
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="p-2 border bg-panel-raised border-border text-text-muted group-hover:text-text transition-colors">
                    <Layers className="w-4 h-4" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-medium text-text group-hover:text-signal-info transition-colors flex items-center gap-1">
                        {appName(r.appId, r.appName)}
                        <ArrowUpRight className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 border rounded uppercase ${trackInfo.style}`}
                      >
                        {trackInfo.label}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 border rounded uppercase ${
                          stateColors[r.state] || "bg-zinc-800 text-zinc-300 border-zinc-700"
                        }`}
                      >
                        {r.state}
                      </span>
                    </div>

                    <div className="text-[11px] text-text-muted font-mono flex items-center gap-2 mt-1 flex-wrap">
                      <span>v{r.version} (Build #{r.buildNumber})</span>
                      <span>·</span>
                      <span className="uppercase text-text-faint font-semibold">{r.platform}</span>
                      <span>·</span>
                      <span className="text-zinc-500">
                        {completedStages}/{r.stages.length} stages complete ({progressPct}%)
                      </span>
                      {r.commitSha && (
                        <>
                          <span>·</span>
                          <span className="text-zinc-500">Commit: {r.commitSha}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 self-end sm:self-center">
                  <div className="text-right hidden sm:block">
                    <div className="text-[10px] font-mono text-text-faint">
                      {new Date(r.createdAt).toLocaleString()}
                    </div>
                    <div className="text-[10px] font-mono text-text-muted mt-0.5">
                      Stage: {r.currentStageId}
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-text group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
