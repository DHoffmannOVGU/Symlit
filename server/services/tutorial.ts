import { randomUUID } from "node:crypto";
import type { Project } from "@shared/schema";
import {
  TUTORIAL_INSTANCE,
  TUTORIAL_INSTANCE_TEMPLATE,
  TUTORIAL_METAMODEL,
  TUTORIAL_METAMODEL_TEMPLATE,
  type TutorialSeedProject,
} from "@shared/tutorial";
import { storage } from "../storage";

export interface CreatedTutorial {
  metamodel: Project;
  instance: Project;
  metamodelViewId: number;
  instanceViewId: number;
}

/**
 * Connection points for a relationship: side by side elements connect right
 * to left; elements above each other use the default bottom/top points.
 */
function handlesFor(source: { x: number; y: number }, target: { x: number; y: number }) {
  return Math.abs(target.x - source.x) >= Math.abs(target.y - source.y)
    ? { sourceHandle: "right", targetHandle: "left" }
    : { sourceHandle: null, targetHandle: null };
}

function buildView(
  seed: TutorialSeedProject,
  ids: Map<string, string>,
  resolveType?: (typeKey: string) => { typeId: string; label: string; icon?: unknown; color?: unknown },
) {
  const idFor = (key: string) => {
    let id = ids.get(key);
    if (!id) {
      id = `node_${randomUUID()}`;
      ids.set(key, id);
    }
    return id;
  };
  const positionOf = (key: string) =>
    seed.nodes.find((node) => node.key === key)?.position ?? { x: 0, y: 0 };
  return {
    name: seed.viewName,
    description: seed.viewDescription,
    nodes: seed.nodes.map((node) => {
      const type = node.typeKey ? resolveType?.(node.typeKey) : undefined;
      return {
        id: idFor(node.key),
        type: node.type,
        position: node.position,
        data: {
          ...node.data,
          ...(type
            ? {
                type: type.label,
                typeId: type.typeId,
                icon: type.icon,
                color: type.color,
                inheritStyle: true,
              }
            : { type: (node.data.label as string) ?? undefined }),
        },
      };
    }),
    edges: seed.edges.map((edge) => ({
      id: `edge_${randomUUID()}`,
      source: idFor(edge.source),
      target: idFor(edge.target),
      edgeType: edge.edgeType,
      ...handlesFor(positionOf(edge.source), positionOf(edge.target)),
      data: edge.data ?? { edgeType: edge.edgeType },
    })),
  };
}

/**
 * Creates the two tutorial projects: a metamodel and an instance model that
 * references it and whose elements are typed by the metamodel's types.
 */
export async function createTutorial(userId: number): Promise<CreatedTutorial> {
  const metamodelIds = new Map<string, string>();
  const metamodelView = buildView(TUTORIAL_METAMODEL, metamodelIds);
  // In a metamodel, an element's "type" is its kind (Object, Behavior, ...).
  metamodelView.nodes = metamodelView.nodes.map((node) => ({
    ...node,
    data: { ...node.data, type: node.type === "actiondef" ? "Behavior" : "Object" },
  }));

  const metamodel = await storage.createStarterProject(
    {
      userId,
      name: TUTORIAL_METAMODEL.name,
      description: TUTORIAL_METAMODEL.description,
      projectType: "metamodel",
      templateId: TUTORIAL_METAMODEL_TEMPLATE,
    },
    [metamodelView],
    { preserveIds: true },
  );

  try {
    const seedTypes = new Map(TUTORIAL_METAMODEL.nodes.map((node) => [node.key, node]));
    const instanceView = buildView(TUTORIAL_INSTANCE, new Map(), (typeKey) => {
      const typeNode = seedTypes.get(typeKey);
      const elementId = metamodelIds.get(typeKey);
      if (!typeNode || !elementId) throw new Error(`Unknown tutorial type ${typeKey}`);
      return {
        typeId: `mm:${metamodel.project.id}:${elementId}`,
        label: String(typeNode.data.label),
        icon: typeNode.data.icon,
        color: typeNode.data.color,
      };
    });
    const instance = await storage.createStarterProject(
      {
        userId,
        name: TUTORIAL_INSTANCE.name,
        description: TUTORIAL_INSTANCE.description,
        projectType: "instance",
        templateId: TUTORIAL_INSTANCE_TEMPLATE,
        referencedMetamodels: [metamodel.project.id],
      },
      [instanceView],
      { preserveIds: true },
    );
    return {
      metamodel: metamodel.project,
      instance: instance.project,
      metamodelViewId: metamodel.firstViewId!,
      instanceViewId: instance.firstViewId!,
    };
  } catch (error) {
    await storage.deleteProject(metamodel.project.id);
    throw error;
  }
}

/** Deletes the user's tutorial projects. Returns how many were removed. */
export async function deleteTutorial(userId: number): Promise<number> {
  const projects = await storage.getProjectsByUser(userId);
  const tutorialProjects = projects.filter(
    (project) =>
      project.templateId === TUTORIAL_METAMODEL_TEMPLATE ||
      project.templateId === TUTORIAL_INSTANCE_TEMPLATE,
  );
  // Instance first, so it never references a deleted metamodel.
  tutorialProjects.sort((a) => (a.templateId === TUTORIAL_INSTANCE_TEMPLATE ? -1 : 1));
  for (const project of tutorialProjects) await storage.deleteProject(project.id);
  return tutorialProjects.length;
}
