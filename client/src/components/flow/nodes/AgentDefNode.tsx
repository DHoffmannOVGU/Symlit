import React, { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import BasePartNode, { type BasePartNodeConfig } from "./BasePartNode";

export const AGENTDEF_DEFAULT_ACCENT_COLOR = "#0ea5e9";

const config: BasePartNodeConfig = {
  defaultTypeLabel: "Performer",
  defaultAccentColor: AGENTDEF_DEFAULT_ACCENT_COLOR,
  defaultIconBg: "rgba(14, 165, 233, 0.12)",
  hoverBorderClass: "group-hover:!border-sky-500",
  containerClassName: `
    px-4 py-3 shadow-xl rounded-xl bg-card border-2 transition-all duration-200 h-full w-full min-w-[180px] group
  `,
  selectedClassName: "shadow-lg translate-y-[-2px]",
};

const AgentDefNode = (props: NodeProps) => {
  const data = (props.data || {}) as Record<string, unknown>;
  const withDefaults = {
    ...props,
    data: {
      ...data,
      icon: data.icon ?? "Bot",
    },
  };

  return <BasePartNode {...withDefaults} config={config} />;
};

export default memo(AgentDefNode);
