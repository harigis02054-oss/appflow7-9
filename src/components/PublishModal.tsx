"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui";
import { X, Send, AlertCircle, ShieldCheck, AlertTriangle } from "lucide-react";
import { ReleaseTrack } from "@/lib/types";

interface PublishModalProps {
  app: {
    id: string;
    name: string;
    androidPackage?: string;
    iosBundleId?: string;
    version: string;
    androidBuildNumber: number;
    iosBuildNumber?: number;
  };
  buildId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (release: { track: string; versionCode: number; isSimulated?: boolean }) => void;
}

export function PublishModal({
  app,
  buildId,
  isOpen,
  onClose,
  onSuccess,
}: PublishModalProps) {
  const [buildPlatform, setBuildPlatform] = useState<"android" | "ios">("android");
  const isIos = buildPlatform === "ios";
  const [track, setTrack] = useState<ReleaseTrack>("internal-testing");
  const [packageName, setPackageName] = useState(
    app.androidPackage || `com.${app.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.app`
  );
  const [releaseNotes, setReleaseNotes] = useState(
    `AppFlow release v${app.version} (Build #${app.androidBuildNumber})`
  );
  const [allowSimulation, setAllowSimulation] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDemoArtifact, setIsDemoArtifact] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !buildId) return;

    fetch(`/api/builds/${buildId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.build) {
          const platform = data.build.platform || "android";
          setBuildPlatform(platform);

          if (platform === "ios") {
            setTrack("testflight");
            setPackageName(app.iosBundleId || "com.quickdrop.quickdrop");
            setReleaseNotes(
              `AppFlow iOS release v${app.version} (Build #${app.iosBuildNumber || 1})`
            );
          } else {
            setTrack("internal-testing");
            setPackageName(
              app.androidPackage || `com.${app.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.app`
            );
            setReleaseNotes(
              `AppFlow release v${app.version} (Build #${app.androidBuildNumber})`
            );
          }

          if (data.build.isDemoArtifact) {
            setIsDemoArtifact(true);
            setAllowSimulation(true);
          } else {
            setIsDemoArtifact(false);
            setAllowSimulation(false);
          }
        }
      })
      .catch(() => {});
  }, [isOpen, buildId, app]);

  if (!isOpen) return null;

  async function handlePublish() {
    setError(null);
    setPublishing(true);

    try {
      const endpoint = isIos ? "/api/apple/publish" : "/api/google-play/publish";
      const payload = isIos
        ? {
            buildId,
            appId: app.id,
            bundleId: packageName,
            track,
            releaseNotes,
            simulateIfUnregistered: allowSimulation,
          }
        : {
            buildId,
            packageName,
            track,
            releaseNotes,
            simulateIfUnregistered: allowSimulation,
          };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Failed to publish to ${isIos ? "TestFlight" : "Google Play"}`);
        return;
      }

      if (data.isSimulated) {
        alert(
          `⚠️ NOTICE: ${data.notice || "Release was SIMULATED. It was not uploaded to live console."}`
        );
      }

      onSuccess({
        track: data.track,
        versionCode: data.versionCode,
        isSimulated: Boolean(data.isSimulated),
      });
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-panel border border-border-strong shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
          <div>
            <h2 className="text-[16px] font-semibold text-text flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-signal-success" />
              Publish to {isIos ? "Apple TestFlight" : "Google Play"}
            </h2>
            <p className="text-[12px] text-text-muted mt-0.5">
              Deploy build artifact to {isIos ? "App Store Connect" : "Google Play Console"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isDemoArtifact && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 text-[12px] text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
            <div>
              <strong>Verification Mode Build:</strong> This build artifact was synthesized in test mode. To protect your live store, dummy binaries will not be uploaded to Apple/Google production servers. It will complete in simulated release mode.
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-signal-danger/10 border border-signal-danger/30 text-[12px] text-signal-danger flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Target Track */}
          <div>
            <label className="block text-[12px] font-medium text-text-muted mb-1.5">
              {isIos ? "TestFlight Release Track" : "Google Play Release Track"}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {isIos
                ? [
                    {
                      id: "testflight",
                      label: "Internal Testing",
                      desc: "Instant to team testers",
                    },
                    {
                      id: "closed-testing",
                      label: "External Testing",
                      desc: "Beta groups (up to 10k)",
                    },
                    {
                      id: "app-store",
                      label: "App Store",
                      desc: "Production submission",
                    },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTrack(t.id as ReleaseTrack)}
                      className={`p-2.5 text-left border transition-colors ${
                        track === t.id
                          ? "border-signal-info bg-signal-info/10 text-text"
                          : "border-border bg-panel-raised text-text-muted hover:text-text"
                      }`}
                    >
                      <div className="text-[12px] font-medium">{t.label}</div>
                      <div className="text-[10px] text-text-muted mt-0.5">
                        {t.desc}
                      </div>
                    </button>
                  ))
                : [
                    {
                      id: "internal-testing",
                      label: "Internal Testing",
                      desc: "Up to 100 testers, immediate",
                    },
                    {
                      id: "closed-testing",
                      label: "Closed (Alpha)",
                      desc: "Target tester groups",
                    },
                    {
                      id: "production",
                      label: "Production",
                      desc: "Store public release",
                    },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTrack(t.id as ReleaseTrack)}
                      className={`p-2.5 text-left border transition-colors ${
                        track === t.id
                          ? "border-signal-info bg-signal-info/10 text-text"
                          : "border-border bg-panel-raised text-text-muted hover:text-text"
                      }`}
                    >
                      <div className="text-[12px] font-medium">{t.label}</div>
                      <div className="text-[10px] text-text-muted mt-0.5">
                        {t.desc}
                      </div>
                    </button>
                  ))}
            </div>
          </div>

          {/* Package Name / Bundle ID */}
          <div>
            <label className="block text-[12px] font-medium text-text-muted mb-1.5">
              {isIos ? "iOS Bundle Identifier" : "Application Package Name"}
            </label>
            <input
              type="text"
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              className="w-full bg-panel-raised border border-border px-3 py-2 text-[13px] text-text font-mono focus:outline-none focus:border-signal-info"
              placeholder={isIos ? "com.example.app" : "com.example.app"}
            />
          </div>

          {/* Release Notes */}
          <div>
            <label className="block text-[12px] font-medium text-text-muted mb-1.5">
              Release Notes (en-US)
            </label>
            <textarea
              rows={3}
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
              className="w-full bg-panel-raised border border-border px-3 py-2 text-[13px] text-text focus:outline-none focus:border-signal-info resize-none"
              placeholder="What's new in this build..."
            />
          </div>

          {/* Simulation fallback */}
          <div className="flex items-start gap-2 pt-1 text-[12px] text-text-muted">
            <input
              id="allowSim"
              type="checkbox"
              checked={allowSimulation}
              onChange={(e) => setAllowSimulation(e.target.checked)}
              className="mt-0.5 rounded border-border"
            />
            <label htmlFor="allowSim" className="cursor-pointer">
              Record pipeline release verification if store account credentials are in test mode or awaiting account authorization.
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-border">
          <Button variant="secondary" onClick={onClose} disabled={publishing}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handlePublish} disabled={publishing}>
            <Send className="w-3.5 h-3.5 mr-1.5 inline" />
            {publishing
              ? `Publishing to ${isIos ? "TestFlight" : "Google Play"}...`
              : `Submit to ${isIos ? "TestFlight" : "Google Play"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
