import { useEffect, useState } from "react";
import { Edge, Node } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowDownRight,
  BadgeCheck,
  Boxes,
  Diamond,
  GitBranch,
  Link2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CustomEdgeData,
  getEdgeSemanticDefaults,
} from "../edges/CustomEdges";
import { inferFlowTypeFromNodes, type FlowType } from "../utils/flow-type";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  getMagicRelationTypeDefinition,
  magicRelationTypeCatalog,
  type MagicRelationType,
} from "@shared/metamodel-setup";

interface EdgeAttributePanelProps {
  edge: Edge | null;
  nodes?: Node[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (edgeId: string, data: CustomEdgeData) => void;
  onDelete: (edgeId: string) => void;
  allowedEdgeTypes?: MagicRelationType[];
  /** Multiplicities are set on a metamodel's relationships and checked in the models built from it. */
  projectType?: ProjectType;
  /** In a model: the multiplicity the metamodel gives this relationship, and the type names it is about. */
  metamodelMultiplicity?: { text: string; sourceType: string; targetType: string } | null;
}

import { Slider } from "@/components/ui/slider";
import type { ProjectType } from "@shared/schema";
import {
  describeMultiplicity,
  formatMultiplicity,
  isUnrestricted,
  MULTIPLICITY_HELP,
  MULTIPLICITY_PRESETS,
  parseMultiplicity,
} from "@shared/multiplicity";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const EDGE_COLORS = [
  { name: "Muted", value: "#94a3b8" },
  { name: "Primary", value: "#3b82f6" },
  { name: "Success", value: "#22c55e" },
  { name: "Warning", value: "#eab308" },
  { name: "Destructive", value: "#ef4444" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Slate", value: "#475569" },
];

export function EdgeAttributePanel({
  edge,
  nodes = [],
  isOpen,
  onClose,
  onSave,
  onDelete,
  allowedEdgeTypes,
  projectType = "metamodel",
  metamodelMultiplicity = null,
}: EdgeAttributePanelProps) {
  const [edgeType, setEdgeType] =
    useState<CustomEdgeData["edgeType"]>("association");
  const [flowType, setFlowType] = useState<FlowType>("partflow");
  const [label, setLabel] = useState("");
  const [multiplicity, setMultiplicity] = useState("");
  const [variability, setVariability] = useState<"mandatory" | "optional" | "">("");
  const [description, setDescription] = useState("");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [strokeColor, setStrokeColor] = useState("#94a3b8");
  const [lineStyle, setLineStyle] = useState<"solid" | "dashed" | "dotted">("solid");
  const [sourceArrow, setSourceArrow] = useState<"none" | "arrow" | "arrowclosed">("none");
  const [targetArrow, setTargetArrow] = useState<"none" | "arrow" | "arrowclosed">("arrowclosed");
  const [pathType, setPathType] = useState<"default" | "straight" | "step" | "smoothstep">("straight");
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (edge) {
      const data = edge.data as CustomEdgeData | undefined;
      const sourceNode = nodes.find((node) => node.id === edge.source);
      const targetNode = nodes.find((node) => node.id === edge.target);
      const inferredFlowType = inferFlowTypeFromNodes(sourceNode, targetNode);
      const resolvedEdgeType =
        (edge.type as CustomEdgeData["edgeType"] | undefined) ||
        data?.edgeType ||
        "association";
      setEdgeType(resolvedEdgeType);
      setFlowType((data?.flowType as FlowType | undefined) || inferredFlowType);
      setLabel(data?.label || "");
      setMultiplicity(data?.multiplicity || "");
      setVariability((data?.variability as "mandatory" | "optional" | undefined) || "");
      setDescription(data?.description || "");
      setStrokeWidth(data?.strokeWidth || 2);
      setStrokeColor(data?.strokeColor || "#94a3b8");
      const semanticDefaults = getEdgeSemanticDefaults(resolvedEdgeType);
      setLineStyle(data?.lineStyle || semanticDefaults.lineStyle || "solid");
      setSourceArrow(data?.sourceArrow || semanticDefaults.sourceArrow || "none");
      setTargetArrow(
        data?.targetArrow ?? semanticDefaults.targetArrow ?? "arrowclosed",
      );
      setPathType(data?.pathType || "straight");
      setAnimated(data?.animated || false);
    }
  }, [edge, nodes]);

