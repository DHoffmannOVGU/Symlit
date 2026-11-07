import { newNodeId } from "@/lib/ids";
import { useCallback, useEffect, useRef } from "react";
import type { CopiedNodeSnapshot } from "./diagramCanvasTypes";
import type {
  DiagramEdge,
  DiagramNode as Node,
} from "../types";

interface UseDiagramClipboardArgs {
  nodes: Node[];
  edges: DiagramEdge[];
  selectedNodes: Node[];
  setNodes: (updater: (current: Node[]) => Node[]) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;
  takeSnapshot: (nodes: Node[], edges: DiagramEdge[]) => void;
}

interface UseDiagramClipboardResult {
  handleCopySelectedNodesToClipboard: () => boolean;
  handlePasteCopiedNodes: () => void;
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
};

/**
 * Copy/paste behaviour for canvas selections, plus the global Ctrl/Cmd+C/V
 * keyboard listener that drives it. Snapshots are kept in a ref local to the
 * hook so paste survives re-renders and unmounts of the host component.
 */
export function useDiagramClipboard({
  nodes,
  edges,
  selectedNodes,
  setNodes,
  setSelectedNodeId,
  setSelectedEdgeId,
  takeSnapshot,
}: UseDiagramClipboardArgs): UseDiagramClipboardResult {
  const copiedNodesRef = useRef<CopiedNodeSnapshot[]>([]);

  const handleCopySelectedNodesToClipboard = useCallback(() => {
    if (selectedNodes.length === 0) return false;

    copiedNodesRef.current = selectedNodes.map((node) => {
      const sourceData = (node.data ?? {}) as Record<string, unknown>;
      const attributes = Array.isArray(sourceData.attributes)
        ? sourceData.attributes.map((attr) => ({
            ...(attr as Record<string, unknown>),
            options: Array.isArray((attr as { options?: unknown }).options)
              ? [...((attr as { options?: string[] }).options ?? [])]
              : undefined,
          }))
        : sourceData.attributes;

      return {
        id: node.id,
        type: node.type,
        position: { ...node.position },
        data: { ...sourceData, attributes } as Record<string, unknown>,
        className: node.className,
        style: node.style ? { ...node.style } : undefined,
        width: node.width,
        height: node.height,
        parentId: node.parentId,
      };
    });

    return true;
  }, [selectedNodes]);

  const handlePasteCopiedNodes = useCallback(() => {
    const copiedNodes = copiedNodesRef.current;
    if (copiedNodes.length === 0) return;

    const copiedIdSet = new Set(copiedNodes.map((node) => node.id));
    const idMap = new Map(
      copiedNodes.map((node) => [
        node.id,
        newNodeId(),
      ]),
    );
    const nextNodes = copiedNodes.map((node) => {
      const sourceData = node.data ?? {};
      const baseLabel =
        typeof sourceData.label === "string" ? sourceData.label : "Untitled";
      const nextId = idMap.get(node.id) ?? newNodeId();
      const nextParentId =
        node.parentId && copiedIdSet.has(node.parentId)
          ? (idMap.get(node.parentId) ?? node.parentId)
          : node.parentId;

      return {
        id: nextId,
        type: node.type,
        position: {
          x: node.position.x + 40,
          y: node.position.y + 40,
        },
        ...(nextParentId
          ? { parentId: nextParentId, extent: "parent" as const }
          : {}),
        data: { ...sourceData, label: `${baseLabel} (copy)` },
        className: node.className,
        style: node.style ? { ...node.style } : undefined,
        width: node.width,
        height: node.height,
        selected: true,
      };
    });

    takeSnapshot(nodes, edges);
    setNodes((current) => [
      ...current.map((node) => ({ ...node, selected: false })),
      ...nextNodes,
    ]);
    setSelectedEdgeId(null);
    setSelectedNodeId(nextNodes[0]?.id ?? null);
  }, [
    edges,
    nodes,
    setNodes,
    setSelectedEdgeId,
    setSelectedNodeId,
    takeSnapshot,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        isEditableTarget(event.target)
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "c") {
        const didCopy = handleCopySelectedNodesToClipboard();
        if (!didCopy) return;
        event.preventDefault();
        return;
      }
      if (key === "v") {
        if (copiedNodesRef.current.length === 0) return;
        event.preventDefault();
        handlePasteCopiedNodes();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCopySelectedNodesToClipboard, handlePasteCopiedNodes]);

  return { handleCopySelectedNodesToClipboard, handlePasteCopiedNodes };
}
