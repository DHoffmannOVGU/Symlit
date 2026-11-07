import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DiagramEventBusProvider } from "@/lib/diagram-events";
import NotFound from "@/pages/not-found";
import ProjectList from "@/pages/ProjectList";
import ProjectView from "@/pages/ProjectView";

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
          <Router />
        </TooltipProvider>
      </DiagramEventBusProvider>
    </QueryClientProvider>
  );
}

export default App;
