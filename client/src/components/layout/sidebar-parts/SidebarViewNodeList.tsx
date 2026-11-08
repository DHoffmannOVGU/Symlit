import type { NodeMeta, ViewDropTarget, InsertNodeOptions } from "./types";
import { type DragEvent, type MouseEvent } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Box, Settings2, ChevronRight, ArrowRight, Check, GripVertical } from "lucide-react";
import * as Icons from "lucide-react";
import type { FlowNode, View } from "@shared/schema";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { type SidebarNodeInsertMode, type SidebarNodeTransfer } from "../sidebar/SidebarConstants";

export type SidebarViewNodeListArgs = {
    view: View;
    nodes: FlowNode[];
    flowState?: { isLoading?: boolean; isError?: boolean };
    isCurrentView: boolean;
    isReadOnly: boolean;
    sourceLabel?: string;
    insertMode?: SidebarNodeInsertMode;
    showReadOnlyBadge?: boolean;
  };

export interface SidebarViewNodeListContext {
  expandedViews: Set<number>;
  toggleExpanded: (viewId: number, nextOpen?: boolean) => void;
  draggedViewId: number | null;
  setViewDropTarget: React.Dispatch<React.SetStateAction<ViewDropTarget | null>>;
  finishViewReorder: (targetViewId: number, position: "before" | "after") => void;
  viewDropTarget: ViewDropTarget | null;
  projectId: number;
  handleLinkClick: (event?: MouseEvent, href?: string) => void;
  setDraggedViewId: React.Dispatch<React.SetStateAction<number | null>>;
  setEditingView: React.Dispatch<React.SetStateAction<View | null>>;
  getNodeMeta: (node: FlowNode) => NodeMeta;
  currentViewId: number | undefined;
  currentViewNodeIds: Set<string>;
  selectedNodeByViewId: Map<number, string | null>;
  currentSelectedNodeId: string | null;
  getCanonicalTypeId: (node: FlowNode) => string;
  handleMetamodelNodeDragStart: (event: DragEvent<HTMLElement>, payload: SidebarNodeTransfer) => void;
  handleInsertNode: (nodeId: string, options?: InsertNodeOptions) => Promise<void>;
}

