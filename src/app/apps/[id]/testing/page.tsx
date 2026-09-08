"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui";
import type { AppTestingOverview } from "@/lib/testing/types";
import {
  ArrowLeft,
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Plus,
  Trash2,
  Sparkles,
  ShieldCheck,
  Radio,
  Layers,
} from "lucide-react";

export default function AppTestingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<AppTestingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New tester form state
  const [newEmail, setNewEmail] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [addingTester, setAddingTester] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Filter state
  const [filterGroup, setFilterGroup] = useState<string>("all");

  useEffect(() => {
    loadTestingData();
  }, [id]);

  async function loadTestingData() {
    try {
      const res = await fetch(`/api/apps/${id}/testing`);
      if (!res.ok) throw new Error("Failed to load testing details");
      const json: AppTestingOverview = await res.json();
      setData(json);
      if (json.groups.length > 0 && !selectedGroup) {
        setSelectedGroup(json.groups[0].name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleAddTester(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setAddingTester(true);
    try {
      const res = await fetch(`/api/apps/${id}/testing/testers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          groupName: selectedGroup || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to add tester");
      const resJson = await res.json();
      if (resJson.overview) {
        setData(resJson.overview);
      } else {
        await loadTestingData();
      }
      setNewEmail("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error adding tester");
    } finally {
      setAddingTester(false);
    }
  }

  async function handleRemoveTester(testerId: string) {
    if (!confirm("Remove this tester from the group?")) return;
    try {
      const res = await fetch(`/api/apps/${id}/testing/testers?testerId=${testerId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove tester");
      const resJson = await res.json();
      if (resJson.overview) {
        setData(resJson.overview);
      } else {
        await loadTestingData();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error removing tester");
    }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  async function handleStartClosedTesting() {
    try {
      const res = await fetch(`/api/apps/${id}/testing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Failed to update closed testing start date");
      const updated = await res.json();
      setData(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error updating date");
    }
  }

  if (loading) {
    return (
      <PageShell title="Testing & Distribution" description="Loading testing environment...">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      </PageShell>
    );
  }

  if (error || !data) {
    return (
      <PageShell title="Testing & Distribution" description="Error loading data">
        <div className="p-8 max-w-4xl mx-auto">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
            <h2 className="text-lg font-semibold text-red-400">Failed to load testing dashboard</h2>
            <p className="text-zinc-400 mt-2">{error || "Unknown error"}</p>
            <Link href={`/apps/${id}`}>
              <Button variant="secondary" className="mt-4">
                Return to App
              </Button>
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  const allTesters = data.groups.flatMap((g) => g.testers);
  const displayedTesters =
    filterGroup === "all"
      ? allTesters
      : data.groups.find((g) => g.name === filterGroup)?.testers || [];

  const closed = data.closedTesting;
  const testerPct = Math.min(100, Math.round((closed.currentTesters / closed.requiredTesters) * 100));
  const daysPct = Math.min(100, Math.round((closed.daysCompleted / closed.requiredDays) * 100));

  return (
    <PageShell
      title="Testing & Distribution"
      description={`Automated tester management, Google Play 12-testers/14-days countdown, and TestFlight tracks for ${data.appName}`}
      actions={
        <div className="flex items-center gap-2">
          <Link href={`/apps/${id}/store`}>
            <Button variant="secondary" className="text-xs font-mono">
              <Layers className="w-3.5 h-3.5 mr-1.5 inline" /> Store Metadata
            </Button>
          </Link>
          <Link href={`/releases`}>
            <Button variant="secondary" className="text-xs font-mono">
              <Radio className="w-3.5 h-3.5 mr-1.5 inline" /> Release Pipeline
            </Button>
          </Link>
        </div>
      }
    >
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Top Navigation */}
        <div>
          <Link
            href={`/apps/${id}`}
            className="inline-flex items-center text-xs font-mono text-zinc-400 hover:text-white mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to {data.appName}
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Testing & Tracks</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 font-medium">
              Phase 6 Automation
            </span>
          </div>
        </div>

        {/* Google Play Closed Testing 12 Testers / 14 Days Prerequisites Card */}
        <div className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900/90 to-zinc-950 p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <ShieldCheck className="w-48 h-48 text-indigo-500" />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">Google Play Closed Testing Readiness</h2>
                {closed.isEligibleForProduction ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Eligible for Production
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                    <Clock className="w-3.5 h-3.5" /> In Progress (Required for Personal Dev Accounts)
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Google requires 12 opt-in testers continuously enrolled for at least 14 days before production publishing is unlocked.
              </p>
            </div>

            {!closed.startDate && (
              <Button onClick={handleStartClosedTesting} variant="secondary" className="text-xs shrink-0">
                <Sparkles className="w-3.5 h-3.5 mr-1.5 inline text-amber-400" /> Start 14-Day Clock
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {/* Progress 1: Testers */}
            <div className="bg-zinc-900/60 rounded-xl p-4 border border-zinc-800/60">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
                  <Users className="w-4 h-4 text-indigo-400" /> Enrolled Testers
                </span>
                <span className="font-mono text-zinc-400">
                  <strong className="text-white text-sm">{closed.currentTesters}</strong> / {closed.requiredTesters} testers
                </span>
              </div>
              <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    testerPct >= 100 ? "bg-emerald-500" : "bg-indigo-500"
                  }`}
                  style={{ width: `${testerPct}%` }}
                />
              </div>
              <p className="text-[11px] text-zinc-400 mt-2">
                {closed.currentTesters >= closed.requiredTesters
                  ? "✓ Quorum reached. Maintain enrolled testers during testing window."
                  : `Need ${closed.requiredTesters - closed.currentTesters} more testers to fulfill requirement.`}
              </p>
            </div>

            {/* Progress 2: Days */}
            <div className="bg-zinc-900/60 rounded-xl p-4 border border-zinc-800/60">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
                  <Calendar className="w-4 h-4 text-emerald-400" /> Continuous Testing Period
                </span>
                <span className="font-mono text-zinc-400">
                  <strong className="text-white text-sm">{closed.daysCompleted}</strong> / {closed.requiredDays} days
                </span>
              </div>
              <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    daysPct >= 100 ? "bg-emerald-500" : "bg-emerald-500/80"
                  }`}
                  style={{ width: `${daysPct}%` }}
                />
              </div>
              <p className="text-[11px] text-zinc-400 mt-2">
                {closed.startDate
                  ? `Active since ${new Date(closed.startDate).toLocaleDateString()}. ${
                      closed.daysCompleted >= closed.requiredDays
                        ? "✓ 14-day duration requirement completed."
                        : `${closed.requiredDays - closed.daysCompleted} days remaining.`
                    }`
                  : "Clock will start automatically when your first tester is added to Closed Testing."}
              </p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-zinc-950/60 rounded-lg border border-zinc-800/40 text-xs text-zinc-400 flex items-center justify-between">
            <span>
              <strong>Status:</strong> {closed.statusSummary}
            </span>
          </div>
        </div>

        {/* Store & Public Distribution Links Card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Official Track & Distribution Links</h2>
            <p className="text-xs text-zinc-400">
              Authentic opt-in URLs and store destinations for testers and end users.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Google Play Opt-In URL */}
            {data.storeLinks.googlePlayOptInUrl && (
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                    Google Play Opt-In URL (Closed Testing)
                  </span>
                  <a
                    href={data.storeLinks.googlePlayOptInUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-zinc-500 hover:text-zinc-300"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-zinc-300 truncate flex-1 bg-zinc-900 px-2 py-1.5 rounded border border-zinc-800">
                    {data.storeLinks.googlePlayOptInUrl}
                  </code>
                  <Button
                    variant="secondary"
                    onClick={() => copyToClipboard(data.storeLinks.googlePlayOptInUrl!, "play-optin")}
                    className="shrink-0 text-xs font-mono py-1 px-2"
                  >
                    {copiedKey === "play-optin" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            )}

            {/* TestFlight Invite Link */}
            {data.storeLinks.testFlightPublicUrl ? (
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-blue-400 flex items-center gap-1.5">
                    Apple TestFlight Public Invite
                  </span>
                  <a
                    href={data.storeLinks.testFlightPublicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-zinc-500 hover:text-zinc-300"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-zinc-300 truncate flex-1 bg-zinc-900 px-2 py-1.5 rounded border border-zinc-800">
                    {data.storeLinks.testFlightPublicUrl}
                  </code>
                  <Button
                    variant="secondary"
                    onClick={() => copyToClipboard(data.storeLinks.testFlightPublicUrl!, "tf-invite")}
                    className="shrink-0 text-xs font-mono py-1 px-2"
                  >
                    {copiedKey === "tf-invite" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-blue-400">Apple TestFlight Link</span>
                </div>
                <p className="text-xs text-zinc-400">
                  TestFlight links generate automatically upon App Store Connect beta distribution.
                </p>
              </div>
            )}

            {/* Google Play Public Store */}
            {data.storeLinks.googlePlayPublicUrl && (
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                    Google Play Public Store Page
                  </span>
                  <a
                    href={data.storeLinks.googlePlayPublicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-zinc-500 hover:text-zinc-300"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-zinc-300 truncate flex-1 bg-zinc-900 px-2 py-1.5 rounded border border-zinc-800">
                    {data.storeLinks.googlePlayPublicUrl}
                  </code>
                  <Button
                    variant="secondary"
                    onClick={() => copyToClipboard(data.storeLinks.googlePlayPublicUrl!, "play-public")}
                    className="shrink-0 text-xs font-mono py-1 px-2"
                  >
                    {copiedKey === "play-public" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Internal App Sharing */}
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  Internal App Sharing
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Direct zero-review installation links generated via Google Play developer API for internal team testing.
              </p>
            </div>
          </div>
        </div>

        {/* Tester Groups & Testers Section */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Tester Management</h2>
              <p className="text-xs text-zinc-400">
                Add testers to internal tracks and closed testing groups.
              </p>
            </div>

            {/* Add Tester Inline Form */}
            <form onSubmit={handleAddTester} className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="email"
                placeholder="tester@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 w-full sm:w-64"
              />
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
              >
                {data.groups.map((g) => (
                  <option key={g.id} value={g.name}>
                    {g.name}
                  </option>
                ))}
              </select>
              <Button type="submit" disabled={addingTester} className="text-xs shrink-0 py-1.5 px-3">
                <Plus className="w-3.5 h-3.5 mr-1 inline" /> Add Tester
              </Button>
            </form>
          </div>

          {/* Group Filter Tabs */}
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 overflow-x-auto">
            <button
              onClick={() => setFilterGroup("all")}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                filterGroup === "all"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              All Groups ({allTesters.length})
            </button>
            {data.groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setFilterGroup(g.name)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5 ${
                  filterGroup === g.name
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <span>{g.name}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-900 border border-zinc-700">
                  {g.testers.length}
                </span>
              </button>
            ))}
          </div>

          {/* Testers Table */}
          {displayedTesters.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-xl">
              No testers added yet. Use the form above to enroll your first tester.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 font-mono">
                    <th className="pb-3 font-medium">Tester Email</th>
                    <th className="pb-3 font-medium">Group</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Enrolled At</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {displayedTesters.map((t) => (
                    <tr key={t.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 font-medium text-white">{t.email}</td>
                      <td className="py-3 text-zinc-400">{t.groupName}</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize font-medium">
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3 text-zinc-400 font-mono text-[11px]">
                        {new Date(t.addedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleRemoveTester(t.id)}
                          className="text-zinc-500 hover:text-red-400 p-1 rounded transition-colors"
                          title="Remove tester"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Active Releases on Distribution Tracks */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Active Releases on Tracks</h2>
            <Link href="/releases">
              <Button variant="secondary" className="text-xs py-1 px-2.5">
                View All Releases
              </Button>
            </Link>
          </div>

          {data.activeReleases.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-xl">
              No releases built yet. Create and compile a release to see it on distribution tracks.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.activeReleases.map((rel, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">
                      v{rel.version} ({rel.buildNumber})
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full uppercase font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {rel.track}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="capitalize">{rel.platform}</span>
                    <span className="text-emerald-400 font-medium capitalize">{rel.status}</span>
                  </div>
                  <div className="text-[11px] text-zinc-400 font-mono">
                    Updated {new Date(rel.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
