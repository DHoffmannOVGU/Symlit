import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AttributeEditorDialogProps {
  open: boolean;
  isNew: boolean;
  /** The element's name, for the title. */
  elementLabel: string;
  /** Why the attribute cannot be kept yet, or null when it can. */
  problem: string | null;
  onDone: () => void;
  onCancel: () => void;
  onDelete: () => void;
  children: ReactNode;
}

/** A small editor for one attribute's definition: name, description, type, unit, options or formula. */
export function AttributeEditorDialog({
  open,
  isNew,
  elementLabel,
  problem,
  onDone,
  onCancel,
  onDelete,
  children,
}: AttributeEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]"
        data-testid="attribute-editor-dialog"
        onKeyDown={(event) => {
          // Enter in a one-line field finishes; text areas keep Enter for new lines.
          if (event.key === "Enter" && event.target instanceof HTMLInputElement && !problem) {
            event.preventDefault();
            onDone();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{isNew ? "New attribute" : "Edit attribute"}</DialogTitle>
          <DialogDescription>
            {elementLabel ? `On ${elementLabel}.` : null} Attributes describe properties such as mass or range.
          </DialogDescription>
        </DialogHeader>
        {children}
        {problem ? <p className="text-xs text-destructive">{problem}</p> : null}
        <DialogFooter className="flex-row items-center gap-2 sm:justify-between">
          {isNew ? (
            <span />
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              data-testid="button-attribute-delete"
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Delete
            </Button>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel} data-testid="button-attribute-cancel">
              Cancel
            </Button>
            <Button type="button" onClick={onDone} disabled={!!problem} data-testid="button-attribute-done">
              {isNew ? "Add attribute" : "Done"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
