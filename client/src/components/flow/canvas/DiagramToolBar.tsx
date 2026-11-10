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
  AlignHorizontalDistributeCenter,
  LayoutDashboard,
  ArrowLeftRight,
  Undo2,
  Redo2,
  Camera,
  CheckCircle2,
  Sparkles,
  Share2,
  Play,
  Square,
  Flag,
  FlagTriangleRight,
  StepBack,
  StepForward,
  RotateCcw,
  SlidersHorizontal,
  CircleHelp,
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
  autoSave?: boolean;
  onToggleAutoSave?: () => void;
};

type ToolbarButtonProps = {
  icon: LucideIcon;
  label: string;
  /** Stable id for tests and the tutorial's "Show me" (`button-toolbar-<id>`). */
  id?: string;
  /** Show the label next to the icon on wide screens (main actions only). */
  showLabel?: boolean;
  /** Shown in the hover label while the button is disabled: why, and what enables it. */
  disabledHint?: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "outline" | "secondary" | "ghost";
  active?: boolean;
  className?: string;
  iconClassName?: string;
};

const toolbarButtonClasses =
  "group/toolbar-button relative h-9 min-w-9 justify-center gap-1.5 overflow-visible px-2.5 transition-colors duration-200 disabled:pointer-events-auto disabled:cursor-not-allowed";

const toolbarLabelClasses =
  "pointer-events-none invisible absolute left-1/2 top-[calc(100%+0.35rem)] z-20 -translate-x-1/2 whitespace-nowrap rounded-md border bg-background/95 px-2 py-1 text-xs font-medium text-foreground shadow-sm opacity-0 transition-opacity duration-200 group-hover/toolbar-button:visible group-hover/toolbar-button:opacity-100 group-focus-visible/toolbar-button:visible group-focus-visible/toolbar-button:opacity-100";

/** A thin divider between groups of toolbar buttons. */
const ToolbarDivider = () => <div aria-hidden className="mx-0.5 h-6 w-px self-center bg-border" />;

function ToolbarButton({
  icon: Icon,
  label,
  id,
  showLabel = false,
  disabledHint,
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
      aria-label={label}
      aria-pressed={active || undefined}
      data-testid={id ? `button-toolbar-${id}` : undefined}
      className={cn(
        toolbarButtonClasses,
        !showLabel && "w-9 px-0",
        active && "border-primary bg-primary/10 text-primary hover:bg-primary/15",
        className,
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", iconClassName)} />
      {showLabel ? <span className="hidden text-xs font-medium xl:inline">{label}</span> : null}
      <span className={cn(toolbarLabelClasses, showLabel && "xl:hidden", disabled && disabledHint && "xl:block")}>
        {disabled && disabledHint ? `${label}: ${disabledHint}` : label}
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
    autoSave = false,
    onToggleAutoSave,
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
      {/* Width is relative to the canvas (not the window, which includes the sidebar) and leaves room for undo/redo. */}
      <Panel position="top-right" className="flex max-w-[min(calc(100%-7.5rem),900px)] flex-wrap items-start justify-end gap-2">
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
                icon={Share2}
                id="graph"
                label="Diagram"
                showLabel
                active={displayMode === "graph"}
                onClick={() => onDisplayModeChange("graph")}
              />
              <ToolbarButton
                icon={TableProperties}
                id="table"
                label="Table"
                showLabel
                active={displayMode === "table"}
                onClick={() => onDisplayModeChange("table")}
              />
            </div>
          )}
          {onDisplayModeChange && <ToolbarDivider />}

          {canStraightenEdge && (
            <ToolbarButton icon={ArrowLeftRight} id="straighten" label="Straighten relationship" onClick={onStraightenEdge} />
          )}


          <ToolbarButton
            icon={LayoutDashboard}
            id="auto-layout"
            label="Auto layout"
            showLabel
            onClick={onAutoLayout}
            disabled={!canAutoLayout}
            disabledHint="add elements first"
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                aria-label="Align selected elements"
                data-testid="button-toolbar-align"
                disabled={!canLayoutSelection}
                className={cn(toolbarButtonClasses, "w-9 px-0")}
              >
                <AlignHorizontalDistributeCenter className="h-4 w-4 shrink-0 text-primary" />
                <span className={toolbarLabelClasses}>
                  {canLayoutSelection ? "Align selected elements" : "Align: select two or more elements first"}
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

          <ToolbarDivider />
          <ToolbarButton icon={CheckCircle2} id="validate" label="Validate" showLabel onClick={onValidate} iconClassName="text-primary" />
          {canSavePattern && onSavePattern && (
            <ToolbarButton icon={Sparkles} id="save-pattern" label="Save pattern" showLabel onClick={onSavePattern} iconClassName="text-primary" />
          )}

          <ToolbarDivider />
          <ToolbarButton icon={Camera} id="screenshot" label="Screenshot" onClick={onScreenshot} iconClassName="text-primary" />
          {(onToggleSnap || onToggleAlwaysShowAccent || onToggleBackgroundDots || onToggleNodeDescriptions) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Canvas settings"
                  data-testid="button-toolbar-settings"
                  className={cn(toolbarButtonClasses, "w-9 px-0")}
                >
                  <SlidersHorizontal className="h-4 w-4 shrink-0 text-primary" />
                  <span className={toolbarLabelClasses}>
                    Canvas settings
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
                    Snap elements to each other
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
                    Show descriptions
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
                {onToggleAutoSave && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Saving</DropdownMenuLabel>
                    <DropdownMenuCheckboxItem
                      checked={autoSave}
                      onCheckedChange={() => onToggleAutoSave()}
                      data-testid="toggle-auto-save"
                    >
                      Save automatically
                    </DropdownMenuCheckboxItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <ToolbarButton icon={CircleHelp} id="help" label="Help and shortcuts" onClick={onOpenHelp} />
        </>
      )}
      </Panel>
    </>
  );
}
