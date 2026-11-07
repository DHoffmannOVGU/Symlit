import { emitTutorialSignal } from "@/lib/tutorial-signals";
import type { QueryClient } from "@tanstack/react-query";
import type { DiagramEdge } from "../types";
import { useCallback, useState } from "react";
import type { DiagramNode as Node } from "../types";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";

export interface UsePatternCreationParams {
  selectedNodes: Node[];
  edges: DiagramEdge[];
  canSavePattern: boolean;
  selectedNodeIds: string[];
  projectId: number;
  queryClient: QueryClient;
}

export function usePatternCreation({
  selectedNodes,
  edges,
  canSavePattern,
  selectedNodeIds,
  projectId,
  queryClient,
}: UsePatternCreationParams) {
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
    const positions = patternSnapshot.nodes.map((node) => node.position);
    const minX = Math.min(...positions.map((p) => p.x));
    const maxX = Math.max(...positions.map((p) => p.x));
    const minY = Math.min(...positions.map((p) => p.y));
    const maxY = Math.max(...positions.map((p) => p.y));
    const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };

    const patternNodesPayload = patternSnapshot.nodes.map((node) => ({
      nodeId: node.id,
      type: node.type || "part",
      position: {
        x: node.position.x - center.x,
        y: node.position.y - center.y,
      },
      data: node.data,
    }));

    const patternEdgesPayload = patternSnapshot.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
      data: edge.data,
    }));

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
