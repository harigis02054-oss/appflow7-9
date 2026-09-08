export type TeamRole =
  | "owner"
  | "admin"
  | "developer"
  | "qa"
  | "release_manager"
  | "viewer";

export type TeamPermission =
  | "create_app"
  | "delete_app"
  | "manage_credentials"
  | "trigger_build"
  | "manage_testers"
  | "approve_release"
  | "publish_production"
  | "view_releases";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  avatarUrl?: string;
  addedAt: string;
  status: "active" | "invited";
}

export const ROLE_PERMISSIONS: Record<TeamRole, TeamPermission[]> = {
  owner: [
    "create_app",
    "delete_app",
    "manage_credentials",
    "trigger_build",
    "manage_testers",
    "approve_release",
    "publish_production",
    "view_releases",
  ],
  admin: [
    "create_app",
    "manage_credentials",
    "trigger_build",
    "manage_testers",
    "approve_release",
    "publish_production",
    "view_releases",
  ],
  developer: [
    "trigger_build",
    "manage_testers",
    "view_releases",
  ],
  qa: [
    "manage_testers",
    "approve_release",
    "view_releases",
  ],
  release_manager: [
    "trigger_build",
    "manage_testers",
    "approve_release",
    "publish_production",
    "view_releases",
  ],
  viewer: [
    "view_releases",
  ],
};

export function hasPermission(role: TeamRole, permission: TeamPermission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}
