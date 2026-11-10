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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Box, Layers } from "lucide-react";
import type { ProjectType } from "@shared/schema";
import {
  magicNodeTypeCatalog,
  magicRelationTypeCatalog,
  metamodelPurposeCatalog,
  type MagicNodeType,
  type MagicRelationType,
  type MetamodelPurpose,
} from "@shared/metamodel-setup";
import { BLANK_TEMPLATE_ID, type ProjectTemplateOption } from "@/lib/project-templates";
import { getProjectTypeMeta } from "./project-types";

export interface ProjectCreateDialogProps {
  open: boolean;
  projectName: string;
  projectDescription: string;
  projectType: ProjectType;
  templates: ProjectTemplateOption[];
  selectedTemplateId: string;
  metamodelPurpose: MetamodelPurpose;
  metamodelSetupDescription: string;
  selectedMagicNodeTypes: MagicNodeType[];
  selectedMagicRelationTypes: MagicRelationType[];
  isCreating: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onTemplateSelect: (templateId: string) => void;
  onProjectTypeChange: (projectType: ProjectType) => void;
  onProjectNameChange: (value: string) => void;
  onProjectDescriptionChange: (value: string) => void;
  onMetamodelPurposeChange: (purpose: MetamodelPurpose) => void;
  onMetamodelSetupDescriptionChange: (value: string) => void;
  onToggleMagicNodeType: (type: MagicNodeType) => void;
  onToggleMagicRelationType: (type: MagicRelationType) => void;
}

