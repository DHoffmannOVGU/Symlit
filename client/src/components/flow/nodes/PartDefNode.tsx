import React, { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import BasePartNode, { type BasePartNodeConfig } from "./BasePartNode";

export const PARTDEF_DEFAULT_ACCENT_COLOR = "#22c55e";

const config: BasePartNodeConfig = {
  defaultTypeLabel: "Object",
  defaultAccentColor: PARTDEF_DEFAULT_ACCENT_COLOR,
  defaultIconBg: "rgba(34, 197, 94, 0.12)",
  hoverBorderClass: "group-hover:!border-emerald-500",
  containerClassName: `
    px-4 py-3 shadow-xl rounded-xl bg-card border-2 transition-all duration-200 h-full w-full min-w-[180px] group
  `,
  selectedClassName: "shadow-lg translate-y-[-2px]",
};

const PartDefNode = (props: NodeProps) => {
  return <BasePartNode {...props} config={config} />;
};

export default memo(PartDefNode);
