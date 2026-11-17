import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/** A project removing a tutorial deletes. */
export interface RemovedProject {
  name: string;
  /** The learner made it (a copy of the tutorial's model), not the tutorial. */
  yours: boolean;
}

/** The projects that go, the learner's own marked as such. */
export function RemovedProjectsList({ projects }: { projects: RemovedProject[] }) {
  if (projects.length === 0) return null;
  return (
    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm" data-testid="tutorial-removed-projects">
      {projects.map((project, index) => (
        <li key={`${project.name}-${index}`}>
          {project.name}
          {project.yours && <span className="font-medium text-amber-700 dark:text-amber-300"> (made by you)</span>}
        </li>
      ))}
    </ul>
  );
}

/** Asks before a tutorial's projects are deleted, and names them. */
export function ConfirmTutorialRemoval({
  title,
  projects,
  onConfirm,
  children,
}: {
  /** The tutorial's title. */
  title: string;
  projects: RemovedProject[];
  onConfirm: () => void;
  /** The button that asks. */
  children: ReactNode;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent data-testid="tutorial-remove-confirm">
        <AlertDialogHeader>
          <AlertDialogTitle>Remove the projects of {title}?</AlertDialogTitle>
          <AlertDialogDescription>
            These projects are deleted with everything in them. The tutorial can be started again at any time, with
            fresh projects.
          </AlertDialogDescription>
          <RemovedProjectsList projects={projects} />
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90"
            onClick={onConfirm}
            data-testid="button-confirm-tutorial-remove"
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
