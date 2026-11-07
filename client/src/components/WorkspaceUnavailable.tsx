import { Button } from "@/components/ui/button";

/** Shown when the local server cannot resolve the workspace user. */
export function WorkspaceUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Workspace unavailable</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The Symlit server could not be reached. Check that it is running and try again.
        </p>
        <Button className="mt-6" onClick={onRetry} data-testid="button-retry-workspace">
          Try again
        </Button>
      </div>
    </div>
  );
}
