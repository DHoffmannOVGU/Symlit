import { useEffect } from "react";
import type {
  DiagramEdge,
  DiagramNode as Node,
} from "../types";

interface UseCanvasKeyboardShortcutsArgs {
  nodes: Node[];
  edges: DiagramEdge[];
  deleteDialogOpen: boolean;
  onSave: () => void;
  requestDelete: (payload: {
    nodeIds: string[];
    edgeIds: string[];
    label?: string;
  }) => void;
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
};

/**
 * Global keyboard shortcuts for the diagram canvas:
 * - Ctrl/Cmd+S triggers save
 * - Delete/Backspace requests deletion of the current selection
 *
 * The Ctrl/Cmd+C/V clipboard shortcuts live in `useDiagramClipboard`.
 */
export function useCanvasKeyboardShortcuts({
  nodes,
  edges,
  deleteDialogOpen,
  onSave,
  requestDelete,
}: UseCanvasKeyboardShortcutsArgs) {
  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== "s"
      ) {
        return;
      }
      event.preventDefault();
      onSave();
    };

    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [onSave]);

  useEffect(() => {
    const handleDeleteShortcut = (event: KeyboardEvent) => {
      if (deleteDialogOpen) return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (isEditableTarget(event.target)) return;

      const selectedNodes = nodes.filter((node) => node.selected);
      const selectedEdges = edges.filter((edge) => edge.selected);
      if (selectedNodes.length === 0 && selectedEdges.length === 0) return;

      event.preventDefault();
      const selectionCount = selectedNodes.length + selectedEdges.length;
      const label =
        selectionCount === 1
          ? selectedNodes[0]
            ? selectedNodes[0].data.label || "this node"
            : selectedEdges[0]?.data?.label ||
              "this relationship"
          : `${selectionCount} items`;

      requestDelete({
        nodeIds: selectedNodes.map((node) => node.id),
        edgeIds: selectedEdges.map((edge) => edge.id),
        label,
      });
    };

    window.addEventListener("keydown", handleDeleteShortcut);
    return () => window.removeEventListener("keydown", handleDeleteShortcut);
  }, [deleteDialogOpen, nodes, edges, requestDelete]);
}
