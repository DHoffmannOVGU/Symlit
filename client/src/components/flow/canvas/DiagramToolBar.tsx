// src/diagram/ui/DiagramToolbar.tsx
import { Panel } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutGrid,
  ArrowLeftRight,
  Undo2,
  Redo2,
  Camera,
  CheckCircle2,
  Sparkles,
  Wand2,
  Play,
  Square,
  Flag,
  FlagTriangleRight,
  StepBack,
  StepForward,
  RotateCcw,
  SlidersHorizontal,
  CircleHelp,
  Network,
  TableProperties,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ProjectType } from "@shared/schema";

type Props = {
  projectType: ProjectType;
  displayMode?: "graph" | "table";
  onDisplayModeChange?: (mode: "graph" | "table") => void;
  canUndo: boolean;
  canRedo: boolean;
  isFlowMode?: boolean;
  isFlowRunning?: boolean;
  canSetFlowStart?: boolean;
  canSetFlowEnd?: boolean;
  canPlayFlow?: boolean;
  canStepBack?: boolean;
  canStepForward?: boolean;
  canStraightenEdge?: boolean;
  snapNodesEnabled?: boolean;
  alwaysShowAccent?: boolean;
  showBackgroundDots?: boolean;
  showNodeDescriptions?: boolean;

  onUndo: () => void;
  onRedo: () => void;
  onToggleSnap?: () => void;
  onToggleAlwaysShowAccent?: () => void;
  onToggleBackgroundDots?: () => void;
  onToggleNodeDescriptions?: () => void;
  onAutoLayout: () => void;
  onLayoutSelectedVertical: () => void;
  onLayoutSelectedHorizontal: () => void;
  onCenterSelectedVertical: () => void;
  onCenterSelectedHorizontal: () => void;
  onScreenshot: () => void;
  onValidate: () => void;
  canLayoutSelection?: boolean;
  canAutoLayout?: boolean;
  canSavePattern?: boolean;
  onSavePattern?: () => void;
  onSetFlowStart?: () => void;
  onSetFlowEnd?: () => void;
  onPlayFlow?: () => void;
  onStopFlow?: () => void;
  onStepBack?: () => void;
  onStepForward?: () => void;
  onResetFlow?: () => void;
  onStraightenEdge?: () => void;
  onOpenHelp: () => void;
};

type ToolbarButtonProps = {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "outline" | "secondary" | "ghost";
  active?: boolean;
  className?: string;
  iconClassName?: string;
};

const toolbarButtonClasses =
  "group/toolbar-button relative h-9 w-9 justify-center overflow-visible px-0 transition-colors duration-200";

const toolbarLabelClasses =
  "pointer-events-none invisible absolute left-1/2 top-[calc(100%+0.35rem)] z-20 -translate-x-1/2 whitespace-nowrap rounded-md border bg-background/95 px-2 py-1 text-xs font-medium text-foreground shadow-sm opacity-0 transition-opacity duration-200 group-hover/toolbar-button:visible group-hover/toolbar-button:opacity-100";

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  variant = "outline",
  active = false,
  className,
  iconClassName,
}: ToolbarButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      variant={variant}
      size="sm"
      title={label}
      className={cn(
        toolbarButtonClasses,
        active && "border-primary bg-primary/10 text-primary hover:bg-primary/15",
        className,
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", iconClassName)} />
      <span className={toolbarLabelClasses}>
        {label}
      </span>
    </Button>
  );
}

