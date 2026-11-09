import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NodeAttribute } from "../../types";

export interface InheritAttributesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentOptions: Array<{ id: string; label: string }>;
  selectedParentId: string;
  onSelectedParentChange: (id: string) => void;
  selectableParentAttributes: NodeAttribute[];
  selectedInherited: Set<string>;
  inheritedKeySet: Set<string>;
  getAttributeKey: (attr: NodeAttribute) => string | undefined;
  onToggleInherited: (key: string, checked: boolean) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onConfirm: () => void;
}

export function InheritAttributesDialog({
  open,
  onOpenChange,
  parentOptions,
  selectedParentId,
  onSelectedParentChange,
  selectableParentAttributes,
  selectedInherited,
  inheritedKeySet,
  getAttributeKey,
  onToggleInherited,
  onSelectAll,
  onSelectNone,
  onConfirm,
}: InheritAttributesDialogProps) {
  if (!open) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Inherit Attributes</DialogTitle>
          <DialogDescription>
            Select attributes from a parent node to copy into this node.
          </DialogDescription>
        </DialogHeader>

        {parentOptions.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            There is no general type to copy attributes from.
          </div>
        ) : (
          <div className="space-y-4">
            {parentOptions.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="inherit-parent">Copy from</Label>
                <Select
                  value={selectedParentId}
                  onValueChange={onSelectedParentChange}
                >
                  <SelectTrigger id="inherit-parent">
                    <SelectValue placeholder="Select parent" />
                  </SelectTrigger>
                  <SelectContent>
                    {parentOptions.map((parent) => (
                      <SelectItem key={parent.id} value={parent.id}>
                        {parent.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label>Parent Attributes</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onSelectAll}
                  disabled={
                    selectableParentAttributes.length === 0 ||
                    selectableParentAttributes.every((attr) => {
                      const key = getAttributeKey(attr);
                      return !key || inheritedKeySet.has(key);
                    })
                  }
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onSelectNone}
                  disabled={selectedInherited.size === 0}
                >
                  Select none
                </Button>
              </div>
            </div>

            {selectableParentAttributes.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                This parent has no attributes to inherit.
              </div>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto border rounded-md p-3">
                {selectableParentAttributes.map((attr) => {
                  const key = getAttributeKey(attr);
                  if (!key) return null;
                  const isAlreadyInherited = inheritedKeySet.has(key);
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={
                            selectedInherited.has(key) || isAlreadyInherited
                          }
                          onCheckedChange={(checked) =>
                            onToggleInherited(key, Boolean(checked))
                          }
                          disabled={isAlreadyInherited}
                        />
                        <div className="text-sm">
                          <div className="font-medium">
                            {attr.name || "Untitled"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {attr.type}
                            {attr.unit ? ` · ${attr.unit}` : ""}
                            {isAlreadyInherited ? " · inherited" : ""}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                        {attr.value}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={selectedInherited.size === 0}
          >
            Inherit Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
