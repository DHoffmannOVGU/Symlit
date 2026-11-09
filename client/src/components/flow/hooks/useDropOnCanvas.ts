import { useCallback, useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { normalizeHandleId } from "@shared/relationships";
import { dispatchDiagramEvent } from "@/lib/diagram-events";
import { newEdgeId, newNodeId } from "@/lib/ids";
import { applyTypeStyle, pickElementStyle } from "@/lib/element-style";
import { attributesFromType } from "@/lib/type-attributes";
import type { DiagramNode, NodeData } from "../types";
import { useDiagramStore, useDiagramStoreApi } from "../state/DiagramStoreProvider";
import { useDiagramModel } from "../state/DiagramModelProvider";
import { OPPOSITE_SIDE } from "../utils/edge-utils";
import { EDGE_CREATE_MARKER_DELAY_MS, EDGE_CREATE_MARKER_MOVE_THRESHOLD_PX } from "../utils/edge-create";
import { inferFlowTypeFromNodes } from "../utils/flow-type";
import { NODE_HEIGHT, NODE_WIDTH } from "../utils/node-size";
import { allowedRelations, defaultRelation, newRelationshipEdge, typeIdOf } from "../utils/relationship-defaults";
import { useAddRelationship } from "./useConnectElements";

type ConnectionSource = { nodeId: string; handleId?: string | null };
type NewElementOptions = { typeId?: string; typeLabel?: string; icon?: string; color?: string };

/** Space the "Create node" menu needs, to keep it on screen. */
const MENU_SIZE = { width: 240, height: 260 };

/**
 * Dragging a relationship from an element onto empty canvas: after the
 * pointer rests briefly, a placeholder element appears with a menu asking
 * which type of element to create. Choosing one turns the placeholder into
 * that element and connects it (one undo step); cancelling removes it.
 */
export function useDropOnCanvas() {
  const diagramStore = useDiagramStoreApi();
  const setNodes = useDiagramStore((state) => state.setNodes);
  const takeSnapshot = useDiagramStore((state) => state.takeSnapshot);
  const { viewId, projectType, relationEdges, typeMetaById, parentMap, partDefStyleById, availablePartDefNodes } = useDiagramModel();
  const { screenToFlowPosition } = useReactFlow();
  const addRelationship = useAddRelationship();

  /** The element a relationship is being dragged from (drives canvas highlighting). */
  const [connectingFromNodeId, setConnectingFromNodeId] = useState<string | null>(null);
  const [pendingSource, setPendingSource] = useState<ConnectionSource | null>(null);
  const pendingSourceRef = useRef<ConnectionSource | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; ghostId: string } | null>(null);
  const lastMoveAtRef = useRef<number | null>(null);
  const lastMovePointRef = useRef<{ x: number; y: number } | null>(null);

  const setSource = (source: ConnectionSource | null) => {
    pendingSourceRef.current = source;
    setPendingSource(source);
  };

  const removePlaceholder = useCallback(
    (ghostId: string) => setNodes((current) => current.filter((node) => node.id !== ghostId)),
    [setNodes],
  );

  const closeMenu = useCallback(() => {
    if (!menu) return;
    removePlaceholder(menu.ghostId);
    setMenu(null);
    setSource(null);
  }, [menu, removePlaceholder]);

  useEffect(() => {
    if (!menu) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeMenu();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menu, closeMenu]);

  const handleConnectStart = useCallback(
    (_event: unknown, params: { nodeId?: string | null; handleId?: string | null }) => {
      lastMoveAtRef.current = Date.now();
      lastMovePointRef.current = null;
      setConnectingFromNodeId(params?.nodeId ?? null);
      setSource(params?.nodeId ? { nodeId: params.nodeId, handleId: params.handleId } : null);
    },
    [],
  );

  // The menu only opens when the pointer has rested, so a quick drag-and-drop
  // onto empty canvas does nothing.
  useEffect(() => {
    if (!connectingFromNodeId) return;
    const onPointerMove = (event: PointerEvent) => {
      const point = { x: event.clientX, y: event.clientY };
      const last = lastMovePointRef.current;
      if (!last || Math.hypot(point.x - last.x, point.y - last.y) > EDGE_CREATE_MARKER_MOVE_THRESHOLD_PX) {
        lastMoveAtRef.current = Date.now();
        lastMovePointRef.current = point;
      }
    };
    window.addEventListener("pointermove", onPointerMove);
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, [connectingFromNodeId]);

  const handleConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      setConnectingFromNodeId(null);
      const target = event?.target as Element | null;
      const overCanvas = !!target?.closest?.(".react-flow, .react-flow__renderer, .react-flow__pane");
      const overElement = !!target?.closest?.(".react-flow__node, .react-flow__handle");
      const source = pendingSourceRef.current;
      const rested = Date.now() - (lastMoveAtRef.current ?? Date.now()) >= EDGE_CREATE_MARKER_DELAY_MS;
      if (!overCanvas || overElement || !source || !rested) {
        setSource(null);
        return;
      }

      const point =
        "touches" in event && event.touches?.[0]
          ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
          : { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY };
      const flowPoint = screenToFlowPosition(point);
      const ghostId = newNodeId();
      const count = diagramStore.getState().nodes.length;
      setNodes((current) => [
        ...current,
        {
          id: ghostId,
          type: projectType === "metamodel" ? "partdef" : "part",
          position: { x: flowPoint.x - NODE_WIDTH / 2, y: flowPoint.y - NODE_HEIGHT / 2 },
          data: {
            label: `New Object ${count + 1}`,
            description: projectType === "metamodel" ? "Component definition" : "Component instance",
            attributes: [],
            isDraft: true,
          },
        },
      ]);
      setMenu({
        x: Math.min(Math.max(16, point.x + 8), window.innerWidth - MENU_SIZE.width - 16),
        y: Math.min(Math.max(16, point.y + 8), window.innerHeight - MENU_SIZE.height - 16),
        ghostId,
      });
    },
    [diagramStore, projectType, screenToFlowPosition, setNodes],
  );

  /** Turns the placeholder into an element of the chosen type and connects it. */
  const createFromMenu = useCallback(
    (options?: NewElementOptions) => {
      const source = pendingSourceRef.current;
      if (!menu || !source) return;
      const { ghostId } = menu;
      const { nodes, edges } = diagramStore.getState();
      const typeLabel = options?.typeLabel || "Object";
      const sourceNode = nodes.find((node) => node.id === source.nodeId);
      const matches =
        projectType === "instance"
          ? allowedRelations(typeIdOf(sourceNode, typeMetaById), options?.typeId, parentMap, relationEdges)
          : [];
      const suggested = defaultRelation(matches);
      const targetDraft = options?.typeLabel
        ? ({ id: ghostId, type: projectType === "metamodel" ? "partdef" : "part", position: { x: 0, y: 0 }, data: { type: options.typeLabel } } as DiagramNode)
        : nodes.find((node) => node.id === ghostId);

      // Undo returns to the diagram before the drag, without the placeholder element.
      takeSnapshot(nodes.filter((node) => node.id !== ghostId), edges);
      setNodes((current) =>
        current.map((node) => {
          if (node.id !== ghostId) return node;
          const data = (node.data as NodeData | undefined) ?? {};
          const typeId = options?.typeId;
          const nextData: NodeData = {
            ...data,
            label: data.label || `New ${typeLabel}`,
            type: projectType === "metamodel" || projectType === "instance" ? typeLabel : data.type,
            typeId,
            icon: projectType === "metamodel" ? options?.icon || data.icon : data.icon,
            color: projectType === "metamodel" ? options?.color || data.color : data.color,
            inheritStyle: undefined,
            isDraft: false,
          };
          return {
            ...node,
            type: projectType === "metamodel" ? "partdef" : node.type,
            // A typed element starts out matching its type's style, with copies of its attributes.
            data: typeId
              ? {
                  ...applyTypeStyle(
                    nextData,
                    pickElementStyle(partDefStyleById.get(typeId) ?? { icon: options?.icon, color: options?.color }),
                  ),
                  attributes: attributesFromType(
                    typeId,
                    availablePartDefNodes.find((candidate) => candidate.id === typeId)?.data?.attributes,
                  ),
                }
              : nextData,
          };
        }),
      );
      const sourceSide = normalizeHandleId("source", source.handleId);
      addRelationship(
        newRelationshipEdge({
          id: newEdgeId(),
          source: source.nodeId,
          target: ghostId,
          sourceHandle: sourceSide,
          targetHandle: OPPOSITE_SIDE[sourceSide],
          edgeType: suggested?.edgeType ?? "association",
          label: suggested?.label,
          flowType: suggested?.flowType || inferFlowTypeFromNodes(sourceNode, targetDraft),
        }),
      );
      dispatchDiagramEvent("diagram-model-node-created", { viewId, nodeId: ghostId });
      setMenu(null);
      setSource(null);
    },
    [addRelationship, availablePartDefNodes, diagramStore, menu, parentMap, partDefStyleById, projectType, relationEdges, setNodes, takeSnapshot, typeMetaById, viewId],
  );

  return {
    connectingFromNodeId,
    pendingConnectionSource: pendingSource,
    edgeCreateMenu: menu,
    handleConnectStart,
    handleConnectEnd,
    closeEdgeCreateMenu: closeMenu,
    finalizeEdgeCreateNode: createFromMenu,
  };
}
