import type { FlowQuery, MetamodelNodeTypeOption, PaletteItem } from "./types";
import type { FlowNode, Project } from "@shared/schema";
import { useMemo, useState, type DragEvent } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getNodeIcon } from "@/lib/node-icons";
import { currentKindLabel } from "@shared/metamodel-setup";
import type {
  SidebarCreateMetamodelNodeDetail,
  SidebarCreateMetamodelNodeDragPayload,
} from "../sidebar/SidebarConstants";

export interface MetamodelCreatePaletteContext {
  referencedProjects: Project[];
  getReferencedFlowQueriesForSelection: (projectId: string, viewId: string) => FlowQuery[];
  visibleMetamodelNodeTypes: MetamodelNodeTypeOption[];
  currentViewId: number | undefined;
  handleCreateMetamodelNode: (options: Omit<SidebarCreateMetamodelNodeDetail, "viewId">) => void;
  handleMetamodelNodeTypeDragStart: (event: DragEvent<HTMLButtonElement>, payload: SidebarCreateMetamodelNodeDragPayload) => void;
  retryReferencedFlows: (projectId: string, viewId: string) => void;
  metamodelCreatePaletteItems: PaletteItem[];
  getCanonicalTypeId: (node: FlowNode) => string;
}

interface Entry {
  key: string;
  testId: string;
  label: string;
  kind: string;
  description: string;
  iconName: string;
  color: string;
  hover: string;
  create: Omit<SidebarCreateMetamodelNodeDetail, "viewId">;
}

const BUILT_IN_GROUP = "built-in";

const matches = (entry: Entry, query: string) =>
  !query || [entry.label, entry.kind, entry.description].some((text) => text.toLowerCase().includes(query));

/**
 * What a metamodel can add: a new type of one of the built-in kinds, or a
 * type that specializes a type of a referenced metamodel. Same layout as the
 * palette of instance models: groups, compact rows, one search.
 */
