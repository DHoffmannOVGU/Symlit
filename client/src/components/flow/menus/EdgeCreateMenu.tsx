import * as Icons from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { ProjectType } from "@shared/schema";

type PartTypeOption = {
  id: string;
  label: string;
  icon?: string;
  color?: string;
};

type EdgeCreateMenuProps = {
  open: boolean;
  position?: { x: number; y: number };
  projectType: ProjectType;
  partTypeOptions: PartTypeOption[];
  metamodelDefaultType?: PartTypeOption;
  limitToValidTargets?: boolean;
  onLimitToValidTargetsChange?: (next: boolean) => void;
  onSelectDefault: () => void;
  onSelectType: (option: PartTypeOption) => void;
  onCancel: () => void;
};

export function EdgeCreateMenu({
  open,
  position,
  projectType,
  partTypeOptions,
  metamodelDefaultType,
  limitToValidTargets,
  onLimitToValidTargetsChange,
  onSelectDefault,
  onSelectType,
  onCancel,
}: EdgeCreateMenuProps) {
  if (!open || !position) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onCancel} />
      <div
        className="fixed z-50 w-60 rounded-lg border bg-popover p-2 shadow-lg"
        style={{ left: position.x, top: position.y }}
      >
        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
          Create node
        </div>
        <button
          type="button"
          className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
          onClick={onSelectDefault}
        >
          {projectType === "metamodel"
            ? `${metamodelDefaultType?.label ?? "Object"} (default)`
            : "Object (default)"}
        </button>
        {projectType === "instance" && (
          <>
            <div className="flex items-center justify-between gap-2 px-2 py-1 text-xs text-muted-foreground">
              <span>Limit to valid targets</span>
              <Switch
                checked={!!limitToValidTargets}
                onCheckedChange={(next) => onLimitToValidTargetsChange?.(next)}
              />
            </div>
            {partTypeOptions.length === 0 ? (
              <div className="px-2 py-2 text-xs text-muted-foreground">
                No valid target types for this relationship.
              </div>
            ) : (
              partTypeOptions.map((option) => {
                const IconComponent =
                  (Icons as any)[option.icon || "Box"] || Icons.Box;
                const iconColor = option.color || "hsl(var(--foreground))";
                const iconBg = option.color
                  ? `${option.color}20`
                  : "hsl(var(--muted))";
                return (
                  <button
                    key={option.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                    onClick={() => onSelectType(option)}
                  >
                    <span
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md"
                      style={{ backgroundColor: iconBg, color: iconColor }}
                    >
                      <IconComponent className="h-3.5 w-3.5" />
                    </span>
                    <span className="truncate">{option.label}</span>
                  </button>
                );
              })
            )}
          </>
        )}
        <div className="px-2 pt-1 text-xs text-muted-foreground">
          Press Esc or click outside to cancel.
        </div>
      </div>
    </>
  );
}
