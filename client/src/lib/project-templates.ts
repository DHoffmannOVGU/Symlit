import type { ProjectType } from "@shared/schema";
import type { FlowEdgeInput, SyncFlowNodeInput } from "@shared/flow-inputs";
import {
  getMetamodelPurposeRecommendation,
  type MetamodelSetup,
} from "@shared/metamodel-setup";

export type ProjectTemplateId =
  | "blank"
  | "tutorial"
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
    id: "tutorial",
    name: "Symlit quickstart",
    description: "A guided model that teaches the workspace in three short stops.",
    projectType: "instance",
    projectName: "Symlit Quickstart",
    projectDescription:
      "A hands-on introduction to Symlit: explore a system, build relationships, and review a requirement.",
    nodes: [],
    edges: [],
    views: [
      {
        name: "1 · Explore the canvas",
        description: "Start here to learn the canvas, nodes, and view navigation.",
        nodes: [
          {
            id: "tutorial-explore-system",
            type: "part",
            position: { x: 300, y: 170 },
            data: {
              label: "Mission Control",
              type: "Object",
              description: "The system we are modeling",
              icon: "Box",
              color: "#2563eb",
            },
          },
          {
            id: "tutorial-explore-operator",
            type: "part",
            position: { x: 60, y: 170 },
            data: {
              label: "Operator",
              type: "Actor",
              description: "A person who uses the system",
              icon: "UserRound",
              color: "#0ea5e9",
            },
          },
          {
            id: "tutorial-explore-ground",
            type: "part",
            position: { x: 560, y: 170 },
            data: {
              label: "Operating Environment",
              type: "External system",
              description: "The surrounding environment",
              icon: "Globe2",
              color: "#8b5cf6",
            },
          },
        ],
        edges: [
          {
            id: "tutorial-explore-operator-system",
            source: "tutorial-explore-operator",
            target: "tutorial-explore-system",
            edgeType: "association",
            sourceHandle: null,
            targetHandle: null,
            data: { label: "operates" },
          },
          {
            id: "tutorial-explore-system-ground",
            source: "tutorial-explore-system",
            target: "tutorial-explore-ground",
            edgeType: "association",
            sourceHandle: null,
            targetHandle: null,
            data: { label: "operates within" },
          },
        ],
      },
      {
        name: "2 · Build relationships",
        description: "See how connected system parts describe behavior and flow.",
        nodes: [
          {
            id: "tutorial-build-system",
            type: "part",
            position: { x: 330, y: 170 },
            data: {
              label: "Mission Control",
              type: "Object",
              description: "The system receiving and acting on telemetry",
              icon: "Box",
              color: "#2563eb",
            },
          },
          {
            id: "tutorial-build-telemetry",
            type: "part",
            position: { x: 40, y: 80 },
            data: {
              label: "Telemetry Service",
              type: "Object",
              description: "Provides incoming system measurements",
              icon: "RadioTower",
              color: "#0ea5e9",
            },
          },
          {
            id: "tutorial-build-alerting",
            type: "part",
            position: { x: 40, y: 280 },
            data: {
              label: "Alerting Service",
              type: "Object",
              description: "Notifies the operator about important events",
              icon: "BellRing",
              color: "#f59e0b",
            },
          },
          {
            id: "tutorial-build-operator",
            type: "part",
            position: { x: 650, y: 170 },
            data: {
              label: "Operator",
              type: "Actor",
              description: "Responds to system alerts",
              icon: "UserRound",
              color: "#8b5cf6",
            },
          },
        ],
        edges: [
          {
            id: "tutorial-build-telemetry-system",
            source: "tutorial-build-telemetry",
            target: "tutorial-build-system",
            edgeType: "association",
            sourceHandle: null,
            targetHandle: null,
            data: { label: "sends telemetry" },
          },
          {
            id: "tutorial-build-system-alerting",
            source: "tutorial-build-system",
            target: "tutorial-build-alerting",
            edgeType: "association",
            sourceHandle: null,
            targetHandle: null,
            data: { label: "raises alert" },
          },
          {
            id: "tutorial-build-alerting-operator",
            source: "tutorial-build-alerting",
            target: "tutorial-build-operator",
            edgeType: "association",
            sourceHandle: null,
            targetHandle: null,
            data: { label: "notifies" },
          },
        ],
      },
      {
        name: "3 · Review and save",
        description: "Finish with a requirement and its verification relationship.",
        nodes: [
          {
            id: "tutorial-review-requirement",
            type: "requirementdef",
            position: { x: 100, y: 170 },
            data: {
              label: "Response Time Requirement",
              type: "Requirement",
              description: "The system responds to an alert within 2 seconds",
              icon: "BadgeCheck",
              color: "#7c3aed",
            },
          },
          {
            id: "tutorial-review-test",
            type: "partdef",
            position: { x: 500, y: 170 },
            data: {
              label: "Response Time Test",
              type: "Verification",
              description: "A test that measures alert response time",
              icon: "ClipboardCheck",
              color: "#059669",
            },
          },
        ],
        edges: [
          {
            id: "tutorial-review-requirement-test",
            source: "tutorial-review-requirement",
            target: "tutorial-review-test",
            edgeType: "association",
            sourceHandle: null,
            targetHandle: null,
            data: { label: "verified by" },
          },
        ],
      },
    ],
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
          type: "Requirement",
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
          type: "Requirement",
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