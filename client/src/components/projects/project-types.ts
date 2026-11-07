import { Box, Layers, type LucideIcon } from "lucide-react";

export interface ProjectTypeMeta {
  label: string;
  icon: LucideIcon;
  iconClassName: string;
  badgeClassName: string;
}

export function getProjectTypeMeta(
  projectType: string | null | undefined,
): ProjectTypeMeta {
  if (projectType === "metamodel") {
    return {
      label: "Metamodel",
      icon: Layers,
      iconClassName:
        "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
      badgeClassName:
        "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-300",
    };
  }
  return {
    label: "Instance",
    icon: Box,
    iconClassName:
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    badgeClassName:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
  };
}