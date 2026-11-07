const RECENT_PROJECTS_KEY = "symlit_recent_projects";
const MAX_RECENT_PROJECTS = 6;

export interface RecentProject {
  projectId: number;
  openedAt: number;
}

function storageKey(userId: number) {
  return `${RECENT_PROJECTS_KEY}:${userId}`;
}

export function getRecentProjects(userId?: number): RecentProject[] {
  if (!userId || typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(storageKey(userId));
    if (!stored) return [];

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    // Migrate the original id-only format while preserving its order.
    return parsed
      .map((entry, index): RecentProject | null => {
        if (Number.isInteger(entry) && entry > 0) {
          return { projectId: entry, openedAt: 0 };
        }
        if (
          typeof entry === "object" &&
          entry !== null &&
          "projectId" in entry &&
          "openedAt" in entry &&
          Number.isInteger(entry.projectId) &&
          entry.projectId > 0 &&
          typeof entry.openedAt === "number" &&
          entry.openedAt >= 0
        ) {
          return {
            projectId: entry.projectId,
            openedAt: entry.openedAt,
          };
        }
        return null;
      })
      .filter((entry): entry is RecentProject => entry !== null)
      .slice(0, MAX_RECENT_PROJECTS);
  } catch {
    return [];
  }
}

export function rememberRecentProject(userId: number, projectId: number) {
  if (typeof window === "undefined") return;

  const recentProjects = getRecentProjects(userId);
  const nextRecentProjectIds = [
    { projectId, openedAt: Date.now() },
    ...recentProjects.filter((entry) => entry.projectId !== projectId),
  ].slice(0, MAX_RECENT_PROJECTS);

  window.localStorage.setItem(
    storageKey(userId),
    JSON.stringify(nextRecentProjectIds),
  );
}