export function MetamodelCreatePalette({
  referencedProjects,
  getReferencedFlowQueriesForSelection,
  visibleMetamodelNodeTypes,
  currentViewId,
  handleCreateMetamodelNode,
  handleMetamodelNodeTypeDragStart,
  retryReferencedFlows,
  metamodelCreatePaletteItems,
  getCanonicalTypeId,
}: MetamodelCreatePaletteContext) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const search = query.trim().toLowerCase();
  const hasMetamodels = referencedProjects.length > 0;
  const disabled = !currentViewId;

  const builtIn: Entry[] = visibleMetamodelNodeTypes.map((item) => ({
    key: item.type,
    testId: `button-create-sidebar-${item.type}`,
    label: item.label,
    kind: "Kind",
    description: item.description,
    iconName: item.iconName,
    color: item.color,
    hover: `${item.label}: ${item.description}\nClick to place a new type, or drag it to a spot.`,
    create: { nodeType: item.type, typeLabel: item.label, icon: item.iconName, color: item.color },
  }));

  const groups = useMemo(() => {
    const byProject = new Map<number, Entry[]>();
    for (const { node, meta, project, view } of metamodelCreatePaletteItems) {
      const typeId = getCanonicalTypeId(node);
      const data = (node.data ?? {}) as { description?: unknown };
      const nodeType = (node.type || "partdef") as SidebarCreateMetamodelNodeDetail["nodeType"];
      const description = typeof data.description === "string" ? data.description.trim() : "";
      const entries = byProject.get(project.id) ?? [];
      entries.push({
        key: typeId,
        testId: `button-create-child-class-${typeId}`,
        label: meta.label,
        kind: currentKindLabel(meta.typeLabel, { nodeType: node.type }) || "Type",
        description,
        iconName: meta.iconName,
        color: meta.color,
        hover: [`New type that specializes ${meta.label}`, description, `From ${project.name} · ${view.name}`]
          .filter(Boolean)
          .join("\n"),
        create: { nodeType, parentTypeId: typeId, typeLabel: meta.label, icon: meta.iconName, color: meta.color },
      });
      byProject.set(project.id, entries);
    }
    return referencedProjects.map((project) => ({
      project,
      entries: (byProject.get(project.id) ?? []).sort((a, b) => a.label.localeCompare(b.label)),
    }));
  }, [getCanonicalTypeId, metamodelCreatePaletteItems, referencedProjects]);

  const toggle = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const renderRow = (entry: Entry) => {
    const Icon = getNodeIcon(entry.iconName);
    return (
      <button
        key={entry.key}
        type="button"
        onClick={() => handleCreateMetamodelNode(entry.create)}
        disabled={disabled}
        draggable={!disabled}
        onDragStart={(event) =>
          currentViewId
            ? handleMetamodelNodeTypeDragStart(event, { viewId: currentViewId, ...entry.create })
            : undefined
        }
        title={entry.hover}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/40",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-grab hover:bg-white/10 active:cursor-grabbing",
        )}
        data-testid={entry.testId}
      >
        <span
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: `${entry.color}25`, color: entry.color }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-sm font-medium text-white">{entry.label}</span>
            {entry.kind !== "Kind" ? (
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-white/60">{entry.kind}</span>
            ) : null}
          </span>
          {entry.description ? <span className="block truncate text-xs text-white/60">{entry.description}</span> : null}
        </span>
      </button>
    );
  };

  const renderGroup = (key: string, title: string, entries: Entry[], extra?: React.ReactNode) => {
    const visible = entries.filter((entry) => matches(entry, search));
    if (search && visible.length === 0 && !extra) return null;
    const open = search ? true : !collapsed.has(key);
    return (
      <section key={key} className="space-y-0.5" data-testid={`palette-group-${key}`}>
        <button
          type="button"
          onClick={() => toggle(key)}
          aria-expanded={open}
          className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left text-xs font-semibold text-white/60 hover:text-white/80"
        >
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", !open && "-rotate-90")} />
          <span className="min-w-0 flex-1 truncate">{title}</span>
          <span className="font-mono text-[10px] text-white/60">{search ? `${visible.length}/${entries.length}` : entries.length}</span>
        </button>
        {open ? (
          <div className="space-y-0.5">
            {extra}
            {visible.map(renderRow)}
          </div>
        ) : null}
      </section>
    );
  };

  const nothingFound =
    search &&
    !builtIn.some((entry) => matches(entry, search)) &&
    !groups.some(({ entries }) => entries.some((entry) => matches(entry, search)));

  return (
    <div className="space-y-3 px-1">
      {/* Seven kinds need no search; it appears once referenced metamodels add their types. */}
      {hasMetamodels ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/60" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && setQuery("")}
            placeholder="Find a kind or type…"
            aria-label="Find a kind or type"
            className="h-8 w-full rounded-md border border-white/10 bg-white/5 pl-8 pr-7 text-sm text-white placeholder:text-white/60 focus:border-white/30 focus:outline-none"
            data-testid="input-palette-search"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-white/60 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}

      {disabled ? <p className="px-1 text-xs text-white/60">Open a diagram to add types.</p> : null}

      {renderGroup(BUILT_IN_GROUP, "New type of a built-in kind", builtIn)}

      {groups.map(({ project, entries }) => {
        const key = String(project.id);
        const queries = getReferencedFlowQueriesForSelection(key, "all");
        const loading = queries.some((candidate) => candidate.isFetching) && entries.length === 0;
        const failed = queries.some((candidate) => candidate.isError);
        const status = failed ? (
          <div className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            Could not load the types of {project.name}.
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-1 h-auto px-0 text-xs text-red-100 underline hover:bg-transparent hover:text-white"
              onClick={() => retryReferencedFlows(key, "all")}
              data-testid="button-retry-referenced-classes"
            >
              Try again
            </Button>
          </div>
        ) : loading ? (
          <p className="px-2 text-xs text-white/60">Loading types…</p>
        ) : entries.length === 0 ? (
          <p className="px-2 text-xs text-white/60">This metamodel has no types yet.</p>
        ) : null;
        return renderGroup(key, `Specialize a type of ${project.name}`, failed ? [] : entries, status);
      })}

      {nothingFound ? (
        <p className="px-2 text-xs text-white/60" data-testid="palette-nothing-found">
          Nothing matches “{query.trim()}”.
        </p>
      ) : null}

      {!hasMetamodels && !disabled ? (
        <p className="px-1 text-xs text-white/60">Click a kind to place a new type, or drag it to a spot.</p>
      ) : null}
    </div>
  );
}
