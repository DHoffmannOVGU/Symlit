import type { FlowQuery, PaletteItem } from "./types";
import type { FlowNode, Project } from "@shared/schema";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import { AlertTriangle, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getNodeIcon } from "@/lib/node-icons";
import { SidebarGroup, SidebarGroupContent } from "@/components/ui/sidebar";
import { dispatchDiagramEvent } from "@/lib/diagram-events";
import { currentKindLabel } from "@shared/metamodel-setup";
import { BASE_INSTANCE_TYPE_ITEMS, type SidebarNodeTransfer } from "../sidebar/SidebarConstants";

/**
 * Clicking a type (or pressing Enter/Space on it) places a new element of it
 * in a free spot in the middle of the canvas; dragging places it where it is dropped.
 */
const placeOnClick = (payload: SidebarNodeTransfer | null) =>
  payload
    ? {
        role: "button" as const,
        tabIndex: 0,
        onClick: () => dispatchDiagramEvent("insert-node-into-view", payload),
        onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          dispatchDiagramEvent("insert-node-into-view", payload);
        },
      }
    : {};

export interface ReferencedNodePaletteContext {
  referencedProjects: Project[];
  unavailableMetamodelIds: number[];
  getReferencedFlowQueriesForSelection: (projectId: string, viewId: string) => FlowQuery[];
  onRemoveReferencedMetamodel: ((id: number) => void) | undefined;
  retryReferencedFlows: (projectId: string, viewId: string) => void;
  referencedPaletteItems: PaletteItem[];
  getCanonicalTypeId: (node: FlowNode) => string;
  currentViewId: number | undefined;
  currentViewNodeIds: Set<string>;
  handleMetamodelNodeDragStart: (event: DragEvent<HTMLElement>, payload: SidebarNodeTransfer) => void;
}

interface Entry {
  key: string;
  testId: string;
  label: string;
  kind: string;
  description: string;
  iconName: string;
  color: string;
  /** Where the type comes from, for the hover text. */
  origin: string;
  payload: SidebarNodeTransfer | null;
}

const BUILT_IN_GROUP = "built-in";

const matches = (entry: Entry, query: string) =>
  !query ||
  [entry.label, entry.kind, entry.description].some((text) => text.toLowerCase().includes(query));

/** One type in the list: icon, name, kind, one line of description. */
function PaletteRow({
  entry,
  onDragStart,
}: {
  entry: Entry;
  onDragStart: (event: DragEvent<HTMLElement>, payload: SidebarNodeTransfer) => void;
}) {
  const Icon = getNodeIcon(entry.iconName);
  const enabled = Boolean(entry.payload);
  return (
    <div
      aria-disabled={!enabled}
      draggable={enabled}
      onDragStart={(event) => (entry.payload ? onDragStart(event, entry.payload) : undefined)}
      {...placeOnClick(entry.payload)}
      title={[`${entry.label} (${entry.kind})`, entry.description, entry.origin, enabled ? "Click to place, or drag to a spot." : ""]
        .filter(Boolean)
        .join("\n")}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/40",
        enabled ? "cursor-grab hover:bg-white/10 active:cursor-grabbing" : "cursor-not-allowed opacity-50",
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
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-white/40">{entry.kind}</span>
        </span>
        {entry.description ? <span className="block truncate text-xs text-white/50">{entry.description}</span> : null}
      </span>
    </div>
  );
}

/**
 * The types an instance model can use: every referenced metamodel's types,
 * grouped by metamodel, plus the built-in kinds. One search filters them all.
 */
