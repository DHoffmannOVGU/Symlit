import type { FlowQuery, MetamodelNodeTypeOption, PaletteItem } from "./types";
import type { Project } from "@shared/schema";
import type { View } from "@shared/schema";
import { type DragEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getNodeIcon } from "@/lib/node-icons";
import type { FlowNode } from "@shared/schema";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BASE_METAMODEL_ID,
  type SidebarCreateMetamodelNodeDetail,
  type SidebarCreateMetamodelNodeDragPayload,
} from "../sidebar/SidebarConstants";

export interface MetamodelCreatePaletteContext {
  selectedMetamodelCreateProjectId: string;
  referencedProjects: Project[];
  getReferencedFlowQueriesForSelection: (projectId: string, viewId: string) => FlowQuery[];
  selectedMetamodelCreateViewId: string;
  filteredMetamodelCreateViews: View[];
  hasReferencedMetamodels: boolean;
  setSelectedMetamodelCreateProjectId: React.Dispatch<React.SetStateAction<string>>;
  setSelectedMetamodelCreateViewId: React.Dispatch<React.SetStateAction<string>>;
  visibleMetamodelNodeTypes: MetamodelNodeTypeOption[];
  currentViewId: number | undefined;
  handleCreateMetamodelNode: (options: Omit<SidebarCreateMetamodelNodeDetail, "viewId">) => void;
  handleMetamodelNodeTypeDragStart: (event: DragEvent<HTMLButtonElement>, payload: SidebarCreateMetamodelNodeDragPayload) => void;
  retryReferencedFlows: (projectId: string, viewId: string) => void;
  metamodelCreatePaletteItems: PaletteItem[];
  getCanonicalTypeId: (node: FlowNode) => string;
}

