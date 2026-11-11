import { useCallback, useEffect, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { useFlow } from "@/hooks/use-flow";
import { useDiagramStoreApi } from "../state/DiagramStoreProvider";
import type { FlowData } from "@/components/layout/sidebar-parts/types";
import { useDiagramModel } from "../state/DiagramModelProvider";
import { diagramSignature, toCanvasGraph } from "./diagram-serialization";
import { canvasFitOptions } from "../utils/fit-options";

/**
 * Loads the open diagram into the store whenever the server copy changes
 * (unless `suspended`, e.g. while repairing it) and fits it into view once
 * per diagram.
 */
export function useDiagramLoading(suspended: boolean) {
  const { viewId, projectType } = useDiagramModel();
  const { data: flowData, isLoading, isError, refetch } = useFlow(viewId);
  const { fitView } = useReactFlow();
  const diagramStore = useDiagramStoreApi();
  const lastFittedViewId = useRef<number | null>(null);
  const loadedViewId = useRef<number | null>(null);

  const load = useCallback(
    (flow: FlowData, options: { discardLocalChanges?: boolean } = {}) => {
      const state = diagramStore.getState();
      const { nodes, edges } = toCanvasGraph(flow);
      const loadedSignature = diagramSignature(nodes, edges, projectType);
      const revision = flow.revision ?? null;

      const sameDiagram = loadedViewId.current === viewId && state.savedSignature !== "";
      loadedViewId.current = viewId;
      if (sameDiagram && !options.discardLocalChanges) {
        // The server copy is what the canvas was loaded from or saved as
        // (the refresh after a save): nothing to load. Replacing the canvas
        // here would drop the undo history and edits made since.
        if (loadedSignature === state.savedSignature) {
          state.setRevision(revision);
          return;
        }
        // The server copy changed elsewhere while there are unsaved edits:
        // keep the edits and the old revision, so the next save reports the
        // conflict and the user decides.
        const localSignature = diagramSignature(state.nodes, state.edges, projectType);
        if (localSignature !== state.savedSignature) return;
      }

      state.setNodes(nodes);
      state.setEdges(edges);
      // Undo must not cross into another diagram (or the state before a reload).
      state.resetHistory();
      // Compare later edits against what was loaded into the canvas, not the raw
      // server records: loading adds defaults (e.g. relationship markers and line
      // styles), which would otherwise make every diagram with relationships look
      // unsaved right after opening it.
      state.setSavedSignature(loadedSignature);
      state.setRevision(revision);
      state.setSaveConflict(false);
    },
    [diagramStore, projectType, viewId],
  );

  useEffect(() => {
    if (!flowData || suspended) return;
    load(flowData);
  }, [flowData, load, suspended]);

  useEffect(() => {
    if (!flowData || lastFittedViewId.current === viewId) return;
    lastFittedViewId.current = viewId;
    requestAnimationFrame(() => {
      fitView(canvasFitOptions(500));
    });
  }, [flowData, fitView, viewId]);

  /** Replaces the canvas with the stored diagram, dropping unsaved edits. */
  const discardAndReload = useCallback(async () => {
    const result = await refetch();
    if (result.data) load(result.data, { discardLocalChanges: true });
  }, [load, refetch]);

  return { isLoading, isError, reload: refetch, discardAndReload };
}
