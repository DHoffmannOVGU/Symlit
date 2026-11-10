import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  describeMultiplicity,
  isUnrestricted,
  MULTIPLICITY_HELP,
  MULTIPLICITY_PRESETS,
  parseMultiplicity,
} from "@shared/multiplicity";

export interface MultiplicityFieldProps {
  /** "target" or "source": used in ids and test ids. */
  end: "target" | "source";
  value: string;
  onChange: (value: string) => void;
  /** The type whose elements the limit applies to ("every Drone needs …"). */
  ownType: string;
  /** The type at the other end ("… to a Battery"). */
  otherType: string;
}

/**
 * One end of a metamodel relationship's multiplicity: a text field with
 * presets that says in words what the entry will require in a model.
 */
export function MultiplicityField({ end, value, onChange, ownType, otherType }: MultiplicityFieldProps) {
  const parsed = parseMultiplicity(value);
  const id = `edge-multiplicity-${end}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        How many {otherType} per {ownType}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="any number"
        aria-invalid={!parsed}
        aria-describedby={`${id}-help`}
        className={parsed ? "" : "border-destructive focus-visible:ring-destructive"}
        data-testid={end === "target" ? "input-edge-multiplicity" : "input-edge-source-multiplicity"}
      />
      <div className="flex flex-wrap gap-1.5">
        {MULTIPLICITY_PRESETS.map((preset) => (
          <Button
            key={preset}
            type="button"
            variant={value.replace(/\s+/g, "") === preset ? "default" : "outline"}
            size="sm"
            className="h-7 px-2 font-mono text-xs"
            onClick={() => onChange(preset)}
            data-testid={`button-${end}-multiplicity-${preset}`}
          >
            {preset}
          </Button>
        ))}
        <Button
          type="button"
          variant={value.trim() === "" ? "default" : "outline"}
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => onChange("")}
        >
          any
        </Button>
      </div>
      <p
        id={`${id}-help`}
        className={`text-xs ${parsed ? "text-muted-foreground" : "text-destructive"}`}
        data-testid={`text-${end}-multiplicity-meaning`}
      >
        {parsed
          ? isUnrestricted(parsed)
            ? `Any number: a ${ownType} needs none and may have many.`
            : `In a model, every ${ownType} needs ${describeMultiplicity(parsed)} of these relationships ${
                end === "target" ? "to" : "from"
              } a ${otherType}.`
          : MULTIPLICITY_HELP}
      </p>
    </div>
  );
}
