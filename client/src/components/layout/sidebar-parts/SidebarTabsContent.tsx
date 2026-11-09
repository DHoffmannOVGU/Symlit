import { ScrollingTabsContent } from "./ScrollingTabsContent";
import type { FlowQuery, NodeMeta, ReferencedViewGroup } from "./types";
import type { ProjectType } from "@shared/schema";
import type { View } from "@shared/schema";
import type { PatternListing } from "@shared/routes";
import type { UseQueryResult } from "@tanstack/react-query";
import { type SidebarViewNodeListArgs } from "./SidebarViewNodeList";
import { type MouseEvent } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { FlowNode } from "@shared/schema";
import { dispatchDiagramEvent } from "@/lib/diagram-events";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { SidebarViewList } from "./SidebarViewList";
import { SidebarPatternPalette } from "./SidebarPatternPalette";

export interface SidebarTabsContentProps {
  projectType: ProjectType | undefined;
  views: View[];
  orderedViews: View[];
  currentViewId: number | undefined;
  flowByViewId: Map<number, FlowQuery>;
  getNodeMeta: (node: FlowNode) => NodeMeta;
  renderViewNodeList: (args: SidebarViewNodeListArgs) => React.JSX.Element;
  onCreateView: () => void;
  projectId: number;
  patternsQuery: UseQueryResult<PatternListing[]>;
  setEditingView: React.Dispatch<React.SetStateAction<View | null>>;
  handleLinkClick: (event?: MouseEvent, href?: string) => void;
  renderReferencedNodePalette: () => React.JSX.Element;
  hasReferencedMetamodels: boolean;
  includeReferencedMetamodelViews: boolean;
  setIncludeReferencedMetamodelViews: React.Dispatch<React.SetStateAction<boolean>>;
  referencedViews: ReferencedViewGroup[];
  referencedFlowByViewId: Map<number, FlowQuery>;
  renderMetamodelCreatePalette: () => React.JSX.Element;
}

