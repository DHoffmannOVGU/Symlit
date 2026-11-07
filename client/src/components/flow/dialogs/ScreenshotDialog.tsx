import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ScreenshotDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  screenshot: string | null;
  onCopy: () => void;
  onDownload: () => void;
};

export function ScreenshotDialog({
  open,
  onOpenChange,
  screenshot,
  onCopy,
  onDownload,
}: ScreenshotDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] md:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background">
        <DialogHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle>Diagram Screenshot</DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-2 md:p-4 bg-muted/30 flex items-center justify-center min-h-[200px] max-h-[60vh]">
          {screenshot && (
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={screenshot}
                alt="Diagram Screenshot"
                className="max-w-full max-h-full w-auto h-auto object-contain shadow-2xl rounded-lg border bg-white"
              />
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t bg-muted/10 flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onCopy} className="flex-1 gap-2">
            <Copy className="h-4 w-4" />
            Copy
          </Button>
          <Button onClick={onDownload} className="flex-1 gap-2">
            <Download className="h-4 w-4" />
            Download
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="flex-1 sm:hidden"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
