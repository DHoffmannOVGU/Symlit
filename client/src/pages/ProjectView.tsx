import { apiCall } from "@/lib/api-client";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { emitTutorialSignal } from "@/lib/tutorial-signals";
import { useState, useEffect } from "react";
import { useRoute, Redirect, Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  useProject,
  useProjects,
  useUpdateProject,
} from "@/hooks/use-projects";
import { useView, useViews } from "@/hooks/use-views";
import { Sidebar } from "@/components/layout/Sidebar";
import { DiagramCanvas } from "@/components/flow/canvas/DiagramCanvas";
import { CreateViewDialog } from "@/components/layout/CreateViewDialog";
import { lazyNamed, MountWhenOpened } from "@/lib/lazy";

// Loads when first opened (it brings the form library).
const EditViewDialog = lazyNamed(() => import("@/components/layout/EditViewDialog"), "EditViewDialog");
import { Layers, Loader2, Plus, ArrowRight, Settings2, Save, Check } from "lucide-react";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { MetamodelSelector } from "@/components/projects/MetamodelSelector";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import type { Project, ProjectType, View } from "@shared/schema";
import type { MetamodelSetup } from "@shared/metamodel-setup";
import {
  dispatchDiagramEvent,
  subscribeDiagramEvent,
} from "@/lib/diagram-events";
import { rememberRecentProject } from "@/lib/recent-projects";
import { TutorialCoach } from "@/components/tutorial/TutorialCoach";
import { useTutorialCoach } from "@/components/tutorial/useTutorialCoach";
import { WorkspaceUnavailable } from "@/components/WorkspaceUnavailable";

