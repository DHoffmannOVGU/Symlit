import {
  displayRelatedFormula,
  storeRelatedFormula,
  unlinkedRelatedReferences,
  type AggregateExplanation,
} from "@shared/related-formula";
import type { NodeAttribute } from "../../types";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRelatedCalculation } from "../../related/RelatedCalculationProvider";

export interface RelatedFormulaState {
  value?: string;
  error?: string;
  pending?: string;
  explanations?: AggregateExplanation[];
  note?: string;
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** What one aggregate looked at, in a sentence. */
export function describeExplanation(explanation: AggregateExplanation): string {
  const parts = [
    explanation.used.length
      ? `${plural(explanation.used.length, "related element")}: ${explanation.used.join(", ")}`
      : "no related element",
  ];
  if (explanation.leftOut) parts.push(`${explanation.leftOut} left out by the condition`);
  if (explanation.without) parts.push(`${explanation.without} without the attribute`);
  return parts.join("; ");
}

/**
 * The formula of a Related Formula attribute: calculated over the elements
 * this one is related to, for example sum([mass] of "consists of").
 */
export function RelatedFormulaEditor({
  nodeId,
  index,
  attr,
  attributes,
  draft,
  state,
  onDraftChange,
  onStoredChange,
  onAutoResize,
}: {
  nodeId: string | undefined;
  index: number;
  attr: NodeAttribute;
  /** The element's attributes, as edited. */
  attributes: NodeAttribute[];
  /** What is being typed; undefined when nothing was typed since it opened. */
  draft: string | undefined;
  state: RelatedFormulaState | undefined;
  onDraftChange: (text: string) => void;
  /** The formula as stored: references by id where they name one attribute. */
  onStoredChange: (formula: string) => void;
  onAutoResize: (element: HTMLTextAreaElement) => void;
}) {
  const { relationshipsOf, formulaContext } = useRelatedCalculation();
  const relationships = nodeId ? relationshipsOf(nodeId) : [];
  const context = formulaContext(nodeId ?? "", attributes, attr.id);
  // Shown by the attributes' names now, so a rename shows here.
  const formula = draft ?? displayRelatedFormula(attr.formula ?? "", context);
  const unlinked = unlinkedRelatedReferences(attr.formula ?? "");
  const change = (text: string) => {
    onDraftChange(text);
    onStoredChange(storeRelatedFormula(text, context));
  };
  const insert = (text: string) => change(formula ? `${formula}${/\s$/.test(formula) ? "" : " "}${text}` : text);
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs" htmlFor={`related-formula-${index}`}>
          Formula over related elements
        </Label>
        <Textarea
          id={`related-formula-${index}`}
          value={formula}
          onChange={(event) => {
            change(event.target.value);
            onAutoResize(event.currentTarget);
          }}
          onInput={(event) => onAutoResize(event.currentTarget)}
          placeholder='sum([mass] of "consists of")'
          className="min-h-10 h-auto resize-none font-mono text-sm"
          rows={2}
          data-testid={`input-attr-formula-${index}`}
        />
        <p className="text-[11px] leading-4 text-muted-foreground" data-testid={`related-formula-syntax-${index}`}>
          count, sum, avg, min or max of the elements a relationship leads to:{" "}
          <code>sum([mass] of "consists of")</code>, <code>count(of incoming "feeds")</code>,{" "}
          <code>count(of all)</code>. Add <code>where</code> to keep some:{" "}
          <code>where [status] = "released" and [mass] &gt; 1</code>. Inside, attributes are those of the related
          element; outside, those of this one. References follow renames, as in a Derived Formula. Each relationship
          counts once, from all diagrams of the project.
        </p>
        {relationships.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]" data-testid={`related-formula-relationships-${index}`}>
            <span className="text-muted-foreground">Its relationships:</span>
            {relationships.map((relationship) => {
              const text =
                relationship.direction === "outgoing"
                  ? `of "${relationship.name}"`
                  : `of incoming "${relationship.name}"`;
              return (
                <button
                  key={`${relationship.direction}-${relationship.name}`}
                  type="button"
                  className="rounded-full border border-border bg-muted/40 px-2 py-0.5 font-mono hover:bg-muted"
                  title={`Insert ${text}`}
                  onClick={() => insert(text)}
                >
                  {text} · {relationship.count}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      {unlinked.length > 0 ? (
        <p className="text-[11px] leading-4 text-muted-foreground" data-testid={`related-formula-by-name-${index}`}>
          By name: {unlinked.map((name) => `[${name}]`).join(", ")}. The related elements have separate attributes of
          this name (or none are related yet), so it is matched by name and does not follow a rename. References to
          attributes the related elements share, because they got them from one type, follow renames.
        </p>
      ) : null}
      <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm" data-testid={`related-formula-result-${index}`}>
        {state?.error ? (
          <p className="text-destructive">Invalid formula: {state.error}</p>
        ) : state?.note ? (
          <p className="text-muted-foreground">{state.note}</p>
        ) : state?.pending ? (
          <p className="text-muted-foreground">Not calculated yet: {state.pending}</p>
        ) : state?.value !== undefined ? (
          <p>
            Calculated value: <span className="font-medium">{state.value}</span>
          </p>
        ) : (
          <p className="text-muted-foreground">Calculated from the project's relationships once they are loaded.</p>
        )}
        {(state?.explanations ?? []).map((explanation, position) => (
          <p key={position} className="mt-1 text-xs text-muted-foreground" data-testid={`related-formula-used-${index}`}>
            {describeExplanation(explanation)}
          </p>
        ))}
      </div>
    </div>
  );
}
