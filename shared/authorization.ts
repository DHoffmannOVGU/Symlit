export const ROLE_NAMES = [
  "guest",
  "viewer",
  "engineer",
  "architect",
  "admin",
] as const;

export type WorkspaceRole = (typeof ROLE_NAMES)[number];

const ROLE_LEVELS: Record<WorkspaceRole, number> = {
  guest: 0,
  viewer: 1,
  engineer: 2,
  architect: 3,
  admin: 4,
};

export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return typeof value === "string" && ROLE_NAMES.includes(value as WorkspaceRole);
}

export function roleAtLeast(
  actual: WorkspaceRole,
  required: WorkspaceRole,
): boolean {
  return ROLE_LEVELS[actual] >= ROLE_LEVELS[required];
}

export function roleCapabilities(role: WorkspaceRole) {
  return {
    canView: roleAtLeast(role, "viewer"),
    canEditInstances: roleAtLeast(role, "engineer"),
    canEditMetamodels: roleAtLeast(role, "architect"),
    canManageMembers: roleAtLeast(role, "admin"),
    // Guests may create an isolated project, but cannot use team features.
    canCreateProjects: true,
  };
}