export function SidebarTabsContent({
  projectType,
  views,
  orderedViews,
  currentViewId,
  flowByViewId,
  getNodeMeta,
  renderViewNodeList,
  onCreateView,
  projectId,
  patternsQuery,
  setEditingView,
  handleLinkClick,
  renderReferencedNodePalette,
  hasReferencedMetamodels,
  includeReferencedMetamodelViews,
  setIncludeReferencedMetamodelViews,
  referencedViews,
  referencedFlowByViewId,
  renderMetamodelCreatePalette,
}: SidebarTabsContentProps) {
  return (
    <SidebarContent className="bg-[#1e293b]">
              {projectType === "instance" ? (
                <Tabs
                  // Keyed so the selected tab resets when switching between an
                  // instance model and a metamodel (their tab values differ).
                  key={`instance-${projectId}`}
                  defaultValue="metamodels"
                  className="flex h-full flex-col px-2 pt-3"
                >
                  <TabsList
                    className={cn(
                      "grid w-full bg-white/5 p-1 text-white/60",
                      "grid-cols-2",
                    )}
                  >
                    <TabsTrigger
                      value="metamodels"
                      className="text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-white data-[state=active]:text-slate-900"
                    >
                      Add elements
                    </TabsTrigger>
                    <TabsTrigger
                      value="diagrams"
                      className="text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-white data-[state=active]:text-slate-900"
                    >
                      Diagrams
                    </TabsTrigger>
                  </TabsList>
    
                  <ScrollingTabsContent
                    value="diagrams"
                    className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1"
                  >
                    <SidebarViewList
                      views={views}
                      orderedViews={orderedViews}
                      currentViewId={currentViewId}
                      flowByViewId={flowByViewId}
                      getNodeLabel={(node) => getNodeMeta(node).label}
                      renderViewNodeList={renderViewNodeList}
                      onCreateView={onCreateView}
                    />
    
                    <SidebarPatternPalette
                      projectId={projectId}
                      currentViewId={currentViewId}
                      patterns={(patternsQuery.data ?? []).map((pattern) => ({
                        id: pattern.id,
                        name: pattern.name,
                        // Patterns of referenced metamodels can only be inserted.
                        from: pattern.ownedByProject ? undefined : pattern.projectName,
                      }))}
                      isLoading={patternsQuery.isLoading}
                      isError={patternsQuery.isError}
                      onInsertPattern={(patternId, viewId) =>
                        dispatchDiagramEvent("insert-pattern-into-view", {
                          patternId,
                          viewId,
                        })
                      }
                      onConfigurePattern={(pattern) => {
                        const fullPattern = (patternsQuery.data ?? []).find(
                          (candidate) => candidate.id === pattern.id,
                        );
                        if (fullPattern) setEditingView(fullPattern);
                      }}
                      onNavigate={handleLinkClick}
                    />
                  </ScrollingTabsContent>
    
                  <ScrollingTabsContent
                    value="metamodels"
                    className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1"
                  >
                    {renderReferencedNodePalette()}
                  </ScrollingTabsContent>
                </Tabs>
              ) : (
                <Tabs
                  key={`metamodel-${projectId}`}
                  defaultValue="node-types"
                  className="flex h-full flex-col px-2 pt-3"
                >
                  <TabsList
                    className={cn(
                      "grid w-full bg-white/5 p-1 text-white/60",
                      "grid-cols-2",
                    )}
                  >
                    <TabsTrigger
                      value="node-types"
                      className="text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-white data-[state=active]:text-slate-900"
                    >
                      Add elements
                    </TabsTrigger>
                    <TabsTrigger
                      value="diagrams"
                      className="text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-white data-[state=active]:text-slate-900"
                    >
                      Diagrams
                    </TabsTrigger>
                  </TabsList>
    
                  <ScrollingTabsContent
                    value="diagrams"
                    className="mt-3 flex-1 overflow-y-auto pr-1"
                  >
                    <SidebarGroup>
                      <SidebarGroupContent>
                        {hasReferencedMetamodels && (
                          <div className="mb-3 px-1">
                            <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75">
                              <Checkbox
                                checked={includeReferencedMetamodelViews}
                                onCheckedChange={(checked) =>
                                  setIncludeReferencedMetamodelViews(checked === true)
                                }
                              />
                              <span>Include referenced metamodel diagrams</span>
                            </label>
                          </div>
                        )}
                        <SidebarMenu>
                          {views.length === 0 ? (
                            <div className="px-4 py-8 text-center text-white/30 text-xs italic">
                              No diagrams yet.
                            </div>
                          ) : (
                            orderedViews.map((view) => {
                              const flowQuery = flowByViewId.get(view.id);
                              const nodes = (
                                (flowQuery?.data?.nodes ?? []) as FlowNode[]
                              )
                                .slice()
                                .sort((a, b) =>
                                  getNodeMeta(a).label.localeCompare(
                                    getNodeMeta(b).label,
                                  ),
                                );
                              return renderViewNodeList({
                                view,
                                nodes,
                                flowState: flowQuery,
                                isCurrentView: view.id === currentViewId,
                                isReadOnly: false,
                              });
                            })
                          )}
    
                          {hasReferencedMetamodels && includeReferencedMetamodelViews &&
                            referencedViews.map(
                              ({ project, views, isLoading, isError }) => (
                                <div key={project.id} className="mt-3 mb-2">
                                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                                    {project.name}
                                  </div>
                                  {isLoading && (
                                    <SidebarMenuItem>
                                      <SidebarMenuButton
                                        asChild
                                        className="text-white/40"
                                      >
                                        <span>Loading referenced views...</span>
                                      </SidebarMenuButton>
                                    </SidebarMenuItem>
                                  )}
                                  {isError && (
                                    <SidebarMenuItem>
                                      <SidebarMenuButton
                                        asChild
                                        className="text-red-300"
                                      >
                                        <span>Failed to load referenced diagrams</span>
                                      </SidebarMenuButton>
                                    </SidebarMenuItem>
                                  )}
                                  {!isLoading && !isError && views.length === 0 && (
                                    <SidebarMenuItem>
                                      <SidebarMenuButton
                                        asChild
                                        className="text-white/40"
                                      >
                                        <span>No diagrams available</span>
                                      </SidebarMenuButton>
                                    </SidebarMenuItem>
                                  )}
                                  {!isLoading &&
                                    !isError &&
                                    views.map((view) => {
                                      const flowQuery = referencedFlowByViewId.get(
                                        view.id,
                                      );
                                      const nodes = (
                                        (flowQuery?.data?.nodes ?? []) as FlowNode[]
                                      )
                                        .slice()
                                        .sort((a, b) =>
                                          getNodeMeta(a).label.localeCompare(
                                            getNodeMeta(b).label,
                                          ),
                                        );
                                      return renderViewNodeList({
                                        view,
                                        nodes,
                                        flowState: flowQuery,
                                        isCurrentView: false,
                                        isReadOnly: true,
                                        sourceLabel: project.description
                                          ? `${project.description}`
                                          : undefined,
                                        insertMode: "insert-reference",
                                        showReadOnlyBadge: false,
                                      });
                                    })}
                                </div>
                              ),
                            )}
                        </SidebarMenu>
                        <div className="px-2 pt-3">
                          <Button
                            variant="ghost"
                            className="w-full justify-center gap-2 rounded-md border border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white"
                            onClick={onCreateView}
                            data-testid="button-create-view-sidebar"
                          >
                            <Plus className="w-4 h-4" />
                            Create view
                          </Button>
                        </div>
                      </SidebarGroupContent>
                    </SidebarGroup>
                  </ScrollingTabsContent>
    
                  <ScrollingTabsContent
                    value="node-types"
                    className="mt-3 flex-1 overflow-y-auto pr-1"
                  >
                    <SidebarGroup>
                      <SidebarGroupContent>
                        {renderMetamodelCreatePalette()}
                      </SidebarGroupContent>
                    </SidebarGroup>
                  </ScrollingTabsContent>
                </Tabs>
              )}
            </SidebarContent>
  );
}