  const parsedMultiplicity = parseMultiplicity(multiplicity);
  const endpointName = (nodeId: string | undefined, fallback: string) => {
    const data = nodes.find((node) => node.id === nodeId)?.data as { label?: string } | undefined;
    return data?.label || fallback;
  };

  const handleSave = () => {
    if (!edge) return;
    // A multiplicity that cannot be read would silently check nothing.
    if (projectType === "metamodel" && !parsedMultiplicity) return;

    const data: CustomEdgeData = {
      edgeType,
      flowType: edgeType === "association" ? flowType : undefined,
      label: label.trim() || undefined,
      multiplicity:
        projectType === "metamodel" && parsedMultiplicity && multiplicity.trim()
          ? formatMultiplicity(parsedMultiplicity)
          : multiplicity.trim() || undefined,
      variability:
        edgeType === "aggregation" || edgeType === "composition"
          ? variability || undefined
          : undefined,
      description: description.trim() || undefined,
      strokeWidth,
      strokeColor,
      lineStyle,
      sourceArrow,
      targetArrow,
      pathType,
      animated,
    };

    onSave(edge.id, data);
    onClose();
  };

  const handleDelete = () => {
    if (!edge) return;
    onDelete(edge.id);
  };

  const configuredEdgeTypes =
    allowedEdgeTypes ?? magicRelationTypeCatalog.map((relation) => relation.id);
  const visibleEdgeTypes = configuredEdgeTypes.includes(
    edgeType as MagicRelationType,
  )
    ? configuredEdgeTypes
    : [...configuredEdgeTypes, edgeType as MagicRelationType];

  if (!edge) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-[540px] overflow-y-auto px-4 sm:px-6" data-testid="edge-attribute-panel">
        <SheetHeader className="relative">
          <div className="flex items-center justify-between pr-8">
            <div>
              <SheetTitle>Edit relationship</SheetTitle>
              <SheetDescription>
                Label, kind, multiplicity and appearance of this relationship.
              </SheetDescription>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
              title="Delete relationship"
              data-testid="button-delete-edge"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          </div>
        </SheetHeader>

        <Tabs defaultValue="content" className="w-full mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="cardinality">Multiplicity</TabsTrigger>
            <TabsTrigger value="style">Styling</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="edge-label">Label</Label>
              <Input
                id="edge-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., contains, uses, depends on"
                data-testid="input-edge-label"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edge-description">Description</Label>
              <Textarea
                id="edge-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes about this relationship..."
                className="resize-none"
                rows={3}
                data-testid="input-edge-description"
              />
            </div>

