import { useState } from "react";
import { AlertTriangle, ChevronsUpDown, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import type { Project } from "@shared/schema";

interface MetamodelSelectorProps {
  availableMetamodels: Project[];
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  unavailableMetamodelIds?: number[];
}

export function MetamodelSelector({ 
  availableMetamodels, 
  selectedIds, 
  onSelectionChange,
  unavailableMetamodelIds = [],
}: MetamodelSelectorProps) {
  const [open, setOpen] = useState(false);

  const toggleMetamodel = (id: number) => {
    const newSelection = selectedIds.includes(id)
      ? selectedIds.filter((sid) => sid !== id)
      : [...selectedIds, id];
    onSelectionChange(newSelection);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between w-full md:min-w-[200px] md:w-auto h-9 bg-background border-border hover:bg-accent"
          data-testid="button-metamodel-selector"
        >
          <div className="flex items-center gap-2 truncate">
            <Layers className="w-4 h-4 text-violet-500 shrink-0" />
            <span className="truncate">
              {selectedIds.length === 0
                ? "Reference Metamodels"
                : `${selectedIds.length} Metamodel${selectedIds.length > 1 ? "s" : ""} selected`}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] md:w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search metamodels..." />
          <CommandList>
            <CommandEmpty>No metamodel found.</CommandEmpty>
            <CommandGroup heading="Available Metamodels">
              {availableMetamodels.map((metamodel) => {
                const isUnavailable = unavailableMetamodelIds.includes(
                  metamodel.id,
                );
                return (
                  <CommandItem
                    key={metamodel.id}
                    onSelect={() => toggleMetamodel(metamodel.id)}
                    className="flex items-center gap-2 p-2"
                  >
                    <Checkbox
                      checked={selectedIds.includes(metamodel.id)}
                      onCheckedChange={() => toggleMetamodel(metamodel.id)}
                    />
                    {isUnavailable && (
                      <AlertTriangle
                        className="h-4 w-4 shrink-0 text-amber-500"
                        aria-hidden="true"
                      />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">
                        {metamodel.name}
                      </span>
                      {isUnavailable ? (
                        <span className="truncate text-xs text-amber-600">
                          Unavailable reference
                        </span>
                      ) : (
                        metamodel.description && (
                          <span className="truncate text-xs text-muted-foreground">
                            {metamodel.description}
                          </span>
                        )
                      )}
                    </div>
                    {isUnavailable && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onSelectionChange(
                            selectedIds.filter(
                              (selectedId) => selectedId !== metamodel.id,
                            ),
                          );
                        }}
                        aria-label={`Remove ${metamodel.name}`}
                        data-testid={`button-remove-unavailable-metamodel-${metamodel.id}`}
                      >
                        Remove
                      </Button>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
