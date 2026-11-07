import type { DiagramEdge } from "../types";
import type { DiagramNode as Node } from "../types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export interface SavePatternDialogProps {
  patternDialogOpen: boolean;
  setPatternDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  patternName: string;
  setPatternName: React.Dispatch<React.SetStateAction<string>>;
  patternDescription: string;
  setPatternDescription: React.Dispatch<React.SetStateAction<string>>;
  patternSnapshot: { nodes: Node[]; edges: DiagramEdge[]; } | null;
  setPatternSnapshot: React.Dispatch<React.SetStateAction<{ nodes: Node[]; edges: DiagramEdge[]; } | null>>;
  handleCreatePattern: () => Promise<void>;
}

export function SavePatternDialog({
  patternDialogOpen,
  setPatternDialogOpen,
  patternName,
  setPatternName,
  patternDescription,
  setPatternDescription,
  patternSnapshot,
  setPatternSnapshot,
  handleCreatePattern,
}: SavePatternDialogProps) {
  return (
    <Dialog open={patternDialogOpen} onOpenChange={setPatternDialogOpen}>
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle>Save Pattern</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pattern-name">Name</Label>
                  <Input
                    id="pattern-name"
                    value={patternName}
                    onChange={(event) => setPatternName(event.target.value)}
                    placeholder="e.g. Control loop starter"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pattern-description">
                    Description (optional)
                  </Label>
                  <Textarea
                    id="pattern-description"
                    value={patternDescription}
                    onChange={(event) => setPatternDescription(event.target.value)}
                    placeholder="What should this pattern be used for?"
                    rows={3}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  Saving {patternSnapshot?.nodes.length ?? 0} nodes and{" "}
                  {patternSnapshot?.edges.length ?? 0} edges.
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPatternDialogOpen(false);
                    setPatternSnapshot(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreatePattern}
                  disabled={!patternName.trim() || !patternSnapshot?.nodes.length}
                >
                  Save Pattern
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
  );
}
