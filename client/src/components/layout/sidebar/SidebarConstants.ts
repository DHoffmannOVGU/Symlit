import { PARTDEF_DEFAULT_ACCENT_COLOR } from "@/components/flow/nodes/PartDefNode";
import { ACTIONDEF_DEFAULT_ACCENT_COLOR } from "@/components/flow/nodes/ActionDefNode";
import { CONCERNDEF_DEFAULT_ACCENT_COLOR } from "@/components/flow/nodes/ConcernDefNode";
import { AGENTDEF_DEFAULT_ACCENT_COLOR } from "@/components/flow/nodes/AgentDefNode";
import { REQUIREMENTDEF_DEFAULT_ACCENT_COLOR } from "@/components/flow/nodes/RequirementDefNode";
import { EVENTDEF_DEFAULT_ACCENT_COLOR } from "@/components/flow/nodes/EventDefNode";
import { CAPABILITYDEF_DEFAULT_ACCENT_COLOR } from "@/components/flow/nodes/CapabilityDefNode";
import {
  magicNodeTypeCatalog,
  type MagicNodeType,
} from "@shared/metamodel-setup";

export const METAMODEL_NODE_DRAG_MIME = "application/x-mbse-metamodel-node";
export const BASE_METAMODEL_ID = "__base_metamodel__";

export const BASE_INSTANCE_TYPE_ITEMS = [
  {
    id: "__default_part__",
    label: "Object",
    description: "Generic structural type.",
    iconName: "Box",
    color: PARTDEF_DEFAULT_ACCENT_COLOR,
  },
  {
    id: "__default_action__",
    label: "Behavior",
    description: "Generic behavior type.",
    iconName: "Zap",
    color: ACTIONDEF_DEFAULT_ACCENT_COLOR,
  },
  {
    id: "__default_concern__",
    label: "Concern",
    description: "Generic concern type.",
    iconName: "Shield",
    color: CONCERNDEF_DEFAULT_ACCENT_COLOR,
  },
  {
    id: "__default_agent__",
    label: "Performer",
    description: "Generic performer type.",
    iconName: "Bot",
    color: AGENTDEF_DEFAULT_ACCENT_COLOR,
  },
  {
    id: "__default_requirement__",
    label: "Requirement",
    description: "Generic requirement type.",
    iconName: "BadgeCheck",
    color: REQUIREMENTDEF_DEFAULT_ACCENT_COLOR,
  },
  {
    id: "__default_event__",
    label: "Event",
    description: "Generic event type.",
    iconName: "Radio",
    color: EVENTDEF_DEFAULT_ACCENT_COLOR,
  },
  {
    id: "__default_capability__",
    label: "Capability",
    description: "Generic capability type.",
    iconName: "Gem",
    color: CAPABILITYDEF_DEFAULT_ACCENT_COLOR,
  },
] as const;

export type SidebarNodeInsertMode =
  | "insert-reference"
  | "create-instance-node";

export type SidebarNodeTransfer = {
  nodeId: string;
  typeId?: string;
  viewId: number;
  mode: SidebarNodeInsertMode;
  typeLabel?: string;
  icon?: string;
  color?: string;
};

export type SidebarCreateMetamodelNodeDetail = {
  viewId: number;
  nodeType: MagicNodeType;
  parentTypeId?: string;
  typeLabel?: string;
  icon?: string;
  color?: string;
};

export type SidebarCreateMetamodelNodeDragPayload =
  SidebarCreateMetamodelNodeDetail;

export const getDefaultNodeStyle = (
  nodeType?: string,
  dataType?: string,
): { iconName: string; color: string } => {
  if (nodeType === "actiondef" || dataType === "Behavior" || dataType === "Action") {
    return { iconName: "Zap", color: ACTIONDEF_DEFAULT_ACCENT_COLOR };
  }
  if (nodeType === "concerndef" || dataType === "Concern") {
    return { iconName: "Shield", color: CONCERNDEF_DEFAULT_ACCENT_COLOR };
  }
  if (nodeType === "agentdef" || dataType === "Performer" || dataType === "Agent") {
    return { iconName: "Bot", color: AGENTDEF_DEFAULT_ACCENT_COLOR };
  }
  if (nodeType === "requirementdef" || dataType === "Requirement") {
    return {
      iconName: "BadgeCheck",
      color: REQUIREMENTDEF_DEFAULT_ACCENT_COLOR,
    };
  }
  if (nodeType === "eventdef" || dataType === "Event") {
    return { iconName: "Radio", color: EVENTDEF_DEFAULT_ACCENT_COLOR };
  }
  if (nodeType === "capabilitydef" || dataType === "Capability") {
    return { iconName: "Gem", color: CAPABILITYDEF_DEFAULT_ACCENT_COLOR };
  }
  return { iconName: "Box", color: PARTDEF_DEFAULT_ACCENT_COLOR };
};

const MAGIC_NODE_TYPE_COLORS: Record<MagicNodeType, string> = {
  partdef: PARTDEF_DEFAULT_ACCENT_COLOR,
  actiondef: ACTIONDEF_DEFAULT_ACCENT_COLOR,
  concerndef: CONCERNDEF_DEFAULT_ACCENT_COLOR,
  agentdef: AGENTDEF_DEFAULT_ACCENT_COLOR,
  requirementdef: REQUIREMENTDEF_DEFAULT_ACCENT_COLOR,
  eventdef: EVENTDEF_DEFAULT_ACCENT_COLOR,
  capabilitydef: CAPABILITYDEF_DEFAULT_ACCENT_COLOR,
};

export const METAMODEL_NODE_TYPE_ITEMS = magicNodeTypeCatalog.map((item) => ({
  type: item.id,
  label: item.label,
  description: item.description,
  iconName: item.iconName,
  color: MAGIC_NODE_TYPE_COLORS[item.id],
}));
