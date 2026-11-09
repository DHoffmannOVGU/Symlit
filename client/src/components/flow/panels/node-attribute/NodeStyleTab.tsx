import { ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { extendedNodeIcons, getNodeIcon, quickNodeIcons } from "@/lib/node-icons";
import {
  borderStyles,
  borderWidths,
  DEFAULT_ELEMENT_STYLE,
  elementCardAppearance,
  elementFills,
  elementShapes,
  type ElementStyle,
} from "@/lib/element-style";
import { nodeColors } from "./style-presets";

export interface NodeStyleTabProps {
  /** The element is typed, so it can match its type's style. */
  canInheritStyle: boolean;
  inheritStyle: boolean;
  /** Name of the element's type, for the "match" explanation. */
  typeLabel: string;
  /** The style the element shows now (its type's while matching). */
  style: ElementStyle;
  /** Colour used when the style has none (the kind's default). */
  defaultColor: string;
  onInheritStyleChange: (checked: boolean) => void;
  /** Changes some settings; the panel stops matching the type. */
  onStyleChange: (patch: ElementStyle) => void;
}

const allIcons = [...quickNodeIcons, ...extendedNodeIcons];

const shapeLabels = { square: "Square", rounded: "Rounded", pill: "Pill" } as const;
const fillLabels = { plain: "Plain", tint: "Tint", solid: "Solid" } as const;
const borderStyleLabels = { solid: "Solid", dashed: "Dashed", dotted: "Dotted" } as const;

/** A small card that shows the style as it will look on the canvas. */
function StylePreview({ style, color, typeLabel }: { style: ElementStyle; color: string; typeLabel: string }) {
  const look = elementCardAppearance(style, color);
  const Icon = getNodeIcon(style.icon);
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed bg-muted/30 p-4" data-testid="style-preview">
      <div
        className="w-[200px] bg-card px-4 py-3 shadow-sm"
        style={{
          borderWidth: look.borderWidth,
          borderStyle: look.borderStyle,
          borderColor: `${color}B0`,
          borderRadius: look.borderRadius,
          backgroundColor: look.backgroundColor,
          ...(look.borderRadius > 100 ? { paddingLeft: 28, paddingRight: 28 } : {}),
        }}
      >
        <div className={cn("mb-2 flex items-center justify-between gap-3 border-b pb-2", look.onSolid ? "border-white/25" : "border-border/50")}>
          <div
            className="rounded p-1.5"
            style={{ backgroundColor: look.onSolid ? "rgba(255,255,255,0.22)" : `${color}25`, color: look.onSolid ? "#fff" : color }}
          >
            <Icon className="h-4 w-4" />
          </div>
          {look.showTypeLabel ? (
            <span className={cn("truncate font-mono text-xs uppercase tracking-wider", look.onSolid ? "text-white/80" : "text-muted-foreground")}>
              {typeLabel}
            </span>
          ) : null}
        </div>
        <div className={cn("text-lg font-semibold leading-tight", look.onSolid ? "text-white" : "text-foreground")}>Preview</div>
      </div>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-3">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Choice<T extends string | number>({
  value,
  options,
  label,
  render,
  onChange,
  testId,
}: {
  value: T;
  options: readonly T[];
  label: (option: T) => string;
  render?: (option: T) => React.ReactNode;
  onChange: (option: T) => void;
  testId: string;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={String(value)}
      onValueChange={(next) => {
        const match = options.find((option) => String(option) === next);
        if (match !== undefined) onChange(match);
      }}
      className="justify-start"
      data-testid={testId}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={String(option)}
          value={String(option)}
          aria-label={label(option)}
          title={label(option)}
          className="min-w-10 px-2.5 data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
          data-testid={`${testId}-${option}`}
        >
          {render ? render(option) : label(option)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function NodeStyleTab({
  canInheritStyle,
  inheritStyle,
  typeLabel,
  style,
  defaultColor,
  onInheritStyleChange,
  onStyleChange,
}: NodeStyleTabProps) {
  const color = style.color || defaultColor;
  const CurrentIcon = getNodeIcon(style.icon);
  const colorName = nodeColors.find((preset) => preset.value && preset.value === style.color)?.label
    ?? (style.color ? style.color.toUpperCase() : "Default");

  return (
    <div className="space-y-5 py-4">
      {canInheritStyle && (
        <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-3">
          <div className="space-y-0.5">
            <Label htmlFor="inherit-style">Match type styling</Label>
            <p className="text-xs text-muted-foreground">
              {inheritStyle
                ? `Looks like every ${typeLabel} and follows changes to the type. Change a setting below to give this element its own style.`
                : `This element has its own style. Turn on to use the style of ${typeLabel} again.`}
            </p>
          </div>
          <Switch
            id="inherit-style"
            checked={inheritStyle}
            onCheckedChange={(checked) => onInheritStyleChange(Boolean(checked))}
            data-testid="switch-inherit-style"
          />
        </div>
      )}

      <StylePreview style={style} color={color} typeLabel={typeLabel} />

      <div className="space-y-3">
        <SettingRow label="Icon">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-2.5 text-sm hover:bg-muted"
                data-testid="button-pick-icon"
              >
                <CurrentIcon className="h-4 w-4" style={{ color }} />
                <span>{style.icon || "Box"}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[296px] p-2" align="start">
              <div className="grid max-h-[260px] grid-cols-7 gap-1 overflow-y-auto">
                {allIcons.map(({ value, icon: IconComponent }) => (
                  <button
                    key={value}
                    type="button"
                    title={value}
                    aria-label={value}
                    aria-pressed={style.icon === value}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-md border border-transparent hover:bg-muted",
                      style.icon === value && "border-primary bg-primary/10 text-primary",
                    )}
                    onClick={() => onStyleChange({ icon: value })}
                    data-testid={`button-icon-${value}`}
                  >
                    <IconComponent className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </SettingRow>

        <SettingRow label="Colour">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-2.5 text-sm hover:bg-muted"
                data-testid="button-pick-color"
              >
                <span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: color }} />
                <span>{colorName}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[232px] p-3" align="start">
              <div className="grid grid-cols-4 gap-2">
                {nodeColors.map((preset) => {
                  const active = (style.color ?? "") === preset.value;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      title={preset.label}
                      aria-label={preset.label}
                      aria-pressed={active}
                      className={cn(
                        "flex h-9 items-center justify-center rounded-md border-2 border-transparent hover:border-muted-foreground/30",
                        active && "border-primary",
                      )}
                      onClick={() => onStyleChange({ color: preset.value || undefined })}
                      data-testid={`button-color-${preset.label}`}
                    >
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-black/10 text-[10px] font-bold text-muted-foreground"
                        style={{ backgroundColor: preset.value || defaultColor }}
                      >
                        {preset.value ? null : <span className="text-white">D</span>}
                      </span>
                    </button>
                  );
                })}
                <label
                  className="relative flex h-9 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/30 text-[10px] font-medium text-muted-foreground hover:border-muted-foreground/60"
                  title="Custom colour"
                >
                  Custom
                  <input
                    type="color"
                    value={color}
                    onChange={(event) => onStyleChange({ color: event.target.value })}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="Pick custom colour"
                    data-testid="input-color-custom"
                  />
                </label>
              </div>
            </PopoverContent>
          </Popover>
        </SettingRow>

        <SettingRow label="Border">
          <div className="flex flex-wrap gap-2">
            <Choice
              testId="choice-border-width"
              value={style.borderWidth ?? DEFAULT_ELEMENT_STYLE.borderWidth}
              options={borderWidths}
              label={(width) => `${width} px`}
              render={(width) => <span className="block w-5 rounded-full bg-current" style={{ height: width }} />}
              onChange={(borderWidth) => onStyleChange({ borderWidth })}
            />
            <Choice
              testId="choice-border-style"
              value={style.borderStyle ?? DEFAULT_ELEMENT_STYLE.borderStyle}
              options={borderStyles}
              label={(option) => borderStyleLabels[option]}
              render={(option) => <span className="block w-6 border-t-2 border-current" style={{ borderTopStyle: option }} />}
              onChange={(borderStyle) => onStyleChange({ borderStyle })}
            />
          </div>
        </SettingRow>

        <SettingRow label="Shape">
          <Choice
            testId="choice-shape"
            value={style.shape ?? DEFAULT_ELEMENT_STYLE.shape}
            options={elementShapes}
            label={(option) => shapeLabels[option]}
            onChange={(shape) => onStyleChange({ shape })}
          />
        </SettingRow>

        <SettingRow label="Fill">
          <Choice
            testId="choice-fill"
            value={style.fill ?? DEFAULT_ELEMENT_STYLE.fill}
            options={elementFills}
            label={(option) => fillLabels[option]}
            onChange={(fill) => onStyleChange({ fill })}
          />
        </SettingRow>

        <SettingRow label="Type label">
          <div className="flex items-center gap-2">
            <Switch
              id="show-type-label"
              checked={style.showTypeLabel ?? DEFAULT_ELEMENT_STYLE.showTypeLabel}
              onCheckedChange={(checked) => onStyleChange({ showTypeLabel: Boolean(checked) })}
              data-testid="switch-show-type-label"
            />
            <Label htmlFor="show-type-label" className="text-sm font-normal">
              Show the type name on the card
            </Label>
          </div>
        </SettingRow>
      </div>
    </div>
  );
}
