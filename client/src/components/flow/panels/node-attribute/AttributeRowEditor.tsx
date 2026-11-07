import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  Trash2,
  X,
  Info,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NodeAttribute } from "../../types";
import {
  attributeTypes,
  sanitizeAttributeOptions,
} from "./style-presets";
import {
  extractFormulaReferences,
  getDisplayFormula,
  getStoredFormulaFromDisplay,
} from "../../utils/attribute-formula";
import type { FormulaAutocompleteState } from "./formula-utils";

export type DerivedAttributeStateMap = globalThis.Map<
  string,
  { value?: string; references: string[]; error?: string }
>;

export interface AttributeRowEditorProps {
  attr: NodeAttribute;
  index: number;
  attributes: NodeAttribute[];
  isCollapsed: boolean;
  isDescriptionOpen: boolean;
  duplicateAttributeNameSet: Set<string>;
  attributeValueLabel: string;
  listOptionDraft: string;
  formulaDrafts: Record<string, string>;
  formulaAutocomplete: FormulaAutocompleteState | null;
  derivedAttributeState: DerivedAttributeStateMap;
  formulaTextareaRefs: React.MutableRefObject<
    Record<string, HTMLTextAreaElement | null>
  >;
  formatAttributeSummary: (attr: NodeAttribute) => string;
  onToggleCollapsed: (id: string) => void;
  onToggleDescription: (id: string) => void;
  onRemoveAttribute: (id: string) => void;
  onAttributeChange: (
    id: string,
    field: keyof NodeAttribute,
    value: string,
  ) => void;
  onAttributeTypeChange: (id: string, type: NodeAttribute["type"]) => void;
  onListOptionDraftChange: (id: string, value: string) => void;
  onAddListOption: (id: string) => void;
  onRemoveListOption: (id: string, option: string) => void;
  onAutoResize: (el: HTMLTextAreaElement) => void;
  setFormulaDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setFormulaAutocomplete: Dispatch<
    SetStateAction<FormulaAutocompleteState | null>
  >;
  updateFormulaAutocomplete: (
    id: string,
    text: string,
    cursor: number,
  ) => void;
  applyFormulaAutocomplete: (id: string, name: string) => void;
}

