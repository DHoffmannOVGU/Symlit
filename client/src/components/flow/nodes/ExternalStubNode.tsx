import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

interface ExternalStubData {
  label: string;
  direction: "input" | "output";
  accentColor?: string;
  side?: "left" | "right" | "top" | "bottom";
}

const sideToPosition: Record<"left" | "right" | "top" | "bottom", Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};

const oppositeSide: Record<"left" | "right" | "top" | "bottom", "left" | "right" | "top" | "bottom"> = {
  left: "right",
  right: "left",
  top: "bottom",
  bottom: "top",
};

const ExternalStubNode = ({ data }: NodeProps) => {
  const stubData = data as unknown as ExternalStubData;
  const isInput = stubData.direction === "input";
  const accentColor = stubData.accentColor ?? "hsl(var(--muted-foreground))";
  const side = stubData.side ?? "left";
  const innerSide = oppositeSide[side];
  const innerPosition = sideToPosition[innerSide];

  return (
    <>
      <Handle
        type={isInput ? "source" : "target"}
        position={innerPosition}
        id="stub-inner"
        style={{ opacity: 0, pointerEvents: "none" }}
        isConnectable={false}
      />
      <div
        className="h-full w-full rounded-md border bg-background/90 px-2 py-1 text-[11px] shadow-sm"
        style={{ borderColor: accentColor }}
      >
        <span
          className="mr-2 font-mono uppercase tracking-wide"
          style={{ color: accentColor }}
        >
          {isInput ? "IN" : "OUT"}
        </span>
        <span className="font-medium text-foreground truncate">{stubData.label}</span>
      </div>
    </>
  );
};

export default ExternalStubNode;
