import { DeleteConfirmDialog } from "../dialogs/DeleteConfirmDialog";
import { useDiagramStore } from "../state/DiagramStoreProvider";

/** Confirms deleting the elements the store has queued with `requestDelete`. */
export function CanvasDeleteDialog() {
  const pendingDelete = useDiagramStore((state) => state.pendingDelete);
  const cancelDelete = useDiagramStore((state) => state.cancelDelete);
  const confirmDelete = useDiagramStore((state) => state.confirmDelete);
  return (
    <DeleteConfirmDialog
      open={pendingDelete !== null}
      label={pendingDelete?.label}
      onOpenChange={(open) => {
        if (!open) cancelDelete();
      }}
      onConfirm={confirmDelete}
    />
  );
}
