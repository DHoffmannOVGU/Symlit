import { useState } from "react";
import { Check, ChevronDown, PenLine } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { findUnit, searchUnits } from "@shared/units";

interface UnitPickerProps {
  value: string;
  onChange: (unit: string) => void;
  testId?: string;
}

/**
 * Picks a unit from the catalog, grouped by quantity and searchable by symbol,
 * name or quantity. A unit the catalog does not know can still be used; it is
 * shown as custom.
 */
export function UnitPicker({ value, onChange, testId = "unit-picker" }: UnitPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = value.trim();
  const known = current ? findUnit(current) : undefined;
  const groups = searchUnits(query);
  const typed = query.trim();
  const offerCustom = typed.length > 0 && !findUnit(typed);

  const choose = (unit: string) => {
    onChange(unit);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-background px-3 text-sm hover:bg-muted/50"
          data-testid={testId}
        >
          {current ? (
            <span className="flex min-w-0 items-center gap-2">
              <span className="font-medium">{current}</span>
              <span className="truncate text-xs text-muted-foreground">
                {known ? `${known.unit.name} · ${known.quantity}` : "custom unit"}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">No unit</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search: kg, energy, metre…"
            value={query}
            onValueChange={setQuery}
            data-testid={`${testId}-search`}
          />
          <CommandList className="max-h-[280px]">
            <CommandEmpty>No unit found.</CommandEmpty>
            {current && !typed ? (
              <CommandGroup>
                <CommandItem value="none" onSelect={() => choose("")}>
                  No unit
                </CommandItem>
              </CommandGroup>
            ) : null}
            {groups.map((group) => (
              <CommandGroup key={group.quantity} heading={group.quantity}>
                {group.units.map((unit) => (
                  <CommandItem
                    key={unit.symbol}
                    value={`${group.quantity}:${unit.symbol}`}
                    onSelect={() => choose(unit.symbol)}
                    data-testid={`${testId}-option-${unit.symbol}`}
                  >
                    <span className="w-14 font-medium">{unit.symbol}</span>
                    <span className="text-xs text-muted-foreground">{unit.name}</span>
                    <Check className={cn("ml-auto h-3.5 w-3.5", unit.symbol === current ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            {offerCustom ? (
              <CommandGroup heading="Not in the catalog">
                <CommandItem value={`custom:${typed}`} onSelect={() => choose(typed)} data-testid={`${testId}-custom`}>
                  <PenLine className="mr-2 h-3.5 w-3.5" />
                  Use “{typed}” as a custom unit
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