export default function ProjectView() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const {
    user,
    userId,
    role,
    isLoading: authLoading,
    refreshSession,
  } = useAuth();
  const [, setLocation] = useLocation();

  // Routes: /project/:id or /project/:id/view/:viewId
  const [, paramsProject] = useRoute("/project/:id");
  const [, paramsView] = useRoute("/project/:id/view/:viewId");

  const projectId = Number(paramsProject?.id || paramsView?.id);
  const viewId = paramsView?.viewId ? Number(paramsView.viewId) : undefined;

  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: views, isLoading: viewsLoading } = useViews(projectId);
  const { data: currentView } = useView(viewId ?? 0);
  const { data: allProjects } = useProjects(userId);
  const updateProject = useUpdateProject();

  const [isCreateViewOpen, setIsCreateViewOpen] = useState(false);
  const [editingView, setEditingView] = useState<View | null>(null);
  const [selectedMetamodelIds, setSelectedMetamodelIds] = useState<number[]>(
    [],
  );
  const [diagramDisplayMode, setDiagramDisplayMode] = useState<
    "graph" | "table"
  >("graph");
  const [activeDiagramDirtyState, setActiveDiagramDirtyState] = useState(false);
  const [activeDiagramSaveState, setActiveDiagramSaveState] = useState(false);
  const tutorialCoach = useTutorialCoach({
    project: project ?? undefined,
    allProjects,
    viewId,
    isDiagramDirty: activeDiagramDirtyState,
  });

  useEffect(() => {
    if (project?.referencedMetamodels) {
      setSelectedMetamodelIds(project.referencedMetamodels as number[]);
    }
  }, [project]);

  useEffect(() => {
    if (userId && project?.id) {
      rememberRecentProject(userId, project.id);
    }
  }, [project?.id, userId]);


  useEffect(() => {
    if (!project?.projectType) return;
    setDiagramDisplayMode("graph");
  }, [projectId, project?.projectType]);

  useEffect(() => {
    if (!viewId) {
      setActiveDiagramDirtyState(false);
      setActiveDiagramSaveState(false);
      return;
    }

    const unsubscribeDirty = subscribeDiagramEvent(
      "diagram-dirty-state",
      (detail) => {
        if (detail.viewId !== viewId) return;
        setActiveDiagramDirtyState(detail.isDirty);
      },
    );
    const unsubscribeSave = subscribeDiagramEvent(
      "diagram-save-state",
      (detail) => {
        if (detail.viewId !== viewId) return;
        setActiveDiagramSaveState(detail.isSaving);
      },
    );
    return () => {
      unsubscribeDirty();
      unsubscribeSave();
    };
  }, [viewId]);

  const handleMetamodelChange = (ids: number[]) => {
    setSelectedMetamodelIds(ids);
    if (projectId) {
      updateProject.mutate({ id: projectId, referencedMetamodels: ids });
    }
  };


  const handleSaveDiagram = () => {
    if (!viewId) return;
    dispatchDiagramEvent("diagram-save-request", { viewId });
  };

  // Ctrl+S / Cmd+S saves the open diagram (and never opens the browser's "save page").
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s" || event.shiftKey || event.altKey) return;
      if (!viewId) return;
      event.preventDefault();
      if (activeDiagramDirtyState && !activeDiagramSaveState) dispatchDiagramEvent("diagram-save-request", { viewId });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeDiagramDirtyState, activeDiagramSaveState, viewId]);

  const saveShortcut = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "\u2318S" : "Ctrl+S";

  // Auth check
  if (authLoading) return null;
  if (!user) return <WorkspaceUnavailable onRetry={() => void refreshSession()} />;

  // Loading state
  if (projectLoading || viewsLoading) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm">Loading workspace...</span>
      </div>
    );
  }

  // Not found handling
  if (!project) return <Redirect to="/projects" />;

  const availableMetamodels = (
    allProjects?.filter(
      (p) => p.projectType === "metamodel" && p.id !== projectId,
    ) || []
  ).concat(
    selectedMetamodelIds
      .filter(
        (id) =>
          id !== projectId &&
          !allProjects?.some((candidate) => candidate.id === id),
      )
      .map(
        (id): Project => ({
          id,
          userId: project.userId,
          name: `Unavailable metamodel #${id}`,
          description: "This referenced metamodel is unavailable.",
          projectType: "metamodel",
          referencedMetamodels: [],
          templateId: null,
          metamodelSetup: null,
          createdAt: null,
        }),
      ),
  );
  const unavailableMetamodelIds = allProjects
    ? selectedMetamodelIds.filter(
        (id) => !allProjects.some((candidate) => candidate.id === id),
      )
    : [];
  const referencedMetamodels = availableMetamodels.filter((project) =>
    selectedMetamodelIds.includes(project.id),
  );

  return (
    <SidebarProvider>
      <div className="flex h-svh w-full overflow-hidden bg-background">
        <Sidebar
          projectId={projectId}
          views={views || []}
          currentViewId={viewId}
          onCreateView={() => setIsCreateViewOpen(true)}
          projectName={project.name}
          projectType={project.projectType as ProjectType}
          workspaceRole={project.userId === userId ? "admin" : role}
          referencedProjects={referencedMetamodels}
           unavailableMetamodelIds={unavailableMetamodelIds}
           onRemoveReferencedMetamodel={(id: number) =>
             handleMetamodelChange(
               selectedMetamodelIds.filter((selectedId) => selectedId !== id),
             )
           }
          metamodelSetup={
            project.projectType === "metamodel"
              ? (project.metamodelSetup as MetamodelSetup | null)
              : null
          }
        />

        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 bg-card sticky top-0 z-10">
            <SidebarTrigger className="-ml-1" />
            <div className="flex items-center justify-between flex-1 gap-4 overflow-hidden">
              <div className="flex items-center gap-2 overflow-hidden shrink-0">
                <span className="text-sm font-semibold truncate max-w-[150px] md:max-w-[300px]">
                  {project.name}
                </span>
                {viewId && (
                  <>
                    <span className="text-muted-foreground">/</span>
                    {currentView?.viewType === "pattern" && (
                      <span className="text-[10px] uppercase tracking-wider text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                        Pattern
                      </span>
                    )}
                    <span className="text-sm text-muted-foreground truncate max-w-[100px] md:max-w-[200px]">
                      {currentView?.name ?? views?.find((v) => v.id === viewId)?.name}
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">


                {project.projectType === "instance" && (
                  <MetamodelSelector
                    availableMetamodels={availableMetamodels}
                    selectedIds={selectedMetamodelIds}
                    onSelectionChange={handleMetamodelChange}
                    unavailableMetamodelIds={unavailableMetamodelIds}
                  />
                )}

                {viewId && (
                  <div className="order-last flex items-center gap-3">
                    <span
                      className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"
                      aria-live="polite"
                      data-testid="diagram-save-status"
                    >
                      {activeDiagramSaveState ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Saving…
                        </>
                      ) : activeDiagramDirtyState ? (
                        <>
                          <span className="h-2 w-2 rounded-full bg-amber-500" />
                          Unsaved changes
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          All changes saved
                        </>
                      )}
                    </span>
                    <Button
                      onClick={handleSaveDiagram}
                      disabled={activeDiagramSaveState || !activeDiagramDirtyState}
                      variant={activeDiagramDirtyState || activeDiagramSaveState ? "default" : "outline"}
                      className="gap-2"
                      data-testid="button-save-diagram-header"
                      title={activeDiagramDirtyState ? `Save the diagram (${saveShortcut})` : "Nothing to save"}
                    >
                      <Save className="h-4 w-4" />
                      Save
                    </Button>
                  </div>
                )}



              </div>
            </div>
          </header>

          <main className="flex-1 relative flex flex-col overflow-hidden">
            {viewId ? (
              <DiagramCanvas
                viewId={viewId}
                projectId={projectId}
                projectType={project.projectType as ProjectType}
                metamodelSetup={
                  project.projectType === "metamodel"
                    ? (project.metamodelSetup as MetamodelSetup | null)
                    : null
                }
                referencedMetamodelIds={selectedMetamodelIds}
                referencedMetamodels={referencedMetamodels}
                viewMode="build"
                displayMode={diagramDisplayMode}
                onDisplayModeChange={(mode) => {
                  setDiagramDisplayMode(mode);
                  if (mode === "table") emitTutorialSignal("table-mode");
                }}
              />
            ) : (
              <div className="flex-1 overflow-y-auto bg-slate-50/30 p-4 md:p-8">
                <div className="max-w-5xl mx-auto space-y-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-3xl font-bold tracking-tight text-foreground">
                        Views
                      </h2>
                      <p className="text-muted-foreground mt-1">
                        Open a diagram or create one to start modeling.
                      </p>
                    </div>
                    <Button
                      onClick={() => setIsCreateViewOpen(true)}
                      size="lg"
                      className="shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all gap-2"
                      data-testid="button-create-view-hero"
                    >
                      <Plus className="w-5 h-5" />
                      New diagram
                    </Button>
                  </div>

                  {views && views.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                      {views.map((view) => (
                        <div key={view.id} className="relative group">
                          <Link href={`/project/${projectId}/view/${view.id}`}>
                            <Card
                              className="hover-elevate cursor-pointer border-border/60 transition-all group-hover:border-primary/30 h-full flex flex-col"
                              data-testid={`card-view-${view.id}`}
                            >
                              <CardHeader className="pb-3">
                                <div className="flex items-center gap-3 mb-2">
                                  <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                                    <Layers className="w-5 h-5" />
                                  </div>
                                  <CardTitle className="text-lg group-hover:text-primary transition-colors">
                                    {view.name}
                                  </CardTitle>
                                </div>
                                <CardDescription className="line-clamp-2">
                                  {view.description ||
                                    "No description provided."}
                                </CardDescription>
                              </CardHeader>
                              <CardFooter className="mt-auto pt-4 border-t text-xs text-muted-foreground flex justify-between items-center">
                                <span>
                                  Created{" "}
                                  {view.createdAt
                                    ? format(
                                        new Date(view.createdAt),
                                        "MMM d, yyyy",
                                      )
                                    : "Recently"}
                                </span>
                                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </CardFooter>
                            </Card>
                          </Link>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-all hover:bg-primary hover:text-white z-10"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditingView(view);
                            }}
                            data-testid={`button-configure-view-${view.id}`}
                          >
                            <Settings2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border flex flex-col items-center">
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 text-muted-foreground">
                        <Layers className="w-8 h-8 opacity-50" />
                      </div>
                      <h3 className="text-xl font-medium">
                        No diagrams yet
                      </h3>
                      <p className="text-muted-foreground mt-1 max-w-sm mx-auto">
                        This project is empty. Create your first diagram to
                        get started.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </SidebarInset>

        <CreateViewDialog
          open={isCreateViewOpen}
          onOpenChange={setIsCreateViewOpen}
          projectId={projectId}
        />
        <MountWhenOpened open={!!editingView}>
          <EditViewDialog
          view={editingView}
          open={!!editingView}
          onOpenChange={(open) => !open && setEditingView(null)}
        />
        </MountWhenOpened>
        {tutorialCoach.active && tutorialCoach.progress && tutorialCoach.scope && (
          <TutorialCoach
            progress={tutorialCoach.progress}
            scope={tutorialCoach.scope}
            onShowMe={(step) => void tutorialCoach.showMe(step)}
            onSkip={tutorialCoach.skip}
            onRestart={tutorialCoach.restart}
            onCollapsedChange={tutorialCoach.setCollapsed}
            onStartOwnProject={() => tutorialCoach.navigate("/projects?startTemplate=blank")}
            onRemoveTutorial={async () => {
              try {
                await apiCall(api.tutorial.delete);
                await queryClient.invalidateQueries({ queryKey: [api.projects.list.path] });
                setLocation("/projects");
              } catch (error) {
                toast({
                  title: "Could not remove the tutorial projects",
                  description: error instanceof Error ? error.message : undefined,
                  variant: "destructive",
                });
              }
            }}
          />
        )}
      </div>
    </SidebarProvider>
  );
}
