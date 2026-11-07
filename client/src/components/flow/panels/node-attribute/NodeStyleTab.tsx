import { Ellipsis } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { nodeColors } from "./style-presets";
import { extendedNodeIcons, quickNodeIcons } from "./icon-registry";

export interface NodeStyleTabProps {
  canInheritStyle: boolean;
  inheritStyle: boolean;
  currentIcon: string;
  currentColor?: string;
  isCustomColor: boolean;
  showExtendedIcons: boolean;
  onInheritStyleChange: (checked: boolean) => void;
  onIconChange: (icon: string) => void;
  onToggleExtendedIcons: () => void;
  onColorChange: (color: string) => void;
}

export function NodeStyleTab({
  canInheritStyle,
  inheritStyle,
  currentIcon,
  currentColor,
  isCustomColor,
  showExtendedIcons,
  onInheritStyleChange,
  onIconChange,
  onToggleExtendedIcons,
  onColorChange,
}: NodeStyleTabProps) {
  const chooseIcon = (value: string) => {
    if (inheritStyle && canInheritStyle) onInheritStyleChange(false);
    onIconChange(value);
  };

  return (
    <div className="space-y-6 py-4">
      <div className="space-y-6">
        {canInheritStyle && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="inherit-style"
              checked={inheritStyle}
              onCheckedChange={(checked) => onInheritStyleChange(Boolean(checked))}
            />
            <Label htmlFor="inherit-style">Match type styling</Label>
          </div>
        )}
        <div className="space-y-3">
          <Label>Icon</Label>
          <div className="grid grid-cols-4 gap-2">
            {quickNodeIcons.map(({ value, icon: IconComponent }) => (
              <Button
                key={value}
                type="button"
                variant={currentIcon === value ? "default" : "outline"}
                className={cn(
                  "h-11 w-full",
                  currentIcon === value
                    ? "border-primary"
                    : "hover:border-muted-foreground/30",
                )}
                onClick={() => chooseIcon(value)}
                data-testid={`button-icon-${value}`}
              >
                <IconComponent className="h-4 w-4" />
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full hover:border-muted-foreground/30"
              onClick={onToggleExtendedIcons}
              data-testid="button-icon-more"
            >
              <Ellipsis className="h-4 w-4" />
            </Button>
          </div>
          {showExtendedIcons && (
            <div className="grid grid-cols-5 gap-2">
              {extendedNodeIcons.map(({ value, icon: IconComponent }) => (
                <Button
                  key={value}
                  type="button"
                  variant={currentIcon === value ? "default" : "outline"}
                  className={cn(
                    "h-10 w-full",
                    currentIcon === value
                      ? "border-primary"
                      : "hover:border-muted-foreground/30",
                  )}
                  onClick={() => chooseIcon(value)}
                  data-testid={`button-icon-${value}`}
                >
                  <IconComponent className="h-4 w-4" />
                </Button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>Accent Color</Label>
          <div className="grid grid-cols-4 gap-2">
            {nodeColors.map((color) => (
              <Button
                key={color.label}
                variant={currentColor === color.value ? "default" : "outline"}
                className={cn(
                  "h-10 w-full border-2 p-0",
                  currentColor === color.value
                    ? "border-primary"
                    : "border-transparent hover:border-muted-foreground/30",
                )}
                disabled={inheritStyle && canInheritStyle}
                onClick={() => {
                  if (inheritStyle) onInheritStyleChange(false);
                  onColorChange(color.value);
                }}
                title={color.label}
                data-testid={`button-color-${color.label}`}
              >
                {color.label === "Default" ? (
                  <div
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full border border-black/10 text-[10px] font-bold transition-transform",
                      currentColor === color.value
                        ? "scale-110 bg-muted text-primary"
                        : "scale-100 bg-background text-muted-foreground",
                    )}
                  >
                    D
                  </div>
                ) : (
                  <>
                    <div
                      className={cn(
                        "h-6 w-6 rounded-full border border-black/10 transition-transform",
                        currentColor === color.value ? "scale-110" : "scale-100",
                      )}
                      style={{ backgroundColor: color.value || "currentColor" }}
                    />
                    {currentColor === color.value && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-white shadow-sm" />
                      </div>
                    )}
                  </>
                )}
              </Button>
            ))}
            <Button
              variant={isCustomColor ? "default" : "outline"}
              className={cn(
                "relative h-10 w-full border-2 p-0",
                isCustomColor
                  ? "border-primary"
                  : "border-transparent hover:border-muted-foreground/30",
              )}
              disabled={inheritStyle && canInheritStyle}
              title="Custom color"
              data-testid="button-color-custom"
            >
              <div className="flex h-full w-full items-center justify-center gap-2">
                <div
                  className={cn(
                    "h-6 w-6 rounded-full border border-black/10 transition-transform",
                    isCustomColor ? "scale-110" : "scale-100",
                  )}
                  style={{ backgroundColor: currentColor || "#3b82f6" }}
                />
                <span className="text-xs font-medium text-muted-foreground">
                  Custom
                </span>
              </div>
              <input
                type="color"
                value={currentColor || "#3b82f6"}
                onChange={(event) => {
                  if (inheritStyle) onInheritStyleChange(false);
                  onColorChange(event.target.value);
                }}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="Pick custom color"
                disabled={inheritStyle && canInheritStyle}
              />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}