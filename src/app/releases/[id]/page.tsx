"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui";
import type { ReleaseModel, ReleaseStage } from "@/lib/types";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Shield,
  Download,
  Terminal,
  ArrowUpRight,
  RefreshCw,
  Play,
  FileCode,
  GitCommit,
  User,
  Calendar,
  Layers,
} from "lucide-react";

export default function ReleaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [release, setRelease] = useState<ReleaseModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  async function fetchRelease() {
    try {
      const res = await fetch(`/api/releases/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Release record not found.");
        } else {
          setError(`Server returned status ${res.status}`);
        }
        return;
      }
      const data = await res.json();
      if (data.release) {
        setRelease(data.release);
        if (!selectedStageId) {
          setSelectedStageId(data.release.currentStageId || "build");
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRelease();
    const interval = setInterval(() => {
      fetchRelease();
    }, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleAdvanceToBuild() {
    if (!release) return;
    setAdvancing(true);
    try {
      const res = await fetch(`/api/releases/${id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "advance-to-build", actor: "Team Member" }),
      });
      if (res.ok) {
        await fetchRelease();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to trigger build");
      }
    } finally {
      setAdvancing(false);
    }
  }

  if (loading) {
    return (
      <PageShell title="Release Pipeline" description="Loading release details...">
        <div className="flex items-center justify-center p-12 text-text-muted">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          Loading orchestrated release...
        </div>
      </PageShell>
    );
  }

  if (error || !release) {
    return (
      <PageShell title="Release Pipeline" description="Release could not be loaded">
        <div className="border border-border bg-panel p-6 text-center">
          <p className="text-signal-danger text-[13px] mb-4">{error || "Release not found"}</p>
          <Link href="/releases">
            <Button variant="secondary">Back to Releases</Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  const selectedStage =
    release.stages.find((s) => s.id === selectedStageId) || release.stages[0];

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

  const stageIcon = (status: ReleaseStage["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-signal-success" />;
      case "running":
        return <RefreshCw className="w-4 h-4 text-signal-warning animate-spin" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-signal-danger" />;
      case "blocked":
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-signal-warning" />;
      default:
        return <div className="w-2 h-2 rounded-full bg-border" />;
    }
  };

  const completedStages = release.stages.filter((s) => s.status === "success").length;
  const progressPct = Math.round((completedStages / release.stages.length) * 100);

  return (
    <PageShell
      title={`Release v${release.version}`}
      description={`Orchestrated pipeline for ${release.appName} (${release.platform.toUpperCase()})`}
      actions={
        <div className="flex items-center gap-2">
          <Link href="/releases">
            <Button variant="secondary" className="text-xs h-8">
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              All Releases
            </Button>
          </Link>
          {release.state === "CREATED" && (
            <Button
              variant="primary"
              onClick={handleAdvanceToBuild}
              disabled={advancing}
              className="text-xs h-8"
            >
              <Play className="w-3.5 h-3.5 mr-1.5" />
              {advancing ? "Triggering..." : "Start Pipeline & Build"}
            </Button>
          )}
          {release.buildId && (
            <Link href={`/apps/${release.appId}?openConsole=${release.buildId}`}>
              <Button variant="secondary" className="text-xs h-8">
                <Terminal className="w-3.5 h-3.5 mr-1.5" />
                Build Console
              </Button>
            </Link>
          )}
        </div>
      }
    >
      {/* ── Metadata Header Bar ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="border border-border bg-panel p-3.5">
          <div className="text-[11px] text-text-muted font-mono uppercase">State Machine</div>
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className={`text-[11px] font-mono px-2 py-0.5 border rounded uppercase ${
                stateColors[release.state] || "bg-zinc-800 text-zinc-300"
              }`}
            >
              {release.state}
            </span>
          </div>
        </div>

        <div className="border border-border bg-panel p-3.5">
          <div className="text-[11px] text-text-muted font-mono uppercase">Platform & Track</div>
          <div className="text-[13px] font-medium text-text mt-1.5 flex items-center gap-1.5">
            <span className="uppercase font-mono text-[11px] px-1.5 py-0.5 border border-border bg-panel-raised rounded">
              {release.platform}
            </span>
            <span className="text-text-muted font-mono text-[11px]">·</span>
            <span className="text-[12px]">{release.track}</span>
          </div>
        </div>

        <div className="border border-border bg-panel p-3.5">
          <div className="text-[11px] text-text-muted font-mono uppercase">Version Target</div>
          <div className="text-[13px] font-mono font-medium text-text mt-1.5">
            v{release.version} (Build #{release.buildNumber})
          </div>
        </div>

        <div className="border border-border bg-panel p-3.5">
          <div className="text-[11px] text-text-muted font-mono uppercase">Pipeline Progress</div>
          <div className="text-[13px] font-mono font-medium text-text mt-1.5 flex items-center gap-2">
            <span>{progressPct}%</span>
            <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-signal-success transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Visual Release Pipeline (11 Stages) ─────────────────────────── */}
      <div className="border border-border bg-panel p-4 mb-6">
        <div className="text-[12px] font-mono text-text-muted uppercase mb-3 flex items-center justify-between">
          <span>Release Pipeline Stages ({completedStages}/{release.stages.length} Completed)</span>
          <span className="text-text-faint text-[11px]">Click stage for details & logs</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-11 gap-2">
          {release.stages.map((stage, idx) => {
            const isSelected = stage.id === selectedStageId;
            const isCurrent = stage.id === release.currentStageId;

            return (
              <button
                key={stage.id}
                onClick={() => setSelectedStageId(stage.id)}
                className={`text-left p-2.5 border transition-all text-xs flex flex-col justify-between min-h-[90px] ${
                  isSelected
                    ? "border-signal-info bg-signal-info/10 shadow-sm"
                    : isCurrent
                    ? "border-signal-warning/50 bg-signal-warning/5"
                    : "border-border bg-panel-raised/40 hover:bg-panel-raised"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono text-text-muted">
                      {(idx + 1).toString().padStart(2, "0")}
                    </span>
                    {stageIcon(stage.status)}
                  </div>
                  <div className="text-[11px] font-medium text-text line-clamp-2 leading-tight">
                    {stage.name}
                  </div>
                </div>

                <div className="text-[10px] font-mono text-text-muted uppercase mt-2">
                  {stage.status}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Stage Details & Inspector ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Stage Description & Logs (2 Cols) */}
        <div className="lg:col-span-2 border border-border bg-panel p-4">
          <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
            <div className="flex items-center gap-2">
              {stageIcon(selectedStage.status)}
              <h3 className="text-sm font-medium text-text">{selectedStage.name}</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 border border-border bg-panel-raised rounded uppercase text-text-muted">
                {selectedStage.status}
              </span>
            </div>
            {selectedStage.durationMs && (
              <span className="text-[11px] font-mono text-text-muted">
                {(selectedStage.durationMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>

          <p className="text-[12px] text-text-muted mb-4">{selectedStage.description}</p>

          {selectedStage.error && (
            <div className="p-3 border border-signal-danger/30 bg-signal-danger/10 text-signal-danger text-xs font-mono mb-4 rounded">
              <strong>Error:</strong> {selectedStage.error}
            </div>
          )}

          {selectedStage.warnings && selectedStage.warnings.length > 0 && (
            <div className="p-3 border border-signal-warning/30 bg-signal-warning/10 text-signal-warning text-xs font-mono mb-4 rounded">
              <strong>Warnings:</strong>
              <ul className="list-disc ml-4 mt-1">
                {selectedStage.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-[11px] font-mono text-text-faint uppercase mb-1.5">
            Stage Execution Log
          </div>
          <div className="border border-border bg-black/60 p-3 font-mono text-[11px] text-text-muted min-h-[160px] max-h-[260px] overflow-y-auto rounded">
            {selectedStage.logs && selectedStage.logs.length > 0 ? (
              selectedStage.logs.map((log, i) => (
                <div key={i} className="leading-relaxed py-0.5">
                  {log}
                </div>
              ))
            ) : (
              <div className="text-text-faint italic py-4 text-center">
                No logs recorded for this stage yet.
              </div>
            )}
          </div>
        </div>

        {/* Git & Artifact Cards (1 Col) */}
        <div className="space-y-4">
          {/* Artifact Card */}
          <div className="border border-border bg-panel p-4">
            <h4 className="text-xs font-mono uppercase text-text-muted mb-3 flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5" />
              Build Artifact
            </h4>

            {release.artifactName ? (
              <div className="space-y-2">
                <div className="text-[12px] font-mono text-text truncate">
                  {release.artifactName}
                </div>
                <div className="text-[11px] font-mono text-text-muted">
                  Size: {((release.artifactSize || 0) / (1024 * 1024)).toFixed(2)} MB
                </div>
                {release.buildId && (
                  <a
                    href={`/api/builds/${release.buildId}/artifact`}
                    download
                    className="inline-flex items-center justify-center w-full px-3 py-1.5 text-xs font-medium border border-border bg-panel-raised hover:bg-panel-hover text-text transition-colors rounded mt-2"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5 text-signal-success" />
                    Download Binary Package
                  </a>
                )}
              </div>
            ) : (
              <div className="text-[11px] text-text-muted italic">
                Artifact pending compilation.
              </div>
            )}
          </div>

          {/* Git Commit Card */}
          <div className="border border-border bg-panel p-4">
            <h4 className="text-xs font-mono uppercase text-text-muted mb-3 flex items-center gap-1.5">
              <GitCommit className="w-3.5 h-3.5" />
              Git Source
            </h4>
            <div className="text-[12px] space-y-1.5 text-text-muted">
              <div>
                <span className="text-text-faint">Repo: </span>
                <span className="text-text font-mono text-[11px]">{release.repositoryId}</span>
              </div>
              <div>
                <span className="text-text-faint">Branch: </span>
                <span className="text-text font-mono text-[11px]">{release.branch}</span>
              </div>
              {release.commitSha && (
                <div>
                  <span className="text-text-faint">Commit: </span>
                  <span className="text-text font-mono text-[11px]">{release.commitSha}</span>
                </div>
              )}
              {release.commitAuthor && (
                <div>
                  <span className="text-text-faint">Author: </span>
                  <span className="text-text">{release.commitAuthor}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Audit Trail ──────────────────────────────────────────────── */}
      <div className="border border-border bg-panel p-4">
        <h3 className="text-xs font-mono uppercase text-text-muted mb-3 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Release Audit History
        </h3>

        <div className="divide-y divide-border border border-border">
          {release.auditLogs && release.auditLogs.length > 0 ? (
            release.auditLogs.map((audit) => (
              <div
                key={audit.id}
                className="px-3.5 py-2.5 flex items-center justify-between text-xs hover:bg-panel-raised/30 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text">{audit.action}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 border border-border bg-panel-raised rounded text-text-muted">
                      {audit.actor}
                    </span>
                  </div>
                  {audit.details && (
                    <div className="text-[11px] text-text-muted mt-0.5 font-mono">
                      {audit.details}
                    </div>
                  )}
                </div>
                <div className="text-[10px] font-mono text-text-faint">
                  {new Date(audit.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-text-faint text-xs">No audit events logged.</div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