export function ProjectCreateDialog({
  open,
  projectName,
  projectDescription,
  projectType,
  templates,
  selectedTemplateId,
  metamodelPurpose,
  metamodelSetupDescription,
  selectedMagicNodeTypes,
  selectedMagicRelationTypes,
  isCreating,
  onOpenChange,
  onSubmit,
  onTemplateSelect,
  onProjectTypeChange,
  onProjectNameChange,
  onProjectDescriptionChange,
  onMetamodelPurposeChange,
  onMetamodelSetupDescriptionChange,
  onToggleMagicNodeType,
  onToggleMagicRelationType,
}: ProjectCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-h-[90vh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>
            {projectType === "metamodel" ? "New metamodel" : "New project"}
          </DialogTitle>
          <DialogDescription>
            {projectType === "metamodel"
              ? "A metamodel defines the types and relationships that models are built from."
              : "A model is built from elements; reference a metamodel later to use your own types."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              value={projectName}
              onChange={(event) => onProjectNameChange(event.target.value)}
              placeholder="e.g. Avionics Control System"
              id="project-name"
              autoFocus
              data-testid="input-project-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-description">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input
              value={projectDescription}
              onChange={(event) => onProjectDescriptionChange(event.target.value)}
              id="project-description"
              placeholder="What is this project about?"
              data-testid="input-project-description"
            />
          </div>
          <div className="space-y-2">
            <Label>Start from a template</Label>
            <div className="grid gap-2">
              {templates.map((template) => {
                const templateMeta = getProjectTypeMeta(template.projectType);
                const TemplateIcon = templateMeta.icon;
                const isSelected = selectedTemplateId === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => onTemplateSelect(template.id)}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                    data-testid={`select-template-${template.id}`}
                  >
                    <div className={`rounded-lg p-2 ${templateMeta.iconClassName}`}>
                      <TemplateIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{template.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {template.description}
                      </p>
                      {template.includedMetamodels.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Includes metamodel: {template.includedMetamodels.join(", ")}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Kind of project</Label>
            <RadioGroup
              value={projectType}
              // A template decides the project type; only a blank project can choose.
              disabled={selectedTemplateId !== BLANK_TEMPLATE_ID}
              onValueChange={(value) => onProjectTypeChange(value as ProjectType)}
              className="flex flex-wrap gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="metamodel" id="type-metamodel" data-testid="radio-metamodel" />
                <Label htmlFor="type-metamodel" className="flex cursor-pointer items-center gap-2">
                  <Layers className="h-4 w-4 text-violet-500" />
                  Metamodel
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="instance" id="type-instance" data-testid="radio-instance" />
                <Label htmlFor="type-instance" className="flex cursor-pointer items-center gap-2">
                  <Box className="h-4 w-4 text-emerald-500" />
                  Model
                </Label>
              </div>
            </RadioGroup>
          </div>

          {projectType === "metamodel" && (
            <div className="space-y-5 rounded-2xl border border-violet-200/70 bg-violet-50/50 p-4 dark:border-violet-900/60 dark:bg-violet-950/20">
              <div className="space-y-1">
                <Label className="text-base">What is the metamodel for?</Label>
                <p className="text-xs leading-5 text-muted-foreground">
                  Pick the closest purpose; it suggests which kinds and relationship types to offer. You can change this at any time.
                </p>
              </div>
              <RadioGroup
                value={metamodelPurpose}
                onValueChange={(value) => onMetamodelPurposeChange(value as MetamodelPurpose)}
                className="grid gap-2 sm:grid-cols-2"
              >
                {metamodelPurposeCatalog.map((purpose) => (
                  <div key={purpose.id}>
                    <RadioGroupItem
                      value={purpose.id}
                      id={`metamodel-purpose-${purpose.id}`}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={`metamodel-purpose-${purpose.id}`}
                      className="block cursor-pointer rounded-xl border border-border bg-background p-3 transition-colors hover:border-violet-300 peer-data-[state=checked]:border-violet-500 peer-data-[state=checked]:bg-violet-100/70 dark:peer-data-[state=checked]:bg-violet-950/40"
                    >
                      <span className="block text-sm font-medium">{purpose.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {purpose.description}
                      </span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              <div className="space-y-2">
                <Label htmlFor="metamodel-setup-description">
                  Describe it briefly <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="metamodel-setup-description"
                  value={metamodelSetupDescription}
                  onChange={(event) => onMetamodelSetupDescriptionChange(event.target.value)}
                  placeholder="e.g. A language for modeling autonomous warehouse systems"
                  className="resize-none bg-background"
                  rows={2}
                  data-testid="input-metamodel-setup-description"
                />
              </div>
              <details className="group rounded-xl border border-border bg-background" data-testid="metamodel-vocabulary-details">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <span>
                    <span className="font-medium">Customize kinds and relationship types</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {selectedMagicNodeTypes.length} of {magicNodeTypeCatalog.length} kinds and{" "}
                      {selectedMagicRelationTypes.length} of {magicRelationTypeCatalog.length} relationship types selected
                    </span>
                  </span>
                  <span className="text-xs text-primary group-open:hidden">Show</span>
                  <span className="hidden text-xs text-primary group-open:inline">Hide</span>
                </summary>
              <div className="grid gap-5 border-t p-3 sm:grid-cols-2">
                <TypeSelectionList
                  title="Kinds"
                  description="Choose the concepts you need to define."
                  items={magicNodeTypeCatalog}
                  selected={selectedMagicNodeTypes}
                  onToggle={onToggleMagicNodeType}
                  testIdPrefix="checkbox-metamodel-node"
                />
                <TypeSelectionList
                  title="Relationship types"
                  description="Choose how your concepts can connect."
                  items={magicRelationTypeCatalog}
                  selected={selectedMagicRelationTypes}
                  onToggle={onToggleMagicRelationType}
                  testIdPrefix="checkbox-metamodel-relation"
                />
              </div>
              <p className="px-3 pb-3 text-xs leading-5 text-muted-foreground">
                This only decides what the Add elements tab offers. You can change it later, and nothing is removed.
              </p>
              </details>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating || !projectName.trim()}
              data-testid="button-create-project"
            >
              {isCreating ? "Creating…" : projectType === "metamodel" ? "Create metamodel" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
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
              <span className="block text-[11px] leading-4 text-muted-foreground">
                {item.description}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
