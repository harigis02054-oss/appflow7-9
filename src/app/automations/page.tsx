"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui";
import type { AutomationRule } from "@/lib/automations/types";
import {
  Zap,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  GitCommit,
  Send,
  Radio,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [lastActionResult, setLastActionResult] = useState<string | null>(null);

  useEffect(() => {
    loadAutomations();
  }, []);

  async function loadAutomations() {
    try {
      const res = await fetch("/api/automations");
      if (!res.ok) return;
      const data = await res.json();
      setAutomations(data.automations || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(id: string, current: boolean) {
    try {
      await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle",
          id,
          enabled: !current,
        }),
      });
      await loadAutomations();
    } catch {
      alert("Failed to toggle automation rule");
    }
  }

  async function handleTestRun(rule: AutomationRule) {
    setTriggeringId(rule.id);
    setLastActionResult(null);
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "trigger-event",
          type: rule.trigger.type,
          appId: rule.appId || "all-apps",
          branch: rule.trigger.branch || "main",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setLastActionResult(`Rule '${rule.name}' executed successfully. Matched ${data.results?.length || 1} action(s).`);
        await loadAutomations();
      } else {
        setLastActionResult(`Execution error: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      setLastActionResult(`Execution failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTriggeringId(null);
    }
  }

  const formatTrigger = (trigger: AutomationRule["trigger"]) => {
    switch (trigger.type) {
      case "github_push":
        return `Git push to '${trigger.branch || "main"}'`;
      case "build_success":
        return "Clean build completed successfully";
      case "testing_completed":
        return "12 testers & 14 days closed testing quorum reached";
      case "cron_schedule":
        return `Scheduled cron (${trigger.cron || "nightly"})`;
      default:
        return trigger.type;
    }
  };

  return (
    <PageShell
      title="Automations & Triggers"
      description="Autonomous release pipelines: Git hooks, instant store ingestion, and quorum-driven reviews."
    >
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Banner */}
        <div className="rounded-2xl border border-zinc-800 bg-gradient-to-r from-zinc-900 via-zinc-900 to-indigo-950/40 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Continuous Distribution Engine</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Active
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Automatically advances releases through compilation, verification, store upload, and team review.
              </p>
            </div>
          </div>

          <div className="text-xs text-zinc-400 font-mono bg-zinc-950/60 px-3 py-2 rounded-xl border border-zinc-800/80">
            {automations.filter((a) => a.enabled).length} of {automations.length} automations enabled
          </div>
        </div>

        {/* Feedback Alert */}
        {lastActionResult && (
          <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-xs text-indigo-300 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              {lastActionResult}
            </span>
            <button onClick={() => setLastActionResult(null)} className="text-zinc-400 hover:text-white">
              Dismiss
            </button>
          </div>
        )}

        {/* Automations Rules List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Active Automation Workflows</h2>

          <div className="grid grid-cols-1 gap-4">
            {automations.map((rule) => (
              <div
                key={rule.id}
                className={`rounded-2xl border transition-all p-6 ${
                  rule.enabled
                    ? "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
                    : "border-zinc-800/40 bg-zinc-950/40 opacity-60"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-semibold text-white">{rule.name}</h3>
                      <span className="text-[11px] px-2 py-0.5 rounded font-mono bg-zinc-950 border border-zinc-800 text-zinc-300">
                        {formatTrigger(rule.trigger)}
                      </span>
                      {rule.lastStatus && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono capitalize ${
                            rule.lastStatus === "success"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-red-500/10 text-red-400 border border-red-500/20"
                          }`}
                        >
                          {rule.lastStatus}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400">{rule.description}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Button
                      variant="secondary"
                      onClick={() => handleTestRun(rule)}
                      disabled={triggeringId === rule.id}
                      className="text-xs py-1.5 px-3"
                    >
                      <Play className="w-3.5 h-3.5 mr-1.5 inline text-amber-400" />
                      {triggeringId === rule.id ? "Running..." : "Test Run"}
                    </Button>

                    <button
                      onClick={() => handleToggle(rule.id, rule.enabled)}
                      className="p-1 rounded text-zinc-400 hover:text-white transition-colors"
                      title={rule.enabled ? "Disable automation" : "Enable automation"}
                    >
                      {rule.enabled ? (
                        <ToggleRight className="w-7 h-7 text-indigo-400" />
                      ) : (
                        <ToggleLeft className="w-7 h-7 text-zinc-600" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Actions Performed */}
                <div className="mt-4 pt-4 border-t border-zinc-800/60 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                  <span className="text-zinc-500 font-medium">Actions:</span>
                  {rule.actions.map((act, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800/80 text-zinc-300 font-mono text-[11px]"
                    >
                      {act.type.replace(/_/g, " ")}
                    </span>
                  ))}
                  {rule.lastRunAt && (
                    <span className="ml-auto text-[11px] text-zinc-400 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Last executed {new Date(rule.lastRunAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
