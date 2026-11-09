import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { NodeAttribute } from "../../types";
import { attributeTypes, sanitizeAttributeOptions } from "./style-presets";

interface AttributeSummaryRowProps {
  attr: NodeAttribute;
  index: number;
  /** Instance elements set values right in the list. */
  valueEditable: boolean;
  /** Calculated value of a derived attribute, or its error. */
  derived?: { value?: string; error?: string };
  /** Label for the value: "Value" on instances, "Default" on types. */
  valueLabel: string;
  onValueChange: (value: string) => void;
  onEdit: () => void;
  onRemove: () => void;
}

const typeLabel = (type: NodeAttribute["type"]) =>
  attributeTypes.find((candidate) => candidate.value === type)?.label ?? type;

/** Shown value of an attribute, as text. */
function formatValue(attr: NodeAttribute, derived?: { value?: string; error?: string }) {
  if (attr.type === "derived") return derived?.error ? "Invalid formula" : derived?.value || "–";
  if (attr.type === "boolean") return attr.value === "true" ? "Yes" : "No";
  return attr.value?.trim() || "–";
}

/**
 * One attribute in short form: name, description and value at a glance.
 * Its definition opens in the attribute editor.
 */
export function AttributeSummaryRow({
  attr,
  index,
  valueEditable,
  derived,
  valueLabel,
  onValueChange,
  onEdit,
  onRemove,
}: AttributeSummaryRowProps) {
  const unit = attr.type === "number" || attr.type === "derived" ? attr.unit.trim() : "";
  const options = sanitizeAttributeOptions(attr.options);
  const description = attr.description?.trim();

  const valueField = () => {
    if (attr.type === "boolean") {
      return (
        <Switch
          checked={attr.value === "true"}
          onCheckedChange={(checked) => onValueChange(checked ? "true" : "false")}
          aria-label={`${attr.name} ${valueLabel.toLowerCase()}`}
          data-testid={`input-attr-value-${index}`}
        />
      );
    }
    if (attr.type === "list") {
      return (
        <Select value={options.includes(attr.value) ? attr.value : undefined} onValueChange={onValueChange}>
          <SelectTrigger className="h-8 w-[150px] text-sm" data-testid={`input-attr-value-${index}`}>
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return (
      <div className="flex items-center gap-1.5">
        <Input
          type={attr.type === "number" ? "number" : attr.type === "date" ? "date" : "text"}
          value={attr.value}
          onChange={(event) => onValueChange(event.target.value)}
          className={cn("h-8 text-sm", attr.type === "string" ? "w-[180px]" : "w-[110px]")}
          aria-label={`${attr.name} ${valueLabel.toLowerCase()}`}
          data-testid={`input-attr-value-${index}`}
        />
        {unit ? <span className="w-10 text-xs text-muted-foreground">{unit}</span> : null}
      </div>
    );
  };

  return (
    <div
      className="group flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5 hover:border-muted-foreground/30"
      data-testid={`attribute-summary-${index}`}
    >
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={onEdit}
        title="Edit the attribute's definition"
        data-testid={`button-attr-open-${index}`}
      >
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium" data-testid={`attribute-name-${index}`}>
            {attr.name || "Unnamed"}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground">{typeLabel(attr.type)}</span>
        </div>
        {description ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground" data-testid={`attribute-description-${index}`}>
            {description}
          </p>
        ) : null}
        {!valueEditable || attr.type === "derived" ? (
          <p className={cn("mt-1 text-sm", derived?.error && "text-destructive")}>
            <span className="text-xs text-muted-foreground">{valueLabel}: </span>
            {formatValue(attr, derived)}
            {unit && formatValue(attr, derived) !== "–" ? ` ${unit}` : ""}
          </p>
        ) : null}
      </button>
      {valueEditable && attr.type !== "derived" ? <div className="shrink-0 pt-0.5">{valueField()}</div> : null}
      <div className="flex shrink-0 gap-0.5 opacity-60 group-hover:opacity-100">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onEdit}
          aria-label={`Edit ${attr.name || "attribute"}`}
          data-testid={`button-attr-edit-${index}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 hover:text-destructive"
          onClick={onRemove}
          aria-label={`Remove ${attr.name || "attribute"}`}
          data-testid={`button-remove-attribute-${index}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
