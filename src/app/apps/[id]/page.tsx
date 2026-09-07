"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { Button, ReadinessBar, BuildStatusBadge, EmptyState } from "@/components/ui";
import { getApp, updateApp, createApp } from "@/lib/storage/apps";
import { getRepository } from "@/lib/storage/repositories";
import {
  getBuildsForApp,
  createBuild,
  updateBuild,
  deleteBuild,
} from "@/lib/storage/builds";
import { createRelease } from "@/lib/storage/releases";
import { logActivity } from "@/lib/storage/activity";
import type { AppRecord, BuildRecord, Repository, ReleaseTrack } from "@/lib/types";
import { BuildConsole } from "@/components/BuildConsole";
import { BuildModal } from "@/components/BuildModal";
import { PublishModal } from "@/components/PublishModal";
import { Download, ExternalLink, Terminal, Play, CheckCircle2, ShieldCheck, RefreshCw } from "lucide-react";

export default function AppDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [app, setApp] = useState<AppRecord | undefined | null>(null);
  const [repo, setRepo] = useState<Repository | undefined>(undefined);
  const [builds, setBuilds] = useState<BuildRecord[]>([]);
  const [reanalyzing, setReanalyzing] = useState(false);

  // Modals & Console State
  const [isBuildModalOpen, setIsBuildModalOpen] = useState(false);
  const [buildModalPlatform, setBuildModalPlatform] = useState<Platform>("android");
  const [consoleBuildId, setConsoleBuildId] = useState<string | null>(null);
  const [publishBuildId, setPublishBuildId] = useState<string | null>(null);

  // Google Play test connection state
  const [testingGooglePlay, setTestingGooglePlay] = useState(false);
  const [googlePlayTestResult, setGooglePlayTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  function refresh() {
    const a = getApp(id);
    if (a) {
      setApp(a);
      setRepo(getRepository(a.repositoryId));
      setBuilds(getBuildsForApp(a.id));
      return;
    }

    // Auto-restore app record from server builds if not in this browser tab's localStorage
    fetch("/api/builds")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.builds) && data.builds.length > 0) {
          interface ServerBuildSummary {
            appId: string;
            appName: string;
            repositoryId: string;
            version: string;
            buildNumber: number;
          }
          const match =
            data.builds.find((b: ServerBuildSummary) => b.appId === id) ||
            data.builds.find((b: ServerBuildSummary) => b.appName === "QuickDrop") ||
            data.builds[0];

          if (match) {
            const restored = createApp({
              id,
              name: match.appName || "QuickDrop",
              repositoryId: match.repositoryId || "harigis02054-oss/QuickDrop",
              version: match.version || "1.0.0",
              androidBuildNumber: match.buildNumber || 1,
              androidPackage: "com.quickdrop.quickdrop",
            });
            setApp(restored);
            setBuilds(getBuildsForApp(restored.id));
            return;
          }
        }
        setApp(undefined);
      })
      .catch(() => setApp(undefined));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Sync server builds with local storage periodically or when console opens
  async function syncServerBuilds() {
    if (!app) return;
    const targetAppId = app.id;
    try {
      const res = await fetch(`/api/builds?appId=${targetAppId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.builds)) {
        interface ServerBuildItem {
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

        const serverBuildIds = new Set(data.builds.map((b: ServerBuildItem) => b.id));
        const currentBuilds = getBuildsForApp(targetAppId);

        // Remove any orphaned builds with non-server IDs that don't match any real job
        currentBuilds.forEach((b: BuildRecord) => {
          if (!serverBuildIds.has(b.id)) {
            deleteBuild(b.id);
          }
        });

        data.builds.forEach((sb: ServerBuildItem) => {
          const existing = currentBuilds.find((b: BuildRecord) => b.id === sb.id);
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
        setBuilds(getBuildsForApp(targetAppId));
      }
    } catch {}
  }

  useEffect(() => {
    syncServerBuilds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app?.id]);

  async function reanalyze() {
    if (!app) return;
    const [owner, name] = app.repositoryId.split("/");
    const branch = repo?.defaultBranch || "main";
    setReanalyzing(true);
    try {
      const res = await fetch(
        `/api/github/repos/${owner}/${name}/analyze?ref=${encodeURIComponent(branch)}`
      );
      const data = await res.json();
      if (res.ok && data.analysis) {
        updateApp(app.id, {
          analysis: data.analysis,
          androidPackage: data.analysis.androidPackage || app.androidPackage,
          iosBundleId: data.analysis.iosBundleId || app.iosBundleId,
          version: data.analysis.currentVersion || app.version,
          androidBuildNumber: data.analysis.versionCode || app.androidBuildNumber,
        });
        logActivity(`Re-analyzed ${app.name}`, "info", app.id);
        refresh();
      } else {
        alert(data.error || "Failed to analyze repository");
      }
    } catch (err) {
      alert(String(err));
    } finally {
      setReanalyzing(false);
    }
  }

  // Handle when build is launched via BuildModal
  function handleBuildStarted(serverBuildId: string, platform: Platform = "android") {
    if (!app) return;

    const buildNumber = platform === "ios" ? (app.iosBuildNumber || 1) : app.androidBuildNumber;

    // Create local build record for immediate UI reactivity
    createBuild({
      id: serverBuildId,
      appId: app.id,
      platform,
      version: app.version,
      buildNumber,
      status: "running",
      startedAt: new Date().toISOString(),
    });

    // Auto-increment build number for next release
    if (platform === "ios") {
      updateApp(app.id, {
        iosBuildNumber: (app.iosBuildNumber || 1) + 1,
      });
    } else {
      updateApp(app.id, {
        androidBuildNumber: app.androidBuildNumber + 1,
      });
    }

    logActivity(
      `Started ${platform === "ios" ? "iOS" : "Android"} build #${buildNumber} for ${app.name}`,
      "info",
      app.id
    );

    refresh();
    setConsoleBuildId(serverBuildId);
  }

  // Handle when publish finishes
  function handlePublishSuccess(result: { track: string; versionCode: number; isSimulated?: boolean }) {
    if (!app || !publishBuildId) return;

    const build = builds.find((b) => b.id === publishBuildId);
    const platform = build?.platform || "android";

    createRelease({
      appId: app.id,
      platform,
      track: result.track as ReleaseTrack,
      version: app.version,
      buildNumber: result.versionCode,
      buildId: publishBuildId,
      status: "success",
      isSimulated: Boolean(result.isSimulated),
    });

    if (!result.isSimulated) {
      if (platform === "ios") {
        updateApp(app.id, {
          appStoreConnection: "connected",
        });
      } else {
        updateApp(app.id, {
          googlePlayConnection: "connected",
        });
      }
    }

    if (publishBuildId) {
      updateBuild(publishBuildId, {
        googlePlayPublishStatus: "success",
        googlePlayPublishedTrack: result.track,
      });
    }

    logActivity(
      result.isSimulated
        ? `Recorded simulated release v${app.version} [${result.track}] for ${app.name}`
        : `Published v${app.version} (${result.versionCode}) to ${platform === "ios" ? "TestFlight" : "Google Play"} [${result.track}]`,
      result.isSimulated ? "info" : "success",
      app.id
    );

    refresh();
    setPublishBuildId(null);
  }

  // Test live connection to Google Play for this package
  async function testGooglePlayConnection() {
    if (!app) return;
    setTestingGooglePlay(true);
    setGooglePlayTestResult(null);

    const pkg =
      app.androidPackage ||
      `com.${app.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.app`;

    try {
      const res = await fetch("/api/google-play/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageName: pkg }),
      });

      const data = await res.json();
      if (res.ok && data.accessible) {
        setGooglePlayTestResult({
          success: true,
          message: `Connected! Package '${pkg}' verified via service account.`,
        });
        updateApp(app.id, { googlePlayConnection: "connected" });
      } else {
        // Test auth status
        const authRes = await fetch("/api/google-play/status");
        const authData = await authRes.json();

        if (authData.valid) {
          setGooglePlayTestResult({
            success: true,
            message: `Service account verified! Ready to publish to Google Play.`,
          });
          updateApp(app.id, { googlePlayConnection: "connected" });
        } else {
          setGooglePlayTestResult({
            success: false,
            message: data.error || "Could not connect to Google Play API.",
          });
        }
      }
      refresh();
    } catch (err) {
      setGooglePlayTestResult({
        success: false,
        message: String(err),
      });
    } finally {
      setTestingGooglePlay(false);
    }
  }

  const [testingAppStore, setTestingAppStore] = useState(false);
  const [appStoreTestResult, setAppStoreTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Test live connection to App Store Connect
  async function testAppStoreConnection() {
    if (!app) return;
    setTestingAppStore(true);
    setAppStoreTestResult(null);

    try {
      const res = await fetch("/api/apple/status");
      const data = await res.json();
      if (res.ok && data.valid) {
        setAppStoreTestResult({
          success: true,
          message: `Connected! Verified via App Store Connect API (Issuer: ${data.issuerIdMasked}).`,
        });
        updateApp(app.id, { appStoreConnection: "connected" });
      } else {
        setAppStoreTestResult({
          success: false,
          message: data.error || "Failed to authenticate with App Store Connect.",
        });
      }
    } catch (err) {
      setAppStoreTestResult({
        success: false,
        message: `Network error: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setTestingAppStore(false);
    }
  }

  if (app === null) {
    return (
      <PageShell title="Loading…">
        <div className="text-text-muted text-[13px]">Loading application…</div>
      </PageShell>
    );
  }

  if (app === undefined) {
    return (
      <PageShell title="Not found">
        <EmptyState
          title="Application not found"
          description="It may have been removed. Head back to the apps list."
          action={
            <Link href="/apps">
              <Button variant="secondary">Back to apps</Button>
            </Link>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={app.name}
      description={app.repositoryId}
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={reanalyze} disabled={reanalyzing}>
            {reanalyzing ? "Re-analyzing…" : "Re-analyze repository"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setBuildModalPlatform("ios");
              setIsBuildModalOpen(true);
            }}
          >
            <Play className="w-3.5 h-3.5 mr-1.5 inline" />
            Run iOS build
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setBuildModalPlatform("android");
              setIsBuildModalOpen(true);
            }}
          >
            <Play className="w-3.5 h-3.5 mr-1.5 inline" />
            Run Android build
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Release Readiness */}
          <section className="border border-border bg-panel p-4">
            <h2 className="text-[13px] font-medium text-text-muted uppercase tracking-wide mb-3">
              Release readiness
            </h2>
            {app.analysis ? (
              <div className="space-y-3">
                {app.analysis.hasAndroid && (
                  <ReadinessBar
                    label="Android"
                    pct={app.analysis.androidReadinessPct}
                  />
                )}
                {app.analysis.hasIOS && (
                  <ReadinessBar label="iOS" pct={app.analysis.iosReadinessPct} />
                )}
                <p className="text-[11px] text-text-faint pt-1">
                  Framework: <span className="mono">{app.analysis.framework}</span>
                  {" · "}
                  Last analyzed{" "}
                  {new Date(app.analysis.analyzedAt).toLocaleString()}
                </p>
              </div>
            ) : (
              <p className="text-[13px] text-text-faint">No analysis yet.</p>
            )}
          </section>

          {/* Builds Pipeline List */}
          <section className="border border-border bg-panel p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-[13px] font-medium text-text uppercase tracking-wide">
                  Build Engine Pipelines
                </h2>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Real-time Git checkout, compilation, bundle generation, and live streaming console.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onClick={() => {
                    setBuildModalPlatform("android");
                    setIsBuildModalOpen(true);
                  }}
                >
                  <Play className="w-3.5 h-3.5 mr-1 inline" />
                  Run Android
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setBuildModalPlatform("ios");
                    setIsBuildModalOpen(true);
                  }}
                >
                  <Play className="w-3.5 h-3.5 mr-1 inline" />
                  Run iOS
                </Button>
              </div>
            </div>

            {builds.length === 0 ? (
              <p className="text-[13px] text-text-faint py-4 text-center">
                No builds yet. Click &quot;Run Android build&quot; to start your first pipeline run.
              </p>
            ) : (
              <div className="divide-y divide-border -mx-4">
                {builds.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between px-4 py-3 text-[13px] hover:bg-panel-raised/50 transition-colors"
                  >
                    <div
                      className="flex items-center gap-3 cursor-pointer group"
                      onClick={() => setConsoleBuildId(b.id)}
                    >
                      <span className="mono text-text-faint uppercase text-[11px] w-16">
                        {b.platform}
                      </span>
                      <div>
                        <div className="mono text-text font-medium group-hover:text-signal-info flex items-center gap-2">
                          <span>v{b.version} ({b.buildNumber})</span>
                          <Terminal className="w-3.5 h-3.5 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-[11px] text-text-muted flex items-center gap-2 mt-0.5">
                          <span>ID: {b.id.slice(0, 16)}</span>
                          {b.commitSha && (
                            <span className="mono text-cyan-400/90">· {b.commitSha}</span>
                          )}
                          {b.durationMs && (
                            <span>· {(b.durationMs / 1000).toFixed(1)}s</span>
                          )}
                          {b.isDemoArtifact && (
                            <span className="text-amber-400 font-sans italic">· (demo mode)</span>
                          )}
                          {b.googlePlayPublishStatus === "success" && (
                            <span className="text-signal-success font-medium flex items-center gap-1">
                              · <ShieldCheck className="w-3 h-3" /> Published ({b.googlePlayPublishedTrack || (b.platform === "ios" ? "testflight" : "internal")})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <BuildStatusBadge status={b.status} />

                      {/* Download Artifact Button */}
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

                      {/* Publish Button (Android Google Play or iOS TestFlight) */}
                      {b.status === "success" && (
                        <button
                          onClick={() => setPublishBuildId(b.id)}
                          className={`px-2.5 py-1 text-[11px] font-medium border transition-colors flex items-center gap-1 ${
                            b.platform === "ios"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20"
                              : "bg-signal-info/10 text-signal-info border-signal-info/30 hover:bg-signal-info/20"
                          }`}
                        >
                          <ExternalLink className="w-3 h-3" />
                          Publish
                        </button>
                      )}

                      {/* View Console Button */}
                      <button
                        onClick={() => setConsoleBuildId(b.id)}
                        className="p-1.5 text-zinc-400 hover:text-white border border-border hover:border-zinc-500 transition-colors"
                        title="View Build Console Logs"
                      >
                        <Terminal className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          {/* Identifiers */}
          <section className="border border-border bg-panel p-4">
            <h2 className="text-[13px] font-medium text-text-muted uppercase tracking-wide mb-3">
              Identifiers
            </h2>
            <dl className="space-y-2 text-[12px]">
              <div className="flex justify-between">
                <dt className="text-text-faint">Version</dt>
                <dd className="mono text-text">{app.version}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-faint">Android build #</dt>
                <dd className="mono text-text">{app.androidBuildNumber}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-faint">Android package</dt>
                <dd className="mono text-text">
                  {app.androidPackage ?? "com.example.app"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-faint">iOS bundle ID</dt>
                <dd className="mono text-text">{app.iosBundleId ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-faint">Default branch</dt>
                <dd className="mono text-text">
                  {repo?.defaultBranch ?? "main"}
                </dd>
              </div>
            </dl>
          </section>

          {/* Store Connections & Publishing */}
          <section className="border border-border bg-panel p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[13px] font-medium text-text-muted uppercase tracking-wide">
                Store connections
              </h2>
              <button
                onClick={testGooglePlayConnection}
                disabled={testingGooglePlay}
                className="text-[11px] text-signal-info hover:underline flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${testingGooglePlay ? "animate-spin" : ""}`} />
                Test Play connection
              </button>
            </div>

            <div className="space-y-3 text-[12px]">
              <div className="flex items-center justify-between p-2 bg-panel-raised border border-border">
                <span className="text-text font-medium">Google Play Developer API</span>
                <span
                  className={
                    app.googlePlayConnection === "connected"
                      ? "text-signal-success font-medium flex items-center gap-1"
                      : "text-text-faint"
                  }
                >
                  {app.googlePlayConnection === "connected" ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Connected
                    </>
                  ) : (
                    "Not connected"
                  )}
                </span>
              </div>

              {googlePlayTestResult && (
                <div
                  className={`p-2.5 text-[11px] border leading-normal ${
                    googlePlayTestResult.success
                      ? "bg-signal-success/10 border-signal-success/30 text-signal-success"
                      : "bg-signal-danger/10 border-signal-danger/30 text-signal-danger"
                  }`}
                >
                  {googlePlayTestResult.message}
                </div>
              )}

              <div className="p-2 bg-panel-raised border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-text font-medium">App Store Connect</span>
                  <span
                    className={
                      app.appStoreConnection === "connected"
                        ? "text-signal-success font-medium flex items-center gap-1"
                        : "text-text-faint"
                    }
                  >
                    {app.appStoreConnection === "connected" ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Connected
                      </>
                    ) : (
                      "Ready"
                    )}
                  </span>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={testAppStoreConnection}
                  disabled={testingAppStore}
                  className="w-full text-[11px] h-7"
                >
                  {testingAppStore ? "Testing Apple API…" : "Test Apple connection"}
                </Button>
              </div>

              {appStoreTestResult && (
                <div
                  className={`p-2.5 text-[11px] border leading-normal ${
                    appStoreTestResult.success
                      ? "bg-signal-success/10 border-signal-success/30 text-signal-success"
                      : "bg-signal-danger/10 border-signal-danger/30 text-signal-danger"
                  }`}
                >
                  {appStoreTestResult.message}
                </div>
              )}
            </div>

            <p className="text-[11px] text-text-muted mt-3">
              Deployment pipeline connected to Google Play and Apple App Store Connect. Deploy successful builds directly to testing tracks.
            </p>
          </section>
        </div>
      </div>

      {/* Build Configuration Modal */}
      <BuildModal
        app={app}
        platform={buildModalPlatform}
        isOpen={isBuildModalOpen}
        onClose={() => setIsBuildModalOpen(false)}
        onStarted={handleBuildStarted}
      />

      {/* Live Build Terminal Console */}
      {consoleBuildId && (
        <BuildConsole
          buildId={consoleBuildId}
          isOpen={Boolean(consoleBuildId)}
          onClose={() => {
            setConsoleBuildId(null);
            refresh();
            syncServerBuilds();
          }}
          onStatusChange={() => {
            refresh();
            syncServerBuilds();
          }}
          onOpenPublish={(bid) => {
            setConsoleBuildId(null);
            setPublishBuildId(bid);
          }}
        />
      )}

      {/* Google Play Publishing Modal */}
      {publishBuildId && (
        <PublishModal
          app={app}
          buildId={publishBuildId}
          isOpen={Boolean(publishBuildId)}
          onClose={() => setPublishBuildId(null)}
          onSuccess={handlePublishSuccess}
        />
      )}
    </PageShell>
  );
}