export function DiagramToolbar(props: Props) {
  const {
    displayMode = "graph",
    onDisplayModeChange,
    canUndo,
    canRedo,
    isFlowMode = false,
    isFlowRunning = false,
    canSetFlowStart = false,
    canSetFlowEnd = false,
    canPlayFlow = false,
    canStepBack = false,
    canStepForward = false,
    canStraightenEdge = false,
    snapNodesEnabled = true,
    alwaysShowAccent = false,
    showBackgroundDots = true,
    showNodeDescriptions = true,
    onUndo,
    onRedo,
    onToggleSnap,
    onToggleAlwaysShowAccent,
    onToggleBackgroundDots,
    onToggleNodeDescriptions,
    onAutoLayout,
    onLayoutSelectedVertical,
    onLayoutSelectedHorizontal,
    onCenterSelectedVertical,
    onCenterSelectedHorizontal,
    onScreenshot,
    onValidate,
    canLayoutSelection = false,
    canAutoLayout = false,
    canSavePattern = false,
    onSavePattern,
    onSetFlowStart,
    onSetFlowEnd,
    onPlayFlow,
    onStopFlow,
    onStepBack,
    onStepForward,
    onResetFlow,
    onStraightenEdge,
    onOpenHelp,
  } = props;

  return (
    <>
      {!isFlowMode && (
        <Panel position="top-left" className="flex items-center gap-1">
          <ToolbarButton
            icon={Undo2}
            label="Undo"
            onClick={onUndo}
            disabled={!canUndo}
          />
          <ToolbarButton
            icon={Redo2}
            label="Redo"
            onClick={onRedo}
            disabled={!canRedo}
          />
        </Panel>
      )}
      <Panel position="top-right" className="flex max-w-[min(100vw-2rem,900px)] flex-wrap items-start justify-end gap-2">
      {isFlowMode ? (
        <>
          <ToolbarButton icon={Flag} label="Mark Start" onClick={onSetFlowStart} disabled={!canSetFlowStart} />
          <ToolbarButton icon={FlagTriangleRight} label="Mark End" onClick={onSetFlowEnd} disabled={!canSetFlowEnd} />
          <ToolbarButton icon={StepBack} label="Step Back" onClick={onStepBack} disabled={!canStepBack} />
          <ToolbarButton icon={StepForward} label="Step Forward" onClick={onStepForward} disabled={!canStepForward} />
          {isFlowRunning ? (
            <ToolbarButton icon={Square} label="Stop Flow" onClick={onStopFlow} />
          ) : (
            <ToolbarButton icon={Play} label="Start Flow" onClick={onPlayFlow} disabled={!canPlayFlow} />
          )}
          <ToolbarButton icon={RotateCcw} label="Reset Flow" onClick={onResetFlow} />
          <ToolbarButton icon={CircleHelp} label="Help" onClick={onOpenHelp} />
        </>
      ) : (
        <>
          {onDisplayModeChange && (
            <div className="flex items-center gap-1">
              <ToolbarButton
                icon={Network}
                label="Graph View"
                active={displayMode === "graph"}
                onClick={() => onDisplayModeChange("graph")}
              />
              <ToolbarButton
                icon={TableProperties}
                label="Table View"
                active={displayMode === "table"}
                onClick={() => onDisplayModeChange("table")}
              />
            </div>
          )}

          {canStraightenEdge && (
            <ToolbarButton icon={ArrowLeftRight} label="Straighten Edge" onClick={onStraightenEdge} />
          )}

          {(onToggleSnap || onToggleAlwaysShowAccent || onToggleBackgroundDots || onToggleNodeDescriptions) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  title="Canvas settings"
                  className={toolbarButtonClasses}
                >
                  <SlidersHorizontal className="h-4 w-4 shrink-0 text-primary" />
                  <span className={toolbarLabelClasses}>
                    Configure
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start">
                <DropdownMenuLabel>Canvas style</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {onToggleSnap && (
                  <DropdownMenuCheckboxItem
                    checked={snapNodesEnabled}
                    onCheckedChange={() => onToggleSnap()}
                  >
                    Snap nodes
                  </DropdownMenuCheckboxItem>
                )}
                {onToggleBackgroundDots && (
                  <DropdownMenuCheckboxItem
                    checked={showBackgroundDots}
                    onCheckedChange={() => onToggleBackgroundDots()}
                  >
                    Show background dots
                  </DropdownMenuCheckboxItem>
                )}
                {onToggleNodeDescriptions && (
                  <DropdownMenuCheckboxItem
                    checked={showNodeDescriptions}
                    onCheckedChange={() => onToggleNodeDescriptions()}
                  >
                    Show node descriptions
                  </DropdownMenuCheckboxItem>
                )}
                {onToggleAlwaysShowAccent && (
                  <DropdownMenuCheckboxItem
                    checked={alwaysShowAccent}
                    onCheckedChange={() => onToggleAlwaysShowAccent()}
                  >
                    Always show accent border
                  </DropdownMenuCheckboxItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <ToolbarButton
            icon={Wand2}
            label="Auto Layout"
            onClick={onAutoLayout}
            disabled={!canAutoLayout}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                title="Alignment tools"
                disabled={!canLayoutSelection}
                className={toolbarButtonClasses}
              >
                <LayoutGrid className="h-4 w-4 shrink-0 text-primary" />
                <span className={toolbarLabelClasses}>
                  Align
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start">
              <DropdownMenuLabel>Selection layout</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onLayoutSelectedVertical} disabled={!canLayoutSelection}>
                Layout vertical
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onLayoutSelectedHorizontal} disabled={!canLayoutSelection}>
                Layout horizontal
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onCenterSelectedVertical} disabled={!canLayoutSelection}>
                Center vertical
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onCenterSelectedHorizontal} disabled={!canLayoutSelection}>
                Center horizontal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {canSavePattern && onSavePattern && (
            <ToolbarButton icon={Sparkles} label="Save Pattern" onClick={onSavePattern} iconClassName="text-primary" />
          )}

          <ToolbarButton icon={CheckCircle2} label="Validate" onClick={onValidate} iconClassName="text-primary" />
          <ToolbarButton icon={Camera} label="Screenshot" onClick={onScreenshot} iconClassName="text-primary" />
          <ToolbarButton icon={CircleHelp} label="Help" onClick={onOpenHelp} />
        </>
      )}
      </Panel>
    </>
  );
}
