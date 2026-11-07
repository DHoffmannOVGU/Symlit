import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@shared/routes";
import type { View } from "@shared/schema";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useUpdateView, useDeleteView } from "@/hooks/use-views";
import { useToast } from "@/hooks/use-toast";
import { Trash2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLocation } from "wouter";

interface EditViewDialogProps {
  view: View | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const editViewSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  description: z.string().max(200).optional(),
});

type EditViewValues = z.infer<typeof editViewSchema>;

export function EditViewDialog({ view, open, onOpenChange }: EditViewDialogProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const updateView = useUpdateView();
  const deleteView = useDeleteView();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isPattern = view?.viewType === "pattern";

  const form = useForm<EditViewValues>({
    resolver: zodResolver(editViewSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  useEffect(() => {
    if (view && open) {
      form.reset({
        name: view.name,
        description: view.description || "",
      });
    }
  }, [view, open, form]);

  const onSubmit = async (data: EditViewValues) => {
    if (!view) return;
    
    try {
      await updateView.mutateAsync({
        id: view.id,
        projectId: view.projectId,
        ...data,
      });
      toast({
        title: "View updated",
        description: "The diagram view has been updated successfully.",
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!view) return;
    try {
      await deleteView.mutateAsync({ id: view.id, projectId: view.projectId });
      toast({
        title: "View deleted",
        description: "The diagram view has been deleted.",
      });
      onOpenChange(false);
      // If we are currently on this view's page, redirect to project overview
      setLocation(`/project/${view.projectId}`);
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader className="flex flex-row items-center justify-between gap-4">
            <DialogTitle>{isPattern ? "Edit Pattern" : "Edit Diagram View"}</DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive transition-colors"
              onClick={() => setShowDeleteConfirm(true)}
              data-testid={isPattern ? "button-delete-pattern-trigger" : "button-delete-view-trigger"}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </DialogHeader>

          <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Logical Architecture" data-testid="input-view-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Describe the purpose of this diagram..." 
                      className="resize-none"
                      data-testid="textarea-view-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-edit-view"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateView.isPending}
                data-testid="button-save-view-changes"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            {isPattern ? "Delete Pattern?" : "Delete View?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the {isPattern ? "pattern" : "view"} "<strong>{view?.name}</strong>" and all its diagram content. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-delete-view">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            data-testid="button-confirm-delete-view"
          >
            Delete Permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
);
}
