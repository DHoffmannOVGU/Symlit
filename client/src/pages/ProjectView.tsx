import { useState, useEffect } from "react";
import { useRoute, Redirect, Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  useProject,
  useProjects,
  useUpdateProject,
} from "@/hooks/use-projects";
import { useDeleteView, useView, useViews } from "@/hooks/use-views";
import { Sidebar } from "@/components/layout/Sidebar";
import { DiagramCanvas } from "@/components/flow/canvas/DiagramCanvas";
import { CreateViewDialog } from "@/components/layout/CreateViewDialog";
import { EditViewDialog } from "@/components/layout/EditViewDialog";
import {
  Layers,
  Loader2,
  Plus,
  ArrowRight,
  Settings2,
  ArrowLeft,
  Trash2,
  Save,
  BookOpen,
} from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  dispatchDiagramEvent,
  subscribeDiagramEvent,
} from "@/lib/diagram-events";
import { rememberRecentProject } from "@/lib/recent-projects";
import { QuickstartGuide } from "@/components/projects/QuickstartGuide";
import { WorkspaceUnavailable } from "@/components/WorkspaceUnavailable";
import {
  getQuickstartProgress,
  updateQuickstartProgress,
  type QuickstartProgress,
} from "@/lib/quickstart-progress";

export default function ProjectView() {
  const {
    user,
    userId,
    role,
    isLoading: authLoading,
    refreshSession,
  } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

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
  const deleteView = useDeleteView();

  const [isCreateViewOpen, setIsCreateViewOpen] = useState(false);
  const [editingView, setEditingView] = useState<View | null>(null);
  const [selectedMetamodelIds, setSelectedMetamodelIds] = useState<number[]>(
    [],
  );
  const [diagramDisplayMode, setDiagramDisplayMode] = useState<
    "graph" | "table"
  >("graph");
  const [internalDeleteOpen, setInternalDeleteOpen] = useState(false);
  const [activeDiagramDirtyState, setActiveDiagramDirtyState] = useState(false);
  const [activeDiagramSaveState, setActiveDiagramSaveState] = useState(false);
  const [quickstartOpen, setQuickstartOpen] = useState(false);
  const [quickstartProgress, setQuickstartProgress] =
    useState<QuickstartProgress>(() => getQuickstartProgress(userId, projectId));
  const isQuickstartProject = project?.name === "SymLit Quickstart";

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
    if (!isQuickstartProject || !userId) {
      setQuickstartProgress(getQuickstartProgress());
      return;
    }
    setQuickstartProgress(getQuickstartProgress(userId, projectId));
  }, [isQuickstartProject, projectId, userId]);

  useEffect(() => {
    if (!isQuickstartProject || !userId || !viewId) return;
    setQuickstartProgress(
      updateQuickstartProgress(userId, projectId, {
        visitedViewId: viewId,
      }),
    );
  }, [isQuickstartProject, projectId, userId, viewId]);

  useEffect(() => {
    if (!isQuickstartProject || !userId || !viewId) return;
    const updateProgress = (
      update: Parameters<typeof updateQuickstartProgress>[2],
    ) => {
      setQuickstartProgress(
        updateQuickstartProgress(userId, projectId, update),
      );
    };
    const unsubscribeNode = subscribeDiagramEvent(
      "diagram-model-node-created",
      (detail) => {
        if (detail.viewId === viewId) updateProgress({ createdNode: true });
      },
    );
    const unsubscribeEdge = subscribeDiagramEvent(
      "diagram-model-edge-created",
      (detail) => {
        if (detail.viewId === viewId) updateProgress({ createdEdge: true });
      },
    );
    const unsubscribeSave = subscribeDiagramEvent(
      "diagram-save-request",
      (detail) => {
        if (detail.viewId === viewId) updateProgress({ saved: true });
      },
    );
    return () => {
      unsubscribeNode();
      unsubscribeEdge();
      unsubscribeSave();
    };
  }, [isQuickstartProject, projectId, userId, viewId]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !isQuickstartProject ||
      !userId ||
      !project?.id
    ) {
      return;
    }
    const seenKey = `symlit_quickstart_seen:${userId}:${project.id}`;
    if (window.localStorage.getItem(seenKey) !== "true") {
      setQuickstartOpen(true);
      window.localStorage.setItem(seenKey, "true");
    }
  }, [isQuickstartProject, project?.id, userId]);

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

  const handleBackToParentView = () => {
    if (currentView?.parentViewId) {
      setLocation(`/project/${projectId}/view/${currentView.parentViewId}`);
    } else {
      setLocation(`/project/${projectId}`);
    }
  };

  const handleDeleteInternalView = async () => {
    if (!currentView) return;
    try {
      await deleteView.mutateAsync({
        id: currentView.id,
        projectId: currentView.projectId,
      });
      toast({
        title: "Internal view deleted",
        description: "The internal view has been deleted.",
      });
      setInternalDeleteOpen(false);
      handleBackToParentView();
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSaveDiagram = () => {
    if (!viewId) return;
    dispatchDiagramEvent("diagram-save-request", { viewId });
  };

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
  if (project.projectType === "method") {
    return <Redirect to="/projects" />;
  }

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
          methodMetadata: null,
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
        {isQuickstartProject && (
          <QuickstartGuide
            open={quickstartOpen}
            onOpenChange={setQuickstartOpen}
            views={views || []}
            currentViewId={viewId}
            progress={quickstartProgress}
            onNavigateToView={(nextViewId) =>
              setLocation(`/project/${projectId}/view/${nextViewId}`)
            }
            onOpenOverview={() => setLocation(`/project/${projectId}`)}
            onCreateBlankProject={() =>
              setLocation("/projects?startTemplate=blank")
            }
          />
        )}

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
                    {currentView?.viewType === "internal" && (
                      <span className="text-[10px] uppercase tracking-wider text-slate-700 bg-slate-200 px-2 py-0.5 rounded-full">
                        Internal
                      </span>
                    )}
                    <span className="text-sm text-muted-foreground truncate max-w-[100px] md:max-w-[200px]">
                      {currentView?.name ?? views?.find((v) => v.id === viewId)?.name}
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isQuickstartProject && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setQuickstartOpen(true)}
                    data-testid="button-open-quickstart"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span className="hidden sm:inline">Quickstart</span>
                  </Button>
                )}

                {currentView?.viewType === "internal" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={handleBackToParentView}
                      data-testid="button-back-to-parent-view"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-destructive"
                      onClick={() => setInternalDeleteOpen(true)}
                      data-testid="button-delete-internal-view"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </>
                )}

                {project.projectType === "instance" && (
                  <MetamodelSelector
                    availableMetamodels={availableMetamodels}
                    selectedIds={selectedMetamodelIds}
                    onSelectionChange={handleMetamodelChange}
                    unavailableMetamodelIds={unavailableMetamodelIds}
                  />
                )}

                {viewId && (
                  <Button
                    onClick={handleSaveDiagram}
                    disabled={activeDiagramSaveState || !activeDiagramDirtyState}
                    variant={activeDiagramDirtyState || activeDiagramSaveState ? "default" : "outline"}
                    className="order-last gap-2 min-w-[124px]"
                    data-testid="button-save-diagram-header"
                    title={
                      activeDiagramSaveState
                        ? "Saving diagram"
                        : activeDiagramDirtyState
                          ? "Save diagram"
                          : "No changes to save"
                    }
                  >
                    {activeDiagramSaveState ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : !activeDiagramDirtyState ? (
                      <Save className="h-4 w-4 opacity-60" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {activeDiagramSaveState
                      ? "Saving..."
                      : activeDiagramDirtyState
                        ? "Save Diagram"
                        : "No Changes"}
                  </Button>
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
                onDisplayModeChange={setDiagramDisplayMode}
                parentNodeId={currentView?.parentNodeId}
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
                        Select or create a diagram view to start modeling.
                      </p>
                    </div>
                    <Button
                      onClick={() => setIsCreateViewOpen(true)}
                      size="lg"
                      className="shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all gap-2"
                      data-testid="button-create-view-hero"
                    >
                      <Plus className="w-5 h-5" />
                      Create New View
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
                        No views created yet
                      </h3>
                      <p className="text-muted-foreground mt-1 max-w-sm mx-auto">
                        This project is empty. Create your first diagram view to
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
        <EditViewDialog
          view={editingView}
          open={!!editingView}
          onOpenChange={(open) => !open && setEditingView(null)}
        />
        {currentView?.viewType === "internal" && (
          <AlertDialog
            open={internalDeleteOpen}
            onOpenChange={setInternalDeleteOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete internal view?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the internal view{" "}
                  <strong>{currentView.name}</strong> and all its diagram
                  content. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDeleteInternalView}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </SidebarProvider>
  );
}
