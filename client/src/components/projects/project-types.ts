import { Box, Layers, Workflow, type LucideIcon } from "lucide-react";

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
  if (projectType === "method") {
    return {
      label: "Method",
      icon: Workflow,
      iconClassName:
        "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400",
      badgeClassName:
        "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-300",
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