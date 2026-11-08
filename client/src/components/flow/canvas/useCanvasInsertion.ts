import { useQueryClient } from "@tanstack/react-query";
import { useReactFlow } from "@xyflow/react";
import { useDiagramModel } from "../state/DiagramModelProvider";
import { useDiagramStore } from "../state/DiagramStoreProvider";
import { useCallback, useEffect, useRef } from "react";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { subscribeDiagramEvent } from "@/lib/diagram-events";


export function useCanvasInsertion() {
  const nodes = useDiagramStore((state) => state.nodes);
  const setNodes = useDiagramStore((state) => state.setNodes);
  const setSelectedEdgeId = useDiagramStore((state) => state.setSelectedEdgeId);
  const setSelectedNodeId = useDiagramStore((state) => state.setSelectedNodeId);
  const { viewId } = useDiagramModel();
  const { screenToFlowPosition } = useReactFlow();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const pendingSelectionRef = useRef<{
    beforeIds: Set<string>;
    mode: "single" | "pattern";
    targetNodeId?: string;
  } | null>(null);
  const insertNodeIntoView = useCallback(
    async (nodeId: string, position?: { x: number; y: number }) => {
      pendingSelectionRef.current = {
        beforeIds: new Set(nodes.map((node) => node.id)),
        mode: "single",
        targetNodeId: nodeId,
      };
      try {
        const targetPosition =
          position ??
          screenToFlowPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          });
        const url = buildUrl(api.flow.insertNode.path, { viewId, nodeId });
        await apiRequest(api.flow.insertNode.method, url, {
          position: targetPosition,
        });
        const nodeUrl = buildUrl(api.nodes.get.path, { nodeId });
        const nodeRes = await apiRequest("GET", nodeUrl);
        const insertedNode = api.nodes.get.responses[200].parse(
          await nodeRes.json(),
        );
        if (!insertedNode) throw new Error("Inserted node not found");

        setNodes((current) => {
          if (current.some((node) => node.id === insertedNode.id)) {
            return current.map((node) => ({
              ...node,
              selected: node.id === insertedNode.id,
            }));
          }

          return [
            ...current.map((node) => ({ ...node, selected: false })),
            {
              id: insertedNode.id,
              type: insertedNode.type,
              position: targetPosition,
              selected: true,
              data: insertedNode.data as Record<string, unknown>,
            },
          ];
        });
        setSelectedEdgeId(null);
        setSelectedNodeId(insertedNode.id);
      } catch (error) {
        pendingSelectionRef.current = null;
        console.error("Failed to insert node into view:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to insert node. Please try again.",
        });
      }
    },
    [nodes, screenToFlowPosition, viewId, setNodes, setSelectedEdgeId, setSelectedNodeId, toast],
  );

  const insertPatternIntoView = useCallback(
    async (patternId: number) => {
      pendingSelectionRef.current = {
        beforeIds: new Set(nodes.map((node) => node.id)),
        mode: "pattern",
      };
      try {
        const center = screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        const url = buildUrl(api.flow.insertPattern.path, {
          viewId,
          patternId,
        });
        await apiRequest(api.flow.insertPattern.method, url, {
          position: center,
        });
        await queryClient.invalidateQueries({
          queryKey: [api.flow.get.path, viewId],
        });
      } catch (error) {
        pendingSelectionRef.current = null;
        console.error("Failed to insert pattern into view:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to insert pattern. Please try again.",
        });
      }
    },
    [nodes, queryClient, screenToFlowPosition, toast, viewId],
  );

  useEffect(() => {
    const pending = pendingSelectionRef.current;
    if (!pending) return;
    if (nodes.length === 0) return;

    const newNodeIds = nodes
      .filter((node) => !pending.beforeIds.has(node.id))
      .map((node) => node.id);

    if (pending.mode === "single") {
      const targetId =
        pending.targetNodeId &&
        new Set(nodes.map((node) => node.id)).has(pending.targetNodeId)
          ? pending.targetNodeId
          : newNodeIds[0];

      if (!targetId) return;
      pendingSelectionRef.current = null;
      setSelectedEdgeId(null);
      setNodes((current) =>
        current.map((node) => ({
          ...node,
          selected: node.id === targetId,
        })),
      );
      return;
    }

    if (newNodeIds.length === 0) return;
    const newIdSet = new Set(newNodeIds);
    pendingSelectionRef.current = null;
    setSelectedEdgeId(null);
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        selected: newIdSet.has(node.id),
      })),
    );
  }, [nodes, setNodes, setSelectedEdgeId]);

  useEffect(
    () =>
      subscribeDiagramEvent("insert-pattern-into-view", (detail) => {
        if (detail.viewId !== viewId) return;
        void insertPatternIntoView(detail.patternId);
      }),
    [insertPatternIntoView, viewId],
  );

  return {
    insertNodeIntoView,
  };
}
