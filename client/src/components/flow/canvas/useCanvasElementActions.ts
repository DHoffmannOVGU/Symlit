import { useDiagramModel } from "../state/DiagramModelProvider";
import { useDiagramStore } from "../state/DiagramStoreProvider";
import { emitTutorialSignal } from "@/lib/tutorial-signals";
import { newNodeId } from "@/lib/ids";
import { applyTypeStyle, pickElementStyle, withElementStyle } from "@/lib/element-style";
import { useCallback, useMemo } from "react";
import type { DiagramNode as Node, NodeData } from "../types";
import { getEdgeSemanticDefaults, getEdgeMarkers, type CustomEdgeData } from "../edges/CustomEdges";
import { useDiagramClipboard } from "./useDiagramClipboard";

export interface UseCanvasElementActionsParams {
  selectedNodes: Node[];
}

export function useCanvasElementActions({
  selectedNodes,
}: UseCanvasElementActionsParams) {
  const takeSnapshot = useDiagramStore((state) => state.takeSnapshot);
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const setNodes = useDiagramStore((state) => state.setNodes);
  const setEdges = useDiagramStore((state) => state.setEdges);
  const setSelectedNodeId = useDiagramStore((state) => state.setSelectedNodeId);
  const setSelectedEdgeId = useDiagramStore((state) => state.setSelectedEdgeId);
  const requestDelete = useDiagramStore((state) => state.requestDelete);
  const { isExternalNode, partDefStyleById, partTypeOptions, projectType, edgeTypeCycle } = useDiagramModel();
  /**
   * Instance elements that match their type take the type's whole style;
   * the others keep exactly the style they were saved with.
   */
  const withStyleForSave = useCallback(
    (nodeType: string | undefined, data: NodeData): NodeData => {
      if (nodeType !== "part") return data;
      const typeStyle = data.typeId ? partDefStyleById.get(data.typeId) : undefined;
      if (data.typeId && data.inheritStyle !== false && typeStyle) return applyTypeStyle(data, typeStyle);
      return { ...withElementStyle(data, pickElementStyle(data)), inheritStyle: data.typeId ? false : data.inheritStyle };
    },
    [partDefStyleById],
  );
  const handleSaveNodeData = useCallback(
    (nodeId: string, data: NodeData) => {
      if (isExternalNode(nodeId)) return;
      takeSnapshot(nodes, edges);
      const previousAttributes =
        (nodes.find((n) => n.id === nodeId)?.data as NodeData | undefined)?.attributes?.length ?? 0;
      if ((data.attributes?.length ?? 0) > previousAttributes) emitTutorialSignal("attribute-added");
      const nextNodes = nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              type:
                data.type === "Behavior" || data.type === "Action"
                  ? "actiondef"
                  : data.type === "Concern"
                    ? "concerndef"
                    : data.type === "Performer" || data.type === "Agent"
                      ? "agentdef"
                      : data.type === "Requirement"
                        ? "requirementdef"
                      : data.type === "Event"
                        ? "eventdef"
                        : data.type === "Capability"
                          ? "capabilitydef"
                      : (data.type === "Object" || data.type === "Part") &&
                          [
                            "partdef",
                            "actiondef",
                            "concerndef",
                            "agentdef",
                            "requirementdef",
                            "eventdef",
                            "capabilitydef",
                          ].includes(n.type || "")
                        ? "partdef"
                        : n.type,
              data: withStyleForSave(n.type, {
                ...n.data,
                ...data,
                ...((data.type === "Behavior" || data.type === "Action") ? { icon: data.icon || "Zap" } : {}),
                ...(data.type === "Concern"
                  ? { icon: data.icon || "Shield" }
                  : {}),
                ...((data.type === "Performer" || data.type === "Agent") ? { icon: data.icon || "Bot" } : {}),
                ...(data.type === "Requirement"
                  ? { icon: data.icon || "BadgeCheck" }
                  : {}),
                ...(data.type === "Event" ? { icon: data.icon || "Radio" } : {}),
                ...(data.type === "Capability" ? { icon: data.icon || "Gem" } : {}),
              }),
            }
          : n,
      );
      setNodes(nextNodes);
    },
    [nodes, edges, setNodes, takeSnapshot, withStyleForSave, isExternalNode],
  );

  const handleSaveEdgeData = useCallback(
    (edgeId: string, data: CustomEdgeData) => {
      takeSnapshot(nodes, edges);
      const nextEdges = edges.map((e) =>
        e.id === edgeId
          ? (() => {
              const existingData = (e.data as CustomEdgeData | undefined) ?? {
                edgeType:
                  (e.type as CustomEdgeData["edgeType"] | undefined) ||
                  "association",
              };
              const {
                data: normalizedData,
                markerStart,
                markerEnd,
              } = getEdgeMarkers({
                ...existingData,
                ...(data.edgeType &&
                data.edgeType !== existingData.edgeType
                  ? getEdgeSemanticDefaults(data.edgeType)
                  : {}),
                ...data,
              });
              return {
                ...e,
                type: normalizedData.edgeType,
                data: normalizedData,
                markerStart,
                markerEnd,
              };
            })()
          : e,
      );
      setEdges(nextEdges);
    },
    [nodes, edges, setEdges, takeSnapshot],
  );

  const metamodelNodeTypeOptions = useMemo(
    () => [
      { value: "Object", label: "Object" },
      { value: "Behavior", label: "Behavior" },
      { value: "Concern", label: "Concern" },
      { value: "Performer", label: "Performer" },
      { value: "Requirement", label: "Requirement" },
      { value: "Event", label: "Event" },
      { value: "Capability", label: "Capability" },
    ],
    [],
  );

  const instanceNodeTypeOptions = useMemo(
    () =>
      partTypeOptions.map((option) => ({
        value: option.id,
        label: option.label,
      })),
    [partTypeOptions],
  );

  const handleInlineNodeFieldChange = useCallback(
    (nodeId: string, field: "name" | "description" | "type", value: string) => {
      const node = nodes.find((candidate) => candidate.id === nodeId);
      if (!node) return;
      if (isExternalNode(nodeId)) return;

      const existingData = (node.data) ?? {
        label: "",
        type: node.type || "Object",
      };

      if (field === "type") {
        if (projectType === "instance") {
          if (value === "untyped") {
            handleSaveNodeData(nodeId, {
              ...existingData,
              type: existingData.type || "Object",
              typeId: undefined,
              inheritStyle: false,
            });
            return;
          }
          const selectedOption = partTypeOptions.find(
            (option) => option.id === value,
          );
          if (!selectedOption) return;
          handleSaveNodeData(nodeId, {
            ...existingData,
            type: selectedOption.label,
            typeId: selectedOption.id,
            inheritStyle: true,
          });
          return;
        }

        handleSaveNodeData(nodeId, {
          ...existingData,
          type: value,
        });
        return;
      }

      handleSaveNodeData(nodeId, {
        ...existingData,
        ...(field === "name"
          ? { label: value }
          : { description: value || undefined }),
      });
    },
    [nodes, partTypeOptions, projectType, handleSaveNodeData, isExternalNode],
  );

  const handleInlineEdgeFieldChange = useCallback(
    (edgeId: string, field: "name" | "description" | "type", value: string) => {
      const edge = edges.find((candidate) => candidate.id === edgeId);
      if (!edge) return;

      const existingData = (edge.data as CustomEdgeData | undefined) ?? {
        edgeType:
          (edge.type as CustomEdgeData["edgeType"] | undefined) ||
          "association",
      };

      handleSaveEdgeData(edgeId, {
        ...existingData,
        ...(field === "name"
          ? { label: value || undefined }
          : field === "description"
            ? { description: value || undefined }
            : { edgeType: value as CustomEdgeData["edgeType"] }),
      });
    },
    [edges, handleSaveEdgeData],
  );

  const handleCopyNode = useCallback(
    (nodeId: string) => {
      const sourceNode = nodes.find((node) => node.id === nodeId);
      if (!sourceNode) return;

      const sourceData = sourceNode.data;
      const baseLabel = sourceData.label ?? "Untitled";
      const attributes = sourceData.attributes
        ? sourceData.attributes.map((attr) => ({
            ...attr,
            options: attr.options ? [...attr.options] : undefined,
          }))
        : undefined;

      takeSnapshot(nodes, edges);
      const newNode: Node = {
        id: newNodeId(),
        type: sourceNode.type,
        position: {
          x: sourceNode.position.x + 40,
          y: sourceNode.position.y + 40,
        },
        data: {
          ...sourceData,
          label: `${baseLabel} (copy)`,
          attributes,
        },
        className: sourceNode.className,
        style: sourceNode.style ? { ...sourceNode.style } : undefined,
        width: sourceNode.width,
        height: sourceNode.height,
      };

      setNodes((nds) => [
        ...nds.map((node) => ({ ...node, selected: false })),
        { ...newNode, selected: true },
      ]);
      setSelectedNodeId(newNode.id);
    },
    [nodes, edges, takeSnapshot, setNodes, setSelectedNodeId],
  );

  useDiagramClipboard({
    nodes,
    edges,
    selectedNodes,
    setNodes,
    setSelectedNodeId,
    setSelectedEdgeId,
    takeSnapshot,
  });

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const target = nodes.find((n) => n.id === nodeId);
      const label =
        (target?.data as NodeData | undefined)?.label || "this node";
      requestDelete({ nodeIds: [nodeId], edgeIds: [], label });
    },
    [nodes, requestDelete],
  );

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      const target = edges.find((e) => e.id === edgeId);
      const label =
        (target?.data as CustomEdgeData | undefined)?.label ||
        "this relationship";
      requestDelete({ nodeIds: [], edgeIds: [edgeId], label });
    },
    [edges, requestDelete],
  );

  const handleToggleEdgeType = useCallback(
    (edgeId: string) => {
      const target = edges.find((edge) => edge.id === edgeId);
      if (!target) return;

      const currentData = (target.data as CustomEdgeData | undefined) ?? {
        edgeType:
          (target.type as CustomEdgeData["edgeType"] | undefined) ||
          "association",
      };
      const currentType = currentData.edgeType || "association";
      const currentIndex = edgeTypeCycle.indexOf(
        currentType as (typeof edgeTypeCycle)[number],
      );
      const nextType =
        edgeTypeCycle[
          currentIndex >= 0
            ? (currentIndex + 1) % edgeTypeCycle.length
            : 0
        ] ?? "association";

      handleSaveEdgeData(edgeId, {
        ...currentData,
        edgeType: nextType,
        ...getEdgeSemanticDefaults(nextType),
        flowType: nextType === "association" ? currentData.flowType : undefined,
        variability:
          nextType === "aggregation" || nextType === "composition"
            ? currentData.variability
            : undefined,
      });
    },
    [edgeTypeCycle, edges, handleSaveEdgeData],
  );

  const handleReverseEdgeDirection = useCallback(
    (edgeId: string) => {
      const target = edges.find((edge) => edge.id === edgeId);
      if (!target) return;

      takeSnapshot(nodes, edges);
      setEdges((current) =>
        current.map((edge) => {
          if (edge.id !== edgeId) return edge;
          const existingData = (edge.data as CustomEdgeData | undefined) ?? {
            edgeType:
              (edge.type as CustomEdgeData["edgeType"] | undefined) ||
              "association",
          };
          const swappedDataInput: CustomEdgeData = {
            ...existingData,
            sourceArrow: existingData.targetArrow,
            targetArrow: existingData.sourceArrow,
            sourceAnchor: existingData.targetAnchor,
            targetAnchor: existingData.sourceAnchor,
          };
          const {
            data: normalizedData,
            markerStart,
            markerEnd,
          } = getEdgeMarkers(swappedDataInput);

          return {
            ...edge,
            source: edge.target,
            target: edge.source,
            sourceHandle: edge.targetHandle,
            targetHandle: edge.sourceHandle,
            type: normalizedData.edgeType,
            data: normalizedData,
            markerStart,
            markerEnd,
          };
        }),
      );
    },
    [edges, nodes, setEdges, takeSnapshot],
  );

  return {
    handleCopyNode,
    handleDeleteNode,
    handleDeleteEdge,
    handleToggleEdgeType,
    handleReverseEdgeDirection,
    instanceNodeTypeOptions,
    metamodelNodeTypeOptions,
    handleInlineNodeFieldChange,
    handleInlineEdgeFieldChange,
    handleSaveNodeData,
    handleSaveEdgeData,
  };
}