export function SidebarViewNodeList({
  expandedViews,
  toggleExpanded,
  draggedViewId,
  setViewDropTarget,
  finishViewReorder,
  viewDropTarget,
  projectId,
  handleLinkClick,
  setDraggedViewId,
  setEditingView,
  getNodeMeta,
  currentViewId,
  currentViewNodeIds,
  selectedNodeByViewId,
  currentSelectedNodeId,
  getCanonicalTypeId,
  handleMetamodelNodeDragStart,
  handleInsertNode,
  view,
  nodes,
  flowState,
  isCurrentView,
  isReadOnly,
  sourceLabel,
  insertMode,
  showReadOnlyBadge = true,
}: SidebarViewNodeListContext & SidebarViewNodeListArgs) {
  return (
    (
    <Collapsible
      key={`${isReadOnly ? "referenced" : "local"}-${view.id}`}
      open={expandedViews.has(view.id)}
      onOpenChange={(open) => toggleExpanded(view.id, open)}
      onDragOver={(event) => {
        if (isReadOnly || draggedViewId === null || draggedViewId === view.id) {
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const bounds = event.currentTarget.getBoundingClientRect();
        setViewDropTarget({
          id: view.id,
          position:
            event.clientY < bounds.top + bounds.height / 2 ? "before" : "after",
        });
      }}
      onDrop={(event) => {
        if (isReadOnly) return;
        event.preventDefault();
        finishViewReorder(
          view.id,
          viewDropTarget?.id === view.id ? viewDropTarget.position : "before",
        );
      }}
    >
      <SidebarMenuItem
        className={cn(
          "group/item rounded-md transition-colors",
          viewDropTarget?.id === view.id &&
            (viewDropTarget.position === "before"
              ? "border-t-2 border-primary"
              : "border-b-2 border-primary"),
        )}
      >
        <SidebarMenuButton
          asChild={!isReadOnly}
          isActive={isCurrentView}
          tooltip={view.name}
          className={cn(
            "transition-all duration-200 pr-14",
            isCurrentView
              ? "bg-primary text-white hover:bg-primary/90"
              : "text-white/70 hover:bg-white/5 hover:text-white hover:pl-3",
            isReadOnly && "cursor-default hover:pl-2",
          )}
        >
          {isReadOnly ? (
            <div className="flex items-center gap-3">
              <Box className="w-4 h-4 shrink-0 text-white/40" />
              <span className="truncate font-medium">{view.name}</span>
              {showReadOnlyBadge && (
                <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white/45">
                  Read only
                </span>
              )}
            </div>
          ) : (
            <Link
              href={`/project/${projectId}/view/${view.id}`}
              onClick={(event) =>
                handleLinkClick(event, `/project/${projectId}/view/${view.id}`)
              }
              className="flex items-center gap-3"
            >
              <span
                draggable
                className="cursor-grab text-white/35 opacity-0 transition-opacity hover:text-white/70 group-hover/item:opacity-100 active:cursor-grabbing"
                title="Drag to reorder view"
                aria-label={`Reorder ${view.name}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onDragStart={(event) => {
                  event.stopPropagation();
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", String(view.id));
                  setDraggedViewId(view.id);
                  setViewDropTarget(null);
                }}
                onDragEnd={() => {
                  setDraggedViewId(null);
                  setViewDropTarget(null);
                }}
              >
                <GripVertical className="h-4 w-4" />
              </span>
              <Box
                className={cn(
                  "w-4 h-4 shrink-0",
                  isCurrentView ? "text-white" : "text-white/40",
                )}
              />
              <span className="truncate font-medium">{view.name}</span>
            </Link>
          )}
        </SidebarMenuButton>
        <SidebarMenuAction
          onClick={() => toggleExpanded(view.id)}
          className={cn(
            "right-7 opacity-100 hover:bg-white/10 text-white/60 hover:text-white",
            expandedViews.has(view.id) && "text-white",
          )}
          title={expandedViews.has(view.id) ? "Hide nodes" : "Show nodes"}
        >
          <ChevronRight
            className={cn(
              "w-4 h-4 transition-transform",
              expandedViews.has(view.id) && "rotate-90",
            )}
          />
        </SidebarMenuAction>
        {!isReadOnly && (
          <SidebarMenuAction
            onClick={() => setEditingView(view)}
            className="opacity-0 group-hover/item:opacity-100 transition-opacity hover:bg-white/10 text-white/60 hover:text-white"
            title="Configure view"
            data-testid={`button-configure-view-${view.id}`}
          >
            <Settings2 className="w-4 h-4" />
          </SidebarMenuAction>
        )}
        <CollapsibleContent>
          <SidebarMenuSub className="mt-1 gap-2">
            {sourceLabel && (
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  asChild
                  size="sm"
                  className="text-white/40"
                >
                  <span>{sourceLabel}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )}
            {flowState?.isLoading && (
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  asChild
                  size="sm"
                  className="text-white/50"
                >
                  <span>Loading nodes...</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )}
            {flowState?.isError && (
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  asChild
                  size="sm"
                  className="text-red-300"
                >
                  <span>Failed to load nodes</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )}
            {!flowState?.isLoading &&
              !flowState?.isError &&
              nodes.length === 0 && (
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    asChild
                    size="sm"
                    className="text-white/40"
                  >
                    <span>No nodes yet</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )}
            {nodes.map((node) => {
              const meta = getNodeMeta(node);
              const IconComponent = (Icons as any)[meta.iconName] || Icons.Box;
              const iconBg = meta.color
                ? `${meta.color}25`
                : "rgba(255,255,255,0.08)";
              const iconColor = meta.color || "rgba(255,255,255,0.6)";
              const alreadyInCurrentView =
                !isCurrentView && currentViewId
                  ? currentViewNodeIds.has(node.id)
                  : false;
              const isSelected = selectedNodeByViewId.get(view.id) === node.id;
              const isReferencedSelection =
                !isSelected &&
                !isCurrentView &&
                !!currentSelectedNodeId &&
                currentSelectedNodeId === node.id;
              const dragPayload =
                !isCurrentView && currentViewId && insertMode
                  ? {
                      nodeId: node.id,
                      typeId:
                        insertMode === "create-instance-node"
                          ? getCanonicalTypeId(node)
                          : undefined,
                      viewId: currentViewId,
                      mode: insertMode,
                      typeLabel: meta.label,
                      icon: meta.iconName,
                      color: meta.color,
                    }
                  : null;
              return (
                <SidebarMenuSubItem key={node.id}>
                  <SidebarMenuSubButton
                    asChild
                    size="sm"
                    className={cn(
                      "text-white/70",
                      isSelected &&
                        "bg-white/10 text-white border border-white/20",
                      isReferencedSelection &&
                        "border border-dashed border-white/20 bg-white/[0.04] text-white/80",
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center gap-2 min-w-0 group/node",
                        dragPayload && "cursor-grab active:cursor-grabbing",
                      )}
                      draggable={Boolean(dragPayload)}
                      onDragStart={(event) =>
                        dragPayload
                          ? handleMetamodelNodeDragStart(event, dragPayload)
                          : undefined
                      }
                    >
                      <span
                        className="h-5 w-5 rounded flex items-center justify-center shrink-0"
                        style={{ backgroundColor: iconBg, color: iconColor }}
                      >
                        <IconComponent className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-[13px] leading-tight">
                          {meta.label}
                        </span>
                        {meta.typeLabel && (
                          <span className="block text-[10px] uppercase tracking-wide text-white/40 truncate">
                            {meta.typeLabel}
                          </span>
                        )}
                      </span>
                      {!isCurrentView && currentViewId && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-6 w-6 opacity-0 group-hover/node:opacity-100 transition-opacity",
                            alreadyInCurrentView
                              ? "text-white/20 cursor-not-allowed"
                              : "text-white/50 hover:text-white hover:bg-white/10",
                          )}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (alreadyInCurrentView) return;
                            void handleInsertNode(node.id, {
                              mode: insertMode,
                              typeId:
                                insertMode === "create-instance-node"
                                  ? getCanonicalTypeId(node)
                                  : undefined,
                              typeLabel: meta.label,
                              icon: meta.iconName,
                              color: meta.color,
                            });
                          }}
                          title={
                            alreadyInCurrentView
                              ? "Already in current view"
                              : "Insert into current view"
                          }
                          data-testid={`button-insert-node-${node.id}`}
                          disabled={alreadyInCurrentView}
                        >
                          {alreadyInCurrentView ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowRight className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
  );
}
