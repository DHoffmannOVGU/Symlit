import React, { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import BasePartNode, { type BasePartNodeConfig } from "./BasePartNode";

export const EVENTDEF_DEFAULT_ACCENT_COLOR = "#ec4899";

const config: BasePartNodeConfig = {
  defaultTypeLabel: "Event",
  defaultAccentColor: EVENTDEF_DEFAULT_ACCENT_COLOR,
  defaultIconBg: "rgba(236, 72, 153, 0.12)",
  hoverBorderClass: "group-hover:!border-pink-500",
  containerClassName: `
    px-4 py-3 shadow-xl rounded-xl bg-card border-2 transition-all duration-200 h-full w-full min-w-[180px] group
  `,
  selectedClassName: "shadow-lg translate-y-[-2px]",
};

const EventDefNode = (props: NodeProps) => {
  const data = (props.data || {}) as Record<string, unknown>;
  return (
    <BasePartNode
      {...props}
      data={{ ...data, icon: data.icon ?? "Radio" }}
      config={config}
    />
  );
};

export default memo(EventDefNode);
