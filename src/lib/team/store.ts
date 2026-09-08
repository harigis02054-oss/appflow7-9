import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { TeamMember, TeamRole } from "./types";

const BUILDS_DIR = path.join(process.cwd(), ".builds");
const TEAM_FILE = path.join(BUILDS_DIR, "team.json");

function ensureBuildsDir() {
  if (!fs.existsSync(BUILDS_DIR)) {
    fs.mkdirSync(BUILDS_DIR, { recursive: true });
  }
}

export function listTeamMembers(): TeamMember[] {
  ensureBuildsDir();
  if (!fs.existsSync(TEAM_FILE)) {
    const defaultMembers: TeamMember[] = [
      {
        id: "mem_owner",
        name: "Alice Chen",
        email: "alice@appflow.dev",
        role: "owner",
        status: "active",
        addedAt: new Date().toISOString(),
      },
      {
        id: "mem_rm",
        name: "David Vance",
        email: "david@appflow.dev",
        role: "release_manager",
        status: "active",
        addedAt: new Date().toISOString(),
      },
      {
        id: "mem_qa",
        name: "Sara Connor",
        email: "sara@appflow.dev",
        role: "qa",
        status: "active",
        addedAt: new Date().toISOString(),
      },
      {
        id: "mem_dev",
        name: "Leo Miller",
        email: "leo@appflow.dev",
        role: "developer",
        status: "active",
        addedAt: new Date().toISOString(),
      },
    ];
    saveAllTeamMembers(defaultMembers);
    return defaultMembers;
  }

  try {
    const raw = fs.readFileSync(TEAM_FILE, "utf-8");
    return JSON.parse(raw) as TeamMember[];
  } catch (err) {
    console.error("[team-store] Failed to read team.json:", err);
    return [];
  }
}

export function saveAllTeamMembers(members: TeamMember[]) {
  ensureBuildsDir();
  const tempPath = `${TEAM_FILE}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(members, null, 2), "utf-8");
  fs.renameSync(tempPath, TEAM_FILE);
}

export function getTeamMember(id: string): TeamMember | null {
  const members = listTeamMembers();
  return members.find((m) => m.id === id || m.email.toLowerCase() === id.toLowerCase()) || null;
}

export function getCurrentUser(): TeamMember {
  const members = listTeamMembers();
  return (
    members.find((m) => m.role === "owner") ||
    members[0] || {
      id: "mem_fallback",
      name: "Default Admin",
      email: "admin@appflow.dev",
      role: "owner",
      status: "active",
      addedAt: new Date().toISOString(),
    }
  );
}

export function addTeamMember(input: {
  name: string;
  email: string;
  role: TeamRole;
}): TeamMember {
  const members = listTeamMembers();
  const emailLower = input.email.trim().toLowerCase();

  const existing = members.find((m) => m.email.toLowerCase() === emailLower);
  if (existing) {
    existing.name = input.name.trim();
    existing.role = input.role;
    saveAllTeamMembers(members);
    return existing;
  }

  const newMember: TeamMember = {
    id: `mem_${crypto.randomBytes(4).toString("hex")}`,
    name: input.name.trim(),
    email: emailLower,
    role: input.role,
    status: "active",
    addedAt: new Date().toISOString(),
  };

  members.push(newMember);
  saveAllTeamMembers(members);
  return newMember;
}

export function updateTeamMemberRole(id: string, role: TeamRole): TeamMember | null {
  const members = listTeamMembers();
  const member = members.find((m) => m.id === id);
  if (!member) return null;

  member.role = role;
  saveAllTeamMembers(members);
  return member;
}

export function removeTeamMember(id: string): boolean {
  const members = listTeamMembers();
  const filtered = members.filter((m) => m.id !== id);
  if (filtered.length === members.length) return false;

  saveAllTeamMembers(filtered);
  return true;
}
