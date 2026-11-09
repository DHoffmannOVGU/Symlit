import { useMemo, useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, X } from "lucide-react";
import { sanitizeAttributeOptions } from "./node-attribute/style-presets";
import type { DiagramNode as Node } from "../types";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  evaluateDerivedAttribute,
  formatDerivedValue,
  getDisplayFormula,
  getStoredFormulaFromDisplay,
  remapStoredFormulaReferences,
} from "../utils/attribute-formula";

import type {
  CustomEdgeData,
  DiagramEdge,
  NodeAttribute,
  NodeData,
} from "../types";
export type { NodeAttribute, NodeData };

import {
  buildFormulaDrafts,
  getFormulaAutocompleteContext,
  normalizeAttribute,
  syncFormulaDrafts,
  type FormulaAutocompleteState,
} from "./node-attribute/formula-utils";
import { AttributeRowEditor } from "./node-attribute/AttributeRowEditor";
import { InheritAttributesDialog } from "./node-attribute/InheritAttributesDialog";
import { NodeStyleTab } from "./node-attribute/NodeStyleTab";
import { ELEMENT_STYLE_KEYS, pickElementStyle, typeStyle, type ElementStyle } from "@/lib/element-style";
import { getDefaultStyleForType } from "../hooks/useMetamodelParts";

