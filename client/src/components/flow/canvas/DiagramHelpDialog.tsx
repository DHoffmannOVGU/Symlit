import type { DiagramHelpContent } from "./useDiagramHelpContent";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface DiagramHelpDialogProps {
  helpDialogOpen: boolean;
  setHelpDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  helpContent: DiagramHelpContent;
}

export function DiagramHelpDialog({
  helpDialogOpen,
  setHelpDialogOpen,
  helpContent,
}: DiagramHelpDialogProps) {
  return (
    <Dialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen}>
            <DialogContent className="sm:max-w-[620px]">
              <DialogHeader>
                <DialogTitle>{helpContent.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  {helpContent.description}
                </p>
    
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Shortcuts</h3>
                  <div className="space-y-2">
                    {helpContent.shortcuts.map((shortcut) => (
                      <div
                        key={shortcut.key}
                        className="flex items-start justify-between gap-4 rounded-lg border bg-muted/20 px-3 py-2"
                      >
                        <code className="shrink-0 rounded bg-background px-2 py-1 text-xs font-semibold">
                          {shortcut.key}
                        </code>
                        <span className="text-sm text-muted-foreground">
                          {shortcut.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
    
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">How it works</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {helpContent.functions.map((item) => (
                      <li
                        key={item}
                        className="rounded-lg border bg-muted/20 px-3 py-2"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </DialogContent>
          </Dialog>
  );
}
