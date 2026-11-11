import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Project } from "@shared/schema";
import {
  getMetamodelPurposeRecommendation,
  magicNodeTypeCatalog,
  magicRelationTypeCatalog,
  metamodelPurposeCatalog,
  normalizeMetamodelSetup,
  type MagicNodeType,
  type MagicRelationType,
  type MetamodelPurpose,
} from "@shared/metamodel-setup";
import { BLANK_METAMODEL, isBlankStart, type ProjectStartOption } from "@/lib/project-templates";
import { getProjectTypeMeta } from "./project-types";
import type { CreateProjectRequest } from "./useProjectCreation";

const NO_METAMODEL = "none";

export interface ProjectCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Blank options and templates (`projectStartOptions`). */
  options: ProjectStartOption[];
  /** The user's metamodels, offered as the basis of a new model. */
  metamodels: Project[];
  /** Opens directly on the details of this start (e.g. "New model from this metamodel"). */
  initialStart?: string;
  initialBasedOn?: number | null;
  isCreating: boolean;
  onCreate: (request: CreateProjectRequest) => void;
}

/**
 * Creating a project in two steps: what to start from (an empty metamodel or
 * model, or a project template), then its name and the few choices that
 * apply to that start.
 */
export function ProjectCreateDialog({
  open,
  onOpenChange,
  options,
  metamodels,
  initialStart,
  initialBasedOn = null,
  isCreating,
  onCreate,
}: ProjectCreateDialogProps) {
  const [startId, setStartId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [basedOn, setBasedOn] = useState<number | null>(null);
  const [purpose, setPurpose] = useState<MetamodelPurpose>("custom");
  const [setupDescription, setSetupDescription] = useState("");
  const [nodeTypes, setNodeTypes] = useState<MagicNodeType[]>(getMetamodelPurposeRecommendation("custom").nodeTypes);
  const [relationTypes, setRelationTypes] = useState<MagicRelationType[]>(
    getMetamodelPurposeRecommendation("custom").relationTypes,
  );

  const choose = (id: string) => {
    const option = options.find((candidate) => candidate.id === id);
    setStartId(id);
    setName(option?.template?.projectName ?? "");
    setDescription(option?.template?.projectDescription ?? "");
  };

  // Every opening starts fresh, on the requested start if there is one.
  useEffect(() => {
    if (!open) return;
    const recommendation = getMetamodelPurposeRecommendation("custom");
    setPurpose("custom");
    setSetupDescription("");
    setNodeTypes(recommendation.nodeTypes);
    setRelationTypes(recommendation.relationTypes);
    setBasedOn(initialBasedOn);
    setStartId(null);
    setName("");
    setDescription("");
    if (initialStart) choose(initialStart);
    // `choose` reads `options`; re-running when they load would reset the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialStart, initialBasedOn]);

  const start = options.find((option) => option.id === startId);
  const isMetamodel = start?.projectType === "metamodel";
  const kind = isMetamodel ? "metamodel" : "model";

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!start || !name.trim()) return;
    if (isBlankStart(start.id)) {
      onCreate({
        kind: "blank",
        projectType: start.projectType,
        name: name.trim(),
        description: description.trim(),
        basedOn: start.projectType === "instance" ? basedOn : null,
        metamodelSetup:
          start.id === BLANK_METAMODEL
            ? normalizeMetamodelSetup({
                version: 1,
                purpose,
                description: setupDescription,
                nodeTypes,
                relationTypes,
              })
            : null,
      });
    } else {
      onCreate({ kind: "template", templateId: start.id, name: name.trim(), description: description.trim() });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-h-[90vh] overflow-y-auto sm:max-w-[620px]">
        {!start ? (
          <>
            <DialogHeader>
              <DialogTitle>New project</DialogTitle>
              <DialogDescription>
                Start empty, or from a project template with a first diagram to build on.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 grid gap-2" role="list">
              {options.map((option, index) => {
                const meta = getProjectTypeMeta(option.projectType);
                const Icon = meta.icon;
                return (
                  <div key={option.id} role="listitem">
                    {index === 2 && (
                      <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Project templates
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => choose(option.id)}
                      className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
                      data-testid={`select-template-${option.id}`}
                    >
                      <div className={`rounded-lg p-2 ${meta.iconClassName}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{option.name}</p>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                        {option.template && option.template.includedMetamodels.length > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Comes with the metamodel {option.template.includedMetamodels.join(", ")}
                          </p>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{isBlankStart(start.id) ? `New ${kind}` : start.name}</DialogTitle>
              <DialogDescription>
                {isBlankStart(start.id)
                  ? start.description
                  : `Creates a ${kind} from this template${
                      start.template?.includedMetamodels.length
                        ? `, together with its metamodel ${start.template.includedMetamodels.join(", ")}`
                        : ""
                    }.`}
              </DialogDescription>
            </DialogHeader>
            <button
              type="button"
              onClick={() => setStartId(null)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              data-testid="button-change-start"
            >
              <ArrowLeft className="h-3 w-3" /> Start from something else
            </button>

            <div className="space-y-2">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={isMetamodel ? "e.g. Drone types" : "e.g. Delivery drone"}
                autoFocus
                data-testid="input-project-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-description">
                Description <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="project-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What is it about?"
                data-testid="input-project-description"
              />
            </div>

            {start.id !== BLANK_METAMODEL && isBlankStart(start.id) && (
              <div className="space-y-2">
                <Label>Types from</Label>
                <Select
                  value={basedOn ? String(basedOn) : NO_METAMODEL}
                  onValueChange={(value) => setBasedOn(value === NO_METAMODEL ? null : Number(value))}
                >
                  <SelectTrigger data-testid="select-based-on">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_METAMODEL}>Built-in types (Object, Behavior, …)</SelectItem>
                    {metamodels.map((metamodel) => (
                      <SelectItem key={metamodel.id} value={String(metamodel.id)} data-testid={`option-based-on-${metamodel.id}`}>
                        {metamodel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The model's elements are typed by this metamodel. You can change it later with Reference Metamodels.
                </p>
              </div>
            )}

            {start.id === BLANK_METAMODEL && (
              <div className="space-y-3 rounded-2xl border border-violet-200/70 bg-violet-50/50 p-4 dark:border-violet-900/60 dark:bg-violet-950/20">
                <div className="space-y-1">
                  <Label className="text-sm">What is the metamodel for?</Label>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Pick the closest purpose; it suggests which kinds and relationship types to offer. You can change this at any time.
                  </p>
                </div>
                <RadioGroup
                  value={purpose}
                  onValueChange={(value) => {
                    const next = value as MetamodelPurpose;
                    const recommendation = getMetamodelPurposeRecommendation(next);
                    setPurpose(next);
                    setNodeTypes(recommendation.nodeTypes);
                    setRelationTypes(recommendation.relationTypes);
                  }}
                  className="grid gap-2 sm:grid-cols-2"
                >
                  {metamodelPurposeCatalog.map((item) => (
                    <div key={item.id}>
                      <RadioGroupItem value={item.id} id={`metamodel-purpose-${item.id}`} className="peer sr-only" />
                      <Label
                        htmlFor={`metamodel-purpose-${item.id}`}
                        className="block cursor-pointer rounded-xl border border-border bg-background p-3 transition-colors hover:border-violet-300 peer-data-[state=checked]:border-violet-500 peer-data-[state=checked]:bg-violet-100/70 dark:peer-data-[state=checked]:bg-violet-950/40"
                      >
                        <span className="block text-sm font-medium">{item.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description}</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
                <Collapsible>
                  <CollapsibleTrigger
                    className="group flex items-center gap-1 text-xs font-medium text-violet-700 dark:text-violet-300"
                    data-testid="button-adjust-vocabulary"
                  >
                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
                    Customize kinds and relationship types
                    <span className="font-normal text-muted-foreground">
                      ({nodeTypes.length} of {magicNodeTypeCatalog.length} kinds, {relationTypes.length} of{" "}
                      {magicRelationTypeCatalog.length} relationship types)
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 pt-3">
                    <div className="space-y-2">
                      <Label htmlFor="metamodel-setup-description">
                        Describe it briefly <span className="font-normal text-muted-foreground">(optional)</span>
                      </Label>
                      <Textarea
                        id="metamodel-setup-description"
                        value={setupDescription}
                        onChange={(event) => setSetupDescription(event.target.value)}
                        placeholder="e.g. A language for modeling autonomous warehouse systems"
                        className="resize-none bg-background"
                        rows={2}
                        data-testid="input-metamodel-setup-description"
                      />
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <TypeSelectionList
                        title="Kinds"
                        description="The kinds of types you will define."
                        items={magicNodeTypeCatalog}
                        selected={nodeTypes}
                        onToggle={(type) =>
                          setNodeTypes((current) =>
                            current.includes(type)
                              ? current.length > 1
                                ? current.filter((item) => item !== type)
                                : current
                              : [...current, type],
                          )
                        }
                        testIdPrefix="checkbox-metamodel-node"
                      />
                      <TypeSelectionList
                        title="Relationship types"
                        description="How your types can be connected."
                        items={magicRelationTypeCatalog}
                        selected={relationTypes}
                        onToggle={(type) =>
                          setRelationTypes((current) =>
                            current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
                          )
                        }
                        testIdPrefix="checkbox-metamodel-relation"
                      />
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">
                      This only decides what the Add elements tab offers. You can change it later, and nothing is removed.
                    </p>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating || !name.trim()} data-testid="button-create-project">
                {isCreating ? "Creating…" : `Create ${kind}`}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

type TypeSelectionListProps<T extends { id: string; label: string; description: string }> = {
  title: string;
  description: string;
  items: readonly T[];
  selected: string[];
  onToggle: (id: T["id"]) => void;
  testIdPrefix: string;
};

function TypeSelectionList<T extends { id: string; label: string; description: string }>({
  title,
  description,
  items,
  selected,
  onToggle,
  testIdPrefix,
}: TypeSelectionListProps<T>) {
  return (
    <div className="space-y-2">
      <div>
        <Label>{title}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <label
            key={item.id}
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/70 bg-background p-2.5 hover:border-violet-300"
          >
            <Checkbox
              checked={selected.includes(item.id)}
              onCheckedChange={() => onToggle(item.id)}
              aria-label={item.label}
              data-testid={`${testIdPrefix}-${item.id}`}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{item.label}</span>
              <span className="block text-[11px] leading-4 text-muted-foreground">{item.description}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
