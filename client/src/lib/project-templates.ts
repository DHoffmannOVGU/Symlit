import type { ProjectType } from "@shared/schema";
import type { FlowEdgeInput, SyncFlowNodeInput } from "@shared/flow-inputs";
import {
  getMetamodelPurposeRecommendation,
  type MetamodelSetup,
} from "@shared/metamodel-setup";

export type ProjectTemplateId =
  | "blank"
  | "system-context"
  | "requirements-baseline";

export interface ProjectTemplateView {
  name: string;
  description: string;
  nodes: SyncFlowNodeInput[];
  edges: FlowEdgeInput[];
}

export interface ProjectTemplate {
  id: ProjectTemplateId;
  name: string;
  description: string;
  projectType: ProjectType;
  projectName: string;
  projectDescription: string;
  viewName?: string;
  viewDescription?: string;
  metamodelSetup?: MetamodelSetup;
  nodes: SyncFlowNodeInput[];
  edges: FlowEdgeInput[];
  views?: ProjectTemplateView[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "blank",
    name: "Blank project",
    description: "Start with an empty project and shape it your way.",
    projectType: "metamodel",
    projectName: "",
    projectDescription: "",
    nodes: [],
    edges: [],
  },
  {
    id: "system-context",
    name: "System context",
    description: "A system boundary with external actors and relationships.",
    projectType: "instance",
    projectName: "System Context Starter",
    projectDescription:
      "A starter system context model with a primary system and external actors.",
    viewName: "System Context",
    viewDescription: "High-level context and external relationships.",
    nodes: [
      {
        id: "system",
        type: "part",
        position: { x: 260, y: 170 },
        data: {
          label: "System",
          type: "Object",
          description: "Primary system boundary",
          icon: "Box",
          color: "#2563eb",
        },
      },
      {
        id: "operator",
        type: "part",
        position: { x: 40, y: 170 },
        data: {
          label: "Operator",
          type: "Actor",
          description: "Human or external operator",
          icon: "UserRound",
          color: "#0ea5e9",
        },
      },
      {
        id: "environment",
        type: "part",
        position: { x: 500, y: 170 },
        data: {
          label: "Environment",
          type: "External system",
          description: "External environment or neighboring system",
          icon: "Globe2",
          color: "#8b5cf6",
        },
      },
    ],
    edges: [
      {
        id: "operator-system",
        source: "operator",
        target: "system",
        edgeType: "association",
        sourceHandle: null,
        targetHandle: null,
        data: { label: "operates" },
      },
      {
        id: "system-environment",
        source: "system",
        target: "environment",
        edgeType: "association",
        sourceHandle: null,
        targetHandle: null,
        data: { label: "interacts with" },
      },
    ],
  },
  {
    id: "requirements-baseline",
    name: "Requirements baseline",
    description: "A small requirements model ready for traceability work.",
    projectType: "metamodel",
    projectName: "Requirements Baseline Starter",
    projectDescription:
      "A starter requirements baseline for organizing needs, constraints, and verification.",
    metamodelSetup: getMetamodelPurposeRecommendation("requirements"),
    viewName: "Requirements Baseline",
    viewDescription: "Initial requirements and verification context.",
    nodes: [
      {
        id: "stakeholder-need",
        type: "requirementdef",
        position: { x: 70, y: 150 },
        data: {
          label: "Stakeholder Need",
          type: "Need",
          description: "A need expressed by a stakeholder",
          icon: "BadgeCheck",
          color: "#7c3aed",
        },
      },
      {
        id: "system-requirement",
        type: "requirementdef",
        position: { x: 350, y: 150 },
        data: {
          label: "System Requirement",
          type: "Need",
          description: "A measurable system-level requirement",
          icon: "FileCheck2",
          color: "#2563eb",
        },
      },
      {
        id: "verification",
        type: "partdef",
        position: { x: 660, y: 150 },
        data: {
          label: "Verification",
          type: "Verification",
          description: "Evidence that a requirement is satisfied",
          icon: "ClipboardCheck",
          color: "#059669",
        },
      },
    ],
    edges: [
      {
        id: "need-requirement",
        source: "stakeholder-need",
        target: "system-requirement",
        edgeType: "association",
        sourceHandle: null,
        targetHandle: null,
        data: { label: "refines" },
      },
      {
        id: "requirement-verification",
        source: "system-requirement",
        target: "verification",
        edgeType: "association",
        sourceHandle: null,
        targetHandle: null,
        data: { label: "verified by" },
      },
    ],
  },
];

export function getProjectTemplate(id: ProjectTemplateId) {
  return PROJECT_TEMPLATES.find((template) => template.id === id) ?? PROJECT_TEMPLATES[0];
}

export function getProjectTemplateViews(template: ProjectTemplate) {
  if (template.views) return template.views;
  if (template.viewName) {
    return [
      {
        name: template.viewName,
        description: template.viewDescription ?? "",
        nodes: template.nodes,
        edges: template.edges,
      },
    ];
  }
  return [];
}