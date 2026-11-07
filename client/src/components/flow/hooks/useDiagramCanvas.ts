import { newNodeId } from "@/lib/ids";
// src/diagram/hooks/useDiagramCanvas.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
} from "@xyflow/react";
import { useFlow, useSyncFlow } from "@/hooks/use-flow";
import { dispatchDiagramEvent } from "@/lib/diagram-events";
import type { ProjectType } from "@shared/schema";
import { isMagicRelationType } from "@shared/metamodel-setup";
import { flowSyncInputSchema } from "@shared/routes";
import type { DiagramEdge, DiagramNode } from "../types";
import { useUndoRedo } from "@/hooks/use-undo-redo";
import {
  getLayoutedElementsEntitree,
  NODE_WIDTH,
  NODE_HEIGHT,
} from "../utils/autolayout";
import { layoutSelectedNodesWithDagre } from "../utils/dagre-layout";
import type { InsertFlowEdge, InsertFlowNode } from "@/hooks/use-flow";
import { getEdgeMarkers, type CustomEdgeData } from "../edges/CustomEdges";

type SerializableNode = {
  id: string;
  type?: string | null;
  position: { x: number; y: number };
  data?: unknown;
  parentId?: string | null;
};

type SerializableEdge = {
  id: string;
  source: string;
  target: string;
  edgeType?: unknown;
  type?: unknown;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const canonicalTypeLabel = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  return value === "Part"
    ? "Object"
    : value === "Action"
      ? "Behavior"
      : value === "Agent"
        ? "Performer"
        : value;
};