interface NodeAttributePanelProps {
  node: Node | null;
  open: boolean;
  onClose: () => void;
  onSave: (nodeId: string, data: NodeData) => void;
  onDelete: (nodeId: string) => void;
  availablePartDefs?: Array<{ id: string; label: string }>;
  availablePartDefNodes?: Node[];
  availablePartDefEdges?: Array<{
    id: string;
    edgeType: CustomEdgeData["edgeType"];
    flowType?: "partflow" | "actionflow" | "informationflow";
    label?: string;
    sourceTypeId: string;
    targetTypeId: string;
  }>;
  allNodes?: Node[];
  allEdges?: DiagramEdge[];
  parentNodes?: Node[];
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function NodeAttributePanel({ 
  node, 
  open, 
  onClose, 
  onSave, 
  onDelete,
  availablePartDefs = [],
  availablePartDefNodes = [],
  parentNodes = [],
}: NodeAttributePanelProps) {
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [attributes, setAttributes] = useState<NodeAttribute[]>([]);
  const [nodeTypeLabel, setNodeTypeLabel] = useState("Object");
  const [nodeTypeId, setNodeTypeId] = useState<string | undefined>(undefined);
  /** The element's own style (used when it does not match its type). */
  const [ownStyle, setOwnStyle] = useState<ElementStyle>({});
  const [inheritStyle, setInheritStyle] = useState(false);
  const [inheritDialogOpen, setInheritDialogOpen] = useState(false);
  const [openDescriptions, setOpenDescriptions] = useState<Set<string>>(new Set());
  const [collapsedAttributes, setCollapsedAttributes] = useState<Set<string>>(new Set());
  const [selectedParentId, setSelectedParentId] = useState<string>("");
  const [selectedInherited, setSelectedInherited] = useState<Set<string>>(new Set());
  const [listOptionDrafts, setListOptionDrafts] = useState<Record<string, string>>({});
  const [formulaDrafts, setFormulaDrafts] = useState<Record<string, string>>({});
  const [formulaAutocomplete, setFormulaAutocomplete] = useState<FormulaAutocompleteState | null>(null);
  const formulaTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const defaultTypeValue = "__default_part__";
  // Instance projects also receive the built-in types in availablePartDefs;
  // they are listed above as "(Default)" already.
  const metamodelTypes = availablePartDefs.filter((def) => !def.id.startsWith("__default_"));
  const actionTypeValue = "__default_action__";
  const concernTypeValue = "__default_concern__";
  const agentTypeValue = "__default_agent__";
  const requirementTypeValue = "__default_requirement__";
  const eventTypeValue = "__default_event__";
  const capabilityTypeValue = "__default_capability__";
  const attributeValueLabel = node?.type === "part" ? "Value" : "Default Value";

  useEffect(() => {
    if (node) {
      const data = node.data;
      const nextAttributes = (data?.attributes || []).map(normalizeAttribute);
      setLabel(String(data?.label || ""));
      setDescription(String(data?.description || ""));
      setAttributes(nextAttributes);
      setNodeTypeLabel(data?.type === "Part" ? "Object" : data?.type === "Action" ? "Behavior" : data?.type === "Agent" ? "Performer" : data?.type || "Object");
      setNodeTypeId(data?.typeId);
      setOwnStyle(pickElementStyle(data));
      if (node.type === "part" && data?.typeId) {
        setInheritStyle(data?.inheritStyle !== false);
      } else {
        setInheritStyle(false);
      }
      setFormulaDrafts(buildFormulaDrafts(nextAttributes));
    } else {
      setFormulaDrafts({});
    }
    setOpenDescriptions(new Set());
    setCollapsedAttributes(new Set());
    setListOptionDrafts({});
    setFormulaAutocomplete(null);
  }, [node]);

  useEffect(() => {
    if (
      nodeTypeId ||
      nodeTypeLabel === "Object" ||
      nodeTypeLabel === "Behavior" ||
      nodeTypeLabel === "Concern" ||
      nodeTypeLabel === "Performer" ||
      nodeTypeLabel === "Requirement" ||
      nodeTypeLabel === "Event" ||
      nodeTypeLabel === "Capability"
    ) {
      return;
    }
    const match = availablePartDefs.find((def) => def.label === nodeTypeLabel);
    if (match) {
      setNodeTypeId(match.id);
    }
  }, [availablePartDefs, nodeTypeId, nodeTypeLabel]);

  const parentOptions = useMemo(() => {
    if (nodeTypeId) {
      const parent = availablePartDefNodes.find((candidate) => candidate.id === nodeTypeId);
      if (!parent) return [];
      const data = parent.data;
      return [
        {
          id: parent.id,
          label: data?.label || parent.id,
          attributes: (data?.attributes || []).map(normalizeAttribute),
        },
      ];
    }

    return parentNodes.map((parent) => {
      const data = parent.data;
      return {
        id: parent.id,
        label: data?.label || parent.id,
        attributes: (data?.attributes || []).map(normalizeAttribute),
      };
    });
  }, [availablePartDefNodes, nodeTypeId, parentNodes]);

  const kindDefaults = getDefaultStyleForType(node?.type === "part" ? "partdef" : node?.type);
  const inheritedStyle = useMemo<ElementStyle | null>(() => {
    if (!nodeTypeId) return null;
    const parent = availablePartDefNodes.find((candidate) => candidate.id === nodeTypeId);
    return typeStyle(parent?.data, getDefaultStyleForType(parent?.type));
  }, [availablePartDefNodes, nodeTypeId]);

  const shownStyle: ElementStyle =
    inheritStyle && inheritedStyle ? inheritedStyle : { ...ownStyle, icon: ownStyle.icon ?? kindDefaults.icon };

  /** Changing a setting gives the element its own style, starting from what it shows now. */
  const handleStyleChange = (patch: ElementStyle) => {
    setOwnStyle({ ...shownStyle, ...patch });
    setInheritStyle(false);
  };
  const handleInheritStyleChange = (checked: boolean) => {
    // Turning matching off keeps the look the element has now, so nothing jumps.
    if (!checked && inheritedStyle) setOwnStyle(inheritedStyle);
    setInheritStyle(checked);
  };

  const isPartNode = node?.type === "part";
  const canInheritStyle = isPartNode && Boolean(nodeTypeId);
  // Node-level rules are intentionally retired. Consistency rules now belong
  // to the view and are edited in the Model Rules workspace.

  useEffect(() => {
    if (!inheritDialogOpen) return;
    if (parentOptions.length === 0) {
      setSelectedParentId("");
      setSelectedInherited(new Set());
      return;
    }
    const nextParentId = parentOptions[0]?.id || "";
    setSelectedParentId(nextParentId);
    setSelectedInherited(new Set());
  }, [inheritDialogOpen, parentOptions]);

  useEffect(() => {
    if (!inheritDialogOpen) return;
    setSelectedInherited(new Set());
  }, [inheritDialogOpen, selectedParentId]);

  const selectedParent = parentOptions.find(
    (parent) => parent.id === selectedParentId,
  );

  const selectedParentAttributes = selectedParent?.attributes || [];
  const selectableParentAttributes = selectedParentAttributes.filter(
    (attr) => !!attr.id,
  );
  const inheritedKeySet = useMemo(() => {
    if (!selectedParentId) return new Set<string>();
    return new Set(
      attributes
        .filter((attr) => attr.inheritedFrom?.nodeId === selectedParentId)
        .map((attr) => attr.inheritedFrom?.attrId)
        .filter((attrId): attrId is string => !!attrId),
    );
  }, [attributes, selectedParentId]);

  const duplicateAttributeNameSet = useMemo(() => {
    const counts: globalThis.Map<string, number> = new globalThis.Map();
    attributes.forEach((attr) => {
      const key = attr.name.trim().toLowerCase();
      if (!key) return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([name]) => name),
    );
  }, [attributes]);

  const derivedAttributeState = useMemo(() => {
    const next: globalThis.Map<
      string,
      { value?: string; references: string[]; error?: string }
    > = new globalThis.Map();

    attributes.forEach((attr) => {
      if (attr.type !== "derived") return;

      try {
        const formula = getStoredFormulaFromDisplay(
          formulaDrafts[attr.id] ?? getDisplayFormula(attr.formula ?? "", attributes, attr.id),
          attributes,
          attr.id,
        );
        const result = evaluateDerivedAttribute(
          {
            ...attr,
            formula,
          },
          attributes,
        );
        next.set(attr.id, {
          value: formatDerivedValue(result.value),
          references: result.references,
        });
      } catch (error) {
        next.set(attr.id, {
          references: [],
          error: error instanceof Error ? error.message : "Invalid formula.",
        });
      }
    });

    return next;
  }, [attributes, formulaDrafts]);

  const getAttributeKey = (attr: NodeAttribute) => attr.id;

  const handleAddAttribute = () => {
    const nextAttributes = [
      ...attributes,
      {
        id: `attr_${Date.now()}`,
        name: "",
        description: "",
        value: "",
        unit: "",
        type: "number" as const,
        options: undefined,
      },
    ];
    setAttributes(nextAttributes);
    setFormulaDrafts((prev) => syncFormulaDrafts(prev, nextAttributes));
  };

  const handleRemoveAttribute = (id: string) => {
    const nextAttributes = attributes.filter((a) => a.id !== id);
    setAttributes(nextAttributes);
    setFormulaDrafts((prev) => syncFormulaDrafts(prev, nextAttributes));
    setFormulaAutocomplete((prev) => (prev?.attrId === id ? null : prev));
  };

  const handleAttributeChange = (id: string, field: keyof NodeAttribute, value: string) => {
    const nextAttributes = attributes.map((a) =>
      a.id === id ? normalizeAttribute({ ...a, [field]: value }) : a
    );
    setAttributes(nextAttributes);
    if (field !== "formula") {
      setFormulaDrafts((prev) => syncFormulaDrafts(prev, nextAttributes));
    }
  };


  const handleListOptionDraftChange = (id: string, value: string) => {
    setListOptionDrafts((prev) => ({ ...prev, [id]: value }));
  };

  const handleAddListOption = (id: string) => {
    const nextOption = (listOptionDrafts[id] ?? "").trim();
    if (!nextOption) return;

    setAttributes((prev) => {
      const nextAttributes = prev.map((attr) => {
        if (attr.id !== id) return attr;
        const options = sanitizeAttributeOptions([...(attr.options ?? []), nextOption]);
        return normalizeAttribute({
          ...attr,
          options,
          value: attr.value || options[0] || "",
        });
      });
      setFormulaDrafts((drafts) => syncFormulaDrafts(drafts, nextAttributes));
      return nextAttributes;
    });
    setListOptionDrafts((prev) => ({ ...prev, [id]: "" }));
  };

  const handleRemoveListOption = (id: string, optionToRemove: string) => {
    setAttributes((prev) => {
      const nextAttributes = prev.map((attr) => {
        if (attr.id !== id) return attr;
        const options = sanitizeAttributeOptions(
          (attr.options ?? []).filter((option) => option !== optionToRemove),
        );
        return normalizeAttribute({
          ...attr,
          options,
          value: attr.value === optionToRemove ? (options[0] ?? "") : attr.value,
        });
      });
      setFormulaDrafts((drafts) => syncFormulaDrafts(drafts, nextAttributes));
      return nextAttributes;
    });
  };

  const getDefaultValueForType = (type: NodeAttribute["type"], options?: string[]) => {
    if (type === "boolean") return "false";
    if (type === "date") return new Date().toISOString().slice(0, 10);
    if (type === "list") return options?.[0] ?? "";
    return "";
  };

  const handleAttributeTypeChange = (id: string, type: NodeAttribute["type"]) => {
    setAttributes((prev) => {
      const nextAttributes = prev.map((attr) => {
        if (attr.id !== id) return attr;
        const options = type === "list" ? sanitizeAttributeOptions(attr.options) : undefined;
        const nextValue =
          type === "list"
            ? options?.includes(attr.value)
              ? attr.value
              : getDefaultValueForType(type, options)
            : type === "derived"
              ? ""
              : attr.value || getDefaultValueForType(type);
        return normalizeAttribute({
          ...attr,
          type,
          value: nextValue,
          unit: type === "number" || type === "derived" ? attr.unit : "",
          formula: type === "derived" ? attr.formula ?? "" : undefined,
          options,
        });
      });
      setFormulaDrafts((drafts) => syncFormulaDrafts(drafts, nextAttributes));
      return nextAttributes;
    });
  };

  const handleAutoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const updateFormulaAutocomplete = (
    id: string,
    formula: string,
    cursor: number,
  ) => {
    const context = getFormulaAutocompleteContext(formula, cursor);
    if (!context) {
      setFormulaAutocomplete((prev) => (prev?.attrId === id ? null : prev));
      return;
    }

    setFormulaAutocomplete((prev) => ({
      attrId: id,
      query: context.query,
      start: context.start,
      end: context.end,
      selectedIndex:
        prev?.attrId === id && prev.query === context.query
          ? prev.selectedIndex
          : 0,
    }));
  };

  const applyFormulaAutocomplete = (id: string, attributeName: string) => {
    const referencedAttribute = attributes.find(
      (attr) => attr.id !== id && attr.name.trim() === attributeName,
    );
    const target = attributes.find((attr) => attr.id === id);
    const activeAutocomplete =
      formulaAutocomplete?.attrId === id ? formulaAutocomplete : null;
    if (!target || !activeAutocomplete || !referencedAttribute) return;

    const formula = formulaDrafts[id] ?? getDisplayFormula(target.formula ?? "", attributes, id);
    const before = formula.slice(0, activeAutocomplete.start);
    const after = formula.slice(activeAutocomplete.end);
    const nextFormula = `${before}[${attributeName}]${
      after.startsWith("]") ? after.slice(1) : after
    }`;
    const nextStoredFormula = getStoredFormulaFromDisplay(nextFormula, attributes, id);

    setFormulaDrafts((prev) => ({ ...prev, [id]: nextFormula }));
    setAttributes((prev) =>
      prev.map((attr) =>
        attr.id === id
          ? normalizeAttribute({
              ...attr,
              formula: nextStoredFormula,
            })
          : attr,
      ),
    );
    setFormulaAutocomplete(null);

    const nextCursor = before.length + attributeName.length + 2;
    window.setTimeout(() => {
      const textarea = formulaTextareaRefs.current[id];
      textarea?.focus();
      textarea?.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  };

  const getCalculatedAttributesForSave = () =>
    attributes
      .filter((attr) => attr.name.trim())
      .map((attr) => {
        if (attr.type !== "derived") {
          return normalizeAttribute(attr);
        }

        const derivedState = derivedAttributeState.get(attr.id);
        return normalizeAttribute({
          ...attr,
          formula: getStoredFormulaFromDisplay(
            formulaDrafts[attr.id] ?? getDisplayFormula(attr.formula ?? "", attributes, attr.id),
            attributes,
            attr.id,
          ),
          value: derivedState?.value ?? "",
        });
      });

  const handleSave = () => {
    if (!node) return;
    onSave(node.id, {
      label,
      description,
      attributes: getCalculatedAttributesForSave(),
      type: nodeTypeLabel,
      typeId: nodeTypeId,
      // Every style key is written, so settings removed here are removed on the element too.
      ...Object.fromEntries(ELEMENT_STYLE_KEYS.map((key) => [key, undefined])),
      ...(inheritStyle && nodeTypeId ? {} : ownStyle),
      inheritStyle: inheritStyle && !!nodeTypeId,
      rule: undefined,
    });
    onClose();
  };

  const handleDelete = () => {
    if (!node) return;
    onDelete(node.id);
  };

  const handleToggleInherited = (key: string, checked: boolean) => {
    setSelectedInherited((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  const handleSelectAllInherited = () => {
    const allKeys = selectableParentAttributes
      .map((attr) => getAttributeKey(attr))
      .filter((key): key is string => !!key && !inheritedKeySet.has(key));
    setSelectedInherited(new Set(allKeys));
  };

  const handleSelectNoneInherited = () => {
    setSelectedInherited(new Set());
  };

  const handleConfirmInheritance = () => {
    if (!selectedParentAttributes.length) {
      setInheritDialogOpen(false);
      return;
    }

    const existingKeys = new Set(
      attributes
        .filter((attr) => attr.inheritedFrom?.nodeId === selectedParentId)
        .map((attr) => attr.inheritedFrom?.attrId)
        .filter((attrId): attrId is string => !!attrId),
    );
    const inheritedDrafts = selectedParentAttributes
      .filter((attr) => {
        const key = getAttributeKey(attr);
        return key ? selectedInherited.has(key) && !existingKeys.has(key) : false;
      })
      .map((attr, index) => ({
        source: attr,
        next: normalizeAttribute({
          ...attr,
          options: attr.options ? [...attr.options] : undefined,
          id: `attr_${Date.now()}_${index}`,
          inheritedFrom: {
            nodeId: selectedParentId,
            attrId: getAttributeKey(attr) || "",
          },
        }),
      }));

    if (inheritedDrafts.length) {
      const inheritedAttributeIdMap = new Map(
        inheritedDrafts.map(({ source, next }) => [source.id, next.id] as const),
      );
      setAttributes((prev) => {
        const remappedInherited = inheritedDrafts.map(({ source, next }) => {
          if (source.type !== "derived" || !source.formula?.trim()) {
            return next;
          }

          return normalizeAttribute({
            ...next,
            formula: remapStoredFormulaReferences(
              source.formula,
              inheritedAttributeIdMap,
            ),
          });
        });
        const finalAttributes = [...prev, ...remappedInherited];
        setFormulaDrafts((drafts) => syncFormulaDrafts(drafts, finalAttributes));
        return finalAttributes;
      });
    }

    setInheritDialogOpen(false);
  };

  const toggleDescription = (id: string) => {
    setOpenDescriptions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAttributeCollapsed = (id: string) => {
    setCollapsedAttributes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatAttributeSummary = (attr: NodeAttribute) => {
    const name = attr.name.trim() || "Attribute";
    const options = sanitizeAttributeOptions(attr.options);
    const derivedState = attr.type === "derived" ? derivedAttributeState.get(attr.id) : undefined;
    let value =
      attr.type === "derived"
        ? derivedState?.error
          ? "Invalid formula"
          : derivedState?.value || ""
        : attr.value?.trim() || "";

    if (attr.type === "boolean") {
      value = value === "true" ? "Yes" : "No";
    } else if (attr.type === "list" && value && !options.includes(value)) {
      value = options[0] ?? value;
    }

    const unit = (attr.type === "number" || attr.type === "derived") && attr.unit.trim()
      ? ` ${attr.unit.trim()}`
      : "";
    return `${name}: ${value || "-"}${unit}`;
  };

  const hasDerivedFormulaErrors = attributes.some(
    (attr) => attr.type === "derived" && !!derivedAttributeState.get(attr.id)?.error,
  );
  const hasDuplicateAttributeNames = duplicateAttributeNameSet.size > 0;

  if (!node) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-[540px] overflow-y-auto px-4 sm:px-6" data-testid="node-attribute-panel">
        <SheetHeader className="relative">
          <div className="flex items-center justify-between pr-8">
            <div>
              <SheetTitle>Configure Node</SheetTitle>
              <SheetDescription>Edit the properties and appearance of this node.</SheetDescription>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
              title="Delete node"
              data-testid="button-delete-node"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          </div>
        </SheetHeader>

        <Tabs defaultValue="content" className="w-full mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="style">Styling</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-6 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="node-label">Name</Label>
                <Input
                  id="node-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Enter node name"
                  data-testid="input-node-label"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="node-type-select">Type</Label>
                <Select
                  value={
                    nodeTypeId ||
                    (nodeTypeLabel === "Object"
                      ? defaultTypeValue
                      : nodeTypeLabel === "Behavior"
                        ? actionTypeValue
                        : nodeTypeLabel === "Concern"
                          ? concernTypeValue
                          : nodeTypeLabel === "Performer"
                            ? agentTypeValue
                            : nodeTypeLabel === "Requirement"
                              ? requirementTypeValue
                              : nodeTypeLabel === "Event"
                                ? eventTypeValue
                                : nodeTypeLabel === "Capability"
                                  ? capabilityTypeValue
                      : availablePartDefs.find((def) => def.label === nodeTypeLabel)?.id ||
                        defaultTypeValue)
                  }
                  onValueChange={(value) => {
                    if (value === defaultTypeValue) {
                      setNodeTypeLabel("Object");
                      setNodeTypeId(undefined);
                      setInheritStyle(false);
                      return;
                    }
                    if (value === actionTypeValue) {
                      setNodeTypeLabel("Behavior");
                      setNodeTypeId(undefined);
                      setInheritStyle(false);
                      return;
                    }
                    if (value === concernTypeValue) {
                      setNodeTypeLabel("Concern");
                      setNodeTypeId(undefined);
                      setInheritStyle(false);
                      return;
                    }
                    if (value === agentTypeValue) {
                      setNodeTypeLabel("Performer");
                      setNodeTypeId(undefined);
                      setInheritStyle(false);
                      return;
                    }
                    if (value === requirementTypeValue) {
                      setNodeTypeLabel("Requirement");
                      setNodeTypeId(undefined);
                      setInheritStyle(false);
                      return;
                    }
                    if (value === eventTypeValue) {
                      setNodeTypeLabel("Event");
                      setNodeTypeId(undefined);
                      setInheritStyle(false);
                      return;
                    }
                    if (value === capabilityTypeValue) {
                      setNodeTypeLabel("Capability");
                      setNodeTypeId(undefined);
                      setInheritStyle(false);
                      return;
                    }

                    const match = availablePartDefs.find((def) => def.id === value);
                    setNodeTypeLabel(match?.label || "Object");
                    setNodeTypeId(match?.id);
                    setInheritStyle(true);
                  }}
                >
                  <SelectTrigger id="node-type-select" data-testid="select-node-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={defaultTypeValue}>Object (Default)</SelectItem>
                    <SelectItem value={actionTypeValue}>Behavior (Default)</SelectItem>
                    <SelectItem value={concernTypeValue}>Concern (Default)</SelectItem>
                    <SelectItem value={agentTypeValue}>Performer (Default)</SelectItem>
                    <SelectItem value={requirementTypeValue}>Requirement (Default)</SelectItem>
                    <SelectItem value={eventTypeValue}>Event (Default)</SelectItem>
                    <SelectItem value={capabilityTypeValue}>Capability (Default)</SelectItem>
                    {metamodelTypes.map((def) => (
                      <SelectItem key={def.id} value={def.id}>
                        {def.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="node-description">Description</Label>
              <Textarea
                id="node-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter description"
                rows={3}
                data-testid="input-node-description"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Custom Attributes</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setInheritDialogOpen(true)}
                    disabled={parentOptions.length === 0}
                    title={
                      parentOptions.length === 0
                        ? "No parent node available for inheritance"
                        : "Inherit attributes from a parent node"
                    }
                  >
                    Inherit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddAttribute}
                    data-testid="button-add-attribute"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Attribute
                  </Button>
                </div>
              </div>

              {attributes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                  No custom attributes defined. Click "Add Attribute" to create one.
                </p>
              )}

              <TooltipProvider delayDuration={0}>
              <div className="space-y-3">
              {attributes.map((attr, index) => (
                <AttributeRowEditor
                  key={attr.id}
                  attr={attr}
                  index={index}
                  attributes={attributes}
                  isCollapsed={collapsedAttributes.has(attr.id)}
                  isDescriptionOpen={openDescriptions.has(attr.id)}
                  duplicateAttributeNameSet={duplicateAttributeNameSet}
                  attributeValueLabel={attributeValueLabel}
                  listOptionDraft={listOptionDrafts[attr.id] ?? ""}
                  formulaDrafts={formulaDrafts}
                  formulaAutocomplete={formulaAutocomplete}
                  derivedAttributeState={derivedAttributeState}
                  formulaTextareaRefs={formulaTextareaRefs}
                  formatAttributeSummary={formatAttributeSummary}
                  onToggleCollapsed={toggleAttributeCollapsed}
                  onToggleDescription={toggleDescription}
                  onRemoveAttribute={handleRemoveAttribute}
                  onAttributeChange={handleAttributeChange}
                  onAttributeTypeChange={handleAttributeTypeChange}
                  onListOptionDraftChange={handleListOptionDraftChange}
                  onAddListOption={handleAddListOption}
                  onRemoveListOption={handleRemoveListOption}
                  onAutoResize={handleAutoResize}
                  setFormulaDrafts={setFormulaDrafts}
                  setFormulaAutocomplete={setFormulaAutocomplete}
                  updateFormulaAutocomplete={updateFormulaAutocomplete}
                  applyFormulaAutocomplete={applyFormulaAutocomplete}
                />
              ))}
              </div>
              </TooltipProvider>
            </div>

          </TabsContent>



          <TabsContent value="style">
          <NodeStyleTab
            canInheritStyle={canInheritStyle}
            inheritStyle={inheritStyle}
            typeLabel={nodeTypeLabel}
            style={shownStyle}
            defaultColor={inheritStyle && inheritedStyle?.color ? inheritedStyle.color : kindDefaults.color}
            onInheritStyleChange={handleInheritStyleChange}
            onStyleChange={handleStyleChange}
          />
          </TabsContent>
        </Tabs>

        {hasDuplicateAttributeNames ? (
          <p className="mt-4 text-sm text-destructive">
            Attribute names must be unique before saving this node.
          </p>
        ) : null}

        {hasDerivedFormulaErrors ? (
          <p className="mt-4 text-sm text-destructive">
            Fix invalid derived formulas before saving this node.
          </p>
        ) : null}

        <SheetFooter className="grid grid-cols-2 gap-2 mt-6 border-t pt-4">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-attributes">
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={hasDerivedFormulaErrors || hasDuplicateAttributeNames}
            data-testid="button-save-attributes"
          >
            <Save className="w-4 h-4 mr-1" />
            Save Changes
          </Button>
        </SheetFooter>
      </SheetContent>
      </Sheet>
      <InheritAttributesDialog
        open={inheritDialogOpen}
        onOpenChange={setInheritDialogOpen}
        parentOptions={parentOptions}
        selectedParentId={selectedParentId}
        onSelectedParentChange={setSelectedParentId}
        selectableParentAttributes={selectableParentAttributes}
        selectedInherited={selectedInherited}
        inheritedKeySet={inheritedKeySet}
        getAttributeKey={getAttributeKey}
        onToggleInherited={handleToggleInherited}
        onSelectAll={handleSelectAllInherited}
        onSelectNone={handleSelectNoneInherited}
        onConfirm={handleConfirmInheritance}
      />
    </>
  );
}
