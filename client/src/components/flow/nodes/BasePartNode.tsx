import React, { useRef } from "react";
import { Handle, Position, NodeProps, NodeResizer } from "@xyflow/react";
import { getNodeIcon } from "@/lib/node-icons";
import { AlertTriangle as AlertTriangleIcon, BadgeAlert as BadgeAlertIcon, BadgeCheck as BadgeCheckIcon, Copy as CopyIcon, Pencil as PencilIcon, Trash2 as Trash2Icon } from "lucide-react";
import { dispatchDiagramEvent } from "@/lib/diagram-events";
import { elementCardAppearance, pickElementStyle, showsDescription } from "@/lib/element-style";
import { useFitText } from "@/lib/fit-text";

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
  suppressActionToolbar?: boolean;
  showDescription?: boolean;
  hasFixedSize?: boolean;
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
  const IconComponent = getNodeIcon(nodeData.icon);
  const accentColor =
    nodeData.ruleAccentColor || nodeData.color || config.defaultAccentColor;
  const appearance = elementCardAppearance(pickElementStyle(nodeData), nodeData.color || config.defaultAccentColor);

  const onSolid = appearance.onSolid;
  const iconBg = onSolid ? "rgba(255,255,255,0.22)" : nodeData.color ? `${accentColor}25` : config.defaultIconBg;
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
  const alwaysShowAccent = Boolean(nodeData.alwaysShowAccent);
  const ruleEmphasis = nodeData.ruleEmphasis || "none";
  const ruleStateLabel = nodeData.ruleStateLabel?.trim();
  const ruleStatusItems = nodeData.ruleStatusItems || [];
  const modelRuleTags = nodeData.modelRuleTags || [];
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
  const suppressActionToolbar = Boolean(nodeData.suppressActionToolbar);
  const elementStyle = pickElementStyle(nodeData);
  const description = nodeData.description?.trim();
  const hasVisibleDescription =
    showsDescription(elementStyle, nodeData.showDescription !== false) && Boolean(description);
  // Resized by hand: the text has to fit the box. Otherwise the card grows,
  // up to a few lines; in both cases text that is still too long gets smaller, then cut.
  const fixedSize = Boolean(nodeData.hasFixedSize);
  const labelRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const labelMax = hasVisibleDescription ? 14 : 18;
  useFitText(labelRef, `${nodeData.label}|${fixedSize}|${hasVisibleDescription}`, { maxSize: labelMax, minSize: 11, lineHeight: 1.25 });
  useFitText(descriptionRef, `${description}|${fixedSize}`, { maxSize: 12, minSize: 9, lineHeight: 1.35 }, hasVisibleDescription);

  const handleAction = (
    event: React.MouseEvent<HTMLButtonElement>,
    action: "edit" | "copy" | "delete",
  ) => {
    event.preventDefault();
    event.stopPropagation();
    dispatchDiagramEvent("diagram-node-action-request", {
      nodeId: id,
      action,
    });
  };

  // One handle per side. Connections can start and end at any of them
  // (ReactFlow runs in loose connection mode), so the direction of a
  // relationship comes from where the user starts dragging.
  const renderHandle = (position: Position) => (
    <Handle
      type="source"
      position={position}
      id={position}
      className="flow-side-handle !w-4 !h-4 !bg-background !border-2 !rounded-full"
      style={{ borderColor: accentColor }}
      title="Drag to connect"
    />
  );

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
          min-h-[110px] flex flex-col
          ${fixedSize ? "" : "max-w-[300px]"}
          ${selected ? config.selectedClassName : alwaysShowAccent ? "" : "border-border"}
          ${isDraft ? "border-dashed opacity-80" : ""}
          ${isFlowActive ? "ring-2 ring-emerald-400/70 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]" : ""}
        `}
        data-testid="element-card"
        data-fixed-size={fixedSize ? "true" : "false"}
        style={{
          borderWidth: appearance.borderWidth,
          borderStyle: isDraft ? "dashed" : appearance.borderStyle,
          borderRadius: appearance.borderRadius,
          backgroundColor: appearance.backgroundColor,
          ...(appearance.borderRadius > 100 ? { paddingLeft: 28, paddingRight: 28 } : {}),
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
        <div className={`flex items-center justify-between gap-3 mb-2 pb-2 border-b ${onSolid ? "border-white/25" : "border-border/50"}`}>
          <div
            className="p-1.5 rounded"
            style={{ backgroundColor: iconBg, color: onSolid ? "#ffffff" : accentColor }}
          >
            <IconComponent className="w-4 h-4" />
          </div>

          {appearance.showTypeLabel ? (
            <div
              className={`text-xs font-mono uppercase tracking-wider truncate max-w-[100px] ${onSolid ? "text-white/80" : "text-muted-foreground"}`}
              title={typeLabel}
              data-testid="element-type-label"
            >
              {typeLabel}
            </div>
          ) : null}
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
                    <PencilIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-slate-700 transition-colors hover:bg-slate-100"
                    title="Copy node"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => handleAction(event, "copy")}
                  >
                    <CopyIcon className="h-3.5 w-3.5" />
                  </button>
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
                    <Trash2Icon className="h-3.5 w-3.5" />
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
                <BadgeAlertIcon className="h-3.5 w-3.5" />
              ) : unfulfilledCount > 0 ? (
                <AlertTriangleIcon className="h-3.5 w-3.5" />
              ) : (
                <BadgeCheckIcon className="h-3.5 w-3.5" />
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
          className={`flex min-h-0 flex-1 flex-col ${hasVisibleDescription ? "" : "justify-center min-h-[42px]"}`}
        >
          <div
            ref={labelRef}
            className={`shrink-0 overflow-hidden break-words font-semibold ${onSolid ? "text-white" : "text-foreground"}`}
            style={{
              maxHeight: fixedSize && !hasVisibleDescription
                ? "100%"
                // With a description, the name gets at most two lines so the description keeps room.
                : `${(hasVisibleDescription ? 2 : 3) * labelMax * 1.25}px`,
            }}
            title={nodeData.label}
            data-testid="element-label"
          >
            {nodeData.label}
          </div>
          {hasVisibleDescription ? (
            <div
              ref={descriptionRef}
              className={`mt-1 overflow-hidden whitespace-pre-line break-words ${fixedSize ? "min-h-0 flex-1" : ""} ${onSolid ? "text-white/80" : "text-muted-foreground"}`}
              style={fixedSize ? undefined : { maxHeight: `${8 * 12 * 1.35}px` }}
              title={description}
              data-testid="element-description"
            >
              {description}
            </div>
          ) : null}
        </div>

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
        {renderHandle(Position.Top)}
        {renderHandle(Position.Right)}
        {renderHandle(Position.Bottom)}
        {renderHandle(Position.Left)}
      </div>
    </>
  );
};

export default BasePartNode;
