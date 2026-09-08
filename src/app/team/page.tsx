"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui";
import type { TeamMember, TeamRole, TeamPermission } from "@/lib/team/types";
import { ROLE_PERMISSIONS } from "@/lib/team/types";
import {
  Users,
  Shield,
  UserPlus,
  Trash2,
  CheckCircle2,
  XCircle,
  KeyRound,
  Lock,
} from "lucide-react";

const ALL_ROLES: TeamRole[] = [
  "owner",
  "admin",
  "release_manager",
  "developer",
  "qa",
  "viewer",
];

const PERMISSION_LABELS: Record<TeamPermission, string> = {
  create_app: "Create Applications",
  delete_app: "Delete Applications",
  manage_credentials: "Manage Signing & Store Credentials",
  trigger_build: "Trigger Builds & Compiles",
  manage_testers: "Manage Testers & Groups",
  approve_release: "Approve Release Candidates",
  publish_production: "Publish to Production / App Store",
  view_releases: "View Builds & Releases",
};

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [currentUser, setCurrentUser] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);

  // Invite form state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<TeamRole>("developer");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadTeam();
  }, []);

  async function loadTeam() {
    try {
      const res = await fetch("/api/team");
      if (!res.ok) return;
      const data = await res.json();
      setMembers(data.members || []);
      setCurrentUser(data.currentUser || null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim(),
          role: newRole,
        }),
      });
      if (res.ok) {
        setNewName("");
        setNewEmail("");
        await loadTeam();
      }
    } catch {
      alert("Failed to invite member");
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(id: string, role: TeamRole) {
    try {
      await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-role",
          id,
          role,
        }),
      });
      await loadTeam();
    } catch {
      alert("Failed to update role");
    }
  }

  async function handleRemove(id: string) {
    if (!confirm("Are you sure you want to remove this team member?")) return;
    try {
      await fetch(`/api/team?id=${id}`, { method: "DELETE" });
      await loadTeam();
    } catch {
      alert("Failed to remove member");
    }
  }

  const formatRole = (role: string) =>
    role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <PageShell
      title="Team & Permissions (RBAC)"
      description="Manage organization members, roles, and granular release publishing permissions."
    >
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Top Current User Banner */}
        {currentUser && (
          <div className="rounded-2xl border border-zinc-800 bg-gradient-to-r from-zinc-900 via-zinc-900 to-indigo-950/40 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-lg">
                {currentUser.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-white">{currentUser.name}</h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase font-semibold">
                    {formatRole(currentUser.role)}
                  </span>
                  <span className="text-[11px] text-zinc-400 font-mono">(Current Session)</span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">{currentUser.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-950/60 px-3.5 py-2 rounded-xl border border-zinc-800/80">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>
                Authorized to: <strong>{ROLE_PERMISSIONS[currentUser.role].length} platform actions</strong>
              </span>
            </div>
          </div>
        )}

        {/* Invite Member Section */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Invite Team Member</h2>
              <p className="text-xs text-zinc-400">
                Assign roles with pre-configured access to builds, credentials, testing, and production approvals.
              </p>
            </div>
          </div>

          <form onSubmit={handleInvite} className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
            <input
              type="text"
              placeholder="Full Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            <input
              type="email"
              placeholder="name@company.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as TeamRole)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-2 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 capitalize"
            >
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {formatRole(r)}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={inviting} className="text-xs py-2">
              <UserPlus className="w-3.5 h-3.5 mr-1.5 inline" /> Invite Member
            </Button>
          </form>
        </div>

        {/* Team Members List */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Active Team Members ({members.length})</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 font-mono">
                  <th className="pb-3 font-medium">Member</th>
                  <th className="pb-3 font-medium">Role</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Joined</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3">
                      <div className="font-medium text-white">{m.name}</div>
                      <div className="text-[11px] text-zinc-400 font-mono">{m.email}</div>
                    </td>
                    <td className="py-3">
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.id, e.target.value as TeamRole)}
                        className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 capitalize"
                      >
                        {ALL_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {formatRole(r)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize font-medium">
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3 text-zinc-400 font-mono text-[11px]">
                      {new Date(m.addedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-right">
                      {m.role !== "owner" && (
                        <button
                          onClick={() => handleRemove(m.id)}
                          className="text-zinc-500 hover:text-red-400 p-1 rounded transition-colors"
                          title="Remove member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* RBAC Permissions Matrix Table */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Role-Based Access Matrix</h2>
            <p className="text-xs text-zinc-400">
              Clear breakdown of platform capabilities across each team role.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-zinc-800 rounded-xl overflow-hidden">
              <thead className="bg-zinc-950/80">
                <tr className="border-b border-zinc-800 text-zinc-400 font-mono">
                  <th className="p-3 font-medium">Permission</th>
                  {ALL_ROLES.map((role) => (
                    <th key={role} className="p-3 font-medium text-center capitalize">
                      {formatRole(role)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/30">
                {(Object.keys(PERMISSION_LABELS) as TeamPermission[]).map((perm) => (
                  <tr key={perm} className="hover:bg-zinc-800/20">
                    <td className="p-3 font-medium text-zinc-300">
                      {PERMISSION_LABELS[perm]}
                    </td>
                    {ALL_ROLES.map((role) => {
                      const allowed = ROLE_PERMISSIONS[role].includes(perm);
                      return (
                        <td key={role} className="p-3 text-center">
                          {allowed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 inline" />
                          ) : (
                            <span className="text-zinc-700 font-mono">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
