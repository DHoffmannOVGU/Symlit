import React, { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import BasePartNode, { type BasePartNodeConfig } from "./BasePartNode";

export const REQUIREMENTDEF_DEFAULT_ACCENT_COLOR = "#14b8a6";

const config: BasePartNodeConfig = {
  defaultTypeLabel: "Requirement",
  defaultAccentColor: REQUIREMENTDEF_DEFAULT_ACCENT_COLOR,
  defaultIconBg: "rgba(20, 184, 166, 0.12)",
  hoverBorderClass: "group-hover:!border-teal-500",
  containerClassName: `
    px-4 py-3 shadow-xl rounded-xl bg-card border-2 transition-all duration-200 h-full w-full min-w-[180px] group
  `,
  selectedClassName: "shadow-lg translate-y-[-2px]",
};

const RequirementDefNode = (props: NodeProps) => {
  const data = (props.data || {}) as Record<string, unknown>;
  const withDefaults = {
    ...props,
    data: {
      ...data,
      icon: data.icon ?? "BadgeCheck",
    },
  };

  return <BasePartNode {...withDefaults} config={config} />;
};

export default memo(RequirementDefNode);
