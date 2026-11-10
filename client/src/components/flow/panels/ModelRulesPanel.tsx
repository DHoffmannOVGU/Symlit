import { useDiagramStore } from "../state/DiagramStoreProvider";
import { useDiagramModel } from "../state/DiagramModelProvider";
import { useEffect, useMemo, useRef, useState } from "react";
import { modelRuleSchema, type ModelRule, type ModelRuleCondition } from "@shared/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  getModelRuleAttributeOptions,
  getModelRuleTargetOptions,
  MODEL_RULE_CHECK_LABELS,
  MODEL_RULE_OPERATOR_LABELS,
  describeModelRule,
} from "../rules/model-rules";

type Props = {
  open: boolean;
  onClose: () => void;
  height: number;
  onHeightChange: (height: number) => void;
};

const NO_RULES: ModelRule[] = [];

type TargetOptions = ReturnType<typeof getModelRuleTargetOptions>;
type Comparison = Extract<ModelRuleCondition, { kind: "comparison" }>;

const createComparison = (): Comparison => ({
  kind: "comparison", source: "self", field: "attribute", attribute: "",
  operator: "equals", value: "",
});

const createRule = (): ModelRule => ({
  id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  name: "New descriptor rule",
  enabled: true,
  targetType: "all",
  condition: { kind: "group", combinator: "all", conditions: [createComparison()] },
  outcome: { kind: "tag", label: "Descriptor", color: "#6366f1" },
});

const needsValue = (operator: Comparison["operator"]) =>
  !["exists", "missing", "is-true", "is-false"].includes(operator);

