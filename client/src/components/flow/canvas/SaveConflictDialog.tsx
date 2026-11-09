import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDiagramStore } from "../state/DiagramStoreProvider";

export interface SaveConflictDialogProps {
  isSaving: boolean;
  /** Saves the canvas as it is, replacing the stored diagram. */
  onOverwrite: () => void;
  /** Loads the stored diagram, dropping the unsaved edits. */
  onReload: () => void;
}

/**
 * Shown when a save was refused because the diagram changed after it was
 * opened: in another tab, or through an element edited in another diagram.
 */
export function SaveConflictDialog({ isSaving, onOverwrite, onReload }: SaveConflictDialogProps) {
  const open = useDiagramStore((state) => state.saveConflict);
  const setOpen = useDiagramStore((state) => state.setSaveConflict);
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isSaving && setOpen(false)}>
      <DialogContent className="sm:max-w-[520px]" data-testid="dialog-save-conflict">
        <DialogHeader>
          <DialogTitle>This diagram was changed somewhere else</DialogTitle>
          <DialogDescription>
            Since you opened it, the diagram or one of its elements was saved from another tab or
            another diagram. Nothing was saved yet. Keep your version, or load the other one and
            lose your unsaved changes?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isSaving}>
            Decide later
          </Button>
          <Button variant="outline" onClick={onReload} disabled={isSaving} data-testid="button-conflict-reload">
            Load the other version
          </Button>
          <Button onClick={onOverwrite} disabled={isSaving} data-testid="button-conflict-overwrite">
            {isSaving ? "Saving..." : "Save my version"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
