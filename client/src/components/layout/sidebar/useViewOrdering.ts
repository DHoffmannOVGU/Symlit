import type { View } from "@shared/schema";

import { useEffect, useMemo, useState } from "react";

const VIEW_ORDER_STORAGE_KEY = "mbse.diagram-view-order";

/** Sorts items by a stored id order; unknown items keep their order at the end. */
export const applyPreferredOrder = <T,>(
  items: T[],
  getId: (item: T) => string,
  preferredOrder: string[] = [],
) => {
  const orderIndex = new Map(
    preferredOrder.map((id, index) => [id, index] as const),
  );
  return items.slice().sort((a, b) => {
    const aIndex = orderIndex.get(getId(a));
    const bIndex = orderIndex.get(getId(b));
    if (aIndex === undefined && bIndex === undefined) return 0;
    if (aIndex === undefined) return 1;
    if (bIndex === undefined) return -1;
    return aIndex - bIndex;
  });
};

export interface UseViewOrderingParams {
  projectId: number;
  views: View[];
}

export function useViewOrdering({
  projectId,
  views,
}: UseViewOrderingParams) {
  const [viewOrderByProject, setViewOrderByProject] = useState<
    Record<string, string[]>
  >(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = window.localStorage.getItem(VIEW_ORDER_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [draggedViewId, setDraggedViewId] = useState<number | null>(null);
  const [viewDropTarget, setViewDropTarget] = useState<{
    id: number;
    position: "before" | "after";
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      VIEW_ORDER_STORAGE_KEY,
      JSON.stringify(viewOrderByProject),
    );
  }, [viewOrderByProject]);

  const viewOrderKey = String(projectId);
  const orderedViews = useMemo(
    () =>
      applyPreferredOrder(
        views,
        (view) => String(view.id),
        viewOrderByProject[viewOrderKey],
      ),
    [viewOrderByProject, viewOrderKey, views],
  );

  const finishViewReorder = (
    targetViewId: number,
    position: "before" | "after",
  ) => {
    if (draggedViewId === null || draggedViewId === targetViewId) {
      setDraggedViewId(null);
      setViewDropTarget(null);
      return;
    }
    const nextOrder = orderedViews.map((view) => view.id);
    const sourceIndex = nextOrder.indexOf(draggedViewId);
    if (sourceIndex >= 0) {
      const [movedId] = nextOrder.splice(sourceIndex, 1);
      const targetIndex = nextOrder.indexOf(targetViewId);
      if (targetIndex < 0) return;
      nextOrder.splice(targetIndex + (position === "after" ? 1 : 0), 0, movedId);
      setViewOrderByProject((current) => ({
        ...current,
        [viewOrderKey]: nextOrder.map(String),
      }));
    }
    setDraggedViewId(null);
    setViewDropTarget(null);
  };

  return {
    draggedViewId,
    setViewDropTarget,
    finishViewReorder,
    viewDropTarget,
    setDraggedViewId,
    orderedViews,
  };
}
