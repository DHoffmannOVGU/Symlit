import { ArrowRight, Settings2, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export interface SidebarPattern {
  id: number;
  name: string;
  /** The referenced metamodel the pattern comes from; unset for the project's own. */
  from?: string;
}

export interface SidebarPatternPaletteProps {
  projectId: number;
  currentViewId?: number;
  patterns: SidebarPattern[];
  isLoading: boolean;
  isError: boolean;
  onInsertPattern: (patternId: number, viewId: number) => void;
  onConfigurePattern: (pattern: SidebarPattern) => void;
  onNavigate: (event: React.MouseEvent, href: string) => void;
}

export function SidebarPatternPalette({
  projectId,
  currentViewId,
  patterns,
  isLoading,
  isError,
  onInsertPattern,
  onConfigurePattern,
  onNavigate,
}: SidebarPatternPaletteProps) {
  return (
    <SidebarGroup>
      <div className="mt-2 flex items-center justify-between border-t border-white/10 px-2 py-2">
        <SidebarGroupLabel className="flex h-auto items-center gap-2 p-0 text-xs font-bold uppercase tracking-wider text-white/40">
          <Sparkles className="h-3 w-3" />
          Patterns
        </SidebarGroupLabel>
      </div>
      <SidebarGroupContent>
        <SidebarMenu>
          {isLoading && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild className="text-white/40">
                <span>Loading patterns...</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {isError && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild className="text-red-300">
                <span>Failed to load patterns</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {!isLoading && !isError && patterns.length === 0 && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild className="text-white/40">
                <span>No patterns yet</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {patterns.map((pattern) => {
            const isActive = pattern.id === currentViewId;
            return (
              <SidebarMenuItem key={pattern.id} className="group/item">
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={
                    pattern.from
                      ? `${pattern.name} (from ${pattern.from})`
                      : pattern.name
                  }
                  className={cn(
                    "pr-14 transition-all duration-200",
                    isActive
                      ? "bg-primary text-white hover:bg-primary/90"
                      : "text-white/70 hover:bg-white/5 hover:pl-3 hover:text-white",
                  )}
                >
                  {pattern.from ? (
                    <span
                      className="flex min-w-0 items-center gap-2"
                      data-testid={`library-pattern-${pattern.id}`}
                    >
                      <span className="truncate font-medium">
                        {pattern.name}
                      </span>
                      <span className="truncate text-[10px] text-white/40">
                        {pattern.from}
                      </span>
                    </span>
                  ) : (
                    <Link
                      href={`/project/${projectId}/view/${pattern.id}`}
                      onClick={(event) =>
                        onNavigate(
                          event,
                          `/project/${projectId}/view/${pattern.id}`,
                        )
                      }
                      className="flex min-w-0 items-center gap-2"
                    >
                      <span className="truncate font-medium">
                        {pattern.name}
                      </span>
                    </Link>
                  )}
                </SidebarMenuButton>
                <SidebarMenuAction
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (currentViewId)
                      onInsertPattern(pattern.id, currentViewId);
                  }}
                  disabled={!currentViewId}
                  showOnHover
                  className={cn(
                    pattern.from ? "right-1" : "right-7",
                    currentViewId
                      ? "text-white/50 hover:bg-white/10 hover:text-white"
                      : "cursor-not-allowed text-white/20 hover:bg-transparent",
                  )}
                  title={
                    currentViewId
                      ? "Insert pattern into this diagram"
                      : "Open a diagram to insert"
                  }
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </SidebarMenuAction>
                {!pattern.from && (
                  <SidebarMenuAction
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onConfigurePattern(pattern);
                    }}
                    className="text-white/60 opacity-0 transition-opacity hover:bg-white/10 hover:text-white group-hover/item:opacity-100"
                    title="Configure pattern"
                    data-testid={`button-configure-pattern-${pattern.id}`}
                  >
                    <Settings2 className="h-4 w-4" />
                  </SidebarMenuAction>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
