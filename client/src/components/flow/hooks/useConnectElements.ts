import { useCallback } from "react";
import { addEdge, type Connection } from "@xyflow/react";
import type { MagicRelationType } from "@shared/metamodel-setup";
import { normalizeHandleId } from "@shared/relationships";
import { dispatchDiagramEvent } from "@/lib/diagram-events";
import { newEdgeId } from "@/lib/ids";
import type { PendingEdgeRelationConfirmation } from "../edges/EdgeRelationConfirmation";
import type { DiagramEdge } from "../types";
import { useDiagramStore, useDiagramStoreApi } from "../state/DiagramStoreProvider";
import { useDiagramModel } from "../state/DiagramModelProvider";
import { inferFlowTypeFromNodes } from "../utils/flow-type";
import {
  allowedRelations,
  defaultRelation,
  newRelationshipEdge,
  relationOptions,
  typeIdOf,
} from "../utils/relationship-defaults";

/**
 * Adds a relationship unless the same one (same elements and handles) already
 * exists. Returns whether it was added.
 */
export function useAddRelationship() {
  const diagramStore = useDiagramStoreApi();
  const setEdges = useDiagramStore((state) => state.setEdges);
  const { viewId } = useDiagramModel();
  return useCallback(
    (edge: DiagramEdge) => {
      const current = diagramStore.getState().edges;
      const next = addEdge<DiagramEdge>(edge, current);
      if (next.length === current.length) return false;
      setEdges(next);
      dispatchDiagramEvent("diagram-model-edge-created", { viewId, edgeId: edge.id });
      return true;
    },
    [diagramStore, setEdges, viewId],
  );
}

/**
 * Drawing a relationship between two elements. In an instance model the
 * metamodel decides the default type (and the user can pick another one via
 * `onEdgeCreated`); in a metamodel it is the first allowed relationship type.
 */
export function useConnectElements({
  allowedEdgeTypes,
  onEdgeCreated,
}: {
  allowedEdgeTypes?: MagicRelationType[];
  onEdgeCreated?: (confirmation: PendingEdgeRelationConfirmation | null) => void;
}) {
  const diagramStore = useDiagramStoreApi();
  const takeSnapshot = useDiagramStore((state) => state.takeSnapshot);
  const { projectType, relationEdges, typeMetaById, parentMap } = useDiagramModel();
  const addRelationship = useAddRelationship();

  return useCallback(
    (connection: Connection) => {
      if (projectType === "metamodel" && allowedEdgeTypes?.length === 0) return;
      const nodes = diagramStore.getState().nodes;
      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);
      const inferredFlow = inferFlowTypeFromNodes(sourceNode, targetNode);

      const matches =
        projectType === "instance"
          ? allowedRelations(typeIdOf(sourceNode, typeMetaById), typeIdOf(targetNode, typeMetaById), parentMap, relationEdges)
          : [];
      const suggested = defaultRelation(matches);
      const edgeType: MagicRelationType =
        projectType === "metamodel"
          ? (allowedEdgeTypes?.[0] ?? "association")
          : ((suggested?.edgeType as MagicRelationType | undefined) ?? "association");

      const id = newEdgeId();
      const before = diagramStore.getState();
      const added = addRelationship(
        newRelationshipEdge({
          id,
          source: connection.source,
          target: connection.target,
          sourceHandle: normalizeHandleId("source", connection.sourceHandle),
          targetHandle: normalizeHandleId("target", connection.targetHandle),
          edgeType,
          label: suggested?.label,
          flowType: suggested?.flowType ?? inferredFlow,
        }),
      );
      if (added) takeSnapshot(before.nodes, before.edges);
      if (projectType === "instance") {
        onEdgeCreated?.(
          added && suggested
            ? { edgeId: id, options: relationOptions(matches, typeMetaById), selectedRelationId: suggested.id }
            : null,
        );
      }
    },
    [addRelationship, allowedEdgeTypes, diagramStore, onEdgeCreated, parentMap, projectType, relationEdges, takeSnapshot, typeMetaById],
  );
}