export const normalizeFlow = (
  nodes: SerializableNode[],
  edges: SerializableEdge[],
  projectType: ProjectType,
) => {
  const defaultType =
    projectType === "metamodel"
      ? "partdef"
      : "part";
  const normalizedNodes = nodes
    .map((node) => {
      const data = isRecord(node.data) ? node.data : {};
      return {
        id: node.id,
        type: node.type || defaultType,
        position: { x: node.position.x, y: node.position.y },
        data: {
          ...data,
          ...(canonicalTypeLabel(data.type) !== undefined
            ? { type: canonicalTypeLabel(data.type) }
            : {}),
        },
        parentId: node.parentId ?? null,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const normalizedEdges = edges
    .map((edge) => {
      const data = isRecord(edge.data) ? edge.data : {};
      const edgeType = normalizeEdgeType(
        edge.edgeType ?? edge.type ?? data.edgeType,
      );
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        edgeType,
        sourceHandle: edge.sourceHandle ?? null,
        targetHandle: edge.targetHandle ?? null,
        data: { ...data, edgeType },
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  return JSON.stringify({ nodes: normalizedNodes, edges: normalizedEdges });
};

export function useDiagramCanvas(
  viewId: number,
  projectType: ProjectType,
  suspendLoad = false,
) {
  const {
    data: flowData,
    isLoading,
    isError,
    refetch: refetchFlow,
  } = useFlow(viewId);
  const syncMutation = useSyncFlow();
  const { screenToFlowPosition, fitView } = useReactFlow();
  const lastFittedViewId = useRef<number | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<DiagramNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<DiagramEdge>([]);
  const [lastSavedSignature, setLastSavedSignature] = useState<string>("");

  const { undo, redo, takeSnapshot, canUndo, canRedo } = useUndoRedo(
    nodes,
    edges,
    setNodes,
    setEdges,
  );

  // load flow
  useEffect(() => {
    if (!flowData) return;
    if (suspendLoad) return;

    const mappedNodes: DiagramNode[] = flowData.nodes.map((n) => {
      const nodeData = isRecord(n.data) ? n.data : {};
      const savedStyle = readSavedNodeStyle(nodeData._nodeStyle);
      return {
        id: n.id,
        type: n.type,
        position: n.position as { x: number; y: number },
        data: {
          ...nodeData,
          ...(canonicalTypeLabel(nodeData.type) !== undefined
            ? { type: canonicalTypeLabel(nodeData.type) }
            : {}),
        },
        ...(n.parentId ? { parentId: n.parentId, extent: "parent" as const } : {}),
        // Restore the size an element was resized to (saved as data._nodeStyle).
        ...(savedStyle ? { style: savedStyle } : {}),
      };
    });

    const mappedEdges: DiagramEdge[] = flowData.edges.map((e) => {
      const edgeData = isRecord(e.data) ? e.data : {};
      const edgeType = normalizeEdgeType(e.edgeType);
      const { data: normalizedData, markerStart, markerEnd } = getEdgeMarkers({
        ...edgeData,
        edgeType,
      });
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? undefined,
        targetHandle: e.targetHandle ?? undefined,
        type: edgeType,
        data: normalizedData,
        markerStart,
        markerEnd,
      };
    });

    setNodes(mappedNodes);
    setEdges(mappedEdges);
    setLastSavedSignature(
      normalizeFlow(
        flowData.nodes as SerializableNode[],
        flowData.edges as SerializableEdge[],
        projectType,
      ),
    );
  }, [flowData, projectType, setNodes, setEdges, suspendLoad]);

  useEffect(() => {
    if (!flowData) return;
    if (lastFittedViewId.current === viewId) return;
    lastFittedViewId.current = viewId;
    requestAnimationFrame(() => {
      fitView({ duration: 500 });
    });
  }, [flowData, fitView, viewId]);

  const onConnect = useCallback(
    (params: Connection) => {
      const { data: normalizedData, markerStart, markerEnd } = getEdgeMarkers({
        edgeType: "association",
      });
      setEdges((eds) =>
        addEdge<DiagramEdge>(
          {
            ...params,
            type: "association",
            data: normalizedData,
            markerStart,
            markerEnd,
          },
          eds,
        ),
      );
    },
    [setEdges],
  );

  const debugInfoById = useMemo(() => {
    if (!flowData?.nodes) {
      return new Map<string, { projectId: number; createdAt: unknown; type: string }>();
    }
    return new Map(
      flowData.nodes.map((node) => [
        node.id,
        {
          projectId: node.projectId,
          createdAt: node.createdAt,
          type: node.type,
        },
      ]),
    );
  }, [flowData]);

  const handleAddNode = useCallback(
    (
      options?: {
        nodeType?: "partdef" | "actiondef" | "concerndef" | "agentdef" | "requirementdef" | "eventdef" | "capabilitydef";
        typeId?: string;
        typeLabel?: string;
        icon?: string;
        color?: string;
        position?: { x: number; y: number };
      },
    ) => {
      takeSnapshot(nodes, edges);
      const id = newNodeId();
      const nodeType =
        projectType === "metamodel"
          ? options?.nodeType ?? "partdef"
          : "part";
      const typeLabel =
        options?.typeLabel ||
        (nodeType === "actiondef"
          ? "Behavior"
          : nodeType === "concerndef"
            ? "Concern"
            : nodeType === "agentdef"
              ? "Performer"
              : nodeType === "requirementdef"
                ? "Requirement"
                : nodeType === "eventdef"
                  ? "Event"
                  : nodeType === "capabilitydef"
                    ? "Capability"
                    : "Object");
      const defaultIcon =
        nodeType === "actiondef"
          ? "Zap"
          : nodeType === "concerndef"
            ? "Shield"
            : nodeType === "agentdef"
              ? "Bot"
              : nodeType === "requirementdef"
                ? "BadgeCheck"
                : nodeType === "eventdef"
                  ? "Radio"
                  : nodeType === "capabilitydef"
                    ? "Gem"
                    : "Box";
      const absCenter = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });

      const center = options?.position ?? absCenter;

      const newNode: DiagramNode = {
        id,
        type: nodeType,
        position: {
          x: center.x - NODE_WIDTH / 2 + (Math.random() - 0.5) * 50,
          y: center.y - NODE_HEIGHT / 2 + (Math.random() - 0.5) * 50,
        },
        data: {
          label: `New ${typeLabel} ${nodes.length + 1}`,
          attributes: [],
          ...(projectType === "metamodel"
            ? {
                type: typeLabel,
                icon: options?.icon ?? defaultIcon,
                ...(options?.color ? { color: options.color } : {}),
              }
            : {}),
          ...(options?.typeId
            ? {
                type: typeLabel,
                typeId: options.typeId,
                icon: options.icon,
                color: options.color,
                inheritStyle: true,
              }
            : {}),
        },
      };

      setNodes((nds) => [...nds, newNode]);
      dispatchDiagramEvent("diagram-model-node-created", {
        viewId,
        nodeId: id,
      });
    },
    [
      takeSnapshot,
      nodes,
      edges,
      projectType,
      screenToFlowPosition,
      setNodes,
      viewId,
    ],
  );

  const handleAutoLayout = useCallback(() => {
    if (nodes.length === 0) return;
    takeSnapshot(nodes, edges);
    const { nodes: layoutedNodes, edges: layoutedEdges } =
      getLayoutedElementsEntitree(nodes, edges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    // Fit after the new positions have rendered.
    requestAnimationFrame(() => {
      fitView({ duration: 800 });
    });
  }, [nodes, edges, setNodes, setEdges, takeSnapshot, fitView]);

  const handleLayoutSelected = useCallback(
    (direction: "TB" | "LR", selectedNodeIds: string[]) => {
      if (selectedNodeIds.length === 0) return;
      setNodes((currentNodes) => {
        takeSnapshot(currentNodes, edges);
        return layoutSelectedNodesWithDagre(
          currentNodes,
          edges,
          selectedNodeIds,
          direction,
        );
      });
    },
    [edges, setNodes, takeSnapshot],
  );

  const handleCenterSelected = useCallback(
    (axis: "x" | "y", selectedNodeIds: string[]) => {
      if (selectedNodeIds.length === 0) return;
      setNodes((currentNodes) => {
        const selected = currentNodes.filter((node) =>
          selectedNodeIds.includes(node.id),
        );
        if (selected.length === 0) return currentNodes;
        takeSnapshot(currentNodes, edges);

        if (axis === "x") {
          const centerX =
            selected.reduce((sum, node) => {
              const width = node.width ?? NODE_WIDTH;
              return sum + node.position.x + width / 2;
            }, 0) / selected.length;
          return currentNodes.map((node) => {
            if (!selectedNodeIds.includes(node.id)) return node;
            const width = node.width ?? NODE_WIDTH;
            return {
              ...node,
              position: {
                x: centerX - width / 2,
                y: node.position.y,
              },
            };
          });
        }

        const centerY =
          selected.reduce((sum, node) => {
            const height = node.height ?? NODE_HEIGHT;
            return sum + node.position.y + height / 2;
          }, 0) / selected.length;
        return currentNodes.map((node) => {
          if (!selectedNodeIds.includes(node.id)) return node;
          const height = node.height ?? NODE_HEIGHT;
          return {
            ...node,
            position: {
              x: node.position.x,
              y: centerY - height / 2,
            },
          };
        });
      });
    },
    [edges, setNodes, takeSnapshot],
  );

  const buildSavePayload = useCallback(
    (nodesInput: DiagramNode[], edgesInput: DiagramEdge[]) => {
      const filteredNodes = nodesInput;
      const filteredEdges = edgesInput;

      const nodesToSave: InsertFlowNode[] = filteredNodes.map((n) => {
        const nodeStyle = n.style as { width?: number; height?: number } | undefined;
        const shouldSaveStyle = nodeStyle?.width != null || nodeStyle?.height != null;
        return {
          id: n.id,
          type:
            n.type ||
            (projectType === "metamodel"
              ? "partdef"
              : "part"),
          position: n.position,
          data: {
            ...n.data,
            ...(shouldSaveStyle ? { _nodeStyle: { width: nodeStyle!.width, height: nodeStyle!.height } } : {}),
          },
          parentId: n.parentId ?? null,
        };
      }) as InsertFlowNode[];

      const edgesToSave: InsertFlowEdge[] = filteredEdges.map((e) => {
        const edgeType =
          e.type ||
          e.data?.edgeType ||
          "association";
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          edgeType,
          sourceHandle: e.sourceHandle || null,
          targetHandle: e.targetHandle || null,
          data: e.data || { edgeType },
        };
      });

      return { nodesToSave, edgesToSave };
    },
    [projectType],
  );

  const handleSaveWithData = useCallback(
    (nodesInput: DiagramNode[], edgesInput: DiagramEdge[]) => {
      const { nodesToSave, edgesToSave } = buildSavePayload(nodesInput, edgesInput);
      syncMutation.mutate(
        {
          viewId,
          nodes: nodesToSave,
          edges: edgesToSave,
        },
        {
          onSuccess: () => {
            setLastSavedSignature(
              normalizeFlow(
                nodesToSave as SerializableNode[],
                edgesToSave as SerializableEdge[],
                projectType,
              ),
            );
          },
        },
      );
    },
    [buildSavePayload, projectType, syncMutation, viewId],
  );

  const handleSave = useCallback(() => {
    handleSaveWithData(nodes, edges);
  }, [edges, handleSaveWithData, nodes]);

  const handleSaveAsync = useCallback(async () => {
    const { nodesToSave, edgesToSave } = buildSavePayload(nodes, edges);
    await syncMutation.mutateAsync({
      viewId,
      nodes: nodesToSave,
      edges: edgesToSave,
    });
    setLastSavedSignature(
      normalizeFlow(
        nodesToSave as SerializableNode[],
        edgesToSave as SerializableEdge[],
        projectType,
      ),
    );
  }, [buildSavePayload, nodes, edges, viewId, projectType, syncMutation]);

  const handleSaveRecovered = useCallback(
    async (nodesToSave: InsertFlowNode[], edgesToSave: InsertFlowEdge[]) => {
      const validation = flowSyncInputSchema.safeParse({
        nodes: nodesToSave,
        edges: edgesToSave,
      });
      if (!validation.success) {
        throw new Error(validation.error.issues[0]?.message ?? "Invalid diagram data");
      }

      await syncMutation.mutateAsync({
        viewId,
        nodes: nodesToSave,
        edges: edgesToSave,
      });
      setLastSavedSignature(
        normalizeFlow(
          nodesToSave as SerializableNode[],
          edgesToSave as SerializableEdge[],
          projectType,
        ),
      );
    },
    [projectType, syncMutation, viewId],
  );

  const currentSignature = useMemo(
    () =>
      normalizeFlow(
        nodes as SerializableNode[],
        edges as SerializableEdge[],
        projectType,
      ),
    [nodes, edges, projectType],
  );
  const isDirty = useMemo(() => {
    if (!lastSavedSignature) return false;
    return currentSignature !== lastSavedSignature;
  }, [currentSignature, lastSavedSignature]);

  return {
    isLoading,
    isError,
    reload: refetchFlow,

    nodes,
    edges,
    setNodes,
    setEdges,

    onNodesChange,
    onEdgesChange,

    onConnect,

    undo,
    redo,
    canUndo,
    canRedo,

    takeSnapshot,

    handleAddNode,
    handleAutoLayout,
    handleLayoutSelected,
    handleCenterSelected,
    handleSave,
    handleSaveWithData,
    handleSaveAsync,
    handleSaveRecovered,

    isSaving: syncMutation.isPending,
    debugInfoById,
    isDirty,
  };
}

const normalizeEdgeType = (
  value: unknown,
): CustomEdgeData["edgeType"] =>
  isMagicRelationType(value)
    ? value
    : "association";

const readSavedNodeStyle = (
  value: unknown,
): { width?: number; height?: number } | undefined => {
  if (!isRecord(value)) return undefined;
  const width = typeof value.width === "number" ? value.width : undefined;
  const height = typeof value.height === "number" ? value.height : undefined;
  return width === undefined && height === undefined
    ? undefined
    : { width, height };
};
