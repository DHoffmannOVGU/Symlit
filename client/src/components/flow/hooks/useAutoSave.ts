import { useEffect, useRef } from "react";
import { emitTutorialSignal } from "@/lib/tutorial-signals";
import { useDiagramStore, useDiagramStoreApi } from "../state/DiagramStoreProvider";

/** How long the diagram must be left alone before it is saved. */
export const AUTO_SAVE_DELAY_MS = 1500;

interface UseAutoSaveParams {
  /** The "Save automatically" canvas setting. */
  enabled: boolean;
  isDirty: boolean;
  isSaving: boolean;
  save: (options?: { quiet?: boolean }) => Promise<void>;
}

/**
 * Saves the open diagram a moment after the last change, without a toast
 * (the header shows "Saving…" and "All changes saved"). A failed save is
 * reported once and not retried until the diagram changes again, so a server
 * problem does not turn into a stream of error messages.
 */
export function useAutoSave({ enabled, isDirty, isSaving, save }: UseAutoSaveParams) {
  const diagramStore = useDiagramStoreApi();
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const failedFor = useRef<{ nodes: unknown; edges: unknown } | null>(null);

  useEffect(() => {
    if (!enabled || !isDirty || isSaving) return;
    if (failedFor.current?.nodes === nodes && failedFor.current?.edges === edges) return;
    const timer = window.setTimeout(() => {
      save({ quiet: true })
        .then(() => {
          failedFor.current = null;
          emitTutorialSignal("saved");
        })
        .catch(() => {
          const state = diagramStore.getState();
          failedFor.current = { nodes: state.nodes, edges: state.edges };
        });
    }, AUTO_SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [diagramStore, edges, enabled, isDirty, isSaving, nodes, save]);
}
