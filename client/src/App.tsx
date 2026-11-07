import { lazy, Suspense } from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DiagramEventBusProvider } from "@/lib/diagram-events";
import NotFound from "@/pages/not-found";

// Pages are loaded on demand so the project list does not download the
// diagram editor (React Flow, panels, layout engines) up front.
const ProjectList = lazy(() => import("@/pages/ProjectList"));
const ProjectView = lazy(() => import("@/pages/ProjectView"));

function PageLoading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center text-sm text-muted-foreground"
      role="status"
    >
      Loading…
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <Redirect to="/projects" />
      </Route>
      {/* Kept so old bookmarks keep working; the local edition has no login. */}
      <Route path="/login">
        <Redirect to="/projects" />
      </Route>
      <Route path="/projects" component={ProjectList} />
      <Route path="/project/:id" component={ProjectView} />
      <Route path="/project/:id/view/:viewId" component={ProjectView} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DiagramEventBusProvider>
        <TooltipProvider>
          <Toaster />
          <Suspense fallback={<PageLoading />}>
            <Router />
          </Suspense>
        </TooltipProvider>
      </DiagramEventBusProvider>
    </QueryClientProvider>
  );
}

export default App;
