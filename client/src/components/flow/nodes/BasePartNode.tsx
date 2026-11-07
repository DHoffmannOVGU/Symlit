import React from "react";
import { Handle, Position, NodeProps, NodeResizer } from "@xyflow/react";
import * as Icons from "lucide-react";
import { dispatchDiagramEvent } from "@/lib/diagram-events";
import { INTERNAL_VIEWS_ENABLED } from "@/lib/feature-flags";

interface PartNodeData {
  label: string;
  description?: string;
  type?: string;
  icon?: string;
  color?: string;
  isDraft?: boolean;
  flowStart?: boolean;
  flowEnd?: boolean;
  flowTick?: number | number[];
  flowActive?: boolean;
  hasInternalView?: boolean;
  isGroupContainer?: boolean;
  externalEdges?: Array<{
    id: string;
    label?: string;
    type: "input" | "output";
    side: "left" | "right" | "top" | "bottom";
    otherNodeName: string;
  }>;
  onOpenInternalView?: (nodeId: string) => void;
  alwaysShowAccent?: boolean;
  ruleAccentColor?: string;
  ruleEmphasis?: "none" | "soft" | "strong";
  ruleStateLabel?: string;
  modelRuleTags?: Array<{ label: string; color?: string; ruleName: string; origin?: "meta" | "instance" | "model" }>;
  ruleStatusItems?: Array<{
    label: string;
    state: "fulfilled" | "unfulfilled";
    role: "concern" | "target";
  }>;
  showActionToolbar?: boolean;
  isReadOnly?: boolean;
  canOpenInternalViewAction?: boolean;
  suppressActionToolbar?: boolean;
  showDescription?: boolean;
}

export interface BasePartNodeConfig {
  defaultTypeLabel: string;
  defaultAccentColor: string;
  defaultIconBg: string;
  hoverBorderClass: string;
  containerClassName: string;
  selectedClassName: string;
}

type BasePartNodeProps = NodeProps & {
  config: BasePartNodeConfig;
};

