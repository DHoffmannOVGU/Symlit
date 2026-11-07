import React, { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import BasePartNode, { type BasePartNodeConfig } from "./BasePartNode";
import { PARTDEF_DEFAULT_ACCENT_COLOR } from "./PartDefNode";

const config: BasePartNodeConfig = {
  defaultTypeLabel: "Object",
  defaultAccentColor: PARTDEF_DEFAULT_ACCENT_COLOR,
  defaultIconBg: "rgba(34, 197, 94, 0.12)",
  hoverBorderClass: "group-hover:!border-emerald-500",
  containerClassName: `
    relative px-4 py-3 rounded-xl bg-card border-2 shadow-xl group
    transition-all duration-200 h-full w-full min-w-[180px]
  `,
  selectedClassName: "shadow-lg -translate-y-0.5",
};

const PartNode = (props: NodeProps) => {
  return <BasePartNode {...props} config={config} />;
};

export default memo(PartNode);
