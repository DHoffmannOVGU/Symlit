import { WorkspaceUnavailable } from "@/components/WorkspaceUnavailable";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import {
  Activity,
  ArrowDownRight,
  Box,
  Clock3,
  Folder,
  Layers,
  Plus,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  useCreateStarterProject,
  useDeleteProject,
  useProjects,
  useUpdateProject,
} from "@/hooks/use-projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  getProjectTemplate,
  getProjectTemplateViews,
  PROJECT_TEMPLATES,
  type ProjectTemplateId,
} from "@/lib/project-templates";
import {
  getRecentProjects,
  rememberRecentProject,
  type RecentProject,
} from "@/lib/recent-projects";
import {
  getMetamodelPurposeRecommendation,
  normalizeMetamodelSetup,
  type MagicNodeType,
  type MagicRelationType,
  type MetamodelPurpose,
  type MetamodelSetup,
} from "@shared/metamodel-setup";
import type { Project, ProjectType } from "@shared/schema";
import { ProjectCreateDialog } from "@/components/projects/ProjectCreateDialog";
import { ProjectEditDialog } from "@/components/projects/ProjectEditDialog";
import { getProjectTypeMeta } from "@/components/projects/project-types";

function RecentProjectCard({
  project,
  openedAt,
}: {
  project: Project;
  openedAt: number;
}) {
  const [, setLocation] = useLocation();
  const typeMeta = getProjectTypeMeta(project.projectType);
  const TypeIcon = typeMeta.icon;
  const openProject = () => {
    rememberRecentProject(project.userId, project.id);
    setLocation(`/project/${project.id}`);
  };

  return (
    <Card
      className="group min-w-[245px] cursor-pointer border-border/60 bg-card/80 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg sm:min-w-[270px]"
      role="link"
      tabIndex={0}
      aria-label={`Open recent project ${project.name}`}
      onClick={openProject}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openProject();
        }
      }}
      data-testid={`recent-project-${project.id}`}
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-xl p-2.5 ${typeMeta.iconClassName}`}>
          <TypeIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{project.name}</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge
              variant="outline"
              className={`h-5 px-1.5 text-[10px] ${typeMeta.badgeClassName}`}
            >
              {typeMeta.label}
            </Badge>
            <span className="truncate text-xs text-muted-foreground">
              {openedAt > 0
                ? formatDistanceToNow(new Date(openedAt), { addSuffix: true })
                : "Recently opened"}
            </span>
          </div>
        </div>
        <ArrowDownRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:text-primary" />
      </div>
    </Card>
  );
}

function ProjectCard({
  project,
  onDelete,
  onEdit,
  allProjects,
}: {
  project: Project;
  onDelete: (id: number) => void;
  onEdit: (project: Project) => void;
  allProjects?: Project[];
}) {
  const [, setLocation] = useLocation();
  const referencedMetamodels =
    allProjects?.filter((candidate) =>
      (project.referencedMetamodels ?? []).includes(candidate.id),
    ) ?? [];
  const typeMeta = getProjectTypeMeta(project.projectType);
  const TypeIcon = typeMeta.icon;
  const openProject = () => {
    rememberRecentProject(project.userId, project.id);
    setLocation(`/project/${project.id}`);
  };

  return (
    <Card
      className="group flex h-full cursor-pointer flex-col overflow-hidden border-border/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
      data-testid={`card-project-${project.id}`}
      role="link"
      tabIndex={0}
      aria-label={`Open project ${project.name}`}
      onClick={openProject}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openProject();
        }
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className={`mb-3 rounded-xl p-2.5 ${typeMeta.iconClassName}`}>
            <TypeIcon className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground opacity-100 transition-all hover:text-primary sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(project);
              }}
              data-testid={`button-edit-project-${project.id}`}
              aria-label={`Edit project ${project.name}`}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground opacity-100 transition-all hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                  onClick={(event) => event.stopPropagation()}
                  data-testid={`button-delete-project-${project.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete "{project.name}" and all its
                    diagrams. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive hover:bg-destructive/90"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onDelete(project.id);
                    }}
                    data-testid="button-confirm-delete"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <CardTitle className="text-xl">{project.name}</CardTitle>
        <CardDescription className="mb-2 line-clamp-2 min-h-[40px]">
          {project.description || "No description provided."}
        </CardDescription>
        {referencedMetamodels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {referencedMetamodels.map((referenced) => (
              <Badge
                key={referenced.id}
                variant="secondary"
                className="h-5 border-violet-200 bg-violet-50 px-1.5 text-[10px] text-violet-700 dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-300"
              >
                {referenced.name}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardFooter className="mt-auto flex items-center justify-between gap-2 border-t bg-slate-50/50 pt-4 text-sm text-muted-foreground dark:bg-slate-900/50">
        <span>
          {project.createdAt
            ? format(new Date(project.createdAt), "MMM d, yyyy")
            : "Unknown date"}
        </span>
        <ArrowDownRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
      </CardFooter>
    </Card>
  );
}

function StarterEmptyState({
  onSelectTemplate,
}: {
  onSelectTemplate: (templateId: ProjectTemplateId) => void;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-primary/25 bg-gradient-to-br from-card to-primary/[0.06] p-6 sm:p-10">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Folder className="h-7 w-7" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          New workspace
        </p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight">
          Start with a model that fits your work
        </h3>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Choose a starter template with a useful first view, or begin with a
          completely blank project.
        </p>
      </div>
      <div className="mx-auto mt-8 grid max-w-5xl gap-3 md:grid-cols-2 lg:grid-cols-4">
        {PROJECT_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelectTemplate(template.id)}
            className="group rounded-2xl border border-border/70 bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid={`button-template-${template.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className={`rounded-xl p-2.5 ${getProjectTypeMeta(template.projectType).iconClassName}`}>
                {(() => {
                  const TemplateIcon = getProjectTypeMeta(template.projectType).icon;
                  return <TemplateIcon className="h-5 w-5" />;
                })()}
              </div>
              <ArrowDownRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:text-primary" />
            </div>
            <p className="mt-6 font-semibold">{template.name}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {template.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProjectGrid({
  projects,
  onDelete,
  onEdit,
  isLoading,
  allProjects,
  onSelectTemplate,
  showStarterState = false,
}: {
  projects?: Project[];
  onDelete: (id: number) => void;
  onEdit: (project: Project) => void;
  isLoading: boolean;
  allProjects?: Project[];
  onSelectTemplate?: (templateId: ProjectTemplateId) => void;
  showStarterState?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-48 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800"
          />
        ))}
      </div>
    );
  }
  if (!projects?.length) {
    if (showStarterState && onSelectTemplate) {
      return <StarterEmptyState onSelectTemplate={onSelectTemplate} />;
    }
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-24 text-center dark:border-slate-700 dark:bg-slate-900">
        <Folder className="mx-auto mb-4 h-8 w-8 text-slate-400" />
        <h3 className="text-xl font-medium text-foreground">No projects found</h3>
        <p className="mx-auto mt-1 max-w-sm text-muted-foreground">
          Get started by creating your first project to organize your system diagrams.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project, index) => (
        <motion.div
          key={project.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <ProjectCard
            project={project}
            onDelete={onDelete}
            onEdit={onEdit}
            allProjects={allProjects}
          />
        </motion.div>
      ))}
    </div>
  );
}

