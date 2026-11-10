import { DEFAULT_LOCAL_USER_NAME } from "@shared/authorization";
import { TutorialCard } from "@/components/tutorial/TutorialCard";
import { WorkspaceUnavailable } from "@/components/WorkspaceUnavailable";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import {
  Activity,
  ArrowDownRight,
  Box,
  Clock3,
  Copy,
  Folder,
  Layers,
  Plus,
  PlusSquare,
  Search,
  Settings2,
  Trash2,
  Upload,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  useProjectTemplates,
  useDeleteProject,
  useImportProject,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  BLANK_MODEL,
  projectStartOptions,
  type ProjectStartOption,
} from "@/lib/project-templates";
import {
  getRecentProjects,
  rememberRecentProject,
  type RecentProject,
} from "@/lib/recent-projects";
import type { Project, ProjectType } from "@shared/schema";
import { ProjectCreateDialog } from "@/components/projects/ProjectCreateDialog";
import { useProjectCreation, type CreateProjectRequest, type CreatedProject } from "@/components/projects/useProjectCreation";
import { ProjectEditDialog } from "@/components/projects/ProjectEditDialog";
import { getProjectTypeMeta } from "@/components/projects/project-types";

type ProjectSort = "edited" | "name" | "created";
const SORT_STORAGE_KEY = "symlit.project-sort";

function sortProjects(projects: Project[], sortBy: ProjectSort): Project[] {
  const time = (value: Date | string | null | undefined) => (value ? new Date(value).getTime() : 0);
  return [...projects].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    if (sortBy === "created") return time(b.createdAt) - time(a.createdAt) || b.id - a.id;
    return time(b.updatedAt ?? b.createdAt) - time(a.updatedAt ?? a.createdAt) || b.id - a.id;
  });
}

