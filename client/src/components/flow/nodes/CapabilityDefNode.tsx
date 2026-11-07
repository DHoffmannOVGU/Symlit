import React, { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import BasePartNode, { type BasePartNodeConfig } from "./BasePartNode";

export const CAPABILITYDEF_DEFAULT_ACCENT_COLOR = "#6366f1";

const config: BasePartNodeConfig = {
  defaultTypeLabel: "Capability",
  defaultAccentColor: CAPABILITYDEF_DEFAULT_ACCENT_COLOR,
  defaultIconBg: "rgba(99, 102, 241, 0.12)",
  hoverBorderClass: "group-hover:!border-indigo-500",
  containerClassName: `
    px-4 py-3 shadow-xl rounded-xl bg-card border-2 transition-all duration-200 h-full w-full min-w-[180px] group
  `,
  selectedClassName: "shadow-lg translate-y-[-2px]",
};

const CapabilityDefNode = (props: NodeProps) => {
  const data = (props.data || {}) as Record<string, unknown>;
  return (
    <BasePartNode
      {...props}
      data={{ ...data, icon: data.icon ?? "Gem" }}
      config={config}
    />
  );
};

export default memo(CapabilityDefNode);
