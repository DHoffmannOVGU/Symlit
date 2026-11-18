import { useDiagramStore } from "../state/DiagramStoreProvider";
import { useDiagramModel } from "../state/DiagramModelProvider";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { modelRuleSchema, type ModelRule } from "@shared/contracts";
import {
  ALL_ELEMENTS,
  builderFromRule,
  displayRuleCondition,
  linkedType,
  parseRuleCondition,
  printRuleCondition,
  printRuleText,
  RULE_PLACEHOLDER,
  ruleFromBuilder,
  ruleFromModelCondition,
  ruleUsesRelationships,
  splitRuleText,
  storeRuleCondition,
  type RuleBuilderComparison,
  type RuleBuilderGroup,
} from "@shared/rule-text";
import type { ConditionOperator } from "@shared/formula";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectSeparator, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, GripHorizontal, Lock, Plus, Save, Tag, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUpdateView } from "@/hooks/use-views";
import {
  evaluateModelRuleResults,
  getModelRuleTargetOptions,
  MODEL_RULE_CHECK_LABELS,
  MODEL_RULE_OPERATOR_LABELS,
} from "../rules/model-rules";
import { useRelatedCalculation } from "../related/RelatedCalculationProvider";
import { useRuleAttributeChoices, useRuleRelationshipNames, useRuleTextContext } from "../rules/useRuleTextContext";

type Props = {
  open: boolean;
  onClose: () => void;
  height: number;
  onHeightChange: (height: number) => void;
};

const NO_RULES: ModelRule[] = [];

type TargetOptions = ReturnType<typeof getModelRuleTargetOptions> & { labelOf: (target: string) => string };
type Draft = { text: string; error?: string };
type AttributeChoice = { name: string; type: string; options: string[] };

const createComparison = (): RuleBuilderComparison => ({
  kind: "comparison", source: "self", field: "attribute", attribute: "",
  operator: "equals", value: "",
});

const createRule = (): ModelRule => ({
  id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  name: "New descriptor rule",
  enabled: true,
  targetType: "all",
  expression: printRuleCondition(ruleFromBuilder({ kind: "group", combinator: "all", conditions: [createComparison()] })),
  outcome: { kind: "tag", label: "Descriptor", color: "#6366f1" },
});

const needsValue = (operator: ConditionOperator) =>
  !["exists", "missing", "is-true", "is-false"].includes(operator);

/** The condition a rule has as text: written as text, or (saved before rules had text) built from its lists. */
const storedExpression = (rule: ModelRule) =>
  rule.expression ?? (rule.condition ? printRuleCondition(ruleFromModelCondition(rule.condition)) : "");

const SET_OPERATORS: ConditionOperator[] = ["exists", "missing"];
/** The comparisons that make sense for a kind of value; the current one is always offered. */
const operatorsFor = (field: RuleBuilderComparison["field"], type: string | undefined): ConditionOperator[] => {
  if (field === "type") return ["equals", "not-equals"];
  if (field === "name" || field === "description") return ["equals", "not-equals", "contains", ...SET_OPERATORS];
  switch (type) {
    case "number":
    case "derived":
    case "related":
      return ["equals", "not-equals", "less-than", "less-than-or-equal", "greater-than", "greater-than-or-equal", ...SET_OPERATORS];
    case "boolean":
      return ["is-true", "is-false", ...SET_OPERATORS];
    case "select":
      return ["equals", "not-equals", ...SET_OPERATORS];
    case "multiselect":
      return ["equals", "not-equals", "contains", ...SET_OPERATORS];
    default:
      return Object.keys(MODEL_RULE_OPERATOR_LABELS) as ConditionOperator[];
  }
};

