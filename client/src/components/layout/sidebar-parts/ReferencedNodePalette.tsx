import type { FlowQuery, PaletteItem } from "./types";
import type { Project } from "@shared/schema";
import type { View } from "@shared/schema";
import { type DragEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Check, AlertTriangle } from "lucide-react";
import * as Icons from "lucide-react";
import type { FlowNode } from "@shared/schema";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SidebarGroup, SidebarGroupContent } from "@/components/ui/sidebar";
import { BASE_INSTANCE_TYPE_ITEMS, BASE_METAMODEL_ID, type SidebarNodeTransfer } from "../sidebar/SidebarConstants";

export interface ReferencedNodePaletteContext {
  referencedProjects: Project[];
  selectedReferencedProjectId: string;
  unavailableMetamodelIds: number[];
  getReferencedFlowQueriesForSelection: (projectId: string, viewId: string) => FlowQuery[];
  selectedReferencedViewId: string;
  setSelectedReferencedProjectId: React.Dispatch<React.SetStateAction<string>>;
  setSelectedReferencedViewId: React.Dispatch<React.SetStateAction<string>>;
  filteredReferencedViews: View[];
  onRemoveReferencedMetamodel: ((id: number) => void) | undefined;
  retryReferencedFlows: (projectId: string, viewId: string) => void;
  referencedPaletteItems: PaletteItem[];
  getCanonicalTypeId: (node: FlowNode) => string;
  currentViewId: number | undefined;
  currentViewNodeIds: Set<string>;
  handleMetamodelNodeDragStart: (event: DragEvent<HTMLElement>, payload: SidebarNodeTransfer) => void;
}

