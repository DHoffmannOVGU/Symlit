import { newEdgeId, newNodeId } from "@/lib/ids";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Connection } from "@xyflow/react";
import { addEdge } from "@xyflow/react";
import type { CustomEdgeData } from "../edges/CustomEdges";
import { getEdgeMarkers } from "../edges/CustomEdges";
import type {
  DiagramEdge,
  DiagramNode as Node,
  NodeData,
} from "../types";
import { NODE_HEIGHT, NODE_WIDTH } from "../utils/autolayout";
import {
  EDGE_CREATE_MARKER_DELAY_MS,
  EDGE_CREATE_MARKER_MOVE_THRESHOLD_PX,
} from "../utils/edge-create";
import { getTypeAncestors } from "@shared/metamodel-inheritance";
import { inferFlowTypeFromNodes } from "../utils/flow-type";
import type { ProjectType } from "@shared/schema";
import type { MagicRelationType } from "@shared/metamodel-setup";
import { dispatchDiagramEvent } from "@/lib/diagram-events";
import type {
  MetaRelationOption,
  PendingEdgeRelationConfirmation,
} from "../edges/EdgeRelationConfirmation";

export function useEdgeCreation({
  viewId,
  projectType,
  allowedEdgeTypes,
  nodes,
  edges,
  setNodes,
  setEdges,
  takeSnapshot,
  availablePartDefEdges,
  typeMetaById,
  parentMap,
  screenToFlowPosition,
  canCreateConnection,
  onInvalidConnection,
  onEdgeCreated,
}: {
  viewId: number;
  projectType: ProjectType;
  allowedEdgeTypes?: MagicRelationType[];
  nodes: Node[];
  edges: DiagramEdge[];
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<DiagramEdge[]>>;
  takeSnapshot: (nodes: Node[], edges: DiagramEdge[]) => void;
  availablePartDefEdges: Array<{
    id: string;
    edgeType: CustomEdgeData["edgeType"];
    flowType?: CustomEdgeData["flowType"];
    label?: string;
    sourceTypeId: string;
    targetTypeId: string;
  }>;
  typeMetaById: Map<
    string,
    {
      referenceTypeId: string;
      originTypeId?: string;
      originProjectId?: number;
      label: string;
    }
  >;
  parentMap: Map<string, Set<string>>;
  screenToFlowPosition: (point: { x: number; y: number }) => { x: number; y: number };
  canCreateConnection?: (connection: Connection) => boolean;
  onInvalidConnection?: (connection: Connection) => void;
  onEdgeCreated?: (confirmation: PendingEdgeRelationConfirmation | null) => void;
}) {
  const [connectingFromNodeId, setConnectingFromNodeId] = useState<string | null>(
    null,
  );
  const connectStartAtRef = useRef<number | null>(null);
  const lastMoveAtRef = useRef<number | null>(null);
  const lastMovePointRef = useRef<{ x: number; y: number } | null>(null);
  const [pendingConnectionSource, setPendingConnectionSource] = useState<{
    nodeId: string;
    handleId?: string | null;
  } | null>(null);
  const pendingConnectionSourceRef = useRef<{
    nodeId: string;
    handleId?: string | null;
  } | null>(null);
  const [connectingGhostId, setConnectingGhostId] = useState<string | null>(null);
  const [edgeCreateMenu, setEdgeCreateMenu] = useState<{
    x: number;
    y: number;
    ghostId: string;
  } | null>(null);

  const relationEdges = useMemo(
    () => availablePartDefEdges.filter((edge) => edge.edgeType !== "generalization"),
    [availablePartDefEdges],
  );

  const resolveNodeTypeId = useCallback(
    (node: Node | undefined) => {
      if (!node) return undefined;
      const data = node.data as NodeData | undefined;
      if (data?.typeId) return data.typeId;
      if (typeMetaById.has(node.id)) return node.id;
      return undefined;
    },
    [typeMetaById],
  );

  const handleConnect = useCallback(
    (params: Connection) => {
      if (canCreateConnection && !canCreateConnection(params)) {
        onInvalidConnection?.(params);
        return;
      }
      if (projectType !== "instance") {
        if (projectType === "metamodel" && allowedEdgeTypes?.length === 0) {
          return;
        }
        const sourceNode = nodes.find((node) => node.id === params.source);
        const targetNode = nodes.find((node) => node.id === params.target);
        const edgeType =
          projectType === "metamodel"
            ? (allowedEdgeTypes?.[0] ?? "association")
            : "association";
        const flowType = inferFlowTypeFromNodes(sourceNode, targetNode);
        const { data: normalizedData, markerStart, markerEnd } = getEdgeMarkers({
          edgeType,
          flowType,
        });
        setEdges((eds) => {
          const nextEdges = addEdge<DiagramEdge>(
            {
              ...params,
              type: normalizedData.edgeType,
              data: normalizedData,
              markerStart,
              markerEnd,
            },
            eds,
          );
          if (nextEdges.length > eds.length) {
            const createdEdge = nextEdges[nextEdges.length - 1];
            dispatchDiagramEvent("diagram-model-edge-created", {
              viewId,
              edgeId: createdEdge.id,
            });
          }
          return nextEdges;
        });
        return;
      }

      const sourceNode = nodes.find((node) => node.id === params.source);
      const targetNode = nodes.find((node) => node.id === params.target);
      const sourceTypeId = resolveNodeTypeId(sourceNode);
      const targetTypeId = resolveNodeTypeId(targetNode);

      const matchingRelations =
        sourceTypeId && targetTypeId
          ? (() => {
              const sourceAncestors = getTypeAncestors(sourceTypeId, parentMap);
              const targetAncestors = getTypeAncestors(targetTypeId, parentMap);
              return relationEdges.filter(
                (edge) =>
                  sourceAncestors.has(edge.sourceTypeId) &&
                  targetAncestors.has(edge.targetTypeId),
              );
            })()
          : [];
      const defaultRelation =
        matchingRelations.find((edge) => (edge.label || "").trim().length > 0) ??
        matchingRelations[0];
      const flowType =
        defaultRelation?.flowType ?? inferFlowTypeFromNodes(sourceNode, targetNode);
      const { data: normalizedData, markerStart, markerEnd } = getEdgeMarkers({
        edgeType: defaultRelation?.edgeType ?? "association",
        label: defaultRelation?.label,
        flowType,
      });
      const edgeId = newEdgeId();

      takeSnapshot(nodes, edges);
      setEdges((currentEdges) => {
        const nextEdges = addEdge<DiagramEdge>(
          {
            ...params,
            id: edgeId,
            type: normalizedData.edgeType,
            data: normalizedData,
            markerStart,
            markerEnd,
          },
          currentEdges,
        );
        if (nextEdges.length > currentEdges.length) {
          dispatchDiagramEvent("diagram-model-edge-created", {
            viewId,
            edgeId,
          });
        }
        return nextEdges;
      });
      const relationOptions: MetaRelationOption[] = matchingRelations.map(
        (relation) => {
          const sourceLabel =
            typeMetaById.get(relation.sourceTypeId)?.label || relation.sourceTypeId;
          const targetLabel =
            typeMetaById.get(relation.targetTypeId)?.label || relation.targetTypeId;
          const relationLabel = relation.label?.trim();
          return {
            id: relation.id,
            edgeType: relation.edgeType,
            flowType: relation.flowType,
            label: relation.label,
            displayLabel:
              relationLabel ||
              `${sourceLabel} → ${targetLabel} (${relation.edgeType})`,
          };
        },
      );
      onEdgeCreated?.(
        defaultRelation
          ? {
              edgeId,
              options: relationOptions,
              selectedRelationId: defaultRelation.id,
            }
          : null,
      );
    },
    [
      viewId,
      projectType,
      nodes,
      relationEdges,
      setEdges,
      canCreateConnection,
      onInvalidConnection,
      parentMap,
      resolveNodeTypeId,
      edges,
      takeSnapshot,
      onEdgeCreated,
      typeMetaById,
      allowedEdgeTypes,
    ],
  );

  const closeEdgeCreateMenu = useCallback(() => {
    if (!edgeCreateMenu) return;
    const ghostId = edgeCreateMenu.ghostId;
    setNodes((nds) => nds.filter((node) => node.id !== ghostId));
    setEdgeCreateMenu(null);
    pendingConnectionSourceRef.current = null;
    setPendingConnectionSource(null);
    setConnectingGhostId(null);
  }, [edgeCreateMenu, setNodes]);

  const finalizeEdgeCreateNode = useCallback(
    (options?: { typeId?: string; typeLabel?: string; icon?: string; color?: string }) => {
      const connectionSource =
        pendingConnectionSourceRef.current ?? pendingConnectionSource;
      if (!edgeCreateMenu || !connectionSource) return;
      const ghostId = edgeCreateMenu.ghostId;
      const typeLabel = options?.typeLabel || "Object";
      const sourceNode = nodes.find((node) => node.id === connectionSource.nodeId);
      const sourceTypeId = resolveNodeTypeId(sourceNode);
      const targetTypeId = options?.typeId;
      const suggestedEdges =
        projectType === "instance" && sourceTypeId && targetTypeId
          ? (() => {
              const sourceAncestors = getTypeAncestors(sourceTypeId, parentMap);
              const targetAncestors = getTypeAncestors(targetTypeId, parentMap);
              return relationEdges.filter(
                (edge) =>
                  sourceAncestors.has(edge.sourceTypeId) &&
                  targetAncestors.has(edge.targetTypeId),
              );
            })()
          : [];
      const suggestedEdge =
        suggestedEdges.find((edge) => (edge.label || "").trim().length > 0) ??
        suggestedEdges[0];
      const targetNodeDraft =
        options?.typeLabel
          ? ({
              id: ghostId,
              type: projectType === "metamodel" ? "partdef" : "part",
              position: { x: 0, y: 0 },
              data: { type: options.typeLabel },
            } as Node)
          : nodes.find((node) => node.id === ghostId);
      const flowType =
        suggestedEdge?.flowType ||
        inferFlowTypeFromNodes(sourceNode, targetNodeDraft);
      const { data: normalizedData, markerStart, markerEnd } = getEdgeMarkers({
        edgeType: suggestedEdge?.edgeType ?? "association",
        label: suggestedEdge?.label,
        flowType,
      });

      takeSnapshot(nodes, edges);
      setNodes((nds) =>
        nds.map((node) =>
          node.id === ghostId
            ? (() => {
                const existingData = (node.data as NodeData | undefined) ?? {};
                return {
                  ...node,
                  type: projectType === "metamodel" ? "partdef" : node.type,
                  data: {
                    ...existingData,
                    label: existingData.label || `New ${typeLabel}`,
                    type:
                      projectType === "metamodel" ||
                      projectType === "instance"
                        ? typeLabel
                        : existingData.type,
                    typeId: options?.typeId,
                    icon:
                      projectType === "metamodel"
                        ? options?.icon || existingData.icon
                        : options?.typeId
                          ? options?.icon
                          : existingData.icon,
                    color:
                      projectType === "metamodel"
                        ? options?.color || existingData.color
                        : options?.typeId
                          ? options?.color
                          : existingData.color,
                    inheritStyle: options?.typeId ? true : undefined,
                    isDraft: false,
                  },
                };
              })()
            : node,
        ),
      );
      const edgeId = newEdgeId();
      setEdges((eds) => {
        const nextEdges = addEdge<DiagramEdge>(
          {
            id: edgeId,
            source: connectionSource.nodeId,
            sourceHandle: connectionSource.handleId ?? null,
            target: ghostId,
            targetHandle:
              connectionSource.handleId === "right" ? "left" : null,
            type: normalizedData.edgeType,
            data: normalizedData,
            markerStart,
            markerEnd,
          },
          eds,
        );
        if (nextEdges.length > eds.length) {
          dispatchDiagramEvent("diagram-model-edge-created", {
            viewId,
            edgeId,
          });
        }
        return nextEdges;
      });
      dispatchDiagramEvent("diagram-model-node-created", {
        viewId,
        nodeId: ghostId,
      });
      setEdgeCreateMenu(null);
      setPendingConnectionSource(null);
      setConnectingGhostId(null);
    },
    [
      edgeCreateMenu,
      viewId,
      projectType,
      nodes,
      edges,
      setNodes,
      setEdges,
      takeSnapshot,
      pendingConnectionSource,
      relationEdges,
      parentMap,
      resolveNodeTypeId,
    ],
  );

  useEffect(() => {
    if (!edgeCreateMenu) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeEdgeCreateMenu();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [edgeCreateMenu, closeEdgeCreateMenu]);

  const handleConnectStart = useCallback(
    (_event: unknown, params: { nodeId?: string | null; handleId?: string | null }) => {
      const now = Date.now();
      connectStartAtRef.current = now;
      lastMoveAtRef.current = now;
      lastMovePointRef.current = null;
      setConnectingFromNodeId(params?.nodeId ?? null);
      const next = params?.nodeId
        ? { nodeId: params.nodeId, handleId: params.handleId }
        : null;
      pendingConnectionSourceRef.current = next;
      setPendingConnectionSource(next);
      setConnectingGhostId(null);
    },
    [],
  );

  useEffect(() => {
    if (!connectingFromNodeId) return;
    const handlePointerMove = (event: PointerEvent) => {
      const point = { x: event.clientX, y: event.clientY };
      const lastPoint = lastMovePointRef.current;
      if (
        !lastPoint ||
        Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) >
          EDGE_CREATE_MARKER_MOVE_THRESHOLD_PX
      ) {
        lastMoveAtRef.current = Date.now();
        lastMovePointRef.current = point;
      }
    };
    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [connectingFromNodeId]);

  const handleConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      setConnectingFromNodeId(null);
      const target = event?.target as Element | null;
      const overFlow = !!target?.closest?.(
        ".react-flow, .react-flow__renderer, .react-flow__pane",
      );
      const overNode = !!target?.closest?.(".react-flow__node");
      const overHandle = !!target?.closest?.(".react-flow__handle");
      if (!overFlow || overNode || overHandle) {
        pendingConnectionSourceRef.current = null;
        setPendingConnectionSource(null);
        if (connectingGhostId) {
          setNodes((nds) => nds.filter((node) => node.id !== connectingGhostId));
          setConnectingGhostId(null);
        }
        return;
      }
      const connectionSource =
        pendingConnectionSourceRef.current ?? pendingConnectionSource;
      if (!connectionSource) return;

      const now = Date.now();
      const lastMoveAt = lastMoveAtRef.current ?? connectStartAtRef.current ?? now;
      const readyToCreate = now - lastMoveAt >= EDGE_CREATE_MARKER_DELAY_MS;
      if (!readyToCreate) {
        pendingConnectionSourceRef.current = null;
        setPendingConnectionSource(null);
        return;
      }

      const point =
        "touches" in event && event.touches?.[0]
          ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
          : { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY };
      const ghostId = connectingGhostId ?? newNodeId();
      if (!connectingGhostId) {
        const flowPoint = screenToFlowPosition(point);
        const labelBase = "Object";

        setNodes((nds) => [
          ...nds,
          {
            id: ghostId,
            type:
              projectType === "metamodel"
                ? "partdef"
                : "part",
            position: {
              x: flowPoint.x - NODE_WIDTH / 2,
              y: flowPoint.y - NODE_HEIGHT / 2,
            },
            data: {
              label: `New ${labelBase} ${nodes.length + 1}`,
              description:
                projectType === "metamodel"
                  ? "Component definition"
                  : "Component instance",
              attributes: [],
              isDraft: true,
            },
          },
        ]);
        setConnectingGhostId(ghostId);
      }

      const menuWidth = 240;
      const menuHeight = 260;
      const clampedX = Math.min(
        Math.max(16, point.x + 8),
        window.innerWidth - menuWidth - 16,
      );
      const clampedY = Math.min(
        Math.max(16, point.y + 8),
        window.innerHeight - menuHeight - 16,
      );
      setEdgeCreateMenu({ x: clampedX, y: clampedY, ghostId });
    },
    [
      connectingGhostId,
      pendingConnectionSource,
      projectType,
      nodes.length,
      screenToFlowPosition,
      setNodes,
    ],
  );

  return {
    connectingFromNodeId,
    pendingConnectionSource,
    edgeCreateMenu,
    handleConnect,
    handleConnectStart,
    handleConnectEnd,
    closeEdgeCreateMenu,
    finalizeEdgeCreateNode,
  };
}
