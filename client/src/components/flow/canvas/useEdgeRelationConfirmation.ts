import type { DiagramEdge } from "../types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getEdgeSemanticDefaults, getEdgeMarkers, type CustomEdgeData } from "../edges/CustomEdges";
import { type PendingEdgeRelationConfirmation } from "../edges/EdgeRelationConfirmation";

export interface UseEdgeRelationConfirmationParams {
  viewId: number;
  setEdges: React.Dispatch<React.SetStateAction<DiagramEdge[]>>;
}

export function useEdgeRelationConfirmation({
  viewId,
  setEdges,
}: UseEdgeRelationConfirmationParams) {
  const [pendingEdgeRelation, setPendingEdgeRelation] =
    useState<PendingEdgeRelationConfirmation | null>(null);
  useEffect(() => {
    setPendingEdgeRelation(null);
  }, [viewId]);

  const handleCanvasEdgeCreated = useCallback(
    (confirmation: PendingEdgeRelationConfirmation | null) => {
      setPendingEdgeRelation(confirmation);
    },
    [],
  );

  const handleConfirmEdgeRelation = useCallback(
    (edgeId: string, relationId: string) => {
      if (!pendingEdgeRelation || pendingEdgeRelation.edgeId !== edgeId) return;
      const relation = pendingEdgeRelation.options.find(
        (option) => option.id === relationId,
      );
      if (!relation) return;

      setEdges((current) =>
        current.map((edge) => {
          if (edge.id !== edgeId) return edge;
          const existingData =
            (edge.data as CustomEdgeData | undefined) ?? {
              edgeType: relation.edgeType,
            };
          const { data, markerStart, markerEnd } = getEdgeMarkers({
            ...existingData,
            ...getEdgeSemanticDefaults(relation.edgeType),
            edgeType: relation.edgeType,
            flowType: relation.flowType,
            label: relation.label,
          });
          return {
            ...edge,
            type: data.edgeType,
            data,
            markerStart,
            markerEnd,
          };
        }),
      );
      setPendingEdgeRelation(null);
    },
    [pendingEdgeRelation, setEdges],
  );

  const handleRejectEdgeRelation = useCallback(
    (edgeId: string) => {
      if (!pendingEdgeRelation || pendingEdgeRelation.edgeId !== edgeId) return;
      setEdges((current) =>
        current.map((edge) => {
          if (edge.id !== edgeId) return edge;
          const existingData =
            (edge.data as CustomEdgeData | undefined) ?? {
              edgeType: "association",
            };
          const { data, markerStart, markerEnd } = getEdgeMarkers({
            ...existingData,
            label: undefined,
          });
          return { ...edge, data, markerStart, markerEnd };
        }),
      );
      setPendingEdgeRelation(null);
    },
    [pendingEdgeRelation, setEdges],
  );

  const edgeRelationConfirmationValue = useMemo(
    () => ({
      pending: pendingEdgeRelation,
      onConfirm: handleConfirmEdgeRelation,
      onReject: handleRejectEdgeRelation,
    }),
    [handleConfirmEdgeRelation, handleRejectEdgeRelation, pendingEdgeRelation],
  );

  return {
    handleCanvasEdgeCreated,
    edgeRelationConfirmationValue,
  };
}
