import { useState } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateView } from "@/hooks/use-views";
import { Loader2 } from "lucide-react";
import { buildUrl, api } from "@shared/routes";

interface CreateViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
}

export function CreateViewDialog({ open, onOpenChange, projectId }: CreateViewDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [, setLocation] = useLocation();
  const createView = useCreateView();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createView.mutate(
      { projectId, name, description },
      {
        onSuccess: (newView) => {
          onOpenChange(false);
          setName("");
          setDescription("");
          // Automatically switch to the new view
          setLocation(buildUrl(api.flow.get.path.replace("/flow", ""), { id: projectId, viewId: newView.id }).replace("/api/views", "/project/" + projectId + "/view"));
        }
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New View</DialogTitle>
          <DialogDescription>
            Add a new diagram view to your project to model a specific aspect of the system.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">View Name</Label>
            <Input 
              id="name" 
              placeholder="e.g. System Architecture" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea 
              id="description" 
              placeholder="Briefly describe what this view represents..." 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createView.isPending || !name.trim()}>
              {createView.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create View
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
