import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface UnsavedChangesDialogProps {
  leaveDialogOpen: boolean;
  isLeaving: boolean;
  handleCancelLeave: () => void;
  isSaving: boolean;
  handleLeaveWithoutSaving: () => void;
  handleSaveAndLeave: () => Promise<void>;
}

export function UnsavedChangesDialog({
  leaveDialogOpen,
  isLeaving,
  handleCancelLeave,
  isSaving,
  handleLeaveWithoutSaving,
  handleSaveAndLeave,
}: UnsavedChangesDialogProps) {
  return (
    <Dialog
            open={leaveDialogOpen}
            onOpenChange={(open) => {
              if (isLeaving) return;
              if (!open) handleCancelLeave();
            }}
          >
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Unsaved changes</DialogTitle>
              </DialogHeader>
              <div className="text-sm text-muted-foreground">
                You have unsaved changes in this diagram. Save now or leave without
                saving?
              </div>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={handleCancelLeave}
                  disabled={isLeaving || isSaving}
                >
                  Stay
                </Button>
                <Button
                  variant="outline"
                  onClick={handleLeaveWithoutSaving}
                  disabled={isLeaving || isSaving}
                >
                  Leave without saving
                </Button>
                <Button
                  onClick={handleSaveAndLeave}
                  disabled={isLeaving || isSaving}
                >
                  {isLeaving || isSaving ? "Saving..." : "Save and leave"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
  );
}
