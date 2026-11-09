import { useCallback, useMemo } from "react";
import { isSaveConflict, useSyncFlow, type InsertFlowEdge, type InsertFlowNode } from "@/hooks/use-flow";
import { flowSyncInputSchema } from "@shared/routes";
import { useDiagramStore, useDiagramStoreApi } from "../state/DiagramStoreProvider";
import { useDiagramModel } from "../state/DiagramModelProvider";
import { diagramSignature, toSavePayload } from "./diagram-serialization";

/** Saving the open diagram, and whether it has unsaved changes. */
export function useDiagramSaving() {
  const { viewId, projectType } = useDiagramModel();
  const syncMutation = useSyncFlow();
  const diagramStore = useDiagramStoreApi();
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const savedSignature = useDiagramStore((state) => state.savedSignature);
  const setSavedSignature = useDiagramStore((state) => state.setSavedSignature);

  /**
   * Saves the diagram. The save names the revision it is based on; when the
   * stored diagram changed in the meantime it is refused and the conflict
   * dialog opens. `overwrite` saves regardless.
   */
  const saveAsync = useCallback(
    async (options: { overwrite?: boolean } = {}) => {
      const { nodes: current, edges: currentEdges, revision, setRevision, setSaveConflict } =
        diagramStore.getState();
      const payload = toSavePayload(current, currentEdges, projectType);
      try {
        const result = await syncMutation.mutateAsync({
          viewId,
          ...payload,
          baseRevision: options.overwrite ? undefined : (revision ?? undefined),
        });
        setRevision(result?.revision ?? null);
        setSaveConflict(false);
      } catch (error) {
        if (isSaveConflict(error)) setSaveConflict(true);
        throw error;
      }
      setSavedSignature(diagramSignature(payload.nodes, payload.edges, projectType));
    },
    [diagramStore, projectType, setSavedSignature, syncMutation, viewId],
  );

  /** Saves without waiting (errors are reported by the mutation's toast). */
  const save = useCallback(() => {
    saveAsync().catch(() => undefined);
  }, [saveAsync]);

  /** Saves a repaired diagram from the recovery dialog (already in stored form). */
  const saveRecovered = useCallback(
    async (nodesToSave: InsertFlowNode[], edgesToSave: InsertFlowEdge[]) => {
      const validation = flowSyncInputSchema.safeParse({ nodes: nodesToSave, edges: edgesToSave });
      if (!validation.success) {
        throw new Error(validation.error.issues[0]?.message ?? "Invalid diagram data");
      }
      const result = await syncMutation.mutateAsync({ viewId, nodes: nodesToSave, edges: edgesToSave });
      diagramStore.getState().setRevision(result?.revision ?? null);
      setSavedSignature(diagramSignature(nodesToSave, edgesToSave, projectType));
    },
    [diagramStore, projectType, setSavedSignature, syncMutation, viewId],
  );

  const currentSignature = useMemo(() => diagramSignature(nodes, edges, projectType), [nodes, edges, projectType]);
  const isDirty = savedSignature !== "" && currentSignature !== savedSignature;

  return { save, saveAsync, saveRecovered, isSaving: syncMutation.isPending, isDirty };
}