export function ReferencedNodePalette({
  referencedProjects,
  unavailableMetamodelIds,
  getReferencedFlowQueriesForSelection,
  onRemoveReferencedMetamodel,
  retryReferencedFlows,
  referencedPaletteItems,
  getCanonicalTypeId,
  currentViewId,
  currentViewNodeIds,
  handleMetamodelNodeDragStart,
}: ReferencedNodePaletteContext) {
  const [query, setQuery] = useState("");
  const hasMetamodels = referencedProjects.length > 0;
  // Built-in kinds are folded away once real types are available.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(hasMetamodels ? [BUILT_IN_GROUP] : []));
  const search = query.trim().toLowerCase();
  useEffect(() => {
    // References load after the sidebar appears; fold the built-in kinds then too.
    if (hasMetamodels) setCollapsed((current) => new Set([...Array.from(current), BUILT_IN_GROUP]));
  }, [hasMetamodels]);

  const groups = useMemo(() => {
    const byProject = new Map<number, Entry[]>();
    for (const { node, meta, project, view, duplicateCount } of referencedPaletteItems) {
      const typeId = getCanonicalTypeId(node);
      const alreadyInView = currentViewId ? currentViewNodeIds.has(node.id) : false;
      const data = (node.data ?? {}) as { description?: unknown };
      const kind = currentKindLabel(meta.typeLabel, { nodeType: node.type }) || "Type";
      const entries = byProject.get(project.id) ?? [];
      entries.push({
        key: typeId,
        testId: `button-insert-referenced-class-${typeId}`,
        label: meta.label,
        kind,
        description: typeof data.description === "string" ? data.description.trim() : "",
        iconName: meta.iconName,
        color: meta.color,
        origin: duplicateCount > 1 ? `In ${duplicateCount} diagrams of ${project.name}` : `From ${project.name} · ${view.name}`,
        payload:
          currentViewId && !alreadyInView
            ? {
                nodeId: node.id,
                typeId,
                viewId: currentViewId,
                mode: "create-instance-node",
                typeLabel: meta.label,
                icon: meta.iconName,
                color: meta.color,
              }
            : null,
      });
      byProject.set(project.id, entries);
    }
    return referencedProjects.map((project) => ({
      project,
      entries: (byProject.get(project.id) ?? []).sort((a, b) => a.label.localeCompare(b.label)),
    }));
  }, [currentViewId, currentViewNodeIds, getCanonicalTypeId, referencedPaletteItems, referencedProjects]);

  const builtIn: Entry[] = BASE_INSTANCE_TYPE_ITEMS.map((item) => ({
    key: item.id,
    testId: `button-insert-base-class-${item.id}`,
    label: item.label,
    kind: "Built-in",
    description: item.description,
    iconName: item.iconName,
    color: item.color,
    origin: "Built into Symlit",
    payload: currentViewId
      ? {
          nodeId: item.id,
          typeId: item.id,
          viewId: currentViewId,
          mode: "create-instance-node",
          typeLabel: item.label,
          icon: item.iconName,
          color: item.color,
        }
      : null,
  }));

  const toggle = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const renderGroup = (key: string, title: string, entries: Entry[], extra?: React.ReactNode) => {
    const visible = entries.filter((entry) => matches(entry, search));
    // While searching, every group with a match is open and the others are hidden.
    if (search && visible.length === 0 && !extra) return null;
    const open = search ? true : !collapsed.has(key);
    return (
      <section key={key} className="space-y-0.5" data-testid={`palette-group-${key}`}>
        <button
          type="button"
          onClick={() => toggle(key)}
          aria-expanded={open}
          className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left text-[11px] font-semibold uppercase tracking-wider text-white/50 hover:text-white/80"
        >
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", !open && "-rotate-90")} />
          <span className="min-w-0 flex-1 truncate normal-case tracking-normal text-xs">{title}</span>
          <span className="font-mono text-[10px] text-white/35">{search ? `${visible.length}/${entries.length}` : entries.length}</span>
        </button>
        {open ? (
          <div className="space-y-0.5">
            {extra}
            {visible.map((entry) => (
              <PaletteRow key={entry.key} entry={entry} onDragStart={handleMetamodelNodeDragStart} />
            ))}
          </div>
        ) : null}
      </section>
    );
  };

  const nothingFound =
    search &&
    !groups.some(({ entries }) => entries.some((entry) => matches(entry, search))) &&
    !builtIn.some((entry) => matches(entry, search));

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <div className="space-y-3 px-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Escape" && setQuery("")}
              placeholder="Find a type…"
              aria-label="Find a type"
              className="h-8 w-full rounded-md border border-white/10 bg-white/5 pl-8 pr-7 text-sm text-white placeholder:text-white/35 focus:border-white/30 focus:outline-none"
              data-testid="input-palette-search"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-white/40 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {!currentViewId ? <p className="px-1 text-xs text-white/50">Open a diagram to add elements.</p> : null}

          {groups.map(({ project, entries }) => {
            const key = String(project.id);
            const queries = getReferencedFlowQueriesForSelection(key, "all");
            const unavailable = unavailableMetamodelIds.includes(project.id);
            const loading = queries.some((candidate) => candidate.isFetching) && entries.length === 0;
            const failed = queries.some((candidate) => candidate.isError);
            const status = unavailable ? (
              <div className="rounded-md border border-amber-400/30 bg-amber-500/10 p-2.5 text-xs text-amber-100" role="alert">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">Metamodel unavailable</p>
                    <p className="mt-1 text-amber-100/70">It cannot be loaded. Remove the reference to continue without it.</p>
                    {onRemoveReferencedMetamodel ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2 border-amber-300/40 bg-transparent text-amber-100 hover:bg-amber-300/10 hover:text-white"
                        onClick={() => onRemoveReferencedMetamodel(project.id)}
                        data-testid={`button-remove-unavailable-reference-${project.id}`}
                      >
                        Remove reference
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : failed ? (
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
              <p className="px-2 text-xs text-white/50">Loading types…</p>
            ) : entries.length === 0 ? (
              <p className="px-2 text-xs text-white/50">This metamodel has no types yet.</p>
            ) : null;
            return renderGroup(key, project.name, failed || unavailable ? [] : entries, status);
          })}

          {renderGroup(
            BUILT_IN_GROUP,
            hasMetamodels ? "Built-in kinds" : "Built-in kinds (no metamodel referenced)",
            builtIn,
          )}

          {nothingFound ? (
            <p className="px-2 text-xs text-white/50" data-testid="palette-nothing-found">
              No type matches “{query.trim()}”.
            </p>
          ) : null}

          {!hasMetamodels ? (
            <p className="px-1 text-xs text-white/45">
              To use your own types, reference a metamodel with the selector at the top of the page.
            </p>
          ) : null}
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
