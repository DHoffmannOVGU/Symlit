import type { ProjectType } from "@shared/schema";
import type { ValidationIssue } from "@shared/model-validation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface ValidationResultsDialogProps {
  validationOpen: boolean;
  setValidationOpen: React.Dispatch<React.SetStateAction<boolean>>;
  validationIssues: ValidationIssue[];
  projectType: ProjectType;
  highlightIssues: boolean;
  setHighlightIssues: React.Dispatch<React.SetStateAction<boolean>>;
  applyIssueHighlights: (enable: boolean, issues?: ValidationIssue[]) => void;
}

export function ValidationResultsDialog({
  validationOpen,
  setValidationOpen,
  validationIssues,
  projectType,
  highlightIssues,
  setHighlightIssues,
  applyIssueHighlights,
}: ValidationResultsDialogProps) {
  return (
    <Dialog open={validationOpen} onOpenChange={setValidationOpen}>
            <DialogContent className="sm:max-w-[560px]">
              <DialogHeader>
                <DialogTitle>Validation Results</DialogTitle>
              </DialogHeader>
    
              {validationIssues.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  {projectType === "instance"
                    ? "No issues found. All meta and instance rules pass."
                    : "No issues found. Your model rules pass."}
                </div>
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto">
                  {validationIssues.map((issue, index) => (
                    <div
                      key={`${issue.type}-${issue.id}-${index}`}
                      className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                    >
                      {issue.message}
                    </div>
                  ))}
                </div>
              )}
    
              <DialogFooter>
                {validationIssues.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const next = !highlightIssues;
                      setHighlightIssues(next);
                      applyIssueHighlights(next);
                    }}
                  >
                    {highlightIssues ? "Clear marks" : "Mark issues"}
                  </Button>
                )}
                <Button onClick={() => setValidationOpen(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
  );
}
