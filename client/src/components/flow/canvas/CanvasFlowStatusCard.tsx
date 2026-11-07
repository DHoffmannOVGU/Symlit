import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface CanvasFlowStatusCardProps {
  completed: boolean;
  startLabel?: string;
  endLabel?: string;
  currentTick: number;
  maxTick: number | null;
}

export function CanvasFlowStatusCard({
  completed,
  startLabel,
  endLabel,
  currentTick,
  maxTick,
}: CanvasFlowStatusCardProps) {
  return (
    <div className="absolute left-4 top-4 z-20">
      <Card className="w-[260px] shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {completed ? "Flow completed" : "Flow in progress"}
          </CardTitle>
          <CardDescription className="text-xs">
            This is a mock run card.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-xs">
          <div>
            <span className="font-semibold">Start:</span>{" "}
            {startLabel || "Not set"}
          </div>
          <div>
            <span className="font-semibold">End:</span>{" "}
            {endLabel || "Not set"}
          </div>
          <div>
            <span className="font-semibold">Tick:</span> {currentTick}
            {maxTick !== null ? ` / ${maxTick}` : ""}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}