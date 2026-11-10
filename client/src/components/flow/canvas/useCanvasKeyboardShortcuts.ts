import { useDiagramStore } from "../state/DiagramStoreProvider";
import { useEffect } from "react";

interface UseCanvasKeyboardShortcutsArgs {
  deleteDialogOpen: boolean;
  onSave: () => void;
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
 * - Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl+Y redoes (not while typing in a field,
 *   where the browser's own text undo applies)
 * - Delete/Backspace requests deletion of the current selection
 * - F2 renames the selected element on its card
 *
 * The Ctrl/Cmd+C/V clipboard shortcuts live in `useDiagramClipboard`.
 */
export function useCanvasKeyboardShortcuts({
  deleteDialogOpen,
  onSave,
}: UseCanvasKeyboardShortcutsArgs) {
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const requestDelete = useDiagramStore((state) => state.requestDelete);
  const setRenamingNodeId = useDiagramStore((state) => state.setRenamingNodeId);

  // F2 renames the selected element right on its card.
  useEffect(() => {
    const handleRenameShortcut = (event: KeyboardEvent) => {
      if (event.key !== "F2" || deleteDialogOpen || isEditableTarget(event.target)) return;
      const selected = nodes.filter((node) => node.selected);
      if (selected.length !== 1) return;
      event.preventDefault();
      setRenamingNodeId(selected[0].id);
    };
    window.addEventListener("keydown", handleRenameShortcut);
    return () => window.removeEventListener("keydown", handleRenameShortcut);
  }, [deleteDialogOpen, nodes, setRenamingNodeId]);

  const undo = useDiagramStore((state) => state.undo);
  const redo = useDiagramStore((state) => state.redo);
  useEffect(() => {
    const handleUndoRedo = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleUndoRedo);
    return () => window.removeEventListener("keydown", handleUndoRedo);
  }, [redo, undo]);
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
            ? selectedNodes[0].data.label || "this element"
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
