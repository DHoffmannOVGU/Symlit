import { useDiagramStore } from "../state/DiagramStoreProvider";
import { useDiagramModel } from "../state/DiagramModelProvider";
import { useElementSelection } from "../state/useElementSelection";
import { useCanvasTableRows } from "./useCanvasTableRows";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getNodeIcon } from "@/lib/node-icons";
import { ArrowDownRight as ArrowDownRightIcon, Boxes as BoxesIcon, Diamond as DiamondIcon, GitBranchPlus as GitBranchPlusIcon, Link2 as Link2Icon, Share2 as Share2Icon, TableProperties as TablePropertiesIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectType } from "@shared/schema";
import { magicRelationTypeCatalog } from "@shared/metamodel-setup";

export type NodeTableRow = {
  id: string;
  name: string;
  type: string;
  typeId: string;
  icon: string;
  color?: string;
  description: string;
  isReadOnly: boolean;
  parentId: string;
};

export type EdgeTableRow = {
  id: string;
  name: string;
  type: string;
  source: string;
  target: string;
  description: string;
  parentId: string;
};

export interface CanvasTableModeProps {
  projectType: ProjectType;
  displayMode: "graph" | "table";
  onDisplayModeChange: (mode: "graph" | "table") => void;
  nodeTableRows: NodeTableRow[];
  filteredNodeTableRows: NodeTableRow[];
  nodeTableFilter: string;
  onNodeTableFilterChange: (value: string) => void;
  edgeTableRows: EdgeTableRow[];
  filteredEdgeTableRows: EdgeTableRow[];
  edgeTableFilter: string;
  onEdgeTableFilterChange: (value: string) => void;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  instanceNodeTypeOptions: Array<{ value: string; label: string }>;
  metamodelNodeTypeOptions: Array<{ value: string; label: string }>;
  onSelectNode: (id: string) => void;
  onSelectEdge: (id: string) => void;
  onOpenNodePanel: (id: string) => void;
  onOpenEdgePanel: (id: string) => void;
  onInlineNodeFieldChange: (
    id: string,
    field: "name" | "type" | "description",
    value: string,
  ) => void;
  onInlineEdgeFieldChange: (
    id: string,
    field: "name" | "type" | "description",
    value: string,
  ) => void;
}