function TargetSelect({ value, onChange, options, allLabel = "All object types" }: {
  value: string; onChange: (value: string) => void; options: TargetOptions; allLabel?: string;
}) {
  const known = value === "all" || [...options.builtInTypes, ...options.viewTypes].some((option) => option.value === value);
  return (
    <Select value={value || "all"} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {!known ? <SelectItem value={value}>{options.labelOf(value)}</SelectItem> : null}
        {options.builtInTypes.length > 0 && <>
          <SelectSeparator />
          <SelectGroup><SelectLabel>Built-in types</SelectLabel>
            {options.builtInTypes.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
          </SelectGroup>
        </>}
        {options.viewTypes.length > 0 && <>
          <SelectSeparator />
          <SelectGroup><SelectLabel>Types in this diagram</SelectLabel>
            {options.viewTypes.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
          </SelectGroup>
        </>}
      </SelectContent>
    </Select>
  );
}

type Relationship = { name: string; direction: "outgoing" | "incoming" };

const sourceValueOf = (condition: RuleBuilderComparison) => {
  if (condition.source === "self") return "self";
  if (condition.relationship) return `via:${condition.direction === "incoming" ? "incoming" : "outgoing"}:${condition.relationship}`;
  return `connected:${condition.direction ?? "any"}`;
};
const relationshipLabel = (relationship: Relationship) =>
  relationship.direction === "incoming" ? `Incoming “${relationship.name}” from` : `Outgoing “${relationship.name}” to`;

function ConditionEditor({ condition, onChange, onDelete, targetOptions, attributesFor, ruleTarget, relationships, depth = 0 }: {
  condition: RuleBuilderGroup | RuleBuilderComparison;
  onChange: (value: RuleBuilderGroup | RuleBuilderComparison) => void;
  onDelete: () => void;
  targetOptions: TargetOptions;
  attributesFor: (targetType: string) => AttributeChoice[];
  ruleTarget: string;
  relationships: Relationship[];
  depth?: number;
}) {
  const listId = useId();
  if (condition.kind === "group") {
    return (
      <div className={`space-y-2 rounded-md border p-2 ${depth ? "ml-4 bg-muted/20" : "bg-background"}`}>
        <div className="flex items-center gap-2 text-xs">
          <span>Match</span>
          <Select value={condition.combinator} onValueChange={(combinator) => onChange({ ...condition, combinator: combinator as "all" | "any" })}>
            <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">all</SelectItem><SelectItem value="any">any</SelectItem></SelectContent>
          </Select>
          <span>of these conditions</span>
          <div className="ml-auto flex gap-1">
            <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => onChange({ ...condition, conditions: [...condition.conditions, createComparison()] })}><Plus className="mr-1 h-3.5 w-3.5" />Condition</Button>
            {depth < 1 && <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => onChange({ ...condition, conditions: [...condition.conditions, { kind: "group", combinator: "all", conditions: [createComparison()] }] })}><Plus className="mr-1 h-3.5 w-3.5" />Group</Button>}
            {depth > 0 && <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onDelete} aria-label="Remove these rows"><Trash2 className="h-3.5 w-3.5" /></Button>}
          </div>
        </div>
        {condition.conditions.length === 0
          ? <p className="px-2 py-1 text-xs text-muted-foreground">{depth ? "An empty group adds nothing." : "No condition: the rule applies to every element it looks at."}</p>
          : condition.conditions.map((child, index) => (
            <ConditionEditor key={index} condition={child} targetOptions={targetOptions} attributesFor={attributesFor} ruleTarget={ruleTarget} relationships={relationships} depth={depth + 1}
              onDelete={() => onChange({ ...condition, conditions: condition.conditions.filter((_, childIndex) => childIndex !== index) })}
              onChange={(next) => {
                if (depth > 0 && next.kind === "group") return;
                onChange({ ...condition, conditions: condition.conditions.map((item, childIndex) => childIndex === index ? next : item) });
              }} />
          ))}
      </div>
    );
  }

  const connected = condition.source === "connected";
  // Whose attributes the row compares: the rule's elements, or the related elements of the chosen type.
  const attributes = attributesFor(connected ? condition.targetType ?? "all" : ruleTarget);
  const chosen = condition.field === "attribute" ? attributes.find((attribute) => attribute.name.toLowerCase() === (condition.attribute ?? "").trim().toLowerCase()) : undefined;
  const fieldValue = condition.field === "attribute" ? `attribute:${condition.attribute ?? ""}` : condition.field;
  const sourceValue = sourceValueOf(condition);
  const viaOptions = [...relationships];
  if (condition.relationship && !viaOptions.some((relationship) => sourceValueOf({ ...condition, relationship: relationship.name, direction: relationship.direction }) === sourceValue)) {
    viaOptions.push({ name: condition.relationship, direction: condition.direction === "incoming" ? "incoming" : "outgoing" });
  }
  const operators = Array.from(new Set([...operatorsFor(condition.field, chosen?.type), condition.operator]));
  const exists = condition.field === "exists";
  const suggestions = chosen?.type === "select" || chosen?.type === "multiselect" ? chosen.options : chosen?.type === "boolean" ? ["yes", "no"] : [];
  const changeSource = (source: string) => {
    if (source === "self") {
      onChange({ kind: "comparison", source: "self", field: exists ? "attribute" : condition.field, attribute: exists ? "" : condition.attribute, operator: exists ? "equals" : condition.operator, value: exists ? "" : condition.value });
      return;
    }
    // A fresh row asks whether related elements are there; a row already comparing keeps its comparison.
    const fresh = condition.source === "self" && condition.field === "attribute" && !condition.attribute?.trim();
    const [kind, direction, ...name] = source.split(":");
    onChange({
      ...condition,
      source: "connected",
      direction: direction as RuleBuilderComparison["direction"],
      relationship: kind === "via" ? name.join(":") : undefined,
      quantifier: condition.quantifier ?? "any",
      targetType: condition.targetType ?? "all",
      ...(fresh ? { field: "exists" as const, attribute: undefined, operator: "exists" as const, value: undefined } : {}),
    });
  };
  return (
    <div className="flex items-start gap-2 rounded-md border bg-card p-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <Select value={sourceValue} onValueChange={changeSource}>
        <SelectTrigger className={`h-8 ${condition.relationship ? "w-[210px]" : "w-[140px]"}`}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="self">This object</SelectItem><SelectItem value="connected:any">Connected to</SelectItem><SelectItem value="connected:outgoing">Outgoing to</SelectItem><SelectItem value="connected:incoming">Incoming from</SelectItem>
          {viaOptions.length > 0 && <><SelectSeparator /><SelectGroup><SelectLabel>By relationship</SelectLabel>
            {viaOptions.map((relationship) => {
              const value = `via:${relationship.direction}:${relationship.name}`;
              return <SelectItem key={value} value={value}>{relationshipLabel(relationship)}</SelectItem>;
            })}
          </SelectGroup></>}
        </SelectContent>
      </Select>
      {connected && <>
        <Select value={condition.quantifier ?? "any"} onValueChange={(quantifier) => onChange({ ...condition, quantifier: quantifier as RuleBuilderComparison["quantifier"] })}>
          <SelectTrigger className="h-8 w-[125px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="any">at least one</SelectItem><SelectItem value="all">every</SelectItem><SelectItem value="none">none</SelectItem></SelectContent>
        </Select>
        <div className="w-[170px]"><TargetSelect value={condition.targetType ?? "all"} onChange={(targetType) => onChange({ ...condition, targetType })} options={targetOptions} allLabel="connected object" /></div>
      </>}
      <Select value={fieldValue} onValueChange={(field) => {
        if (field === "exists") onChange({ ...condition, field: "exists", attribute: undefined, operator: "exists", value: undefined });
        else if (field.startsWith("attribute:")) onChange({ ...condition, field: "attribute", attribute: field.slice(10), operator: exists ? "equals" : condition.operator });
        else onChange({ ...condition, field: field as RuleBuilderComparison["field"], attribute: undefined, operator: exists ? "exists" : condition.operator });
      }}>
        <SelectTrigger className="h-8 w-[170px]"><SelectValue placeholder="Choose a field" /></SelectTrigger>
        <SelectContent>
          {connected && <SelectItem value="exists">exists</SelectItem>}
          <SelectItem value="name">Name</SelectItem><SelectItem value="description">Description</SelectItem><SelectItem value="type">Type</SelectItem>
          {(attributes.length > 0 || (condition.field === "attribute" && condition.attribute)) && <><SelectSeparator /><SelectGroup><SelectLabel>Attributes</SelectLabel>
            {attributes.map((attribute) => <SelectItem key={attribute.name} value={`attribute:${attribute.name}`}>{attribute.name}</SelectItem>)}
            {condition.field === "attribute" && condition.attribute && !chosen && <SelectItem value={`attribute:${condition.attribute}`}>{condition.attribute}</SelectItem>}
          </SelectGroup></>}
          {condition.field === "attribute" && !condition.attribute && <SelectItem value="attribute:">Choose attribute…</SelectItem>}
        </SelectContent>
      </Select>
      {exists ? null : <Select value={condition.operator} onValueChange={(operator) => onChange({ ...condition, operator: operator as ConditionOperator })}>
        <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
        <SelectContent>{operators.map((operator) => <SelectItem key={operator} value={operator}>{MODEL_RULE_OPERATOR_LABELS[operator]}</SelectItem>)}</SelectContent>
      </Select>}
      {!exists && needsValue(condition.operator) ? <>
        <Input className="h-8 min-w-[80px] flex-1" value={condition.value ?? ""} placeholder="value" list={suggestions.length ? listId : undefined} onChange={(event) => onChange({ ...condition, value: event.target.value })} />
        {suggestions.length ? <datalist id={listId}>{suggestions.map((option) => <option key={option} value={option} />)}</datalist> : null}
      </> : null}
      </div>
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={onDelete} aria-label="Remove this row"><Trash2 className="h-3.5 w-3.5" /></Button>
    </div>
  );
}

