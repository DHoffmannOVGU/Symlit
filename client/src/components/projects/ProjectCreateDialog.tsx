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
import {
  PROJECT_TEMPLATES,
  type ProjectTemplateId,
} from "@/lib/project-templates";
import { getProjectTypeMeta } from "./project-types";

export interface ProjectCreateDialogProps {
  open: boolean;
  projectName: string;
  projectDescription: string;
  projectType: ProjectType;
  selectedTemplateId: ProjectTemplateId;
  metamodelPurpose: MetamodelPurpose;
  metamodelSetupDescription: string;
  selectedMagicNodeTypes: MagicNodeType[];
  selectedMagicRelationTypes: MagicRelationType[];
  isCreating: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onTemplateSelect: (templateId: ProjectTemplateId) => void;
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
            {projectType === "metamodel" ? "Start a new metamodel" : "Create Project"}
          </DialogTitle>
          <DialogDescription>
            {projectType === "metamodel"
              ? "Choose the modeling vocabulary that should be visible while you build it."
              : "Start a new engineering project container."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label>Start from a template</Label>
            <div className="grid gap-2">
              {PROJECT_TEMPLATES.map((template) => {
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
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Project Type</Label>
            <RadioGroup
              value={projectType}
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
                  Instance Model
                </Label>
              </div>
            </RadioGroup>
          </div>

          {projectType === "metamodel" && (
            <div className="space-y-5 rounded-2xl border border-violet-200/70 bg-violet-50/50 p-4 dark:border-violet-900/60 dark:bg-violet-950/20">
              <div className="space-y-1">
                <Label className="text-base">What do you want to create?</Label>
                <p className="text-xs leading-5 text-muted-foreground">
                  We’ll suggest a focused set of magic types. You can adjust it before creating the metamodel.
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
              <div className="grid gap-5 sm:grid-cols-2">
                <TypeSelectionList
                  title="Suggested node types"
                  description="Choose the concepts you need to define."
                  items={magicNodeTypeCatalog}
                  selected={selectedMagicNodeTypes}
                  onToggle={onToggleMagicNodeType}
                  testIdPrefix="checkbox-metamodel-node"
                />
                <TypeSelectionList
                  title="Suggested relation types"
                  description="Choose how your concepts can connect."
                  items={magicRelationTypeCatalog}
                  selected={selectedMagicRelationTypes}
                  onToggle={onToggleMagicRelationType}
                  testIdPrefix="checkbox-metamodel-relation"
                />
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                These choices control what is offered in the creation palette. They do not remove existing content or prevent you from expanding the vocabulary later.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={projectName}
              onChange={(event) => onProjectNameChange(event.target.value)}
              placeholder="e.g. Avionics Control System"
              autoFocus
              data-testid="input-project-name"
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={projectDescription}
              onChange={(event) => onProjectDescriptionChange(event.target.value)}
              placeholder="Brief overview..."
              data-testid="input-project-description"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating || !projectName.trim()}
              data-testid="button-create-project"
            >
              {isCreating ? "Creating..." : "Create Project"}
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