function RecentProjectCard({
  project,
  openedAt,
}: {
  project: Project;
  openedAt: number;
}) {
  const typeMeta = getProjectTypeMeta(project.projectType);
  const TypeIcon = typeMeta.icon;

  return (
    <Card
      className="group relative min-w-[245px] border-border/60 bg-card/80 p-4 transition-all focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-ring hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg sm:min-w-[270px]"
      data-testid={`recent-project-${project.id}`}
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-xl p-2.5 ${typeMeta.iconClassName}`}>
          <TypeIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {/* A real link (opens in a new tab, shows its address); it covers the whole card. */}
            <Link
              href={`/project/${project.id}`}
              className="outline-none after:absolute after:inset-0 after:rounded-[inherit]"
              aria-label={`Open recent project ${project.name}`}
              onClick={() => rememberRecentProject(project.userId, project.id)}
            >
              {project.name}
            </Link>
          </p>
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
  onDuplicate,
  onNewModel,
  allProjects,
}: {
  project: Project;
  onDelete: (id: number) => void;
  onEdit: (project: Project) => void;
  onDuplicate: (project: Project) => void;
  onNewModel: (metamodel: Project) => void;
  allProjects?: Project[];
}) {
  const referencedMetamodels =
    allProjects?.filter((candidate) =>
      (project.referencedMetamodels ?? []).includes(candidate.id),
    ) ?? [];
  const typeMeta = getProjectTypeMeta(project.projectType);
  const TypeIcon = typeMeta.icon;
  // Projects that would lose their types when this metamodel is deleted.
  const dependents =
    project.projectType === "metamodel"
      ? (allProjects?.filter((candidate) =>
          (candidate.referencedMetamodels ?? []).includes(project.id),
        ) ?? [])
      : [];
  const changedAt = project.updatedAt ?? project.createdAt;

  return (
    <Card
      className="group relative flex h-full flex-col overflow-hidden border-border/60 transition-all duration-300 focus-within:ring-2 focus-within:ring-ring hover:-translate-y-1 hover:shadow-xl"
      data-testid={`card-project-${project.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className={`mb-3 rounded-xl p-2.5 ${typeMeta.iconClassName}`}>
            <TypeIcon className="h-5 w-5" />
          </div>
          <div className="relative z-10 flex items-center gap-1">
            {project.projectType === "metamodel" && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground opacity-100 transition-all hover:text-primary sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                onClick={(event) => {
                  event.stopPropagation();
                  onNewModel(project);
                }}
                title="New model from this metamodel"
                aria-label={`New model from ${project.name}`}
                data-testid={`button-new-model-${project.id}`}
              >
                <PlusSquare className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground opacity-100 transition-all hover:text-primary sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
              onClick={(event) => {
                event.stopPropagation();
                onDuplicate(project);
              }}
              title="Duplicate"
              aria-label={`Duplicate ${project.name}`}
              data-testid={`button-duplicate-project-${project.id}`}
            >
              <Copy className="h-4 w-4" />
            </Button>
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
                  aria-label={`Delete project ${project.name}`}
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
                  {dependents.length > 0 && (
                    <div
                      className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
                      data-testid="delete-project-dependents"
                    >
                      <p className="font-medium">
                        {dependents.length === 1 ? "1 project uses" : `${dependents.length} projects use`} this
                        metamodel:
                      </p>
                      <ul className="mt-1 list-disc pl-5">
                        {dependents.map((dependent) => (
                          <li key={dependent.id}>{dependent.name}</li>
                        ))}
                      </ul>
                      <p className="mt-2">
                        Their elements stay, but lose their types, and types from this metamodel placed in
                        their diagrams disappear. Export this metamodel first if you may need it again.
                      </p>
                    </div>
                  )}
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
        <CardTitle className="text-xl">
          {/* A real link (opens in a new tab, shows its address); it covers the whole card. */}
          <Link
            href={`/project/${project.id}`}
            className="outline-none after:absolute after:inset-0"
            aria-label={`Open project ${project.name}`}
            onClick={() => rememberRecentProject(project.userId, project.id)}
          >
            {project.name}
          </Link>
        </CardTitle>
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
        <span title={changedAt ? format(new Date(changedAt), "PPp") : undefined}>
          {changedAt
            ? `Edited ${formatDistanceToNow(new Date(changedAt), { addSuffix: true })}`
            : "Unknown date"}
        </span>
        <ArrowDownRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
      </CardFooter>
    </Card>
  );
}

function TemplateEmptyState({
  templates,
  onSelectTemplate,
}: {
  templates: ProjectStartOption[];
  onSelectTemplate: (templateId: string) => void;
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
          Start from a project template with a first diagram to build on, or
          begin with an empty metamodel or model.
        </p>
      </div>
      <div className="mx-auto mt-8 grid max-w-5xl gap-3 md:grid-cols-3">
        {templates.map((template) => (
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
  onDuplicate,
  onNewModel,
  isLoading,
  allProjects,
  templates = [],
  onSelectTemplate,
  showTemplateState = false,
}: {
  projects?: Project[];
  onDelete: (id: number) => void;
  onEdit: (project: Project) => void;
  onDuplicate: (project: Project) => void;
  onNewModel: (metamodel: Project) => void;
  isLoading: boolean;
  allProjects?: Project[];
  templates?: ProjectStartOption[];
  onSelectTemplate?: (templateId: string) => void;
  showTemplateState?: boolean;
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
    if (showTemplateState && onSelectTemplate) {
      return <TemplateEmptyState templates={templates} onSelectTemplate={onSelectTemplate} />;
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
            onDuplicate={onDuplicate}
            onNewModel={onNewModel}
            allProjects={allProjects}
          />
        </motion.div>
      ))}
    </div>
  );
}

/** "Delivery drone is ready.", naming metamodels a template brought along. */
function describeCreated(result: CreatedProject) {
  const along = result.alongside.map((project) => project.name);
  return along.length
    ? `${result.project.name} is ready, with its metamodel ${along.join(", ")}.`
    : `${result.project.name} is ready.`;
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
  const { create, duplicate } = useProjectCreation();
  const templates = projectStartOptions(useProjectTemplates().data);
  const deleteProject = useDeleteProject();
  const updateProject = useUpdateProject();
  const { toast } = useToast();
  // The sort choice is a personal preference: remembered in this browser.
  const [sortBy, setSortByState] = useState<ProjectSort>(() => {
    try {
      const stored = window.localStorage.getItem(SORT_STORAGE_KEY);
      return stored === "name" || stored === "created" ? stored : "edited";
    } catch {
      return "edited";
    }
  });
  const setSortBy = (value: ProjectSort) => {
    setSortByState(value);
    try {
      window.localStorage.setItem(SORT_STORAGE_KEY, value);
    } catch {
      // Storage can be unavailable (private window); the choice then lasts for this visit.
    }
  };
  const importProject = useImportProject();
  const importInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | ProjectType>("all");
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectDesc, setEditProjectDesc] = useState("");
  const [recentProjectEntries, setRecentProjectEntries] = useState<RecentProject[]>([]);
  // The create dialog: open, optionally on a given start (and metamodel).
  const [createDialog, setCreateDialog] = useState<{ open: boolean; start?: string; basedOn?: number | null }>({
    open: false,
  });

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
    setCreateDialog({ open: true });
    window.history.replaceState({}, document.title, window.location.pathname);
  }, [authLoading, userId]);

  if (authLoading) return null;
  if (!user) return <WorkspaceUnavailable onRetry={() => void refreshSession()} />;

  const handleImport = async (file: File) => {
    let content: unknown;
    try {
      content = JSON.parse(await file.text());
    } catch {
      toast({
        title: "Not a project file",
        description: `"${file.name}" is not JSON. Import the file written by Export Project → JSON.`,
        variant: "destructive",
      });
      return;
    }
    try {
      const result = await importProject.mutateAsync(content);
      const extra = result.createdProjects - 1;
      toast({
        title: `Imported "${result.project.name}"`,
        description:
          extra > 0
            ? `It brought ${extra} metamodel${extra === 1 ? "" : "s"} along; they were added as new projects.`
            : "It was added as a new project.",
      });
      setLocation(
        result.firstViewId
          ? `/project/${result.project.id}/view/${result.firstViewId}`
          : `/project/${result.project.id}`,
      );
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "The file could not be imported.",
        variant: "destructive",
      });
    }
  };

  const openCreateDialog = (start?: string, basedOn?: number | null) =>
    setCreateDialog({ open: true, start, basedOn });

  const opened = (result: CreatedProject, message: string) => {
    if (userId) rememberRecentProject(userId, result.project.id);
    toast({ title: message, description: describeCreated(result) });
    setLocation(
      result.firstViewId
        ? `/project/${result.project.id}/view/${result.firstViewId}`
        : `/project/${result.project.id}`,
    );
  };

  const handleCreate = async (request: CreateProjectRequest) => {
    try {
      const result = await create.mutateAsync(request);
      setCreateDialog({ open: false });
      opened(result, "Project created");
    } catch (error) {
      toast({
        title: "Could not create the project",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDuplicate = async (project: Project) => {
    try {
      opened(await duplicate.mutateAsync(project), "Project duplicated");
    } catch (error) {
      toast({
        title: "Could not duplicate the project",
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
  const sortedProjects = filteredProjects ? sortProjects(filteredProjects, sortBy) : filteredProjects;
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
        {/* A compact header: the projects themselves should be visible without scrolling. */}
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {/* Greet by the configured name (SYMLIT_USER_NAME), not the internal login; the default name is no name. */}
                  Good to see you
                  {user.displayName && user.displayName !== DEFAULT_LOCAL_USER_NAME ? `, ${user.displayName}` : ""}.
                </h1>
                <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">
                  Local workspace
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Your Symlit projects: metamodels and the models built from them.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-label="Project file to import"
              data-testid="input-import-project"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void handleImport(file);
              }}
            />
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={importProject.isPending}
              onClick={() => importInputRef.current?.click()}
              title="Open a project file (a JSON export) as a new project"
              data-testid="button-import-project"
            >
              <Upload className="mr-2 h-4 w-4" />
              {importProject.isPending ? "Importing…" : "Import"}
            </Button>
            <Button onClick={() => openCreateDialog()} className="w-full sm:w-auto" data-testid="button-new-project">
              <Plus className="mr-2 h-4 w-4" />
              New project
            </Button>
          </div>
        </header>

        <TutorialCard projects={projects} />

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
            <div className="flex flex-wrap items-center gap-2">
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as ProjectSort)}>
                <SelectTrigger className="h-9 w-[170px] text-xs md:text-sm" aria-label="Sort projects" data-testid="select-sort-projects">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="edited">Last edited first</SelectItem>
                  <SelectItem value="name">Name (A–Z)</SelectItem>
                  <SelectItem value="created">Newest first</SelectItem>
                </SelectContent>
              </Select>
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
                projects={sortedProjects}
                onDelete={(id) => userId && deleteProject.mutate({ id, userId })}
                onEdit={setEditingProject}
                onDuplicate={(project) => void handleDuplicate(project)}
                onNewModel={(metamodel) => openCreateDialog(BLANK_MODEL, metamodel.id)}
                isLoading={isLoading}
                allProjects={visibleProjects}
                templates={templates}
                onSelectTemplate={openCreateDialog}
                showTemplateState={!visibleProjects?.length}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <ProjectCreateDialog
        open={createDialog.open}
        onOpenChange={(open) => setCreateDialog((current) => ({ ...current, open }))}
        options={templates}
        metamodels={(projects ?? []).filter((project) => project.projectType === "metamodel")}
        initialStart={createDialog.start}
        initialBasedOn={createDialog.basedOn ?? null}
        isCreating={create.isPending}
        onCreate={(request) => void handleCreate(request)}
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
