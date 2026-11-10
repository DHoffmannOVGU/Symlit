import type { ValidationIssue } from "@shared/model-validation";
import { useReactFlow } from "@xyflow/react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDiagramStore } from "../state/DiagramStoreProvider";
import { canvasFitOptions } from "../utils/fit-options";

export interface ValidationResultsDialogProps {
  validationOpen: boolean;
  setValidationOpen: React.Dispatch<React.SetStateAction<boolean>>;
  validationIssues: ValidationIssue[];
  highlightIssues: boolean;
  setHighlightIssues: React.Dispatch<React.SetStateAction<boolean>>;
  applyIssueHighlights: (enable: boolean, issues?: ValidationIssue[]) => void;
  /** Runs validation again (after fixing something). */
  handleValidate: () => void;
}

/**
 * The issues the last validation found, in a panel beside the canvas that
 * stays open while they are fixed. Clicking an issue selects the element or
 * relationship and brings it into view. (A clean result is only a toast.)
 */
export function ValidationResultsDialog({
  validationOpen,
  setValidationOpen,
  validationIssues,
  highlightIssues,
  setHighlightIssues,
  applyIssueHighlights,
  handleValidate,
}: ValidationResultsDialogProps) {
  const { fitView } = useReactFlow();
  const selectNode = useDiagramStore((state) => state.selectNode);
  const selectEdge = useDiagramStore((state) => state.selectEdge);
  const edges = useDiagramStore((state) => state.edges);

  if (!validationOpen || validationIssues.length === 0) return null;

  const close = () => {
    setValidationOpen(false);
    setHighlightIssues(false);
    applyIssueHighlights(false);
  };

  const show = (issue: ValidationIssue) => {
    let nodeIds = [issue.id];
    if (issue.type === "edge") {
      selectEdge(issue.id);
      const edge = edges.find((candidate) => candidate.id === issue.id);
      nodeIds = edge ? [edge.source, edge.target] : [];
    } else {
      selectNode(issue.id);
    }
    if (nodeIds.length > 0) {
      void fitView({ ...canvasFitOptions(300), nodes: nodeIds.map((id) => ({ id })) });
    }
  };

  return (
    <section
      aria-label="Validation issues"
      className="absolute right-4 top-[72px] z-30 flex max-h-[min(420px,calc(100%-6rem))] w-[340px] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-xl border bg-card shadow-xl"
      data-testid="validation-results"
    >
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
        <h2 className="flex-1 text-sm font-semibold">
          {validationIssues.length} {validationIssues.length === 1 ? "issue" : "issues"} found
        </h2>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={close} aria-label="Close validation issues">
          <X className="h-4 w-4" />
        </Button>
      </header>
      <ol className="space-y-1 overflow-y-auto p-2">
        {validationIssues.map((issue, index) => (
          <li key={`${issue.type}-${issue.id}-${index}`}>
            <button
              type="button"
              onClick={() => show(issue)}
              className="w-full rounded-md border border-transparent px-2.5 py-2 text-left text-sm hover:border-destructive/30 hover:bg-destructive/5 focus-visible:border-destructive/40 focus-visible:outline-none"
              title="Show on the diagram"
              data-testid={`validation-issue-${index}`}
            >
              <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {issue.type === "edge" ? "Relationship" : "Element"}
              </span>
              {issue.message}
            </button>
          </li>
        ))}
      </ol>
      <footer className="flex items-center justify-between gap-2 border-t px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const next = !highlightIssues;
            setHighlightIssues(next);
            applyIssueHighlights(next);
          }}
        >
          {highlightIssues ? "Hide marks" : "Mark on diagram"}
        </Button>
        <Button size="sm" variant="outline" onClick={handleValidate} data-testid="button-validate-again">
          Validate again
        </Button>
      </footer>
    </section>
  );
}
