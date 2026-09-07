"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui";
import { X, Play, AlertTriangle, CheckCircle2, Cpu } from "lucide-react";
import { ToolchainStatus } from "@/lib/build/preflight";

interface BuildModalProps {
  app: {
    id: string;
    name: string;
    repositoryId: string;
    version: string;
    androidBuildNumber: number;
    iosBuildNumber?: number;
  };
  platform?: "android" | "ios";
  isOpen: boolean;
  onClose: () => void;
  onStarted: (buildId: string, platform: "android" | "ios") => void;
}

export function BuildModal({
  app,
  platform = "android",
  isOpen,
  onClose,
  onStarted,
}: BuildModalProps) {
  const isIos = platform === "ios";
  const [branch, setBranch] = useState("main");
  const [branches, setBranches] = useState<string[]>(["main"]);
  const [buildMode, setBuildMode] = useState<"release-aab" | "debug-apk" | "release-ipa" | "debug-ios">(
    isIos ? "release-ipa" : "release-aab"
  );
  const [loading, setLoading] = useState(false);
  const [toolchain, setToolchain] = useState<ToolchainStatus | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setBuildMode(isIos ? "release-ipa" : "release-aab");

    // Load branches
    const [owner, repo] = app.repositoryId.split("/");
    if (owner && repo) {
      fetch(`/api/github/repos/${owner}/${repo}/branches`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.branches) && data.branches.length > 0) {
            const names = data.branches.map((b: { name: string }) => b.name);
            setBranches(names);
            setBranch((prev) => (names.includes(prev) ? prev : names[0]));
          }
        })
        .catch(() => {});
    }

    // Load toolchain
    fetch("/api/builds/environment")
      .then((r) => r.json())
      .then((data) => setToolchain(data))
      .catch(() => {});
  }, [isOpen, app.repositoryId, isIos]);

  if (!isOpen) return null;

  async function handleLaunch() {
    setLoading(true);
    const targetBuildNumber = isIos ? (app.iosBuildNumber || 1) : app.androidBuildNumber;

    try {
      const res = await fetch("/api/builds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: app.id,
          appName: app.name,
          repositoryId: app.repositoryId,
          branch,
          platform,
          buildMode,
          version: app.version,
          buildNumber: targetBuildNumber,
        }),
      });

      const data = await res.json();
      if (res.ok && data.build?.id) {
        onStarted(data.build.id, platform);
        onClose();
      } else {
        alert(data.error || "Failed to start build");
      }
    } catch (err) {
      alert(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-panel border border-border-strong shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
          <div>
            <h2 className="text-[16px] font-semibold text-text">
              Run {isIos ? "iOS" : "Android"} Build
            </h2>
            <p className="text-[12px] text-text-muted mt-0.5">
              {app.name} · {app.repositoryId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Target Branch */}
          <div>
            <label className="block text-[12px] font-medium text-text-muted mb-1.5">
              Git Branch
            </label>
            {branches.length > 1 ? (
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full bg-panel-raised border border-border px-3 py-2 text-[13px] text-text font-mono focus:outline-none focus:border-signal-info"
              >
                {branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="w-full bg-panel-raised border border-border px-3 py-2 text-[13px] text-text font-mono focus:outline-none focus:border-signal-info"
              />
            )}
          </div>

          {/* Build Output Format */}
          <div>
            <label className="block text-[12px] font-medium text-text-muted mb-1.5">
              Build Format
            </label>
            {isIos ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBuildMode("release-ipa")}
                  className={`p-3 text-left border transition-colors ${
                    buildMode === "release-ipa"
                      ? "border-signal-info bg-signal-info/10 text-text"
                      : "border-border bg-panel-raised text-text-muted hover:text-text"
                  }`}
                >
                  <div className="text-[13px] font-medium">Release IPA</div>
                  <div className="text-[11px] text-text-muted mt-0.5">
                    TestFlight & App Store package
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBuildMode("debug-ios")}
                  className={`p-3 text-left border transition-colors ${
                    buildMode === "debug-ios"
                      ? "border-signal-info bg-signal-info/10 text-text"
                      : "border-border bg-panel-raised text-text-muted hover:text-text"
                  }`}
                >
                  <div className="text-[13px] font-medium">Unsigned Archive</div>
                  <div className="text-[11px] text-text-muted mt-0.5">
                    Local testing (--no-codesign)
                  </div>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBuildMode("release-aab")}
                  className={`p-3 text-left border transition-colors ${
                    buildMode === "release-aab"
                      ? "border-signal-info bg-signal-info/10 text-text"
                      : "border-border bg-panel-raised text-text-muted hover:text-text"
                  }`}
                >
                  <div className="text-[13px] font-medium">Release AAB</div>
                  <div className="text-[11px] text-text-muted mt-0.5">
                    Google Play Bundle format
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBuildMode("debug-apk")}
                  className={`p-3 text-left border transition-colors ${
                    buildMode === "debug-apk"
                      ? "border-signal-info bg-signal-info/10 text-text"
                      : "border-border bg-panel-raised text-text-muted hover:text-text"
                  }`}
                >
                  <div className="text-[13px] font-medium">Debug APK</div>
                  <div className="text-[11px] text-text-muted mt-0.5">
                    Direct Android installation
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Target Version Info */}
          <div className="flex items-center justify-between p-3 bg-panel-raised border border-border text-[12px]">
            <span className="text-text-muted">Target Release Version:</span>
            <span className="font-mono text-text">
              v{app.version} (Build #{isIos ? (app.iosBuildNumber || 1) : app.androidBuildNumber})
            </span>
          </div>

          {/* Toolchain Preflight Status */}
          <div className="p-3 bg-panel-raised/50 border border-border text-[12px] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-text-muted flex items-center gap-1.5 font-medium">
                <Cpu className="w-3.5 h-3.5" />
                Host {isIos ? "iOS" : "Android"} Toolchain
              </span>
              {(isIos ? toolchain?.readyForIosBuild : toolchain?.readyForAndroidBuild) ? (
                <span className="text-signal-success flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Ready
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Preflight Warning
                </span>
              )}
            </div>

            {isIos ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-text-muted pt-1 border-t border-border/50">
                <div>
                  • Xcode:{" "}
                  <span className={toolchain?.tools.xcode.installed ? "text-signal-success" : "text-signal-danger"}>
                    {toolchain?.tools.xcode.installed ? toolchain.tools.xcode.version : "Not installed"}
                  </span>
                </div>
                <div>
                  • Flutter:{" "}
                  <span className={toolchain?.tools.flutter.installed ? "text-signal-success" : "text-text-muted"}>
                    {toolchain?.tools.flutter.installed ? "Ready" : "Not on PATH"}
                  </span>
                </div>
                <div>
                  • Signing:{" "}
                  <span className={toolchain?.tools.signingIdentities.installed ? "text-signal-success" : "text-amber-400"}>
                    {toolchain?.tools.signingIdentities.installed ? "Identity detected" : "Local mode (--no-codesign)"}
                  </span>
                </div>
                <div>
                  • CocoaPods:{" "}
                  <span className={toolchain?.tools.cocoapods.installed ? "text-signal-success" : "text-text-muted"}>
                    {toolchain?.tools.cocoapods.installed ? "Ready" : "SwiftPM fallback"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-text-muted pt-1 border-t border-border/50">
                <div>
                  • Git:{" "}
                  <span className={toolchain?.tools.git.installed ? "text-signal-success" : "text-signal-danger"}>
                    {toolchain?.tools.git.installed ? "Ready" : "Missing"}
                  </span>
                </div>
                <div>
                  • Flutter:{" "}
                  <span className={toolchain?.tools.flutter.installed ? "text-signal-success" : "text-text-muted"}>
                    {toolchain?.tools.flutter.installed ? "Ready" : "Not on PATH"}
                  </span>
                </div>
                <div>
                  • Java JDK:{" "}
                  <span className={toolchain?.tools.java.installed ? "text-signal-success" : "text-amber-400"}>
                    {toolchain?.tools.java.installed ? "Ready" : "Missing JDK 17"}
                  </span>
                </div>
                <div>
                  • Android SDK:{" "}
                  <span className={toolchain?.tools.androidSdk.installed ? "text-signal-success" : "text-amber-400"}>
                    {toolchain?.tools.androidSdk.installed ? "Ready" : "Missing"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-border">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleLaunch} disabled={loading}>
            <Play className="w-3.5 h-3.5 mr-1.5 inline" />
            {loading ? "Starting..." : `Start ${isIos ? "iOS" : "Android"} Build`}
          </Button>
        </div>
      </div>
    </div>
  );
}
