import type { ReactNode } from "react";
import type { FlowNode, View } from "@shared/schema";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export interface SidebarViewListProps {
  views: View[];
  orderedViews: View[];
  currentViewId?: number;
  flowByViewId: Map<
    number,
    {
      data?: { nodes?: unknown[] } | null;
      isLoading?: boolean;
      isError?: boolean;
    }
  >;
  getNodeLabel: (node: FlowNode) => string;
  renderViewNodeList: (args: {
    view: View;
    nodes: FlowNode[];
    flowState?: { isLoading?: boolean; isError?: boolean };
    isCurrentView: boolean;
    isReadOnly: boolean;
  }) => ReactNode;
  onCreateView: () => void;
}

export function SidebarViewList({
  views,
  orderedViews,
  currentViewId,
  flowByViewId,
  getNodeLabel,
  renderViewNodeList,
  onCreateView,
}: SidebarViewListProps) {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {views.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs italic text-white/30">
              No diagrams yet.
            </div>
          ) : (
            orderedViews.map((view) => {
              const flowQuery = flowByViewId.get(view.id);
              const nodes = ((flowQuery?.data?.nodes ?? []) as FlowNode[])
                .slice()
                .sort((left, right) =>
                  getNodeLabel(left).localeCompare(getNodeLabel(right)),
                );
              return renderViewNodeList({
                view,
                nodes,
                flowState: {
                  isLoading: flowQuery?.isLoading,
                  isError: flowQuery?.isError,
                },
                isCurrentView: view.id === currentViewId,
                isReadOnly: false,
              });
            })
          )}
        </SidebarMenu>
        <div className="px-2 pt-3">
          <Button
            variant="ghost"
            className="w-full justify-center gap-2 rounded-md border border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white"
            onClick={onCreateView}
            data-testid="button-create-view-sidebar"
          >
            <Plus className="h-4 w-4" />
            Create view
          </Button>
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}