export default function ProjectList() {
  const {
    user,
    userId,
    isLoading: authLoading,
    refreshSession,
  } = useAuth();
  const [, setLocation] = useLocation();
  const { data: projects, isLoading } = useProjects(userId);
  const createStarterProject = useCreateStarterProject();
  const deleteProject = useDeleteProject();
  const updateProject = useUpdateProject();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newProjectType, setNewProjectType] = useState<ProjectType>("metamodel");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | ProjectType>("all");
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectDesc, setEditProjectDesc] = useState("");
  const [recentProjectEntries, setRecentProjectEntries] = useState<RecentProject[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<ProjectTemplateId>("blank");
  const [metamodelPurpose, setMetamodelPurpose] = useState<MetamodelPurpose>("custom");
  const [metamodelSetupDescription, setMetamodelSetupDescription] = useState("");
  const [selectedMagicNodeTypes, setSelectedMagicNodeTypes] = useState<MagicNodeType[]>(
    () => getMetamodelPurposeRecommendation("custom").nodeTypes,
  );
  const [selectedMagicRelationTypes, setSelectedMagicRelationTypes] = useState<MagicRelationType[]>(
    () => getMetamodelPurposeRecommendation("custom").relationTypes,
  );

  const applyMetamodelSetup = (setup: MetamodelSetup) => {
    setMetamodelPurpose(setup.purpose);
    setMetamodelSetupDescription(setup.description);
    setSelectedMagicNodeTypes(setup.nodeTypes);
    setSelectedMagicRelationTypes(setup.relationTypes);
  };

  useEffect(() => {
    if (editingProject) {
      setEditProjectName(editingProject.name);
      setEditProjectDesc(editingProject.description || "");
    }
  }, [editingProject]);

  useEffect(() => {
    setRecentProjectEntries(getRecentProjects(userId));
  }, [userId]);

  useEffect(() => {
    if (
      authLoading ||
      !userId ||
      typeof window === "undefined" ||
      new URLSearchParams(window.location.search).get("startTemplate") !== "blank"
    ) {
      return;
    }
    const template = getProjectTemplate("blank");
    setSelectedTemplateId(template.id);
    setNewProjectType(template.projectType);
    setNewProjectName(template.projectName);
    setNewProjectDesc(template.projectDescription);
    setIsCreateOpen(true);
    window.history.replaceState({}, document.title, window.location.pathname);
  }, [authLoading, userId]);

  if (authLoading) return null;
  if (!user) return <WorkspaceUnavailable onRetry={() => void refreshSession()} />;

  const openCreateDialog = (templateId: ProjectTemplateId = "blank") => {
    const template = getProjectTemplate(templateId);
    setSelectedTemplateId(template.id);
    setNewProjectType(template.projectType);
    setNewProjectName(template.projectName);
    setNewProjectDesc(template.projectDescription);
    if (template.projectType === "metamodel") {
      applyMetamodelSetup(template.metamodelSetup ?? getMetamodelPurposeRecommendation("custom"));
    }
    setIsCreateOpen(true);
  };

  const resetCreateForm = () => {
    setNewProjectName("");
    setNewProjectDesc("");
    setNewProjectType("metamodel");
    setSelectedTemplateId("blank");
    applyMetamodelSetup(getMetamodelPurposeRecommendation("custom"));
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newProjectName.trim() || !userId) return;
    const template = getProjectTemplate(selectedTemplateId);
    const metamodelSetup =
      newProjectType === "metamodel"
        ? normalizeMetamodelSetup({
            version: 1,
            purpose: metamodelPurpose,
            description: metamodelSetupDescription,
            nodeTypes: selectedMagicNodeTypes,
            relationTypes: selectedMagicRelationTypes,
          })
        : null;
    try {
      const result = await createStarterProject.mutateAsync({
        project: {
          userId,
          name: newProjectName.trim(),
          description: newProjectDesc.trim(),
          projectType: newProjectType,
          metamodelSetup,
        },
        views: getProjectTemplateViews(template),
      });
      rememberRecentProject(userId, result.project.id);
      setIsCreateOpen(false);
      resetCreateForm();
      toast({
        title: "Project created",
        description: result.firstViewId
          ? `${result.project.name} is ready with a starter view.`
          : `${result.project.name} is ready for modeling.`,
      });
      setLocation(
        result.firstViewId
          ? `/project/${result.project.id}/view/${result.firstViewId}`
          : `/project/${result.project.id}`,
      );
    } catch (error) {
      toast({
        title: "Could not create project",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEditSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingProject || !editProjectName.trim()) return;
    try {
      await updateProject.mutateAsync({
        id: editingProject.id,
        name: editProjectName.trim(),
        description: editProjectDesc.trim(),
      });
      toast({ title: "Project updated", description: "Project details were saved." });
      setEditingProject(null);
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const visibleProjects = projects;
  const filteredProjects = visibleProjects?.filter((project) => {
    const query = search.toLowerCase();
    return (
      (project.name.toLowerCase().includes(query) ||
        project.description?.toLowerCase().includes(query)) &&
      (activeTab === "all" || project.projectType === activeTab)
    );
  });
  const metamodelCount = visibleProjects?.filter((p) => p.projectType === "metamodel").length ?? 0;
  const instanceCount = visibleProjects?.filter((p) => p.projectType === "instance").length ?? 0;
  const recentProjects = recentProjectEntries
    .map((entry) => {
      const project = visibleProjects?.find((candidate) => candidate.id === entry.projectId);
      return project ? { project, openedAt: entry.openedAt } : null;
    })
    .filter((entry): entry is { project: Project; openedAt: number } => Boolean(entry));

  return (
    <div className="min-h-screen bg-slate-50 p-4 dark:bg-slate-950 sm:p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-7">
        <section className="relative overflow-hidden rounded-3xl border border-primary/10 bg-gradient-to-br from-card via-card to-primary/[0.08] p-6 shadow-sm sm:p-8">
          <div className="absolute -right-24 -top-32 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-7 md:flex-row md:items-end">
            <div>
              <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                  <Activity className="h-4 w-4" />
                </div>
                Symlit workspace
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Good to see you{user.username ? `, ${user.username}` : ""}.
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-medium capitalize text-primary">
                  Local workspace
                </span>
              </div>
              <p className="mt-3 max-w-xl text-base leading-6 text-muted-foreground">
                Keep your system models organized, connected, and ready for the next engineering decision.
              </p>
            </div>
            <div>
              <Button
                onClick={() => openCreateDialog()}
                size="lg"
                className="w-full shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 md:w-auto"
                data-testid="button-new-project"
              >
                <Plus className="mr-2 h-5 w-5" />
                New Project
              </Button>
            </div>
          </div>
        </section>

        <section aria-label="Workspace summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: "All projects", value: visibleProjects?.length ?? 0, icon: Folder, tone: "text-primary bg-primary/10" },
            { label: "Metamodels", value: metamodelCount, icon: Layers, tone: "text-violet-600 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-400" },
            { label: "Instance models", value: instanceCount, icon: Box, tone: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400" },
          ].map((stat) => {
            const StatIcon = stat.icon;
            return (
              <div key={stat.label} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/80 p-4">
                <div className={`rounded-xl p-2.5 ${stat.tone}`}><StatIcon className="h-4 w-4" /></div>
                <div><p className="text-xl font-semibold leading-none">{stat.value}</p><p className="mt-1 text-xs text-muted-foreground">{stat.label}</p></div>
              </div>
            );
          })}
        </section>

        {!search.trim() && activeTab === "all" && recentProjects.length > 0 && (
          <section aria-labelledby="recent-projects-heading" className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-primary" />
              <h2 id="recent-projects-heading" className="text-sm font-semibold tracking-tight">Continue where you left off</h2>
              <span className="text-xs text-muted-foreground">Recent projects</span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {recentProjects.map(({ project, openedAt }) => <RecentProjectCard key={project.id} project={project} openedAt={openedAt} />)}
            </div>
          </section>
        )}

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "all" | ProjectType)} className="w-full">
          <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/60 p-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="border-slate-200 bg-background pl-10 dark:border-slate-800" placeholder="Search by name or description..." value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search projects by name or description" data-testid="input-search-projects" />
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-xs font-medium text-muted-foreground sm:inline">Filter:</span>
              <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg bg-muted/50 p-1 md:w-auto">
                <TabsTrigger value="all" data-testid="tab-all" className="flex-1 whitespace-nowrap px-3 py-2 text-xs md:flex-none md:text-sm">All ({visibleProjects?.length ?? 0})</TabsTrigger>
                <TabsTrigger value="metamodel" className="flex flex-1 gap-2 whitespace-nowrap px-3 py-2 text-xs md:flex-none md:text-sm" data-testid="tab-metamodel"><Layers className="h-3.5 w-3.5" />Meta ({metamodelCount})</TabsTrigger>
                <TabsTrigger value="instance" className="flex flex-1 gap-2 whitespace-nowrap px-3 py-2 text-xs md:flex-none md:text-sm" data-testid="tab-instance"><Box className="h-3.5 w-3.5" />Instance ({instanceCount})</TabsTrigger>
              </TabsList>
            </div>
          </div>
          {(["all", "metamodel", "instance"] as const).map((tab) => (
            <TabsContent key={tab} value={tab}>
              <ProjectGrid
                projects={filteredProjects}
                onDelete={(id) => userId && deleteProject.mutate({ id, userId })}
                onEdit={setEditingProject}
                isLoading={isLoading}
                allProjects={visibleProjects}
                onSelectTemplate={openCreateDialog}
                showStarterState={!visibleProjects?.length}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <ProjectCreateDialog
        open={isCreateOpen}
        projectName={newProjectName}
        projectDescription={newProjectDesc}
        projectType={newProjectType}
        selectedTemplateId={selectedTemplateId}
        metamodelPurpose={metamodelPurpose}
        metamodelSetupDescription={metamodelSetupDescription}
        selectedMagicNodeTypes={selectedMagicNodeTypes}
        selectedMagicRelationTypes={selectedMagicRelationTypes}
        isCreating={createStarterProject.isPending}
        onOpenChange={setIsCreateOpen}
        onSubmit={handleCreate}
        onTemplateSelect={openCreateDialog}
        onProjectTypeChange={(projectType) => {
          setNewProjectType(projectType);
          if (projectType === "metamodel" && selectedMagicNodeTypes.length === 0) {
            applyMetamodelSetup(getMetamodelPurposeRecommendation("custom"));
          }
        }}
        onProjectNameChange={setNewProjectName}
        onProjectDescriptionChange={setNewProjectDesc}
        onMetamodelPurposeChange={(purpose) => {
          const recommendation = getMetamodelPurposeRecommendation(purpose);
          setMetamodelPurpose(purpose);
          setSelectedMagicNodeTypes(recommendation.nodeTypes);
          setSelectedMagicRelationTypes(recommendation.relationTypes);
        }}
        onMetamodelSetupDescriptionChange={setMetamodelSetupDescription}
        onToggleMagicNodeType={(type) => setSelectedMagicNodeTypes((current) => current.includes(type) ? (current.length > 1 ? current.filter((item) => item !== type) : current) : [...current, type])}
        onToggleMagicRelationType={(type) => setSelectedMagicRelationTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type])}
      />
      <ProjectEditDialog
        project={editingProject}
        name={editProjectName}
        description={editProjectDesc}
        isSaving={updateProject.isPending}
        onNameChange={setEditProjectName}
        onDescriptionChange={setEditProjectDesc}
        onClose={() => setEditingProject(null)}
        onSubmit={handleEditSave}
      />
    </div>
  );
}