/** How rules are written, for the panel's help. */
const RULE_EXAMPLES = [
  "for Drone where [range] < 15",
  'for Component where [single source] is true and [criticality] = "high"',
  'for Process where none of incoming "executes"',
  'for Assembly where all of "consists of" have [status] = "released"',
  "for Print job where [price] < [total cost]",
  'for Machine where count(of "consists of") < 2',
];

export function ModelRulesPanel({ open, onClose, height: panelHeight, onHeightChange }: Props) {
  const { viewId, projectId, projectType, localModelRules: initialRules, referencedModelRules, typeMetaById } = useDiagramModel();
  const inheritedRules = projectType === "instance" ? referencedModelRules : NO_RULES;
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const { ruleGraph, requestGraph } = useRelatedCalculation();
  const contextFor = useRuleTextContext();
  const relationshipsFor = useRuleRelationshipNames();
  const attributesFor = useRuleAttributeChoices();
  const [rules, setRules] = useState<ModelRule[]>(initialRules);
  // The lists as last edited (they may hold what is not chosen yet), and text being typed.
  const [builders, setBuilders] = useState<Map<string, RuleBuilderGroup>>(new Map());
  const [drafts, setDrafts] = useState<Map<string, Draft>>(new Map());
  const isInstanceEditor = projectType === "instance";
  const resizeStart = useRef<{ y: number; height: number } | null>(null);
  const updateView = useUpdateView();
  const { toast } = useToast();
  useEffect(() => {
    setRules(initialRules);
    setBuilders(new Map());
    setDrafts(new Map());
  }, [initialRules, viewId]);

  // A rule being written that looks at related elements sees those of the whole project.
  const localRulesNeedGraph = useMemo(
    () =>
      rules.some((rule) => {
        try {
          return ruleUsesRelationships(parseRuleCondition(storedExpression(rule)));
        } catch {
          return false;
        }
      }),
    [rules],
  );
  useEffect(() => {
    if (open && localRulesNeedGraph) requestGraph();
  }, [localRulesNeedGraph, open, requestGraph]);

  const targetOptions = useMemo(() => getModelRuleTargetOptions(nodes), [nodes]);
  const getTargetLabel = (target: string) => {
    if (target === "all") return "all objects";
    const options = [...targetOptions.builtInTypes, ...targetOptions.viewTypes];
    // A rule from a metamodel names one of its types as "node:<type id>".
    const typeId = target.startsWith("node:") ? target.slice("node:".length) : target;
    // A metamodel's type by its name now (elements keep the name it had when they were made).
    return (
      typeMetaById.get(typeId)?.label ??
      options.find((option) => option.value === target)?.label ??
      options.find((option) => option.value === typeId)?.label ??
      target
    );
  };
  const selectOptions: TargetOptions = { ...targetOptions, labelOf: getTargetLabel };
  const allRules = useMemo(() => [...inheritedRules, ...rules], [inheritedRules, rules]);
  const inheritedRuleIds = useMemo(() => new Set(inheritedRules.map((rule) => rule.id)), [inheritedRules]);
  const results = useMemo(() => evaluateModelRuleResults(allRules, nodes, edges, ruleGraph), [allRules, nodes, edges, ruleGraph]);
  const rulesValid = rules.every((rule) => modelRuleSchema.safeParse(rule).success && !drafts.get(rule.id)?.error);
  const issueCount = results.filter((result) => result.outcome.kind === "issue").length;
  const updateRule = (id: string, patch: Partial<ModelRule>) => setRules((current) => current.map((rule) => rule.id === id ? { ...rule, ...patch } as ModelRule : rule));
  const setMapEntry = <T,>(setter: React.Dispatch<React.SetStateAction<Map<string, T>>>, id: string, value: T | undefined) =>
    setter((current) => {
      const next = new Map(current);
      if (value === undefined) next.delete(id);
      else next.set(id, value);
      return next;
    });

  /** A rule's whole text, by names: for <type> where <condition>. */
  const ruleText = (rule: ModelRule) =>
    printRuleText(rule.targetType === "all" ? null : getTargetLabel(rule.targetType), displayRuleCondition(storedExpression(rule), contextFor(rule.targetType)));

  /** The rule's lists, from its text; null when the lists cannot show it. */
  const builderOf = (rule: ModelRule): RuleBuilderGroup | null => {
    const kept = builders.get(rule.id);
    if (kept) return kept;
    try {
      return builderFromRule(
        parseRuleCondition(displayRuleCondition(storedExpression(rule), contextFor(rule.targetType), { keepTypes: true }), { placeholders: true }),
      );
    } catch {
      return null;
    }
  };

  const changeBuilder = (rule: ModelRule, builder: RuleBuilderGroup) => {
    setMapEntry(setBuilders, rule.id, builder);
    setMapEntry(setDrafts, rule.id, undefined);
    const text = printRuleCondition(ruleFromBuilder(builder));
    updateRule(rule.id, { expression: storeRuleCondition(text, contextFor(rule.targetType)), condition: undefined });
  };

  /** The rule's target for a type's name in the text. */
  const targetNamed = (name: string, current: string): string | undefined => {
    if (getTargetLabel(current).trim().toLowerCase() === name.trim().toLowerCase()) return current;
    return linkedType(name, contextFor(current).types) ?? undefined;
  };

  const changeText = (rule: ModelRule, text: string) => {
    let parts: ReturnType<typeof splitRuleText>;
    try {
      parts = splitRuleText(text);
    } catch (error) {
      setMapEntry<Draft>(setDrafts, rule.id, { text, error: (error as Error).message });
      return;
    }
    const targetType = parts.target === null ? "all" : targetNamed(parts.target, rule.targetType);
    if (!targetType) {
      const name = parts.target!.trim().toLowerCase();
      const named = new Set(
        contextFor(rule.targetType).types.filter((type) => type.label.trim().toLowerCase() === name).map((type) => type.value),
      );
      setMapEntry<Draft>(setDrafts, rule.id, {
        text,
        error: named.size > 1
          ? `Several types are named “${parts.target}”: choose one in the list next to the rule name.`
          : `There is no type named “${parts.target}” here. Write for ${ALL_ELEMENTS}, or the name of a type.`,
      });
      return;
    }
    setMapEntry(setBuilders, rule.id, undefined);
    try {
      parseRuleCondition(parts.condition);
    } catch (error) {
      setMapEntry<Draft>(setDrafts, rule.id, { text, error: (error as Error).message });
      updateRule(rule.id, { targetType, expression: parts.condition, condition: undefined });
      return;
    }
    setMapEntry<Draft>(setDrafts, rule.id, { text });
    updateRule(rule.id, { targetType, expression: storeRuleCondition(parts.condition, contextFor(targetType)), condition: undefined });
  };

  const save = async () => {
    if (!rulesValid) {
      toast({ title: "Finish configuring the rule", description: "Finish each rule's condition (choose every attribute, enter each value, or correct the text) before saving.", variant: "destructive" });
      return;
    }
    try {
      await updateView.mutateAsync({ id: viewId, projectId, modelRules: rules });
      toast({ title: "Model rules saved", description: `${rules.length} rule${rules.length === 1 ? "" : "s"} stored for this view.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The view could not be updated.";
      toast({
        title: "Could not save model rules",
        description: message === "Required"
          ? "The API is still running the previous rule schema. Restart the development server and try again."
          : message,
        variant: "destructive",
      });
    }
  };
  const clampPanelHeight = (height: number) =>
    Math.min(Math.max(height, 280), Math.max(280, window.innerHeight - 120));

  const handleResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    resizeStart.current = { y: event.clientY, height: panelHeight };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handleResizePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeStart.current) return;
    onHeightChange(clampPanelHeight(resizeStart.current.height + resizeStart.current.y - event.clientY));
  };

  const handleResizePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    resizeStart.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  if (!open) return null;

  return (
    <section className="absolute inset-x-0 bottom-0 z-30 flex flex-col border-t bg-background shadow-[0_-12px_30px_rgba(15,23,42,0.16)]" style={{ height: panelHeight }} data-testid="model-rules-panel">
      <div
        role="separator"
        aria-label="Resize model rules panel"
        aria-orientation="horizontal"
        aria-valuemin={280}
        aria-valuemax={Math.max(280, window.innerHeight - 120)}
        aria-valuenow={Math.round(panelHeight)}
        tabIndex={0}
        className="group absolute inset-x-0 top-0 z-40 flex h-3 -translate-y-1/2 touch-none cursor-row-resize items-center justify-center outline-none"
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerEnd}
        onPointerCancel={handleResizePointerEnd}
        onDoubleClick={() => onHeightChange(clampPanelHeight(560))}
        onKeyDown={(event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          onHeightChange(clampPanelHeight(panelHeight + (event.key === "ArrowUp" ? 24 : -24)));
        }}
        data-testid="model-rules-resize-handle"
      >
        <span className="flex h-4 w-12 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors group-hover:text-foreground group-focus-visible:ring-2 group-focus-visible:ring-ring">
          <GripHorizontal className="h-3.5 w-3.5" />
        </span>
      </div>
      <header className="flex items-center justify-between border-b px-5 py-3">
        <div>
          <div className="flex items-center gap-2"><h2 className="font-semibold">{isInstanceEditor ? "Model rules (this model and its metamodels)" : "Model rules"}</h2><Badge variant={issueCount ? "destructive" : "secondary"}>{issueCount ? `${issueCount} issue${issueCount === 1 ? "" : "s"}` : `${results.length} match${results.length === 1 ? "" : "es"}`}</Badge></div>
          <p className="text-xs text-muted-foreground">{isInstanceEditor ? "Rules from the metamodels apply here and are read-only. Rules you add apply to this diagram only." : "Describe elements by their attributes and relationships, then add a tag or report an issue."} Write a rule as text, or build it with the lists: both stay in step.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setRules((current) => [...current, createRule()])} data-testid="button-add-rule"><Plus className="mr-1 h-4 w-4" />Add rule</Button>
          <Button size="sm" onClick={save} disabled={updateView.isPending || !rulesValid} data-testid="button-save-rules"><Save className="mr-1 h-4 w-4" />Save</Button>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close model rules"><X className="h-4 w-4" /></Button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.8fr)_minmax(280px,0.65fr)]">
        <div className="overflow-y-auto p-4">
          {isInstanceEditor && inheritedRules.length > 0 ? <section className="mb-5 space-y-2" data-testid="inherited-model-rules">
            <div className="flex items-center gap-2"><h3 className="text-sm font-semibold">Rules from metamodels</h3><Badge variant="secondary">{inheritedRules.length} inherited</Badge></div>
            <p className="text-xs text-muted-foreground">Defined by referenced metamodels and applied automatically to this instance.</p>
            {inheritedRules.map((rule) => <div key={rule.id} className="rounded-lg border bg-muted/30 p-3 text-xs">
              <div className="flex items-center gap-2"><Lock className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-semibold">{rule.name}</span><Badge variant="outline">Meta rule</Badge>{!rule.enabled ? <Badge variant="secondary">Disabled</Badge> : null}</div>
              <p className="mt-2 font-mono text-muted-foreground" data-testid="inherited-rule-text">{rule.check ? `${MODEL_RULE_CHECK_LABELS[rule.check]} (for ${getTargetLabel(rule.targetType)})` : ruleText(rule)}</p>
              {rule.outcome ? <p className="mt-1">Then {rule.outcome.kind === "tag" ? `add “${rule.outcome.label}”` : `report a ${rule.outcome.severity}`}.</p> : null}
            </div>)}
          </section> : null}
          {isInstanceEditor ? <div className="mb-2 flex items-center gap-2"><h3 className="text-sm font-semibold">Rules of this diagram</h3><Badge variant="outline">{rules.length}</Badge></div> : null}
          <details className="mb-3 rounded-md border bg-muted/10 px-3 py-2 text-xs" data-testid="rule-syntax-help">
            <summary className="cursor-pointer font-medium">How a rule is written</summary>
            <div className="mt-2 space-y-1 text-muted-foreground">
              <p>A rule says which elements it looks at and when its outcome applies: <code>for</code> a type (or {ALL_ELEMENTS}) <code>where</code> a condition. Attributes go in square brackets, texts in quotes.</p>
              <p>Compare with <code>= != &lt; &gt; &lt;= &gt;=</code> or <code>contains</code>, or check with <code>is set</code>, <code>is not set</code>, <code>is true</code>, <code>is false</code>. Both sides can be values or calculations, also over related elements as in a Related Formula. Combine with <code>and</code>, <code>or</code>, <code>not</code> and parentheses.</p>
              <p>About related elements: <code>any of</code>, <code>all of</code> or <code>none of</code> a relationship (<code>"consists of"</code>, <code>incoming "executes"</code>, <code>all</code>), then <code>where</code> to keep some and <code>has</code> for what they must meet. Relationships count from all diagrams of the project.</p>
              <ul className="space-y-0.5 font-mono">{RULE_EXAMPLES.map((example) => <li key={example}>{example}</li>)}</ul>
            </div>
          </details>
          {rules.length === 0 ? <div className="flex min-h-28 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground"><span className="max-w-md px-4 text-center">No rules yet. A rule looks like: every Battery whose capacity is below 100 Wh gets the tag “small” (for Battery where [capacity] &lt; 100), or: report an issue for every Drone without a Battery.</span></div> : <div className="space-y-3">
            {rules.map((rule) => {
              const legacy = !rule.outcome || (!!rule.check && rule.expression === undefined && !rule.condition);
              const draft = drafts.get(rule.id);
              const builder = legacy ? null : builderOf(rule);
              let textProblem = draft?.error;
              if (!textProblem && !legacy) {
                try {
                  parseRuleCondition(storedExpression(rule));
                } catch (error) {
                  textProblem = (error as Error).message;
                }
              }
              return <div key={rule.id} className="space-y-3 rounded-lg border bg-muted/10 p-3" data-testid="model-rule">
              <div className="grid grid-cols-[auto_minmax(180px,1fr)_minmax(160px,0.7fr)_auto] items-center gap-2">
                <Switch checked={rule.enabled} onCheckedChange={(enabled) => updateRule(rule.id, { enabled })} aria-label={`Enable ${rule.name}`} />
                <div className="flex items-center gap-2"><Input value={rule.name} onChange={(event) => updateRule(rule.id, { name: event.target.value })} aria-label="Rule name" />{isInstanceEditor ? <Badge variant="outline" className="shrink-0">Instance rule</Badge> : null}</div>
                <TargetSelect value={rule.targetType} onChange={(targetType) => {
                  setMapEntry(setDrafts, rule.id, undefined);
                  updateRule(rule.id, legacy ? { targetType } : { targetType, expression: storedExpression(rule), condition: undefined });
                }} options={selectOptions} />
                <Button size="icon" variant="ghost" onClick={() => {
                  setRules((current) => current.filter((item) => item.id !== rule.id));
                  setMapEntry(setDrafts, rule.id, undefined);
                  setMapEntry(setBuilders, rule.id, undefined);
                }} aria-label={`Delete ${rule.name}`}><Trash2 className="h-4 w-4" /></Button>
              </div>
              {!legacy && rule.outcome ? <>
                <div className="space-y-1">
                  <Textarea
                    value={draft?.text ?? ruleText(rule)}
                    onChange={(event) => changeText(rule, event.target.value)}
                    onBlur={() => { if (!drafts.get(rule.id)?.error) setMapEntry(setDrafts, rule.id, undefined); }}
                    placeholder="for Drone where [range] < 15"
                    aria-label="Rule text"
                    spellCheck={false}
                    rows={1}
                    className="min-h-9 resize-y font-mono text-sm"
                    data-testid="rule-text"
                  />
                  {textProblem && !draft?.error && storedExpression(rule).includes(RULE_PLACEHOLDER)
                    ? <p className="text-xs text-muted-foreground" data-testid="rule-text-unfinished">Choose what {RULE_PLACEHOLDER} stands for in the lists, or write the condition here.</p>
                    : textProblem
                    ? <p className="text-xs text-destructive" data-testid="rule-text-error">{textProblem}</p>
                    : !builder
                      ? <p className="text-xs text-muted-foreground" data-testid="rule-text-only">The lists cannot show this condition (it compares two values, calculates, or uses not). It is edited as text.</p>
                      : null}
                </div>
                {builder ? <ConditionEditor condition={builder} onChange={(next) => changeBuilder(rule, next as RuleBuilderGroup)} onDelete={() => undefined} targetOptions={selectOptions} attributesFor={attributesFor} ruleTarget={rule.targetType} relationships={relationshipsFor(rule.targetType)} /> : null}
                <div className="grid grid-cols-[70px_150px_minmax(140px,1fr)_130px] items-center gap-2 text-xs">
                  <span className="font-medium">Then</span>
                  <Select value={rule.outcome.kind} onValueChange={(kind) => updateRule(rule.id, { outcome: kind === "tag" ? { kind: "tag", label: "Descriptor", color: "#6366f1" } : { kind: "issue", severity: "warning" } })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tag">add descriptor tag</SelectItem><SelectItem value="issue">report an issue</SelectItem></SelectContent>
                  </Select>
                  {rule.outcome.kind === "tag" ? <Input className="h-8" value={rule.outcome.label} placeholder="e.g. Heavy" onChange={(event) => updateRule(rule.id, { outcome: { kind: "tag", label: event.target.value, color: rule.outcome?.kind === "tag" ? rule.outcome.color : undefined } })} /> : <Input className="h-8" value={rule.outcome.message ?? ""} placeholder="Issue message (optional)" onChange={(event) => updateRule(rule.id, { outcome: { kind: "issue", severity: rule.outcome?.kind === "issue" ? rule.outcome.severity : "warning", message: event.target.value } })} />}
                  {rule.outcome.kind === "tag" ? <div className="flex items-center gap-2"><input type="color" value={rule.outcome.color ?? "#6366f1"} onChange={(event) => updateRule(rule.id, { outcome: { kind: "tag", label: rule.outcome?.kind === "tag" ? rule.outcome.label : "Descriptor", color: event.target.value } })} className="h-8 w-10 rounded border bg-transparent" /><span>Tag color</span></div> : <Select value={rule.outcome.severity} onValueChange={(severity) => updateRule(rule.id, { outcome: { kind: "issue", message: rule.outcome?.kind === "issue" ? rule.outcome.message : undefined, severity: severity as "warning" | "error" } })}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="warning">Warning</SelectItem><SelectItem value="error">Error</SelectItem></SelectContent></Select>}
                </div>
              </> : <div className="grid grid-cols-[1fr_180px_130px] items-center gap-2 rounded-md border bg-background p-2 text-xs"><span><Badge variant="outline" className="mr-2">Legacy check</Badge>{rule.check ? MODEL_RULE_CHECK_LABELS[rule.check] : "Incomplete rule"}</span><Select value={rule.check} onValueChange={(check) => updateRule(rule.id, { check: check as ModelRule["check"] })}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(MODEL_RULE_CHECK_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Select value={rule.severity ?? "warning"} onValueChange={(severity) => updateRule(rule.id, { severity: severity as "warning" | "error" })}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="warning">Warning</SelectItem><SelectItem value="error">Error</SelectItem></SelectContent></Select></div>}
            </div>;
            })}
          </div>}
        </div>
        <aside className="overflow-y-auto border-l bg-muted/20 p-4"><h3 className="mb-2 text-sm font-semibold">Live results</h3>
          {results.length === 0 ? <div className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />No element matches a rule.</div> : <div className="space-y-2">{results.map((result, index) => <div key={`${result.ruleId}:${result.nodeId}:${index}`} className="rounded-md border bg-background p-2 text-xs"><div className="flex items-center gap-1 font-medium">{result.outcome.kind === "tag" ? <Tag className="h-3.5 w-3.5" style={{ color: result.outcome.color }} /> : <AlertTriangle className={result.outcome.severity === "error" ? "h-3.5 w-3.5 text-destructive" : "h-3.5 w-3.5 text-amber-500"} />}{result.ruleName}<Badge variant="outline" className="ml-auto text-[9px]">{inheritedRuleIds.has(result.ruleId) ? "Metamodel" : "This diagram"}</Badge></div><p className="mt-1 text-muted-foreground">{result.message}</p></div>)}</div>}
        </aside>
      </div>
    </section>
  );
}