            <div className="space-y-2">
              <Label>Relationship Type</Label>
              <ToggleGroup
                type="single"
                value={edgeType}
                onValueChange={(value) => {
                  const semanticDefaults = getEdgeSemanticDefaults(value);
                  setEdgeType(value);
                  setLineStyle(semanticDefaults.lineStyle || "solid");
                  setSourceArrow(semanticDefaults.sourceArrow || "none");
                  setTargetArrow(semanticDefaults.targetArrow || "none");
                }}
                className={cn(
                  "grid w-full rounded-lg bg-muted/50 p-1",
                  visibleEdgeTypes.length === 1
                    ? "grid-cols-1"
                    : visibleEdgeTypes.length === 2
                      ? "grid-cols-2"
                      : visibleEdgeTypes.length === 3
                        ? "grid-cols-3"
                        : "grid-cols-2",
                )}
                data-testid="toggle-edge-type"
              >
                {visibleEdgeTypes.map(
                  (type) => {
                    const isAssociation = type === "association";
                    const isAggregation = type === "aggregation";
                    const isComposition = type === "composition";
                    const isDependency = type === "dependency";
                    const isGeneralization = type === "generalization";
                    const relation = getMagicRelationTypeDefinition(type);
                    const Icon = isAssociation
                      ? Link2
                      : isAggregation
                        ? Diamond
                        : isComposition
                          ? Boxes
                          : isDependency
                            ? ArrowDownRight
                            : isGeneralization
                              ? GitBranch
                              : BadgeCheck;
                    return (
                      <ToggleGroupItem
                        key={type}
                        value={type}
                        aria-label={type}
                        className={cn(
                          "h-auto gap-2 rounded-md border border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground",
                          edgeType === type &&
                            "border-border bg-background text-foreground shadow-sm hover:bg-background",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4",
                            edgeType === type
                              ? "text-violet-600"
                              : "text-muted-foreground",
                          )}
                        />
                        <span>{relation?.label ?? type}</span>
                      </ToggleGroupItem>
                    );
                  },
                )}
              </ToggleGroup>
              <p className="text-xs text-muted-foreground">
                {getMagicRelationTypeDefinition(edgeType).description}
              </p>
            </div>

            {edgeType === "association" && (
              <div className="space-y-2">
                <Label>Flow Type</Label>
                <ToggleGroup
                  type="single"
                  value={flowType}
                  onValueChange={(value) => {
                    if (
                      value === "partflow" ||
                      value === "actionflow" ||
                      value === "informationflow"
                    ) {
                      setFlowType(value);
                    }
                  }}
                  className="grid w-full grid-cols-3 rounded-lg bg-muted/50 p-1"
                  data-testid="toggle-edge-flow-type"
                >
                  <ToggleGroupItem
                    value="partflow"
                    aria-label="Object Flow"
                    className={cn(
                      "h-auto gap-2 px-3 py-2 text-sm font-medium rounded-md border border-transparent bg-transparent text-muted-foreground",
                      flowType === "partflow" &&
                        "border-border bg-background text-foreground shadow-sm hover:bg-background",
                    )}
                  >
                    <Boxes
                      className={cn(
                        "h-4 w-4",
                        flowType === "partflow" ? "text-slate-600" : "text-muted-foreground",
                      )}
                    />
                    <span>Object</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="actionflow"
                    aria-label="Behavior Flow"
                    className={cn(
                      "h-auto gap-2 px-3 py-2 text-sm font-medium rounded-md border border-transparent bg-transparent text-muted-foreground",
                      flowType === "actionflow" &&
                        "border-border bg-background text-foreground shadow-sm hover:bg-background",
                    )}
                  >
                    <Sparkles
                      className={cn(
                        "h-4 w-4",
                        flowType === "actionflow" ? "text-emerald-600" : "text-muted-foreground",
                      )}
                    />
                    <span>Behavior</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="informationflow"
                    aria-label="Information Flow"
                    className={cn(
                      "h-auto gap-2 px-3 py-2 text-sm font-medium rounded-md border border-transparent bg-transparent text-muted-foreground",
                      flowType === "informationflow" &&
                        "border-border bg-background text-foreground shadow-sm hover:bg-background",
                    )}
                  >
                    <Link2
                      className={cn(
                        "h-4 w-4",
                        flowType === "informationflow" ? "text-violet-600" : "text-muted-foreground",
                      )}
                    />
                    <span>Info</span>
                  </ToggleGroupItem>
                </ToggleGroup>
                <p className="text-xs text-muted-foreground">
                  {flowType === "actionflow"
                    ? "Control flow between behaviors"
                    : flowType === "informationflow"
                    ? "Information transfer between elements"
                    : "Object flow involving behaviors and objects"}
                </p>
              </div>
            )}

