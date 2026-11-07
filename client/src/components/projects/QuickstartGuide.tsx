import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Download,
  MousePointer2,
  PanelLeft,
  Save,
} from "lucide-react";
import type { View } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { QuickstartProgress } from "@/lib/quickstart-progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface QuickstartGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  views: View[];
  currentViewId?: number;
  progress: QuickstartProgress;
  onNavigateToView: (viewId: number) => void;
  onOpenOverview: () => void;
  onCreateBlankProject: () => void;
}

const steps = [
  {
    number: "01",
    icon: PanelLeft,
    title: "Choose a view",
    description:
      "Use the Diagram Views tab in the left sidebar to move between different perspectives of the same system.",
  },
  {
    number: "02",
    icon: MousePointer2,
    title: "Shape the model",
    description:
      "Drag nodes to arrange the diagram. Use the left panel to add new elements when you are ready to extend it.",
  },
  {
    number: "03",
    icon: ArrowRight,
    title: "Connect ideas",
    description:
      "Drag from one node handle to another to describe a relationship, flow, or dependency between elements.",
  },
  {
    number: "04",
    icon: Save,
    title: "Save and share",
    description:
      "Save your changes from the header, then use Export Project in the sidebar when you want to share the model.",
  },
];

export function QuickstartGuide({
  open,
  onOpenChange,
  views,
  currentViewId,
  progress,
  onNavigateToView,
  onOpenOverview,
  onCreateBlankProject,
}: QuickstartGuideProps) {
  const tutorialViewCount = Math.max(views.length, 3);
  const visitedViewIds = new Set(progress.visitedViewIds);
  if (currentViewId) visitedViewIds.add(currentViewId);
  const visitedViewCount =
    views.length > 0
      ? views.filter((view) => visitedViewIds.has(view.id)).length
      : currentViewId
        ? 1
        : 0;
  const checklist = [
    {
      label: `Visit all ${tutorialViewCount} tutorial views`,
      complete:
        views.length > 0 &&
        visitedViewCount === tutorialViewCount,
    },
    {
      label: "Create a model element",
      complete: progress.createdNode,
    },
    {
      label: "Create a relationship",
      complete: progress.createdEdge,
    },
    {
      label: "Save your work",
      complete: progress.saved,
    },
  ];
  const completedCount = checklist.filter((item) => item.complete).length;
  const isComplete = completedCount === checklist.length;
  const progressPercent = Math.round(
    (completedCount / checklist.length) * 100,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <Badge variant="secondary">Quickstart guide</Badge>
          </div>
          <DialogTitle className="text-2xl">Take a short tour of SymLit</DialogTitle>
          <DialogDescription className="max-w-xl leading-6">
            This guide follows the same workflow as the tutorial model: explore
            a view, build connections, and review what you created.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-primary/20 bg-primary/[0.06] p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold">
              {isComplete
                ? "Quickstart complete"
                : `${completedCount} of ${checklist.length} steps complete`}
            </span>
            <span className="font-mono text-xs text-primary">
              {progressPercent}%
            </span>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-primary/10"
            role="progressbar"
            aria-label="Quickstart progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {checklist.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <CheckCircle2
                  className={`h-4 w-4 shrink-0 ${
                    item.complete ? "text-emerald-600" : "text-muted-foreground/40"
                  }`}
                />
                <span className={item.complete ? "text-foreground" : ""}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 pt-2 sm:grid-cols-2">
          {steps.map((step) => {
            const StepIcon = step.icon;
            return (
              <div
                key={step.number}
                className="rounded-2xl border border-border/70 bg-muted/20 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold tracking-widest text-primary">
                    {step.number}
                  </span>
                  <StepIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="mt-5 font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Tour stops in this project</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Open each view in order to follow the model from context to
                verification.
              </p>
              <div className="mt-3 grid gap-2">
                {views.map((view, index) => (
                  <Button
                    key={view.id}
                    type="button"
                    variant={currentViewId === view.id ? "secondary" : "outline"}
                    className="h-auto justify-between gap-3 px-3 py-2 text-left"
                    onClick={() => {
                      onNavigateToView(view.id);
                      onOpenChange(false);
                    }}
                    data-testid={`button-quickstart-view-${index + 1}`}
                  >
                    <span className="min-w-0 truncate">
                      <span className="mr-2 text-xs font-semibold text-primary">
                        {index + 1}
                      </span>
                      {view.name}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {isComplete ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
            <p className="font-semibold text-emerald-800 dark:text-emerald-300">
              You have the core SymLit workflow down.
            </p>
            <p className="mt-1 text-sm leading-5 text-emerald-700/80 dark:text-emerald-300/80">
              Continue refining this model, or use what you learned to start
              your own blank project.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button type="button" onClick={onCreateBlankProject}>
                Start a blank project
              </Button>
              <Button type="button" variant="outline" onClick={onOpenOverview}>
                Back to project overview
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onOpenOverview}>
              Project overview
            </Button>
          </div>
        )}

        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Download className="h-3.5 w-3.5" />
          You can reopen this guide anytime from the Quickstart button in the
          workspace header.
        </p>
      </DialogContent>
    </Dialog>
  );
}