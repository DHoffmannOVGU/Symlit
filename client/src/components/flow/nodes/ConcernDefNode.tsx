import React, { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import BasePartNode, { type BasePartNodeConfig } from "./BasePartNode";

export const CONCERNDEF_DEFAULT_ACCENT_COLOR = "#a855f7";

const config: BasePartNodeConfig = {
  defaultTypeLabel: "Concern",
  defaultAccentColor: CONCERNDEF_DEFAULT_ACCENT_COLOR,
  defaultIconBg: "rgba(168, 85, 247, 0.1)",
  hoverBorderClass: "group-hover:!border-purple-500",
  containerClassName: `
    px-4 py-3 shadow-xl rounded-xl bg-card border-2 transition-all duration-200 h-full w-full min-w-[180px] group
  `,
  selectedClassName: "shadow-lg translate-y-[-2px]",
};

const ConcernDefNode = (props: NodeProps) => {
  const data = (props.data || {}) as Record<string, unknown>;
  const withDefaults = {
    ...props,
    data: {
      ...data,
      icon: data.icon ?? "Shield",
    },
  };

  return <BasePartNode {...withDefaults} config={config} />;
};

export default memo(ConcernDefNode);
