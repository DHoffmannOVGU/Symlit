import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProjectExportInput } from "@shared/routes";
import type { ProjectType } from "@shared/schema";

export interface ExportProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectType: ProjectType;
  referencedMetamodelCount: number;
  views: Array<{ id: number | string; name: string }>;
  isExporting: boolean;
  onExport: (options: ProjectExportInput) => void | Promise<void>;
}

export function ExportProjectDialog({
  open,
  onOpenChange,
  projectType,
  referencedMetamodelCount,
  views,
  isExporting,
  onExport,
}: ExportProjectDialogProps) {
  const [format, setFormat] = useState<ProjectExportInput["format"]>("json");
  const [selectedViewIds, setSelectedViewIds] = useState<number[]>([]);
  const [includeProjectDetails, setIncludeProjectDetails] = useState(true);
  const [includeElements, setIncludeElements] = useState(true);
  const [includeRelationships, setIncludeRelationships] = useState(true);
  const [includePatterns, setIncludePatterns] = useState(false);
  const [includeReferencedMetamodels, setIncludeReferencedMetamodels] =
    useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedViewIds(views.map((view) => Number(view.id)));
  }, [open, views]);

  const isMetamodel = projectType === "metamodel";
  const isInstance = projectType === "instance";
  const modelLabel = isMetamodel
    ? "Metamodel"
    : isInstance
      ? "Instance Model"
      : "Method Model";
  const elementLabel = isMetamodel
    ? "Class catalog"
    : isInstance
      ? "Model elements"
      : "Method steps";
  const relationshipLabel = isMetamodel
    ? "Metamodel relationships"
    : isInstance
      ? "Instance relationships"
      : "Method transitions";
  const isCsv = format !== "json";
  const canExport = isCsv
    ? selectedViewIds.length > 0
    : selectedViewIds.length > 0 || includeProjectDetails || includePatterns;

  const toggleView = (viewId: number, checked: boolean) => {
    setSelectedViewIds((current) =>
      checked
        ? Array.from(new Set([...current, viewId]))
        : current.filter((id) => id !== viewId),
    );
  };

  const submit = () => {
    onExport({
      format,
      viewIds: selectedViewIds,
      includeProjectDetails,
      includeElements,
      includeRelationships,
      includePatterns,
      includeReferencedMetamodels,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>
            Export {modelLabel}
          </DialogTitle>
          <DialogDescription>
            Choose the views, content, and download format you need.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          <div className="space-y-2">
            <Label>Download format</Label>
            <Select
              value={format}
              onValueChange={(value) =>
                setFormat(value as ProjectExportInput["format"])
              }
            >
              <SelectTrigger data-testid="select-export-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">Structured model package (JSON)</SelectItem>
                <SelectItem value="elements-csv">
                  {elementLabel} (CSV)
                </SelectItem>
                <SelectItem value="relationships-csv">
                  {relationshipLabel} (CSV)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {format === "json"
                ? "Best for backups, interchange, and further processing."
                : "A flat spreadsheet-friendly export across the selected views."}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Views</Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedViewIds(views.map((view) => Number(view.id)))}
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedViewIds([])}
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
              {views.length === 0 ? (
                <div className="text-xs text-muted-foreground">No views yet.</div>
              ) : (
                views.map((view) => {
                  const viewId = Number(view.id);
                  return (
                    <label key={view.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedViewIds.includes(viewId)}
                        onCheckedChange={(checked) =>
                          toggleView(viewId, checked === true)
                        }
                      />
                      <span>{view.name}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {!isCsv && (
            <div className="space-y-3">
              <Label>Package contents</Label>
              <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
                <ExportOption
                  checked={includeProjectDetails}
                  onChange={setIncludeProjectDetails}
                  label="Project details"
                />
                <ExportOption
                  checked={includeElements}
                  onChange={setIncludeElements}
                  label={isMetamodel ? "Classes and definitions" : elementLabel}
                />
                <ExportOption
                  checked={includeRelationships}
                  onChange={setIncludeRelationships}
                  label={relationshipLabel}
                />
                <ExportOption
                  checked={includePatterns}
                  onChange={setIncludePatterns}
                  label="Reusable patterns"
                />
                {projectType === "instance" && (
                  <ExportOption
                    checked={includeReferencedMetamodels}
                    onChange={setIncludeReferencedMetamodels}
                    label={`Referenced metamodel definitions (${referencedMetamodelCount})`}
                    disabled={referencedMetamodelCount === 0}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isExporting || !canExport}>
            {isExporting ? "Preparing download..." : "Download"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExportOption({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-2">
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <span className={disabled ? "text-muted-foreground" : ""}>{label}</span>
    </label>
  );
}
