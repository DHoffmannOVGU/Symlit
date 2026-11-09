import { normalizeRelationship } from "@shared/relationships";
import { useQueryClient } from "@tanstack/react-query";
import { useDiagramModel } from "../state/DiagramModelProvider";
import { useDiagramStore } from "../state/DiagramStoreProvider";
import { emitTutorialSignal } from "@/lib/tutorial-signals";
import { useCallback, useState } from "react";
import type { DiagramNode as Node } from "../types";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";

export interface UsePatternCreationParams {
  selectedNodes: Node[];
  canSavePattern: boolean;
  selectedNodeIds: string[];
}

export function usePatternCreation({
  selectedNodes,
  canSavePattern,
  selectedNodeIds,
}: UsePatternCreationParams) {
  const edges = useDiagramStore((state) => state.edges);
  const { projectId } = useDiagramModel();
  const queryClient = useQueryClient();
  const [patternDialogOpen, setPatternDialogOpen] = useState(false);
  const [patternName, setPatternName] = useState("");
  const [patternDescription, setPatternDescription] = useState("");
  const [patternSnapshot, setPatternSnapshot] = useState<{
    nodes: typeof selectedNodes;
    edges: typeof edges;
  } | null>(null);

  const openPatternDialog = useCallback(() => {
    if (!canSavePattern) return;
    const nodeSet = new Set(selectedNodeIds);
    const snapshotEdges = edges.filter(
      (edge) => nodeSet.has(edge.source) && nodeSet.has(edge.target),
    );
    setPatternSnapshot({ nodes: selectedNodes, edges: snapshotEdges });
    setPatternName("");
    setPatternDescription("");
    setPatternDialogOpen(true);
  }, [canSavePattern, edges, selectedNodeIds, selectedNodes]);

  const handleCreatePattern = useCallback(async () => {
    if (!patternName.trim()) return;
    if (!patternSnapshot || patternSnapshot.nodes.length === 0) return;
    const selectedIds = new Set(patternSnapshot.nodes.map((node) => node.id));
    const isNested = (node: Node) => Boolean(node.parentId && selectedIds.has(node.parentId));
    // Nested elements are positioned relative to their parent; only the
    // others are moved so the pattern is centred on its origin.
    const positions = patternSnapshot.nodes.filter((node) => !isNested(node)).map((node) => node.position);
    const minX = Math.min(...positions.map((p) => p.x));
    const maxX = Math.max(...positions.map((p) => p.x));
    const minY = Math.min(...positions.map((p) => p.y));
    const maxY = Math.max(...positions.map((p) => p.y));
    const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };

    const patternNodesPayload = patternSnapshot.nodes.map((node) => ({
      nodeId: node.id,
      // Nesting is kept when the parent is part of the pattern too.
      parentId: isNested(node) ? node.parentId : null,
      type: node.type || "part",
      position: isNested(node)
        ? node.position
        : { x: node.position.x - center.x, y: node.position.y - center.y },
      data: node.data,
    }));

    const patternEdgesPayload = patternSnapshot.edges.map((edge) => {
      const { id: _id, ...relationship } = normalizeRelationship({
        id: edge.id,
        edgeType: edge.type || edge.data?.edgeType,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        data: edge.data,
      });
      return { ...relationship, source: edge.source, target: edge.target };
    });

    const url = buildUrl(api.patterns.create.path, { projectId });
    await apiRequest(api.patterns.create.method, url, {
      name: patternName.trim(),
      description: patternDescription.trim() || undefined,
      nodes: patternNodesPayload,
      edges: patternEdgesPayload,
    });
    await queryClient.invalidateQueries({
      queryKey: [api.patterns.list.path, projectId],
    });
    setPatternDialogOpen(false);
    setPatternSnapshot(null);
    emitTutorialSignal("pattern-saved");
  }, [
    patternDescription,
    patternName,
    patternSnapshot,
    projectId,
    queryClient,
  ]);

  return {
    openPatternDialog,
    patternDialogOpen,
    setPatternDialogOpen,
    patternName,
    setPatternName,
    patternDescription,
    setPatternDescription,
    patternSnapshot,
    setPatternSnapshot,
    handleCreatePattern,
  };
}
