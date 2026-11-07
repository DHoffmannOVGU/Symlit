import React, { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import BasePartNode, { type BasePartNodeConfig } from "./BasePartNode";

export const ACTIONDEF_DEFAULT_ACCENT_COLOR = "#f59e0b";

const config: BasePartNodeConfig = {
  defaultTypeLabel: "Behavior",
  defaultAccentColor: ACTIONDEF_DEFAULT_ACCENT_COLOR,
  defaultIconBg: "rgba(245, 158, 11, 0.12)",
  hoverBorderClass: "group-hover:!border-amber-500",
  containerClassName: `
    px-4 py-3 shadow-xl rounded-xl bg-card border-2 transition-all duration-200 h-full w-full min-w-[180px] group
  `,
  selectedClassName: "shadow-lg translate-y-[-2px]",
};

const ActionDefNode = (props: NodeProps) => {
  const data = (props.data || {}) as Record<string, unknown>;
  const withDefaults = {
    ...props,
    data: {
      ...data,
      icon: data.icon ?? "Zap",
    },
  };

  return <BasePartNode {...withDefaults} config={config} />;
};

export default memo(ActionDefNode);