          </TabsContent>

          <TabsContent value="cardinality" className="space-y-6 py-4">
            {projectType === "metamodel" ? (
              <div className="space-y-2">
                <Label htmlFor="edge-multiplicity">
                  How many {endpointName(edge?.target, "targets")} per {endpointName(edge?.source, "source")}
                </Label>
                <Input
                  id="edge-multiplicity"
                  value={multiplicity}
                  onChange={(e) => setMultiplicity(e.target.value)}
                  placeholder="any number"
                  aria-invalid={!parsedMultiplicity}
                  aria-describedby="edge-multiplicity-help"
                  className={parsedMultiplicity ? "" : "border-destructive focus-visible:ring-destructive"}
                  data-testid="input-edge-multiplicity"
                />
                <div className="flex flex-wrap gap-1.5">
                  {MULTIPLICITY_PRESETS.map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant={multiplicity.replace(/\s+/g, "") === preset ? "default" : "outline"}
                      size="sm"
                      className="h-7 px-2 font-mono text-xs"
                      onClick={() => setMultiplicity(preset)}
                      data-testid={`button-multiplicity-${preset}`}
                    >
                      {preset}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant={multiplicity.trim() === "" ? "default" : "outline"}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setMultiplicity("")}
                  >
                    any
                  </Button>
                </div>
                <p
                  id="edge-multiplicity-help"
                  className={`text-xs ${parsedMultiplicity ? "text-muted-foreground" : "text-destructive"}`}
                  data-testid="text-multiplicity-meaning"
                >
                  {parsedMultiplicity
                    ? isUnrestricted(parsedMultiplicity)
                      ? `A ${endpointName(edge?.source, "source")} may have any number of these relationships. Nothing is checked.`
                      : `In a model, every ${endpointName(edge?.source, "source")} needs ${describeMultiplicity(parsedMultiplicity)} of these relationships to a ${endpointName(edge?.target, "target")}. Validate reports elements that do not.`
                    : MULTIPLICITY_HELP}
                </p>
              </div>
            ) : (
              <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm" data-testid="text-multiplicity-from-metamodel">
                <p className="font-medium">Multiplicity</p>
                {metamodelMultiplicity ? (
                  <p className="text-muted-foreground">
                    The metamodel sets <span className="font-mono text-foreground">{metamodelMultiplicity.text}</span>:
                    every {metamodelMultiplicity.sourceType} needs{" "}
                    {describeMultiplicity(parseMultiplicity(metamodelMultiplicity.text) ?? { min: 0, max: null })} of
                    these relationships to a {metamodelMultiplicity.targetType}. Validate checks it.
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    The metamodel sets no limit for this relationship. Multiplicities are defined on a
                    metamodel's relationships and checked here when you validate.
                  </p>
                )}
              </div>
            )}

