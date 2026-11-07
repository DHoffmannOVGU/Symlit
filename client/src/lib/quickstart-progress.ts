export interface QuickstartProgress {
  visitedViewIds: number[];
  createdNode: boolean;
  createdEdge: boolean;
  saved: boolean;
}

export type QuickstartProgressUpdate = Partial<
  Omit<QuickstartProgress, "visitedViewIds">
> & {
  visitedViewId?: number;
};

const EMPTY_PROGRESS: QuickstartProgress = {
  visitedViewIds: [],
  createdNode: false,
  createdEdge: false,
  saved: false,
};

function storageKey(userId: number, projectId: number) {
  return `symlit_quickstart_progress:${userId}:${projectId}`;
}

function normalizeProgress(value: unknown): QuickstartProgress {
  if (!value || typeof value !== "object") return { ...EMPTY_PROGRESS };
  const record = value as Partial<QuickstartProgress>;
  return {
    visitedViewIds: Array.isArray(record.visitedViewIds)
      ? record.visitedViewIds.filter(
          (viewId): viewId is number =>
            Number.isInteger(viewId) && viewId > 0,
        )
      : [],
    createdNode: record.createdNode === true,
    createdEdge: record.createdEdge === true,
    saved: record.saved === true,
  };
}

export function getQuickstartProgress(
  userId?: number,
  projectId?: number,
): QuickstartProgress {
  if (!userId || !projectId || typeof window === "undefined") {
    return { ...EMPTY_PROGRESS };
  }

  try {
    const stored = window.localStorage.getItem(storageKey(userId, projectId));
    return stored ? normalizeProgress(JSON.parse(stored)) : { ...EMPTY_PROGRESS };
  } catch {
    return { ...EMPTY_PROGRESS };
  }
}

export function updateQuickstartProgress(
  userId: number,
  projectId: number,
  update: QuickstartProgressUpdate,
): QuickstartProgress {
  const current = getQuickstartProgress(userId, projectId);
  const next: QuickstartProgress = {
    ...current,
    ...(typeof update.createdNode === "boolean"
      ? { createdNode: current.createdNode || update.createdNode }
      : {}),
    ...(typeof update.createdEdge === "boolean"
      ? { createdEdge: current.createdEdge || update.createdEdge }
      : {}),
    ...(typeof update.saved === "boolean"
      ? { saved: current.saved || update.saved }
      : {}),
    visitedViewIds:
      update.visitedViewId &&
      !current.visitedViewIds.includes(update.visitedViewId)
        ? [...current.visitedViewIds, update.visitedViewId]
        : current.visitedViewIds,
  };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey(userId, projectId), JSON.stringify(next));
  }
  return next;
}