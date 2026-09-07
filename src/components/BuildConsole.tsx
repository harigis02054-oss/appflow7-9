"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";
import { ServerBuildLogLine } from "@/lib/build/store";
import { Download, Copy, Check, X, Square, Terminal, ExternalLink } from "lucide-react";

interface BuildConsoleProps {
  buildId: string;
  isOpen: boolean;
  onClose: () => void;
  onOpenPublish?: (buildId: string) => void;
  onStatusChange?: (status: string) => void;
}

export function BuildConsole({
  buildId,
  isOpen,
  onClose,
  onOpenPublish,
  onStatusChange,
}: BuildConsoleProps) {
  const [logs, setLogs] = useState<ServerBuildLogLine[]>([]);
  const [status, setStatus] = useState<string>("queued");
  const [platform, setPlatform] = useState<"android" | "ios">("android");
  const [artifactName, setArtifactName] = useState<string | undefined>();
  const [durationMs, setDurationMs] = useState<number | undefined>();
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  });

  // Poll logs while open
  useEffect(() => {
    if (!isOpen || !buildId) return;

    let active = true;
    let pollTimeout: NodeJS.Timeout;

    async function fetchLogs() {
      try {
        const res = await fetch(`/api/builds/${buildId}/logs?since=0`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (active) {
            setStatus("failed");
            setLogs([
              {
                index: 0,
                timestamp: new Date().toISOString(),
                message: `⚠️ Unable to load logs for build ID [${buildId}]: ${errData.error || res.statusText}. Please refresh the page to sync recent builds.`,
                level: "warn",
              },
            ]);
          }
          return;
        }
        const data = await res.json();

        if (active) {
          setLogs(data.lines || []);
          setStatus(data.status || "running");
          setArtifactName(data.artifactName);
          setDurationMs(data.durationMs);
          if (data.platform) {
            setPlatform(data.platform);
          } else if (data.artifactName?.endsWith(".ipa")) {
            setPlatform("ios");
          }

          if (data.status) {
            onStatusChangeRef.current?.(data.status);
          }

          // If still running or queued, poll every 800ms
          if (data.status === "running" || data.status === "queued") {
            pollTimeout = setTimeout(fetchLogs, 800);
          }
        }
      } catch (err) {
        console.error("Failed to fetch logs:", err);
      }
    }

    fetchLogs();

    return () => {
      active = false;
      clearTimeout(pollTimeout);
    };
  }, [buildId, isOpen]);

  // Handle auto-scroll
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  async function cancelBuild() {
    setCancelling(true);
    try {
      await fetch(`/api/builds/${buildId}/cancel`, { method: "POST" });
      setStatus("cancelled");
    } finally {
      setCancelling(false);
    }
  }

  function copyLogs() {
    const text = logs.map((l) => `[${l.timestamp}] ${l.message}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!isOpen) return null;

  const isRunning = status === "running" || status === "queued";
  const isSuccess = status === "success";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="flex flex-col w-full max-w-5xl h-[85vh] bg-[#0c0e14] border border-[#232736] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#131620] border-b border-[#232736]">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#e05252]/80" />
              <div className="w-3 h-3 rounded-full bg-[#e5b544]/80" />
              <div className="w-3 h-3 rounded-full bg-[#52ba80]/80" />
            </div>
            <div className="flex items-center gap-2 pl-2 text-[13px] font-mono text-zinc-300">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>build-console</span>
              <span className="text-zinc-600">/</span>
              <span className="text-zinc-400 font-semibold">{buildId}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Status Badge */}
            <div
              className={`flex items-center gap-2 px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider rounded border ${
                isRunning
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                  : isSuccess
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isRunning
                    ? "bg-amber-400 animate-ping"
                    : isSuccess
                    ? "bg-emerald-400"
                    : "bg-rose-400"
                }`}
              />
              <span>{status}</span>
              {durationMs && (
                <span className="text-zinc-500">
                  ({(durationMs / 1000).toFixed(1)}s)
                </span>
              )}
            </div>

            {/* Auto Scroll Toggle */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`text-[11px] px-2 py-1 font-mono transition-colors ${
                autoScroll
                  ? "text-cyan-400 bg-cyan-950/40 border border-cyan-800/60"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              auto-scroll: {autoScroll ? "on" : "off"}
            </button>

            {/* Copy Logs */}
            <button
              onClick={copyLogs}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Copy entire log"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Terminal Body */}
        <div
          ref={scrollContainerRef}
          className="flex-1 p-4 overflow-y-auto font-mono text-[12px] leading-relaxed bg-[#08090d] select-text"
        >
          {logs.length === 0 ? (
            <div className="flex items-center gap-2 text-zinc-500 py-8">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              Initializing build environment and connecting to process runner...
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((line) => {
                const isStep = line.level === "step";
                const isWarn = line.level === "warn";
                const isError = line.level === "error";

                return (
                  <div
                    key={line.index}
                    className={`flex items-start gap-3 hover:bg-white/[0.02] px-1 py-0.5 rounded ${
                      isStep
                        ? "text-cyan-300 font-semibold"
                        : isError
                        ? "text-rose-400 font-medium"
                        : isWarn
                        ? "text-amber-300"
                        : "text-zinc-300"
                    }`}
                  >
                    <span className="w-8 text-[10px] text-zinc-600 select-none text-right pt-0.5">
                      {line.index + 1}
                    </span>
                    <span className="text-[10px] text-zinc-500 select-none pt-0.5">
                      {line.timestamp ? new Date(line.timestamp).toLocaleTimeString() : ""}
                    </span>
                    <span className="flex-1 whitespace-pre-wrap break-all">
                      {line.message}
                    </span>
                  </div>
                );
              })}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>

        {/* Terminal Footer Actions */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#10121a] border-t border-[#232736]">
          <div className="text-[12px] font-mono text-zinc-400">
            {artifactName ? (
              <span className="text-emerald-400 flex items-center gap-2">
                <span>📦 Artifact: {artifactName}</span>
              </span>
            ) : isRunning ? (
              <span className="text-amber-400 animate-pulse">
                Build in progress...
              </span>
            ) : (
              <span className="text-zinc-500">Build session completed.</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isRunning && (
              <Button
                variant="danger"
                onClick={cancelBuild}
                disabled={cancelling}
              >
                <Square className="w-3.5 h-3.5 mr-1 inline" />
                {cancelling ? "Cancelling..." : "Cancel Build"}
              </Button>
            )}

            {isSuccess && artifactName && (
              <a
                href={`/api/builds/${buildId}/artifact`}
                download={artifactName}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium bg-cyan-600 hover:bg-cyan-500 text-black transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download {artifactName.endsWith(".ipa") ? "IPA" : artifactName.endsWith(".apk") ? "APK" : "AAB"}
              </a>
            )}

            {isSuccess && onOpenPublish && (
              <Button
                variant="primary"
                onClick={() => onOpenPublish(buildId)}
                className={platform === "ios" ? "bg-blue-600 hover:bg-blue-500 text-white" : ""}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1 inline" />
                {platform === "ios" ? "Publish to TestFlight / App Store" : "Publish to Google Play"}
              </Button>
            )}

            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