            {(edgeType === "aggregation" || edgeType === "composition") && (
              <div className="space-y-2">
                <Label>Variability</Label>
                <ToggleGroup
                  type="single"
                  value={variability}
                  onValueChange={(v) =>
                    setVariability(v as "mandatory" | "optional" | "")
                  }
                  className="grid w-full grid-cols-2 rounded-lg bg-muted/50 p-1"
                  data-testid="toggle-edge-variability"
                >
                  <ToggleGroupItem
                    value="mandatory"
                    aria-label="Mandatory"
                    className={cn(
                      "h-auto gap-2 px-3 py-2 text-sm font-medium rounded-md border border-transparent bg-transparent text-muted-foreground",
                      variability === "mandatory" &&
                        "border-border bg-background text-foreground shadow-sm hover:bg-background",
                    )}
                  >
                    <Diamond
                      className={cn(
                        "h-4 w-4",
                        variability === "mandatory" ? "text-rose-600" : "text-muted-foreground",
                      )}
                    />
                    <span>Mandatory</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="optional"
                    aria-label="Optional"
                    className={cn(
                      "h-auto gap-2 px-3 py-2 text-sm font-medium rounded-md border border-transparent bg-transparent text-muted-foreground",
                      variability === "optional" &&
                        "border-border bg-background text-foreground shadow-sm hover:bg-background",
                    )}
                  >
                    <Sparkles
                      className={cn(
                        "h-4 w-4",
                        variability === "optional" ? "text-emerald-600" : "text-muted-foreground",
                      )}
                    />
                    <span>Optional</span>
                  </ToggleGroupItem>
                </ToggleGroup>
                <p className="text-xs text-muted-foreground">
                  Specifies whether the part is required for the whole.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="style" className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Stroke Thickness</Label>
                  <span className="text-xs text-muted-foreground font-mono">{strokeWidth}px</span>
                </div>
                <Slider
                  value={[strokeWidth]}
                  min={1}
                  max={10}
                  step={1}
                  onValueChange={([v]) => setStrokeWidth(v)}
                  className="py-2"
                  data-testid="slider-edge-stroke-width"
                />
              </div>

              <div className="space-y-2">
                <Label>Line Style</Label>
                <Select value={lineStyle} onValueChange={(v) => setLineStyle(v as typeof lineStyle)}>
                  <SelectTrigger data-testid="select-edge-style">
                    <SelectValue placeholder="Select style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solid">Solid</SelectItem>
                    <SelectItem value="dashed">Dashed</SelectItem>
                    <SelectItem value="dotted">Dotted</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Arrow</Label>
                <Select 
                  value={sourceArrow || "none"} 
                  onValueChange={(v) => setSourceArrow(v as typeof sourceArrow)}
                >
                  <SelectTrigger data-testid="select-edge-source-arrow">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="arrow">Arrow (Open)</SelectItem>
                    <SelectItem value="arrowclosed">Arrow (Closed)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>End Arrow</Label>
                <Select 
                  value={targetArrow || "none"} 
                  onValueChange={(v) => setTargetArrow(v as typeof targetArrow)}
                >
                  <SelectTrigger data-testid="select-edge-target-arrow">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="arrow">Arrow (Open)</SelectItem>
                    <SelectItem value="arrowclosed">Arrow (Closed)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Path Type</Label>
                <Select 
                  value={pathType} 
                  onValueChange={(v) => setPathType(v as typeof pathType)}
                >
                  <SelectTrigger data-testid="select-edge-path-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Bezier</SelectItem>
                    <SelectItem value="straight">Straight</SelectItem>
                    <SelectItem value="smoothstep">Smooth Step</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex flex-col justify-end">
                <div className="flex items-center space-x-2 pb-2">
                  <input
                    type="checkbox"
                    id="edge-animated"
                    checked={animated}
                    onChange={(e) => setAnimated(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    data-testid="checkbox-edge-animated"
                  />
                  <Label htmlFor="edge-animated" className="cursor-pointer">Animated</Label>
                </div>
              </div>
            </div>

              <div className="space-y-2">
                <Label>Color</Label>
                <div className="grid grid-cols-7 gap-2">
                  {EDGE_COLORS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setStrokeColor(color.value)}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all",
                        strokeColor === color.value 
                          ? "border-primary scale-110" 
                          : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                      type="button"
                      data-testid={`button-edge-color-${color.name.toLowerCase()}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-2 gap-2 pt-4 border-t border-border mt-6">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-edge">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={projectType === "metamodel" && !parsedMultiplicity}
            title={projectType === "metamodel" && !parsedMultiplicity ? "The multiplicity is not valid" : undefined}
            data-testid="button-save-edge"
          >
            Apply
          </Button>
        </div>
        <p className="pt-2 text-right text-xs text-muted-foreground">
          Apply updates the diagram. Use Save in the header to keep it.
        </p>
      </SheetContent>
    </Sheet>
  );
}