export function ReferencedNodePalette({
  referencedProjects,
  selectedReferencedProjectId,
  unavailableMetamodelIds,
  getReferencedFlowQueriesForSelection,
  selectedReferencedViewId,
  setSelectedReferencedProjectId,
  setSelectedReferencedViewId,
  filteredReferencedViews,
  onRemoveReferencedMetamodel,
  retryReferencedFlows,
  referencedPaletteItems,
  getCanonicalTypeId,
  currentViewId,
  currentViewNodeIds,
  handleMetamodelNodeDragStart,

}: ReferencedNodePaletteContext) {
    if (referencedProjects.length === 0) return null;

    const selectedProject =
      selectedReferencedProjectId === BASE_METAMODEL_ID
        ? null
        : referencedProjects.find(
            (project) => String(project.id) === selectedReferencedProjectId,
          ) ?? null;
    const selectedProjectIsUnavailable =
      selectedProject !== null &&
      unavailableMetamodelIds.includes(selectedProject.id);

    const selectedReferencedFlowQueries =
      getReferencedFlowQueriesForSelection(
        selectedReferencedProjectId,
        selectedReferencedViewId,
      );
    const paletteLoading =
      selectedReferencedProjectId !== BASE_METAMODEL_ID &&
      selectedReferencedFlowQueries.some((query) => query.isFetching);
    const paletteError =
      selectedReferencedProjectId !== BASE_METAMODEL_ID &&
      selectedReferencedFlowQueries.some((query) => query.isError);

    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="space-y-3 px-1">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    Metamodel
                  </Label>
                  <Select
                    value={selectedReferencedProjectId}
                    onValueChange={setSelectedReferencedProjectId}
                  >
                    <SelectTrigger className="border-white/10 bg-white/5 text-white">
                      <SelectValue placeholder="Select metamodel" />
                    </SelectTrigger>
                    <SelectContent>
                      {referencedProjects.length === 0 && (
                        <SelectItem value={BASE_METAMODEL_ID}>
                          Base Metamodel
                        </SelectItem>
                      )}
                      {referencedProjects.map((project) => (
                        <SelectItem
                          key={project.id}
                          value={String(project.id)}
                        >
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    Diagram
                  </Label>
                  <Select
                    value={selectedReferencedViewId}
                    onValueChange={setSelectedReferencedViewId}
                    disabled={selectedReferencedProjectId === BASE_METAMODEL_ID}
                  >
                    <SelectTrigger className="border-white/10 bg-white/5 text-white">
                      <SelectValue placeholder="Select diagram" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All diagrams</SelectItem>
                      {filteredReferencedViews.map((view) => (
                        <SelectItem key={view.id} value={String(view.id)}>
                          {view.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {selectedProject?.description && (
                <p className="mt-3 text-xs text-white/50">
                  {selectedProject.description}
                </p>
              )}
              {selectedProjectIsUnavailable && (
                <div
                  className="mt-3 rounded-md border border-amber-400/30 bg-amber-500/10 p-2.5 text-xs text-amber-100"
                  role="alert"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">Metamodel unavailable</p>
                      <p className="mt-1 text-amber-100/70">
                        This reference cannot be loaded. Remove it to restore the
                        default instance modeling state.
                      </p>
                      {onRemoveReferencedMetamodel && selectedProject && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2 border-amber-300/40 bg-transparent text-amber-100 hover:bg-amber-300/10 hover:text-white"
                          onClick={() =>
                            onRemoveReferencedMetamodel(selectedProject.id)
                          }
                          data-testid={`button-remove-unavailable-reference-${selectedProject.id}`}
                        >
                          Remove reference
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {selectedReferencedProjectId === BASE_METAMODEL_ID && (
                <p className="mt-3 text-xs text-white/50">
                  Standard fallback types for instance modeling without a referenced metamodel.
                </p>
              )}
            </div>

            {paletteLoading && (
              <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/55">
                Loading referenced classes...
              </div>
            )}

            {paletteError && (
              <div className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                Failed to load referenced classes.
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-auto px-0 text-xs text-red-100 underline hover:bg-transparent hover:text-white"
                  onClick={() =>
                    retryReferencedFlows(
                      selectedReferencedProjectId,
                      selectedReferencedViewId,
                    )
                  }
                  data-testid="button-retry-referenced-classes"
                >
                  Try again
                </Button>
              </div>
            )}

            {!paletteLoading &&
              !paletteError &&
              selectedReferencedProjectId !== BASE_METAMODEL_ID && (
                <div className="space-y-2">
                  {referencedPaletteItems.length === 0 ? (
                    <div className="rounded-md border border-dashed border-white/10 px-3 py-2 text-xs text-white/45">
                      No classes found for this filter.
                    </div>
                  ) : (
                    referencedPaletteItems.map(
                      ({ node, meta, view, duplicateCount }) => {
                        const IconComponent =
                          (Icons as Record<string, any>)[meta.iconName] ||
                          Icons.Box;
                        const typeId = getCanonicalTypeId(node);
                        const alreadyInCurrentView = currentViewId
                          ? currentViewNodeIds.has(node.id)
                          : false;
                        const dragPayload = currentViewId
                          ? {
                              nodeId: node.id,
                              typeId,
                              viewId: currentViewId,
                              mode: "create-instance-node" as const,
                              typeLabel: meta.label,
                              icon: meta.iconName,
                              color: meta.color,
                            }
                          : null;

                        return (
                          <div
                            key={typeId}
                            aria-disabled={!currentViewId || alreadyInCurrentView}
                            draggable={Boolean(dragPayload && !alreadyInCurrentView)}
                            onDragStart={(event) =>
                              dragPayload && !alreadyInCurrentView
                                ? handleMetamodelNodeDragStart(event, dragPayload)
                                : undefined
                            }
                            className={cn(
                              "w-full rounded-lg border p-3 text-left transition-colors",
                              alreadyInCurrentView
                                ? "cursor-not-allowed border-white/10 bg-white/[0.04] opacity-60"
                                : currentViewId
                                  ? "cursor-grab border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 active:cursor-grabbing"
                                  : "cursor-not-allowed border-white/10 bg-white/[0.04] opacity-50",
                            )}
                            data-testid={`button-insert-referenced-class-${typeId}`}
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
                                style={{
                                  backgroundColor: `${meta.color}25`,
                                  color: meta.color,
                                }}
                              >
                                <IconComponent className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium text-white">
                                  {meta.label}
                                </span>
                                <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/50">
                                  {meta.typeLabel && <span>{meta.typeLabel}</span>}
                                  <span>{view.name}</span>
                                  {duplicateCount > 1 && (
                                    <span>{duplicateCount} diagrams</span>
                                  )}
                                </span>
                              </span>
                              {alreadyInCurrentView ? (
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/45">
                                  <Check className="h-3.5 w-3.5" />
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      },
                    )
                  )}
                </div>
              )}

            {selectedReferencedProjectId === BASE_METAMODEL_ID && (
              <div className="space-y-2">
                {BASE_INSTANCE_TYPE_ITEMS.map((item) => {
                  const IconComponent =
                    (Icons as Record<string, any>)[item.iconName] || Icons.Box;
                  const dragPayload = currentViewId
                    ? {
                        nodeId: item.id,
                        typeId: item.id,
                        viewId: currentViewId,
                        mode: "create-instance-node" as const,
                        typeLabel: item.label,
                        icon: item.iconName,
                        color: item.color,
                      }
                    : null;

                  return (
                    <div
                      key={item.id}
                      aria-disabled={!currentViewId}
                      draggable={Boolean(dragPayload)}
                      onDragStart={(event) =>
                        dragPayload
                          ? handleMetamodelNodeDragStart(event, dragPayload)
                          : undefined
                      }
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition-colors",
                        currentViewId
                          ? "cursor-grab border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 active:cursor-grabbing"
                          : "cursor-not-allowed border-white/10 bg-white/[0.04] opacity-50",
                      )}
                      data-testid={`button-insert-base-class-${item.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
                          style={{
                            backgroundColor: `${item.color}25`,
                            color: item.color,
                          }}
                        >
                          <IconComponent className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-white">
                            {item.label}
                          </span>
                          <span className="mt-1 block text-[11px] text-white/50">
                            {item.description}
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!currentViewId && (
              <div className="rounded-md border border-dashed border-white/10 px-3 py-2 text-xs text-white/45">
                Select a diagram view to drop referenced classes into it.
              </div>
            )}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }
