import { ChevronDown } from "lucide-react";
import { formatMultiselectValue, parseMultiselectValue } from "@shared/attribute-values";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Picks any number of an attribute's options. The menu stays open while
 * options are ticked; the trigger shows the chosen ones.
 */
export function MultiselectValue({
  options,
  value,
  onChange,
  disabled,
  ariaLabel,
  className,
  testId,
  onOpen,
}: {
  options: string[];
  /** The stored value: a JSON array of the chosen options. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
  testId?: string;
  /** Called when the menu opens (the table uses it to start an undoable edit). */
  onOpen?: () => void;
}) {
  const selected = parseMultiselectValue(value).filter((option) => options.includes(option));
  const toggle = (option: string, checked: boolean) =>
    onChange(
      formatMultiselectValue(checked ? [...selected, option] : selected.filter((item) => item !== option), options),
    );
  return (
    <DropdownMenu onOpenChange={(open) => open && onOpen?.()}>
      <DropdownMenuTrigger
        disabled={disabled || options.length === 0}
        aria-label={ariaLabel}
        data-testid={testId}
        data-attribute-value={selected.join(", ")}
        className={cn(
          "flex h-8 min-w-[150px] max-w-[260px] items-center justify-between gap-2 rounded-md border border-input bg-background px-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <span className={cn("truncate", selected.length === 0 && "text-muted-foreground")}>
          {selected.length ? selected.join(", ") : options.length ? "Choose" : "No options yet"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(event) => event.stopPropagation()}>
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option}
            checked={selected.includes(option)}
            onCheckedChange={(checked) => toggle(option, checked === true)}
            // Keep the menu open, so several options can be ticked in a row.
            onSelect={(event) => event.preventDefault()}
          >
            {option}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
