"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { createVersionPlan } from "@/lib/release/versioning";
import type { AppRecord, Platform, ReleaseTrack, VersionIncrementType } from "@/lib/types";
import { Layers, ArrowRight, X, Shield, GitCommit, Sparkles } from "lucide-react";

interface ReleasePipelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  app: AppRecord;
}

export function ReleasePipelineModal({
  isOpen,
  onClose,
  app,
}: ReleasePipelineModalProps) {
  const router = useRouter();
  const [platform, setPlatform] = useState<Platform>("android");
  const [track, setTrack] = useState<ReleaseTrack>("internal-testing");
  const [incrementType, setIncrementType] = useState<VersionIncrementType>("patch");
  const [manualVersion, setManualVersion] = useState(app.version || "1.0.0");
  const [manualBuildNumber, setManualBuildNumber] = useState(
    platform === "ios" ? (app.iosBuildNumber || 1) : app.androidBuildNumber
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentBuildNumber =
    platform === "ios" ? (app.iosBuildNumber || 1) : app.androidBuildNumber;

  const versionPlan = useMemo(() => {
    return createVersionPlan(
      app.version || "1.0.0",
      currentBuildNumber,
      incrementType,
      manualVersion,
      manualBuildNumber
    );
  }, [app.version, currentBuildNumber, incrementType, manualVersion, manualBuildNumber]);

  if (!isOpen) return null;

  async function handleCreateRelease() {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: app.id,
          appName: app.name,
          repositoryId: app.repositoryId,
          platform,
          track: platform === "ios" && track === "internal-testing" ? "testflight" : track,
          version: versionPlan.nextVersion,
          buildNumber: versionPlan.nextBuildNumber,
          androidPackage: app.androidPackage,
          iosBundleId: app.iosBundleId,
          actor: "Team Member",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate release pipeline");
      }

      onClose();
      router.push(`/releases/${data.release.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="border border-border bg-panel w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-signal-info" />
            <h2 className="text-sm font-medium text-text">
              Start Orchestrated Release Pipeline
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 text-xs">
          {error && (
            <div className="p-3 border border-signal-danger/30 bg-signal-danger/10 text-signal-danger font-mono rounded">
              {error}
            </div>
          )}

          {/* Platform Selector */}
          <div>
            <label className="block font-mono text-[11px] text-text-muted uppercase mb-1.5">
              Target Platform
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPlatform("android");
                  setTrack("internal-testing");
                }}
                className={`p-2.5 border text-center font-medium transition-all ${
                  platform === "android"
                    ? "border-signal-info bg-signal-info/10 text-signal-info"
                    : "border-border bg-panel-raised text-text-muted hover:text-text"
                }`}
              >
                Android (Google Play)
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlatform("ios");
                  setTrack("testflight");
                }}
                className={`p-2.5 border text-center font-medium transition-all ${
                  platform === "ios"
                    ? "border-signal-info bg-signal-info/10 text-signal-info"
                    : "border-border bg-panel-raised text-text-muted hover:text-text"
                }`}
              >
                iOS (TestFlight / App Store)
              </button>
            </div>
          </div>

          {/* Target Track */}
          <div>
            <label className="block font-mono text-[11px] text-text-muted uppercase mb-1.5">
              Distribution Track
            </label>
            <select
              value={track}
              onChange={(e) => setTrack(e.target.value as ReleaseTrack)}
              className="w-full p-2 border border-border bg-panel-raised text-text font-mono text-xs focus:outline-none focus:border-signal-info"
            >
              {platform === "android" ? (
                <>
                  <option value="internal-testing">Internal Testing (Google Play)</option>
                  <option value="closed-testing">Closed Alpha / Beta Track</option>
                  <option value="production">Production Public Release</option>
                </>
              ) : (
                <>
                  <option value="testflight">TestFlight (App Store Connect Beta)</option>
                  <option value="app-store">App Store Production Release</option>
                </>
              )}
            </select>
          </div>

          {/* Version Increment Strategy */}
          <div>
            <label className="block font-mono text-[11px] text-text-muted uppercase mb-1.5">
              Version Increment Strategy
            </label>
            <div className="grid grid-cols-4 gap-1.5 font-mono text-[11px]">
              {(["patch", "minor", "major", "build-only"] as VersionIncrementType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setIncrementType(type)}
                  className={`p-2 border text-center capitalize transition-all ${
                    incrementType === type
                      ? "border-signal-info bg-signal-info/10 text-signal-info font-bold"
                      : "border-border bg-panel-raised text-text-muted hover:text-text"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Version Preview Card */}
          <div className="border border-border bg-panel-raised/50 p-3 rounded">
            <div className="text-[11px] font-mono text-text-muted uppercase mb-2 flex items-center justify-between">
              <span>Version Resolution</span>
              <Sparkles className="w-3.5 h-3.5 text-signal-info" />
            </div>

            <div className="flex items-center justify-between font-mono text-xs">
              <div>
                <span className="text-text-faint text-[10px] block">Current</span>
                <span className="text-text-muted">
                  v{app.version || "1.0.0"} (#{currentBuildNumber})
                </span>
              </div>

              <ArrowRight className="w-4 h-4 text-text-muted mx-2" />

              <div className="text-right">
                <span className="text-signal-info text-[10px] block font-bold">Next Release</span>
                <span className="text-signal-info font-bold">
                  v{versionPlan.nextVersion} (#{versionPlan.nextBuildNumber})
                </span>
              </div>
            </div>

            <p className="text-[11px] text-text-faint font-mono mt-2 pt-2 border-t border-border/50">
              {versionPlan.rationale}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-panel-raised/30">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateRelease}
            disabled={submitting}
          >
            {submitting ? "Initializing Pipeline..." : "Create & Launch Pipeline"}
          </Button>
        </div>
      </div>
    </div>
  );
}