const BasePartNode = ({ id, data, selected, config }: BasePartNodeProps) => {
  const nodeData = data as unknown as PartNodeData;
  const IconComponent = (Icons as any)[nodeData.icon || "Box"] || Icons.Box;
  const accentColor =
    nodeData.ruleAccentColor || nodeData.color || config.defaultAccentColor;
  const iconBg = nodeData.color ? `${accentColor}25` : config.defaultIconBg;
  const typeLabel = nodeData.type || config.defaultTypeLabel;
  const isDraft = Boolean(nodeData.isDraft);
  const isFlowStart = Boolean(nodeData.flowStart);
  const isFlowEnd = Boolean(nodeData.flowEnd);
  const flowTick = nodeData.flowTick;
  const flowTicks = Array.isArray(flowTick)
    ? flowTick
    : typeof flowTick === "number"
      ? [flowTick]
      : [];
  const isFlowActive = Boolean(nodeData.flowActive);
  const hasInternalView = Boolean(nodeData.hasInternalView);
  const alwaysShowAccent = Boolean(nodeData.alwaysShowAccent);
  const ruleEmphasis = nodeData.ruleEmphasis || "none";
  const ruleStateLabel = nodeData.ruleStateLabel?.trim();
  const ruleStatusItems = nodeData.ruleStatusItems || [];
  const modelRuleTags = nodeData.modelRuleTags || [];
  const isGroupContainer = Boolean(nodeData.isGroupContainer);
  const externalEdges = nodeData.externalEdges || [];
  const shouldShowRuleAccent =
    ruleEmphasis !== "none" && Boolean(nodeData.ruleAccentColor);
  const idleAccentBorderColor = shouldShowRuleAccent
    ? `${accentColor}${ruleEmphasis === "strong" ? "D0" : "90"}`
    : alwaysShowAccent
      ? `${accentColor}70`
      : undefined;
  const idleAccentShadow = shouldShowRuleAccent
    ? ruleEmphasis === "strong"
      ? `0 0 0 1px ${accentColor}35, 0 12px 22px -10px ${accentColor}55`
      : `0 8px 14px -8px ${accentColor}40`
    : alwaysShowAccent
      ? `0 8px 12px -6px ${accentColor}14`
      : undefined;
  const hoverAccentBorderColor = `${accentColor}B0`;
  const hoverAccentShadow = `0 10px 18px -8px ${accentColor}22`;
  const selectedAccentShadow = `0 10px 15px -3px ${accentColor}20`;
  const fulfilledCount = ruleStatusItems.filter((item) => item.state === "fulfilled").length;
  const unfulfilledCount = ruleStatusItems.length - fulfilledCount;
  const hasMixedRuleStates = fulfilledCount > 0 && unfulfilledCount > 0;
  const statusSummary = ruleStatusItems.length
    ? ruleStatusItems.map((item) => `${item.state === "fulfilled" ? "Fulfilled" : "Not fulfilled"}: ${item.label}`).join("\n")
    : undefined;
  const showActionToolbar = Boolean(nodeData.showActionToolbar);
  const isReadOnly = Boolean(nodeData.isReadOnly);
  const canOpenInternalViewAction = Boolean(nodeData.canOpenInternalViewAction);
  const suppressActionToolbar = Boolean(nodeData.suppressActionToolbar);
  const showDescription = nodeData.showDescription !== false;
  const description = nodeData.description?.trim();
  const hasVisibleDescription = showDescription && Boolean(description);

  const handleAction = (
    event: React.MouseEvent<HTMLButtonElement>,
    action: "edit" | "copy" | "open-internal-view" | "delete",
  ) => {
    event.preventDefault();
    event.stopPropagation();
    dispatchDiagramEvent("diagram-node-action-request", {
      nodeId: id,
      action,
    });
  };

  if (isGroupContainer) {
    return (
      <>
        <NodeResizer
          minWidth={300}
          minHeight={200}
          isVisible={selected}
          lineStyle={{ borderColor: accentColor, borderWidth: 2 }}
          handleClassName="h-3 w-3 bg-white border-2 rounded"
          handleStyle={{ borderColor: accentColor }}
        />
        <Handle type="source" position={Position.Left} id="left" style={{ opacity: 0, pointerEvents: "none" }} isConnectable={false} />
        <Handle type="source" position={Position.Right} id="right" style={{ opacity: 0, pointerEvents: "none" }} isConnectable={false} />
        <Handle type="source" position={Position.Top} id="top" style={{ opacity: 0, pointerEvents: "none" }} isConnectable={false} />
        <Handle type="source" position={Position.Bottom} id="bottom" style={{ opacity: 0, pointerEvents: "none" }} isConnectable={false} />
        <Handle type="target" position={Position.Left} id="left-target" style={{ opacity: 0, pointerEvents: "none" }} isConnectable={false} />
        <Handle type="target" position={Position.Right} id="right-target" style={{ opacity: 0, pointerEvents: "none" }} isConnectable={false} />
        <Handle type="target" position={Position.Top} id="top-target" style={{ opacity: 0, pointerEvents: "none" }} isConnectable={false} />
        <Handle type="target" position={Position.Bottom} id="bottom-target" style={{ opacity: 0, pointerEvents: "none" }} isConnectable={false} />
        <div
          className="w-full h-full rounded-2xl border-2 border-dashed relative"
          style={{
            borderColor: accentColor,
            backgroundColor: nodeData.color
              ? `${accentColor}0A`
              : "hsl(var(--primary) / 0.04)",
            boxShadow: selected
              ? `0 0 0 2px ${accentColor}40, inset 0 0 0 1px ${accentColor}20`
              : `inset 0 0 0 1px ${accentColor}15`,
          }}
        >
          <div
            className="absolute top-3 left-4 flex items-center gap-2 pointer-events-none select-none"
          >
            <div
              className="p-1 rounded"
              style={{ backgroundColor: iconBg, color: accentColor }}
            >
              <IconComponent className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col">
              <span
                className="text-[10px] font-mono uppercase tracking-wider"
                style={{ color: accentColor, opacity: 0.7 }}
              >
                {typeLabel}
              </span>
              <span className="text-sm font-semibold text-foreground leading-tight">
                {nodeData.label}
              </span>
            </div>
          </div>
        </div>
      </>
    );
  }

  const getArrowIcon = (type: "source" | "target", position: Position) => {
    if (position === Position.Top) return type === "target" ? Icons.ArrowDown : Icons.ArrowUp;
    if (position === Position.Bottom) return type === "target" ? Icons.ArrowUp : Icons.ArrowDown;
    if (position === Position.Left) return type === "target" ? Icons.ArrowRight : Icons.ArrowLeft;
    if (position === Position.Right) return type === "target" ? Icons.ArrowLeft : Icons.ArrowRight;
    return Icons.ArrowDown;
  };

  const renderHandle = (type: "source" | "target", position: Position, id?: string) => {
    const Arrow = getArrowIcon(type, position);
    const isInput = type === "target";

    return (
      <Handle
        type={type}
        position={position}
        id={id}
        className={`
          !w-5 !h-5 !bg-background !border-2 transition-all flex items-center justify-center !rounded-full
          ${position === Position.Top ? "!top-0 !left-1/2 !-translate-x-1/2 !-translate-y-1/2" : ""}
          ${position === Position.Bottom ? "!bottom-0 !left-1/2 !-translate-x-1/2 !translate-y-1/2" : ""}
          ${position === Position.Left ? "!left-0 !top-1/2 !-translate-y-1/2 !-translate-x-1/2" : ""}
          ${position === Position.Right ? "!right-0 !top-1/2 !-translate-y-1/2 !translate-x-1/2" : ""}
          hover:!scale-110 ${config.hoverBorderClass}
        `}
        style={{ borderColor: accentColor }}
        title={isInput ? "Input" : "Output"}
      >
        <Arrow
          size={10}
          className="flow-handle-icon"
          style={{ color: accentColor }}
          strokeWidth={3}
        />
      </Handle>
    );
  };

  return (
    <>
      <NodeResizer
        minWidth={180}
        minHeight={110}
        isVisible={selected}
        lineStyle={{ borderColor: accentColor }}
        handleClassName="h-3 w-3 bg-white border-2 rounded"
        handleStyle={{ borderColor: accentColor }}
      />

      <div
        className={`
          ${config.containerClassName}
          min-h-[110px]
          ${selected ? config.selectedClassName : alwaysShowAccent ? "" : "border-border"}
          ${isDraft ? "border-dashed opacity-80" : ""}
          ${isFlowActive ? "ring-2 ring-emerald-400/70 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]" : ""}
        `}
        style={{
          borderColor: selected
            ? accentColor
            : alwaysShowAccent
              ? idleAccentBorderColor
              : undefined,
          boxShadow: selected
            ? selectedAccentShadow
            : alwaysShowAccent
              ? idleAccentShadow
              : undefined,
        }}
        onMouseEnter={(e) => {
          if (selected) return;
          e.currentTarget.style.borderColor = hoverAccentBorderColor;
          e.currentTarget.style.boxShadow = hoverAccentShadow;
        }}
        onMouseLeave={(e) => {
          if (selected) return;
          e.currentTarget.style.borderColor = idleAccentBorderColor ?? "";
          e.currentTarget.style.boxShadow = idleAccentShadow ?? "";
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-2 pb-2 border-b border-border/50">
          <div
            className="p-1.5 rounded"
            style={{ backgroundColor: iconBg, color: accentColor }}
          >
            <IconComponent className="w-4 h-4" />
          </div>

          <div
            className="text-xs font-mono text-muted-foreground uppercase tracking-wider truncate max-w-[100px]"
            title={typeLabel}
          >
            {typeLabel}
          </div>
        </div>

        {showActionToolbar && !suppressActionToolbar && (
          <div className="absolute right-[-3.75rem] top-0 -translate-y-[calc(100%+8px)]">
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white/96 p-1 shadow-lg backdrop-blur">
                  <button
                    type="button"
                    className={`
                      inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-slate-700 transition-colors
                      ${isReadOnly ? "cursor-not-allowed opacity-40" : "hover:bg-slate-100"}
                    `}
                    title={isReadOnly ? "Referenced nodes are read-only" : "Edit node"}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      if (isReadOnly) return;
                      handleAction(event, "edit");
                    }}
                    disabled={isReadOnly}
                  >
                    <Icons.Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-slate-700 transition-colors hover:bg-slate-100"
                    title="Copy node"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => handleAction(event, "copy")}
                  >
                    <Icons.Copy className="h-3.5 w-3.5" />
                  </button>
                  {INTERNAL_VIEWS_ENABLED && (
                    <button
                    type="button"
                    className={`
                      inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-slate-700 transition-colors
                      ${canOpenInternalViewAction ? "hover:bg-slate-100" : "cursor-not-allowed opacity-40"}
                    `}
                    title={canOpenInternalViewAction ? "Open internal view" : "Internal views are unavailable here"}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      if (!canOpenInternalViewAction) return;
                      handleAction(event, "open-internal-view");
                    }}
                    disabled={!canOpenInternalViewAction}
                  >
                    <Icons.Layers className="h-3.5 w-3.5" />
                  </button>
                  )}
                  <button
                    type="button"
                    className={`
                      inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-rose-600 transition-colors
                      ${isReadOnly ? "cursor-not-allowed opacity-40" : "hover:bg-rose-50"}
                    `}
                    title={isReadOnly ? "Referenced nodes cannot be deleted" : "Delete node"}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      if (isReadOnly) return;
                      handleAction(event, "delete");
                    }}
                    disabled={isReadOnly}
                  >
                    <Icons.Trash2 className="h-3.5 w-3.5" />
                  </button>
            </div>
          </div>
        )}

        {modelRuleTags.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1">
            {modelRuleTags.map((tag, index) => (
              <span
                key={`${tag.ruleName}:${tag.label}:${index}`}
                className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  borderColor: `${tag.color || "#6366f1"}70`,
                  backgroundColor: `${tag.color || "#6366f1"}16`,
                  color: tag.color || "#6366f1",
                }}
                title={`Derived by ${tag.origin === "meta" ? "meta rule" : tag.origin === "instance" ? "instance rule" : "model rule"}: ${tag.ruleName}`}
              >
                {tag.label}
              </span>
            ))}
          </div>
        ) : null}

        {ruleStatusItems.length > 0 ? (
          <div className="mb-2 flex items-center justify-between gap-2">
            <div
              className="inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] font-semibold uppercase tracking-wide"
              style={{
                borderColor: hasMixedRuleStates
                  ? "rgba(217, 119, 6, 0.45)"
                  : unfulfilledCount > 0
                    ? "rgba(185, 28, 28, 0.45)"
                    : "rgba(21, 128, 61, 0.45)",
                backgroundColor: hasMixedRuleStates
                  ? "rgba(217, 119, 6, 0.12)"
                  : unfulfilledCount > 0
                    ? "rgba(185, 28, 28, 0.12)"
                    : "rgba(21, 128, 61, 0.12)",
                color: hasMixedRuleStates
                  ? "#b45309"
                  : unfulfilledCount > 0
                    ? "#b91c1c"
                    : "#15803d",
              }}
              title={statusSummary}
            >
              {hasMixedRuleStates ? (
                <Icons.BadgeAlert className="h-3.5 w-3.5" />
              ) : unfulfilledCount > 0 ? (
                <Icons.AlertTriangle className="h-3.5 w-3.5" />
              ) : (
                <Icons.BadgeCheck className="h-3.5 w-3.5" />
              )}
              <span>{fulfilledCount}/{ruleStatusItems.length}</span>
            </div>
            {ruleStateLabel ? (
              <span className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                {ruleStateLabel}
              </span>
            ) : null}
          </div>
        ) : null}

        <div
          className={`${
            hasVisibleDescription
              ? ""
              : "flex min-h-[42px] items-center"
          }`}
        >
          <div
            className={`font-semibold text-foreground ${
              hasVisibleDescription
                ? "text-sm"
                : "text-lg leading-tight"
            }`}
          >
            {nodeData.label}
          </div>
        </div>

        {hasVisibleDescription ? (
          <div className="text-xs text-muted-foreground mt-1 truncate max-w-[150px]">
            {description}
          </div>
        ) : null}

        {(isFlowStart || isFlowEnd) && (
          <div className="absolute left-0 top-0 -translate-y-[calc(100%+4px)] -translate-x-1 flex flex-col items-start gap-1 pointer-events-none">
            {isFlowStart && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded bg-emerald-500/20 text-emerald-700 shadow-sm">
                Start
              </span>
            )}
            {isFlowEnd && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded bg-rose-500/20 text-rose-700 shadow-sm">
                End
              </span>
            )}
          </div>
        )}
        {flowTicks.length > 0 && (
          <div className="absolute right-0 top-0 -translate-y-[calc(100%+4px)] translate-x-1 flex flex-col items-end gap-1 pointer-events-none">
            <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded bg-slate-900 text-slate-100 shadow-sm">
              T{flowTicks.join(",")}
            </span>
          </div>
        )}

        {/* Handles */}
        {renderHandle("source", Position.Bottom)}
        {renderHandle("target", Position.Top)}
        {renderHandle("source", Position.Top, "top-source")}
        {renderHandle("target", Position.Left, "left")}
        {renderHandle("source", Position.Left, "left-source")}
        {renderHandle("target", Position.Bottom, "bottom-target")}
        {renderHandle("source", Position.Right, "right")}
        {renderHandle("target", Position.Right, "right-target")}
      </div>
    </>
  );
};

export default BasePartNode;