function TargetSelect({ value, onChange, options, allLabel = "All object types" }: {
  value: string; onChange: (value: string) => void; options: TargetOptions; allLabel?: string;
}) {
  return (
    <Select value={value || "all"} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
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

function ConditionEditor({ condition, onChange, onDelete, targetOptions, attributes, depth = 0 }: {
  condition: ModelRuleCondition;
  onChange: (value: ModelRuleCondition) => void;
  onDelete: () => void;
  targetOptions: TargetOptions;
  attributes: string[];
  depth?: number;
}) {
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
            {depth > 0 && <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>}
          </div>
        </div>
        {condition.conditions.length === 0
          ? <p className="px-2 py-1 text-xs text-muted-foreground">Add a condition to make this rule active.</p>
          : condition.conditions.map((child, index) => (
            <ConditionEditor key={index} condition={child} targetOptions={targetOptions} attributes={attributes} depth={depth + 1}
              onDelete={() => onChange({ ...condition, conditions: condition.conditions.filter((_, childIndex) => childIndex !== index) })}
              onChange={(next) => {
                if (depth > 0 && next.kind === "group") return;
                onChange({ ...condition, conditions: condition.conditions.map((item, childIndex) => childIndex === index ? next : item) } as ModelRuleCondition);
              }} />
          ))}
      </div>
    );
  }

  const fieldValue = condition.field === "attribute" ? `attribute:${condition.attribute ?? ""}` : condition.field;
  const sourceValue = condition.source === "self" ? "self" : `connected:${condition.direction ?? "any"}`;
  return (
    <div className={`grid items-center gap-2 rounded-md border bg-card p-2 ${condition.source === "connected" ? "grid-cols-[110px_100px_minmax(130px,1fr)_minmax(140px,1fr)_145px_minmax(110px,0.8fr)_32px]" : "grid-cols-[110px_minmax(150px,1fr)_145px_minmax(110px,0.8fr)_32px]"}`}>
      <Select value={sourceValue} onValueChange={(source) => onChange(source === "self" ? { ...condition, source: "self" } : { ...condition, source: "connected", quantifier: condition.quantifier ?? "any", direction: source.slice(10) as Comparison["direction"], targetType: condition.targetType ?? "all" })}>
        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="self">This object</SelectItem><SelectItem value="connected:any">Connected to</SelectItem><SelectItem value="connected:outgoing">Outgoing to</SelectItem><SelectItem value="connected:incoming">Incoming from</SelectItem></SelectContent>
      </Select>
      {condition.source === "connected" && <>
        <Select value={condition.quantifier ?? "any"} onValueChange={(quantifier) => onChange({ ...condition, quantifier: quantifier as Comparison["quantifier"] })}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="any">at least one</SelectItem><SelectItem value="all">every</SelectItem><SelectItem value="none">none</SelectItem></SelectContent>
        </Select>
        <TargetSelect value={condition.targetType ?? "all"} onChange={(targetType) => onChange({ ...condition, targetType })} options={targetOptions} allLabel="connected object" />
      </>}
      <Select value={fieldValue} onValueChange={(field) => onChange(field.startsWith("attribute:") ? { ...condition, field: "attribute", attribute: field.slice(10) } : { ...condition, field: field as Comparison["field"], attribute: undefined })}>
        <SelectTrigger className="h-8"><SelectValue placeholder="Choose a field" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="name">Name</SelectItem><SelectItem value="description">Description</SelectItem><SelectItem value="type">Type</SelectItem>
          {attributes.length > 0 && <><SelectSeparator /><SelectGroup><SelectLabel>Attributes</SelectLabel>{attributes.map((attribute) => <SelectItem key={attribute} value={`attribute:${attribute}`}>{attribute}</SelectItem>)}</SelectGroup></>}
          {condition.field === "attribute" && condition.attribute === "" && <SelectItem value="attribute:">Choose attribute…</SelectItem>}
        </SelectContent>
      </Select>
      <Select value={condition.operator} onValueChange={(operator) => onChange({ ...condition, operator: operator as Comparison["operator"] })}>
        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
        <SelectContent>{Object.entries(MODEL_RULE_OPERATOR_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
      </Select>
      {needsValue(condition.operator) ? <Input className="h-8" value={condition.value ?? ""} placeholder="value" onChange={(event) => onChange({ ...condition, value: event.target.value })} /> : <div />}
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
    </div>
  );
}

export function ModelRulesPanel({ open, onClose, height: panelHeight, onHeightChange }: Props) {
  const { viewId, projectId, projectType, localModelRules: initialRules, referencedModelRules } = useDiagramModel();
  const inheritedRules = projectType === "instance" ? referencedModelRules : NO_RULES;
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const [rules, setRules] = useState<ModelRule[]>(initialRules);
  const isInstanceEditor = projectType === "instance";
  const resizeStart = useRef<{ y: number; height: number } | null>(null);
  const updateView = useUpdateView();
  const { toast } = useToast();
  useEffect(() => setRules(initialRules), [initialRules, viewId]);

  const targetOptions = useMemo(() => getModelRuleTargetOptions(nodes), [nodes]);
  const getTargetLabel = (target: string) => target === "all"
    ? "all objects"
    : [...targetOptions.builtInTypes, ...targetOptions.viewTypes].find((option) => option.value === target)?.label ?? target;
  const attributes = useMemo(() => getModelRuleAttributeOptions(nodes), [nodes]);
  const allRules = useMemo(() => [...inheritedRules, ...rules], [inheritedRules, rules]);
  const inheritedRuleIds = useMemo(() => new Set(inheritedRules.map((rule) => rule.id)), [inheritedRules]);
  const results = useMemo(() => evaluateModelRuleResults(allRules, nodes, edges), [allRules, nodes, edges]);
  const rulesValid = rules.every((rule) => modelRuleSchema.safeParse(rule).success);
  const issueCount = results.filter((result) => result.outcome.kind === "issue").length;
  const updateRule = (id: string, patch: Partial<ModelRule>) => setRules((current) => current.map((rule) => rule.id === id ? { ...rule, ...patch } as ModelRule : rule));

  const save = async () => {
    if (!rulesValid) {
      toast({ title: "Finish configuring the rule", description: "Choose every attribute and enter each required value before saving.", variant: "destructive" });
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
          <p className="text-xs text-muted-foreground">{isInstanceEditor ? "Rules from the metamodels apply here and are read-only. Rules you add apply to this diagram only." : "Describe elements by their attributes and relationships, then add a tag or report an issue."}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setRules((current) => [...current, createRule()])}><Plus className="mr-1 h-4 w-4" />Add rule</Button>
          <Button size="sm" onClick={save} disabled={updateView.isPending || !rulesValid}><Save className="mr-1 h-4 w-4" />Save</Button>
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
              <p className="mt-2 text-muted-foreground">For {getTargetLabel(rule.targetType)}: when {describeModelRule(rule)}.</p>
              {rule.outcome ? <p className="mt-1">Then {rule.outcome.kind === "tag" ? `add “${rule.outcome.label}”` : `report a ${rule.outcome.severity}`}.</p> : null}
            </div>)}
          </section> : null}
          {isInstanceEditor ? <div className="mb-2 flex items-center gap-2"><h3 className="text-sm font-semibold">Rules of this diagram</h3><Badge variant="outline">{rules.length}</Badge></div> : null}
          {rules.length === 0 ? <div className="flex min-h-28 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground"><span className="max-w-md px-4 text-center">No rules yet. A rule looks like: every Battery whose capacity is below 100 Wh gets the tag “small”, or: report an issue for every Drone without a Battery.</span></div> : <div className="space-y-3">
            {rules.map((rule) => <div key={rule.id} className="space-y-3 rounded-lg border bg-muted/10 p-3">
              <div className="grid grid-cols-[auto_minmax(180px,1fr)_minmax(160px,0.7fr)_auto] items-center gap-2">
                <Switch checked={rule.enabled} onCheckedChange={(enabled) => updateRule(rule.id, { enabled })} aria-label={`Enable ${rule.name}`} />
                <div className="flex items-center gap-2"><Input value={rule.name} onChange={(event) => updateRule(rule.id, { name: event.target.value })} aria-label="Rule name" />{isInstanceEditor ? <Badge variant="outline" className="shrink-0">Instance rule</Badge> : null}</div>
                <TargetSelect value={rule.targetType} onChange={(targetType) => updateRule(rule.id, { targetType })} options={targetOptions} />
                <Button size="icon" variant="ghost" onClick={() => setRules((current) => current.filter((item) => item.id !== rule.id))} aria-label={`Delete ${rule.name}`}><Trash2 className="h-4 w-4" /></Button>
              </div>
              {rule.condition && rule.outcome ? <>
                <ConditionEditor condition={rule.condition} onChange={(condition) => updateRule(rule.id, { condition })} onDelete={() => undefined} targetOptions={targetOptions} attributes={attributes} />
                <div className="grid grid-cols-[70px_150px_minmax(140px,1fr)_130px] items-center gap-2 text-xs">
                  <span className="font-medium">Then</span>
                  <Select value={rule.outcome.kind} onValueChange={(kind) => updateRule(rule.id, { outcome: kind === "tag" ? { kind: "tag", label: "Descriptor", color: "#6366f1" } : { kind: "issue", severity: "warning" } })}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tag">add descriptor tag</SelectItem><SelectItem value="issue">report an issue</SelectItem></SelectContent>
                  </Select>
                  {rule.outcome.kind === "tag" ? <Input className="h-8" value={rule.outcome.label} placeholder="e.g. Heavy" onChange={(event) => updateRule(rule.id, { outcome: { kind: "tag", label: event.target.value, color: rule.outcome?.kind === "tag" ? rule.outcome.color : undefined } })} /> : <Input className="h-8" value={rule.outcome.message ?? ""} placeholder="Issue message (optional)" onChange={(event) => updateRule(rule.id, { outcome: { kind: "issue", severity: rule.outcome?.kind === "issue" ? rule.outcome.severity : "warning", message: event.target.value } })} />}
                  {rule.outcome.kind === "tag" ? <div className="flex items-center gap-2"><input type="color" value={rule.outcome.color ?? "#6366f1"} onChange={(event) => updateRule(rule.id, { outcome: { kind: "tag", label: rule.outcome?.kind === "tag" ? rule.outcome.label : "Descriptor", color: event.target.value } })} className="h-8 w-10 rounded border bg-transparent" /><span>Tag color</span></div> : <Select value={rule.outcome.severity} onValueChange={(severity) => updateRule(rule.id, { outcome: { kind: "issue", message: rule.outcome?.kind === "issue" ? rule.outcome.message : undefined, severity: severity as "warning" | "error" } })}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="warning">Warning</SelectItem><SelectItem value="error">Error</SelectItem></SelectContent></Select>}
                </div>
              </> : <div className="grid grid-cols-[1fr_180px_130px] items-center gap-2 rounded-md border bg-background p-2 text-xs"><span><Badge variant="outline" className="mr-2">Legacy check</Badge>{rule.check ? MODEL_RULE_CHECK_LABELS[rule.check] : "Incomplete rule"}</span><Select value={rule.check} onValueChange={(check) => updateRule(rule.id, { check: check as ModelRule["check"] })}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(MODEL_RULE_CHECK_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Select value={rule.severity ?? "warning"} onValueChange={(severity) => updateRule(rule.id, { severity: severity as "warning" | "error" })}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="warning">Warning</SelectItem><SelectItem value="error">Error</SelectItem></SelectContent></Select></div>}
            </div>)}
          </div>}
        </div>
        <aside className="overflow-y-auto border-l bg-muted/20 p-4"><h3 className="mb-2 text-sm font-semibold">Live results</h3>
          {results.length === 0 ? <div className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />No element matches a rule.</div> : <div className="space-y-2">{results.map((result, index) => <div key={`${result.ruleId}:${result.nodeId}:${index}`} className="rounded-md border bg-background p-2 text-xs"><div className="flex items-center gap-1 font-medium">{result.outcome.kind === "tag" ? <Tag className="h-3.5 w-3.5" style={{ color: result.outcome.color }} /> : <AlertTriangle className={result.outcome.severity === "error" ? "h-3.5 w-3.5 text-destructive" : "h-3.5 w-3.5 text-amber-500"} />}{result.ruleName}<Badge variant="outline" className="ml-auto text-[9px]">{inheritedRuleIds.has(result.ruleId) ? "Metamodel" : "This diagram"}</Badge></div><p className="mt-1 text-muted-foreground">{result.message}</p></div>)}</div>}
        </aside>
      </div>
    </section>
  );
}