export function MetamodelCreatePalette({
  selectedMetamodelCreateProjectId,
  referencedProjects,
  getReferencedFlowQueriesForSelection,
  selectedMetamodelCreateViewId,
  filteredMetamodelCreateViews,
  hasReferencedMetamodels,
  setSelectedMetamodelCreateProjectId,
  setSelectedMetamodelCreateViewId,
  visibleMetamodelNodeTypes,
  currentViewId,
  handleCreateMetamodelNode,
  handleMetamodelNodeTypeDragStart,
  retryReferencedFlows,
  metamodelCreatePaletteItems,
  getCanonicalTypeId,

}: MetamodelCreatePaletteContext) {
    const selectedProject =
      selectedMetamodelCreateProjectId === BASE_METAMODEL_ID
        ? null
        : referencedProjects.find(
            (project) => String(project.id) === selectedMetamodelCreateProjectId,
          ) ?? null;

    const selectedMetamodelCreateFlowQueries =
      getReferencedFlowQueriesForSelection(
        selectedMetamodelCreateProjectId,
        selectedMetamodelCreateViewId,
      );
    const paletteLoading =
      selectedMetamodelCreateProjectId !== BASE_METAMODEL_ID &&
      selectedMetamodelCreateFlowQueries.some((query) => query.isFetching);
    const paletteError =
      selectedMetamodelCreateProjectId !== BASE_METAMODEL_ID &&
      selectedMetamodelCreateFlowQueries.some((query) => query.isError);

    const showAllMetamodelCreateViewsOption =
      filteredMetamodelCreateViews.length > 1;

    return (
      <div className="space-y-3 px-1">
        {hasReferencedMetamodels ? (
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Parent Metamodel
                </Label>
                <Select
                  value={selectedMetamodelCreateProjectId}
                  onValueChange={setSelectedMetamodelCreateProjectId}
                >
                  <SelectTrigger className="border-white/10 bg-white/5 text-white">
                    <SelectValue placeholder="Select metamodel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={BASE_METAMODEL_ID}>
                      Common Model
                    </SelectItem>
                    {referencedProjects.map((project) => (
                      <SelectItem key={project.id} value={String(project.id)}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedMetamodelCreateProjectId !== BASE_METAMODEL_ID &&
              filteredMetamodelCreateViews.length > 1 ? (
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    Diagram
                  </Label>
                  <Select
                    value={selectedMetamodelCreateViewId}
                    onValueChange={setSelectedMetamodelCreateViewId}
                  >
                    <SelectTrigger className="border-white/10 bg-white/5 text-white">
                      <SelectValue placeholder="Select diagram" />
                    </SelectTrigger>
                    <SelectContent>
                      {showAllMetamodelCreateViewsOption ? (
                        <SelectItem value="all">All diagrams</SelectItem>
                      ) : null}
                      {filteredMetamodelCreateViews.map((view) => (
                        <SelectItem key={view.id} value={String(view.id)}>
                          {view.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
            {selectedProject?.description && (
              <p className="mt-3 text-xs text-white/50">
                {selectedProject.description}
              </p>
            )}
            {selectedMetamodelCreateProjectId === BASE_METAMODEL_ID ? (
              <p className="mt-3 text-xs text-white/50">
                Create one of the {visibleMetamodelNodeTypes.length} enabled
                magic node types.
              </p>
            ) : (
              <p className="mt-3 text-xs text-white/50">
                Create a child class that inherits from a referenced metamodel type.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
            These are the 7 standard node types that can be used in the metamodel.
          </div>
        )}

        {selectedMetamodelCreateProjectId === BASE_METAMODEL_ID ? (
          <>
             {visibleMetamodelNodeTypes.map((item) => {
              const IconComponent =
                getNodeIcon(item.iconName);
              const disabled = !currentViewId;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() =>
                    handleCreateMetamodelNode({
                      nodeType: item.type,
                      typeLabel: item.label,
                      icon: item.iconName,
                      color: item.color,
                    })
                  }
                  disabled={disabled}
                  draggable={!disabled}
                  onDragStart={(event) =>
                    handleMetamodelNodeTypeDragStart(event, {
                      viewId: currentViewId!,
                      nodeType: item.type,
                      typeLabel: item.label,
                      icon: item.iconName,
                      color: item.color,
                    })
                  }
                  className={cn(
                    "w-full rounded-lg border border-white/10 bg-white/5 p-3 text-left transition-colors",
                    disabled
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-grab hover:bg-white/10 hover:border-white/20 active:cursor-grabbing",
                  )}
                  data-testid={`button-create-sidebar-${item.type}`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                      style={{
                        backgroundColor: `${item.color}25`,
                        color: item.color,
                      }}
                    >
                      <IconComponent className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-white">
                        {item.label}
                      </span>
                      <span className="block text-xs text-white/55">
                        {item.description}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </>
        ) : (
          <>
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
                      selectedMetamodelCreateProjectId,
                      selectedMetamodelCreateViewId,
                    )
                  }
                  data-testid="button-retry-referenced-classes"
                >
                  Try again
                </Button>
              </div>
            )}

            {!paletteLoading && !paletteError && (
              <div className="space-y-2">
                {metamodelCreatePaletteItems.length === 0 ? (
                  <div className="rounded-md border border-dashed border-white/10 px-3 py-2 text-xs text-white/45">
                    No classes found for this filter.
                  </div>
                ) : (
                  metamodelCreatePaletteItems.map(
                    ({ node, meta, view, duplicateCount }) => {
                      const IconComponent =
                        getNodeIcon(meta.iconName);
                      const typeId = getCanonicalTypeId(node);
                      const nodeType = (node.type || "partdef") as SidebarCreateMetamodelNodeDetail["nodeType"];
                      const disabled = !currentViewId;
                      const dragPayload = currentViewId
                        ? {
                            viewId: currentViewId,
                            nodeType,
                            parentTypeId: typeId,
                            typeLabel: meta.label,
                            icon: meta.iconName,
                            color: meta.color,
                          }
                        : null;

                      return (
                        <button
                          key={`metamodel-create-${typeId}`}
                          type="button"
                          onClick={() =>
                            handleCreateMetamodelNode({
                              nodeType,
                              parentTypeId: typeId,
                              typeLabel: meta.label,
                              icon: meta.iconName,
                              color: meta.color,
                            })
                          }
                          disabled={disabled}
                          draggable={Boolean(dragPayload)}
                          onDragStart={(event) =>
                            dragPayload
                              ? handleMetamodelNodeTypeDragStart(event, dragPayload)
                              : undefined
                          }
                          className={cn(
                            "w-full rounded-lg border p-3 text-left transition-colors",
                            disabled
                              ? "cursor-not-allowed border-white/10 bg-white/[0.04] opacity-50"
                              : "cursor-grab border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 active:cursor-grabbing",
                          )}
                          data-testid={`button-create-child-class-${typeId}`}
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
                                {duplicateCount > 1 && <span>{duplicateCount} diagrams</span>}
                              </span>
                              <span className="mt-1 block text-[11px] text-white/40">
                                New child class
                              </span>
                            </span>
                          </div>
                        </button>
                      );
                    },
                  )
                )}
              </div>
            )}
          </>
        )}

        {!currentViewId && (
          <div className="rounded-md border border-dashed border-white/10 px-3 py-2 text-xs text-white/45">
            Select a diagram view to create node types.
          </div>
        )}
      </div>
    );
  }