export function AttributeRowEditor({
  attr,
  index,
  attributes,
  isCollapsed,
  isDescriptionOpen,
  duplicateAttributeNameSet,
  attributeValueLabel,
  listOptionDraft,
  formulaDrafts,
  formulaAutocomplete,
  derivedAttributeState,
  formulaTextareaRefs,
  formatAttributeSummary,
  onToggleCollapsed,
  onToggleDescription,
  onRemoveAttribute,
  onAttributeChange,
  onAttributeTypeChange,
  onListOptionDraftChange,
  onAddListOption,
  onRemoveListOption,
  onAutoResize,
  setFormulaDrafts,
  setFormulaAutocomplete,
  updateFormulaAutocomplete,
  applyFormulaAutocomplete,
}: AttributeRowEditorProps) {
  const formulaSuggestions =
    formulaAutocomplete?.attrId === attr.id
      ? attributes
          .filter(
            (candidate) =>
              candidate.id !== attr.id && candidate.name.trim().length > 0,
          )
          .filter((candidate) =>
            candidate.name
              .trim()
              .toLowerCase()
              .includes(formulaAutocomplete.query.trim().toLowerCase()),
          )
          .slice(0, 8)
      : [];

  return (
    <div
      className="p-3 border rounded-lg bg-muted/30 space-y-3"
      data-testid={`attribute-row-${index}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => onToggleCollapsed(attr.id)}
            data-testid={`button-attr-collapse-${index}`}
            aria-label={isCollapsed ? "Expand attribute" : "Collapse attribute"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </Button>
          <div className="min-w-0">
            <div className="text-xs font-medium text-muted-foreground">
              Attribute {index + 1}
            </div>
            {isCollapsed && (
              <div
                className="truncate text-sm text-foreground"
                title={formatAttributeSummary(attr)}
              >
                {formatAttributeSummary(attr)}
              </div>
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => onToggleDescription(attr.id)}
                data-testid={`button-attr-description-toggle-${index}`}
                aria-label="Toggle attribute description"
              >
                <Info className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {attr.description?.trim()
                ? attr.description
                : "No description yet"}
            </TooltipContent>
          </Tooltip>
          {attr.inheritedFrom && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border border-muted-foreground/40 rounded px-1.5 py-0.5">
              Inherited
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={() => onRemoveAttribute(attr.id)}
          data-testid={`button-remove-attribute-${index}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {!isCollapsed && isDescriptionOpen && (
        <div className="space-y-1">
          <Label className="text-xs">Description</Label>
          <Textarea
            value={attr.description || ""}
            onChange={(e) => {
              onAttributeChange(attr.id, "description", e.target.value);
              onAutoResize(e.currentTarget);
            }}
            onInput={(e) => onAutoResize(e.currentTarget)}
            placeholder="Explain what this attribute means"
            className="min-h-8 h-auto text-sm resize-none"
            rows={1}
            data-testid={`input-attr-description-${index}`}
          />
        </div>
      )}

      {!isCollapsed && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={attr.name}
                onChange={(e) =>
                  onAttributeChange(attr.id, "name", e.target.value)
                }
                placeholder="e.g. Mass"
                className="h-8 text-sm"
                data-testid={`input-attr-name-${index}`}
              />
              {duplicateAttributeNameSet.has(
                attr.name.trim().toLowerCase(),
              ) ? (
                <p className="text-[11px] text-destructive">
                  Attribute names must be unique within a node.
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select
                value={attr.type}
                onValueChange={(v) =>
                  onAttributeTypeChange(attr.id, v as NodeAttribute["type"])
                }
              >
                <SelectTrigger
                  className="h-8 text-sm"
                  data-testid={`select-attr-type-${index}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {attributeTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {attr.type === "list" ? (
            <div className="space-y-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-start">
                <div className="space-y-1">
                  <Label className="text-xs">Add Option</Label>
                  <div className="flex gap-2">
                    <Input
                      value={listOptionDraft}
                      onChange={(e) =>
                        onListOptionDraftChange(attr.id, e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        onAddListOption(attr.id);
                      }}
                      placeholder="Add option"
                      className="h-8 text-sm"
                      data-testid={`input-attr-options-${index}`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => onAddListOption(attr.id)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Options</Label>
                  <div className="flex min-h-11 flex-wrap gap-2 rounded-md border border-border/70 bg-muted/20 p-2">
                    {sanitizeAttributeOptions(attr.options).length > 0 ? (
                      sanitizeAttributeOptions(attr.options).map((option) => (
                        <Badge
                          key={option}
                          variant="secondary"
                          className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
                        >
                          <span>{option}</span>
                          <button
                            type="button"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                            onClick={() => onRemoveListOption(attr.id, option)}
                            aria-label={`Remove option ${option}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        No options yet.
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{attributeValueLabel}</Label>
                {sanitizeAttributeOptions(attr.options).length > 0 ? (
                  <Select
                    value={
                      sanitizeAttributeOptions(attr.options).includes(
                        attr.value,
                      )
                        ? attr.value
                        : undefined
                    }
                    onValueChange={(value) =>
                      onAttributeChange(attr.id, "value", value)
                    }
                  >
                    <SelectTrigger
                      className="h-8 text-sm"
                      data-testid={`input-attr-value-${index}`}
                    >
                      <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                    <SelectContent>
                      {sanitizeAttributeOptions(attr.options).map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex h-8 items-center rounded-md border border-dashed border-muted-foreground/30 px-3 text-xs text-muted-foreground">
                    Add list options to choose a default value.
                  </div>
                )}
              </div>
            </div>
          ) : attr.type === "derived" ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Formula</Label>
                <div className="relative">
                  <Textarea
                    ref={(element) => {
                      formulaTextareaRefs.current[attr.id] = element;
                    }}
                    value={
                      formulaDrafts[attr.id] ??
                      getDisplayFormula(
                        attr.formula ?? "",
                        attributes,
                        attr.id,
                      )
                    }
                    onChange={(e) => {
                      const nextDraft = e.target.value;
                      setFormulaDrafts((prev) => ({
                        ...prev,
                        [attr.id]: nextDraft,
                      }));
                      onAttributeChange(
                        attr.id,
                        "formula",
                        getStoredFormulaFromDisplay(
                          nextDraft,
                          attributes,
                          attr.id,
                        ),
                      );
                      onAutoResize(e.currentTarget);
                      updateFormulaAutocomplete(
                        attr.id,
                        nextDraft,
                        e.currentTarget.selectionStart ?? nextDraft.length,
                      );
                    }}
                    onInput={(e) => onAutoResize(e.currentTarget)}
                    onClick={(e) =>
                      updateFormulaAutocomplete(
                        attr.id,
                        formulaDrafts[attr.id] ??
                          getDisplayFormula(
                            attr.formula ?? "",
                            attributes,
                            attr.id,
                          ),
                        e.currentTarget.selectionStart ??
                          (
                            formulaDrafts[attr.id] ??
                            getDisplayFormula(
                              attr.formula ?? "",
                              attributes,
                              attr.id,
                            )
                          ).length,
                      )
                    }
                    onKeyUp={(e) =>
                      updateFormulaAutocomplete(
                        attr.id,
                        e.currentTarget.value,
                        e.currentTarget.selectionStart ??
                          e.currentTarget.value.length,
                      )
                    }
                    onBlur={() => {
                      window.setTimeout(() => {
                        setFormulaAutocomplete((prev) =>
                          prev?.attrId === attr.id ? null : prev,
                        );
                      }, 100);
                    }}
                    onKeyDown={(e) => {
                      const autocompleteIsActive =
                        formulaAutocomplete?.attrId === attr.id;
                      if (
                        !autocompleteIsActive ||
                        formulaSuggestions.length === 0
                      ) {
                        return;
                      }

                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setFormulaAutocomplete((prev) =>
                          prev
                            ? {
                                ...prev,
                                selectedIndex:
                                  (prev.selectedIndex + 1) %
                                  formulaSuggestions.length,
                              }
                            : prev,
                        );
                        return;
                      }

                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setFormulaAutocomplete((prev) =>
                          prev
                            ? {
                                ...prev,
                                selectedIndex:
                                  (prev.selectedIndex -
                                    1 +
                                    formulaSuggestions.length) %
                                  formulaSuggestions.length,
                              }
                            : prev,
                        );
                        return;
                      }

                      if (e.key === "Enter" || e.key === "Tab") {
                        e.preventDefault();
                        const selected =
                          formulaSuggestions[
                            Math.min(
                              formulaAutocomplete?.selectedIndex ?? 0,
                              formulaSuggestions.length - 1,
                            )
                          ];
                        if (selected) {
                          applyFormulaAutocomplete(
                            attr.id,
                            selected.name.trim(),
                          );
                        }
                        return;
                      }

                      if (e.key === "Escape") {
                        setFormulaAutocomplete((prev) =>
                          prev?.attrId === attr.id ? null : prev,
                        );
                      }
                    }}
                    placeholder="[Length] * [Width] * [Height]"
                    className="min-h-16 h-auto resize-none font-mono text-sm"
                    rows={2}
                    data-testid={`input-attr-formula-${index}`}
                  />
                  {formulaAutocomplete?.attrId === attr.id ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20 overflow-hidden rounded-md border bg-popover shadow-lg">
                      {formulaSuggestions.map((candidate, candidateIndex) => (
                        <button
                          key={candidate.id}
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                            candidateIndex === formulaAutocomplete.selectedIndex
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-accent/60",
                          )}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applyFormulaAutocomplete(
                              attr.id,
                              candidate.name.trim(),
                            );
                          }}
                        >
                          <span className="font-medium">{candidate.name}</span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {candidate.type}
                          </span>
                        </button>
                      ))}
                      {formulaSuggestions.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No matching attributes.
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Type `[` to open attribute suggestions. Keep typing to
                  filter, then use arrow keys with `Enter` or `Tab` to insert.
                </p>
                {extractFormulaReferences(
                  formulaDrafts[attr.id] ??
                    getDisplayFormula(attr.formula ?? "", attributes, attr.id),
                  attributes,
                  attr.id,
                ).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {extractFormulaReferences(
                      formulaDrafts[attr.id] ??
                        getDisplayFormula(
                          attr.formula ?? "",
                          attributes,
                          attr.id,
                        ),
                      attributes,
                      attr.id,
                    ).map((reference, refIndex) => (
                      <Badge
                        key={`${reference.name}-${reference.start}-${refIndex}`}
                        variant="secondary"
                        className={cn(
                          "text-[10px]",
                          reference.missing &&
                            "border-destructive/40 text-destructive",
                        )}
                      >
                        {reference.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div
                className={cn(
                  "grid grid-cols-1 gap-2 sm:grid-cols-2",
                  !attr.unit.trim() && "sm:grid-cols-[minmax(0,1fr)_180px]",
                )}
              >
                <div className="space-y-1">
                  <Label className="text-xs">Calculated Value</Label>
                  <div
                    className={cn(
                      "min-h-8 rounded-md border px-3 py-2 text-sm",
                      derivedAttributeState.get(attr.id)?.error
                        ? "border-destructive/50 bg-destructive/5 text-destructive"
                        : "border-border/70 bg-muted/20",
                    )}
                    data-testid={`input-attr-value-${index}`}
                  >
                    {derivedAttributeState.get(attr.id)?.error ||
                      derivedAttributeState.get(attr.id)?.value ||
                      "Enter a formula"}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Unit</Label>
                  <Input
                    value={attr.unit}
                    onChange={(e) =>
                      onAttributeChange(attr.id, "unit", e.target.value)
                    }
                    placeholder="e.g. m³"
                    className="h-8 text-sm"
                    data-testid={`input-attr-unit-${index}`}
                  />
                </div>
              </div>
              {derivedAttributeState.get(attr.id)?.references?.length ? (
                <p className="text-[11px] text-muted-foreground">
                  Depends on{" "}
                  {derivedAttributeState.get(attr.id)?.references.join(", ")}.
                </p>
              ) : null}
            </div>
          ) : (
            <div
              className={cn(
                "grid grid-cols-1 sm:grid-cols-2 gap-2",
                attr.type !== "number" && "sm:grid-cols-1",
              )}
            >
              <div className="space-y-1">
                <Label className="text-xs">{attributeValueLabel}</Label>
                {attr.type === "boolean" ? (
                  <ToggleGroup
                    type="single"
                    value={attr.value === "true" ? "true" : "false"}
                    onValueChange={(value) => {
                      if (!value) return;
                      onAttributeChange(attr.id, "value", value);
                    }}
                    className="w-full"
                    data-testid={`input-attr-value-${index}`}
                  >
                    <ToggleGroupItem
                      value="true"
                      className="flex-1 border border-muted-foreground/30 data-[state=on]:bg-foreground data-[state=on]:text-background data-[state=on]:border-foreground"
                    >
                      Yes
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="false"
                      className="flex-1 border border-muted-foreground/30 data-[state=on]:bg-foreground data-[state=on]:text-background data-[state=on]:border-foreground"
                    >
                      No
                    </ToggleGroupItem>
                  </ToggleGroup>
                ) : attr.type === "string" ? (
                  <Textarea
                    value={attr.value}
                    onChange={(e) => {
                      onAttributeChange(attr.id, "value", e.target.value);
                      onAutoResize(e.currentTarget);
                    }}
                    onInput={(e) => onAutoResize(e.currentTarget)}
                    placeholder="Enter text"
                    className="min-h-8 h-auto text-sm resize-none"
                    rows={1}
                    data-testid={`input-attr-value-${index}`}
                  />
                ) : (
                  <Input
                    type={attr.type === "date" ? "date" : "number"}
                    value={attr.value}
                    onChange={(e) =>
                      onAttributeChange(attr.id, "value", e.target.value)
                    }
                    placeholder={attr.type === "number" ? "e.g. 150" : ""}
                    className="h-8 text-sm"
                    data-testid={`input-attr-value-${index}`}
                  />
                )}
              </div>
              {attr.type === "number" ? (
                <div className="space-y-1">
                  <Label className="text-xs">Unit</Label>
                  <Input
                    value={attr.unit}
                    onChange={(e) =>
                      onAttributeChange(attr.id, "unit", e.target.value)
                    }
                    placeholder="e.g. kg"
                    className="h-8 text-sm"
                    data-testid={`input-attr-unit-${index}`}
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
