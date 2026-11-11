import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Catches errors thrown while rendering a page. Without it React removes the
 * whole app and leaves a blank page, with no hint of what happened or how to
 * get back.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Symlit could not show this page:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6" role="alert">
        <div className="w-full max-w-lg rounded-2xl border bg-card p-8 shadow-sm">
          <h1 className="text-xl font-semibold">This page could not be shown</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Something went wrong while displaying it. What you saved is safe; changes you had not
            saved yet may be lost. Reloading usually helps.
          </p>
          <pre
            className="mt-4 max-h-32 overflow-auto rounded-md bg-muted p-3 font-mono text-xs text-muted-foreground"
            data-testid="text-error-details"
          >
            {error.message || String(error)}
          </pre>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={() => window.location.reload()} data-testid="button-error-reload">
              Reload
            </Button>
            <Button variant="outline" onClick={() => window.location.assign("/projects")}>
              All projects
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