export function CanvasTableMode({
  projectType,
  displayMode,
  onDisplayModeChange,
  nodeTableRows,
  filteredNodeTableRows,
  nodeTableFilter,
  onNodeTableFilterChange,
  edgeTableRows,
  filteredEdgeTableRows,
  edgeTableFilter,
  onEdgeTableFilterChange,
  selectedNodeId,
  selectedEdgeId,
  instanceNodeTypeOptions,
  metamodelNodeTypeOptions,
  onSelectNode,
  onSelectEdge,
  onOpenNodePanel,
  onOpenEdgePanel,
  onInlineNodeFieldChange,
  onInlineEdgeFieldChange,
}: CanvasTableModeProps) {
  return (
    <div className="h-full w-full overflow-y-auto p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="outline"
            size="sm"
            aria-label="Diagram"
            aria-pressed={displayMode === "graph"}
            data-testid="button-toolbar-graph"
            className={cn(
              "h-9 gap-1.5 px-2.5 text-xs",
              displayMode === "graph" &&
                "border-primary bg-primary/10 text-primary",
            )}
            onClick={() => onDisplayModeChange("graph")}
          >
            <Share2Icon className="h-4 w-4" />
            Diagram
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="Table"
            aria-pressed={displayMode === "table"}
            data-testid="button-toolbar-table"
            className={cn(
              "h-9 gap-1.5 px-2.5 text-xs",
              displayMode === "table" &&
                "border-primary bg-primary/10 text-primary",
            )}
            onClick={() => onDisplayModeChange("table")}
          >
            <TablePropertiesIcon className="h-4 w-4" />
            Table
          </Button>
        </div>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Elements</CardTitle>
            <CardDescription>
              {filteredNodeTableRows.length} of {nodeTableRows.length} node
              {nodeTableRows.length === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="mb-3">
              <Input
                value={nodeTableFilter}
                onChange={(event) => onNodeTableFilterChange(event.target.value)}
                placeholder="Filter elements by name, id, type, description, or parent"
                data-testid="input-node-table-filter"
              />
            </div>
            <div className="rounded-lg border border-slate-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Name</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Parent ID</TableHead>
                    <TableHead className="w-[90px] text-right">
                      Edit
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNodeTableRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground"
                      >
                        {nodeTableRows.length === 0
                          ? "No elements in this diagram."
                          : "No elements match the filter."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredNodeTableRows.map((row) => {
                      const NodeIcon =
                        getNodeIcon(row.icon);
                      const isSelected = selectedNodeId === row.id;
                      const isReadOnly = row.isReadOnly;
                      const nodeTypeValue =
                        projectType === "instance"
                          ? row.typeId || "untyped"
                          : row.type || "Object";
                      const nodeTypeOptions =
                        projectType === "instance"
                          ? instanceNodeTypeOptions
                          : metamodelNodeTypeOptions;
                      return (
                        <TableRow
                          key={row.id}
                          data-state={isSelected ? "selected" : undefined}
                          className={cn(
                            "cursor-pointer",
                            isSelected && "bg-sky-50 hover:bg-sky-50",
                          )}
                          onClick={() => onSelectNode(row.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onSelectNode(row.id);
                            }
                          }}
                          tabIndex={0}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              <div
                                className="flex h-8 w-8 items-center justify-center rounded-md border"
                                style={{
                                  color: row.color || "#475569",
                                  backgroundColor: row.color
                                    ? `${row.color}18`
                                    : "#f8fafc",
                                  borderColor: row.color
                                    ? `${row.color}3d`
                                    : "#cbd5e1",
                                }}
                              >
                                <NodeIcon className="h-4 w-4" />
                              </div>
                              <Input
                                value={row.name}
                                disabled={isReadOnly}
                                onClick={(event) => event.stopPropagation()}
                                onKeyDown={(event) => event.stopPropagation()}
                                onChange={(event) =>
                                  onInlineNodeFieldChange(
                                    row.id,
                                    "name",
                                    event.target.value,
                                  )
                                }
                                className="h-8 border-transparent bg-transparent px-2 shadow-none focus-visible:border-slate-300 focus-visible:ring-1 focus-visible:ring-slate-300"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-slate-700">
                            {row.id}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={nodeTypeValue}
                              disabled={isReadOnly}
                              onValueChange={(value) =>
                                onInlineNodeFieldChange(row.id, "type", value)
                              }
                            >
                              <SelectTrigger
                                className="h-8 min-w-[160px] border-transparent bg-transparent px-2 shadow-none focus:ring-1 focus:ring-slate-300"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <SelectValue placeholder="Type" />
                              </SelectTrigger>
                              <SelectContent>
                                {projectType === "instance" && (
                                  <SelectItem value="untyped">
                                    Unmapped
                                  </SelectItem>
                                )}
                                {nodeTypeOptions.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="max-w-[380px]">
                            <Input
                              value={row.description}
                              disabled={isReadOnly}
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                              onChange={(event) =>
                                onInlineNodeFieldChange(
                                  row.id,
                                  "description",
                                  event.target.value,
                                )
                              }
                              className="h-8 border-transparent bg-transparent px-2 shadow-none focus-visible:border-slate-300 focus-visible:ring-1 focus-visible:ring-slate-300"
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs text-slate-700">
                            {row.parentId || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              disabled={isReadOnly}
                              onClick={(event) => {
                                event.stopPropagation();
                                onOpenNodePanel(row.id);
                              }}
                            >
                              {isReadOnly ? "Read only" : "Edit"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Edges</CardTitle>
            <CardDescription>
              {filteredEdgeTableRows.length} of {edgeTableRows.length} edge
              {edgeTableRows.length === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="mb-3">
              <Input
                value={edgeTableFilter}
                onChange={(event) => onEdgeTableFilterChange(event.target.value)}
                placeholder="Filter edges by name, id, type, description, source, or target"
                data-testid="input-edge-table-filter"
              />
            </div>
            <div className="rounded-lg border border-slate-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Name</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Parent ID</TableHead>
                    <TableHead className="w-[90px] text-right">
                      Edit
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEdgeTableRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground"
                      >
                        {edgeTableRows.length === 0
                          ? "No edges in this diagram."
                          : "No edges match the current filter."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEdgeTableRows.map((row) => {
                      const EdgeIcon =
                        row.type === "aggregation"
                          ? DiamondIcon
                          : row.type === "composition"
                            ? BoxesIcon
                            : row.type === "generalization" ||
                                row.type === "realization"
                              ? GitBranchPlusIcon
                              : row.type === "dependency"
                                ? ArrowDownRightIcon
                            : Link2Icon;
                      const isSelected = selectedEdgeId === row.id;
                      return (
                        <TableRow
                          key={row.id}
                          data-state={isSelected ? "selected" : undefined}
                          className={cn(
                            "cursor-pointer",
                            isSelected && "bg-sky-50 hover:bg-sky-50",
                          )}
                          onClick={() => onSelectEdge(row.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onSelectEdge(row.id);
                            }
                          }}
                          tabIndex={0}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-600">
                                <EdgeIcon className="h-4 w-4" />
                              </div>
                              <Input
                                value={row.name}
                                onClick={(event) => event.stopPropagation()}
                                onKeyDown={(event) => event.stopPropagation()}
                                onChange={(event) =>
                                  onInlineEdgeFieldChange(
                                    row.id,
                                    "name",
                                    event.target.value,
                                  )
                                }
                                className="h-8 border-transparent bg-transparent px-2 shadow-none focus-visible:border-slate-300 focus-visible:ring-1 focus-visible:ring-slate-300"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-slate-700">
                            {row.id}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={row.type || "association"}
                              onValueChange={(value) =>
                                onInlineEdgeFieldChange(row.id, "type", value)
                              }
                            >
                              <SelectTrigger
                                className="h-8 min-w-[160px] border-transparent bg-transparent px-2 shadow-none focus:ring-1 focus:ring-slate-300"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <SelectValue placeholder="Type" />
                              </SelectTrigger>
                              <SelectContent>
                                {magicRelationTypeCatalog.map((relation) => (
                                  <SelectItem key={relation.id} value={relation.id}>
                                    {relation.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="max-w-[380px]">
                            <Input
                              value={row.description}
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                              onChange={(event) =>
                                onInlineEdgeFieldChange(
                                  row.id,
                                  "description",
                                  event.target.value,
                                )
                              }
                              className="h-8 border-transparent bg-transparent px-2 shadow-none focus-visible:border-slate-300 focus-visible:ring-1 focus-visible:ring-slate-300"
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs text-slate-700">
                            {row.parentId || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              onClick={(event) => {
                                event.stopPropagation();
                                onOpenEdgePanel(row.id);
                              }}
                            >
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Table mode wired to the open diagram: rows, filters and selection come from the diagram store. */
export function ConnectedCanvasTableMode(
  props: Pick<
    CanvasTableModeProps,
    | "displayMode"
    | "onDisplayModeChange"
    | "instanceNodeTypeOptions"
    | "metamodelNodeTypeOptions"
    | "onInlineNodeFieldChange"
    | "onInlineEdgeFieldChange"
  >,
) {
  const { projectType } = useDiagramModel();
  const nodeTableFilter = useDiagramStore((state) => state.nodeTableFilter);
  const edgeTableFilter = useDiagramStore((state) => state.edgeTableFilter);
  const setNodeTableFilter = useDiagramStore((state) => state.setNodeTableFilter);
  const setEdgeTableFilter = useDiagramStore((state) => state.setEdgeTableFilter);
  const selectedNodeId = useDiagramStore((state) => state.selectedNodeId);
  const selectedEdgeId = useDiagramStore((state) => state.selectedEdgeId);
  const { selectNode, selectEdge, openNodePanel, openEdgePanel } = useElementSelection();
  const rows = useCanvasTableRows({ nodeTableFilter, edgeTableFilter });
  return (
    <CanvasTableMode
      {...props}
      {...rows}
      projectType={projectType}
      nodeTableFilter={nodeTableFilter}
      onNodeTableFilterChange={setNodeTableFilter}
      edgeTableFilter={edgeTableFilter}
      onEdgeTableFilterChange={setEdgeTableFilter}
      selectedNodeId={selectedNodeId}
      selectedEdgeId={selectedEdgeId}
      onSelectNode={selectNode}
      onSelectEdge={selectEdge}
      onOpenNodePanel={openNodePanel}
      onOpenEdgePanel={openEdgePanel}
    />
  );
}
