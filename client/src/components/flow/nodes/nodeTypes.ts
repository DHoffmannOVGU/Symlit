import PartNode from "./PartNode";
import PartDefNode from "./PartDefNode";
import ActionDefNode from "./ActionDefNode";
import ConcernDefNode from "./ConcernDefNode";
import AgentDefNode from "./AgentDefNode";
import RequirementDefNode from "./RequirementDefNode";
import EventDefNode from "./EventDefNode";
import CapabilityDefNode from "./CapabilityDefNode";

/** React Flow renderers per element type (`part` in instance models, `*def` in metamodels). */
export const nodeTypes = {
  part: PartNode,
  partdef: PartDefNode,
  actiondef: ActionDefNode,
  concerndef: ConcernDefNode,
  agentdef: AgentDefNode,
  requirementdef: RequirementDefNode,
  eventdef: EventDefNode,
  capabilitydef: CapabilityDefNode,
};
