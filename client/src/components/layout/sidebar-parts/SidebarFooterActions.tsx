import type { ProjectType } from "@shared/schema";
import { type MouseEvent } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { Download as DownloadIcon, ListChecks as ListChecksIcon, Sparkles as SparklesIcon } from "lucide-react";
import { dispatchDiagramEvent } from "@/lib/diagram-events";
import { Separator } from "@/components/ui/separator";
import { SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { AI_ASSISTANT_ENABLED } from "@/lib/feature-flags";
import { supportsModelRules } from "@/components/flow/rules/model-rules";

export interface SidebarFooterActionsProps {
  projectType: ProjectType | undefined;
  currentViewId: number | undefined;
  canEditMetamodels: boolean;
  canSeeModelRules: boolean;
  setExportDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleLinkClick: (event?: MouseEvent, href?: string) => void;
}

export function SidebarFooterActions({
  projectType,
  currentViewId,
  canEditMetamodels,
  canSeeModelRules,
  setExportDialogOpen,
  handleLinkClick,
}: SidebarFooterActionsProps) {
  return (
    <SidebarFooter className="px-3 py-2 border-t border-white/10 bg-[#1e293b] gap-1">
              <Separator className="bg-white/10" />
              {AI_ASSISTANT_ENABLED &&
              projectType === "metamodel" &&
              currentViewId &&
              canEditMetamodels ? (
                <Button
                  variant="ghost"
                  className="h-8 w-full justify-start text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() => dispatchDiagramEvent("metamodel-ai-assistant-toggle-request", { viewId: currentViewId })}
                  data-testid="button-ai-model-assistant"
                >
                  <SparklesIcon className="w-4 h-4 mr-2" />
                  AI Model Assistant
                </Button>
              ) : null}
              {supportsModelRules(projectType) &&
              currentViewId &&
              canSeeModelRules ? (
                <Button
                  variant="ghost"
                  className="h-8 w-full justify-start text-white/70 hover:text-white hover:bg-white/10"
                  onClick={() =>
                    dispatchDiagramEvent("model-rules-toggle-request", {
                      viewId: currentViewId,
                    })
                  }
                  data-testid="button-model-rules"
                >
                  <ListChecksIcon className="w-4 h-4 mr-2" />
                  Model rules
                </Button>
              ) : null}
              <Button
                variant="ghost"
                className="h-8 w-full justify-start text-white/70 hover:text-white hover:bg-white/10"
                onClick={() => setExportDialogOpen(true)}
                data-testid="button-export-project"
              >
                <DownloadIcon className="w-4 h-4 mr-2" />
                Export Project
              </Button>
              <Separator className="bg-white/10" />
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    className="w-full justify-start text-white/60 hover:text-white hover:bg-white/5 gap-2 h-8"
                  >
                    <Link
                      href="/projects"
                      onClick={(event) => handleLinkClick(event, "/projects")}
                    >
                      <Home className="w-4 h-4" />
                      <span className="font-medium">All projects</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
  );
}
