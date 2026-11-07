import { db } from "./db";
import {
  users,
  projects,
  views,
  nodes,
  nodeViews,
  edges,
  type User,
  type Project,
  type InsertProject,
  type View,
  type InsertView,
  type FlowNode,
  type FlowNodeWithPosition,
  type FlowEdge,
} from "@shared/schema";
import type {
  FlowEdgeInput,
  PatternEdgeInput,
  PatternNodeInput,
  SyncFlowNodeInput,
} from "@shared/flow-inputs";
import { eq, and, inArray } from "drizzle-orm";
import {
  createInternalViewForNode as createInternalViewForNodeService,
  getInternalViewByNodeId as getInternalViewByNodeIdService,
} from "./services/internal-views";
import { createPattern as createPatternService } from "./services/patterns";
import {
  getFlow as getFlowService,
  getFlowRecovery as getFlowRecoveryService,
  insertNodeIntoView as insertNodeIntoViewService,
  insertPatternIntoView as insertPatternIntoViewService,
  buildStarterViewRecords,
  validateStarterTemplate,
  type StarterViewFlowInput,
  syncFlow as syncFlowService,
} from "./services/flow-mutations";

/**
 * `IStorage` is intentionally thin: it exposes simple CRUD over the persistence
 * layer. Anything with non-trivial business rules (multi-step transactions,
 * cross-entity validation, layout/centering math, etc.) belongs in
 * `server/services/*` and is delegated here as a pass-through. The storage
 * layer should never grow beyond plumbing.
 */
export interface IStorage {
  // Users
  getOrCreateUser(username: string): Promise<User>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  updateUserDisplayName(id: number, displayName: string): Promise<User>;

  // Projects
  getProjectsByUser(userId: number): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  getProjectExportData(projectId: number): Promise<{
    project: Project;
    views: Array<
      View & { nodes: Array<FlowNodeWithPosition>; edges: FlowEdge[] }
    >;
  }>;
  createProject(project: InsertProject): Promise<Project>;
  createStarterProject(
    project: InsertProject,
    starterViews: Array<
      StarterViewFlowInput & { name: string; description?: string }
    >,
  ): Promise<{ project: Project; firstViewId: number | null }>;
  updateProject(
    id: number,
    project: Partial<InsertProject> & { referencedMetamodels?: number[] },
  ): Promise<Project>;
  deleteProject(id: number): Promise<void>;

  // Views
  getViews(projectId: number): Promise<View[]>;
  getView(id: number): Promise<View | undefined>;
  createView(view: InsertView): Promise<View>;
  updateView(id: number, view: Partial<InsertView>): Promise<View>;
  deleteView(id: number): Promise<void>;
  getInternalViews(projectId: number): Promise<View[]>;
  getInternalViewByNodeId(nodeId: string): Promise<View | undefined>;
  createInternalViewForNode(
    nodeId: string,
    overrides?: { name?: string; description?: string; parentViewId?: number },
  ): Promise<View>;

  // Patterns
  getPatterns(projectId: number): Promise<View[]>;
  createPattern(
    projectId: number,
    pattern: {
      name: string;
      description?: string;
      nodes: PatternNodeInput[];
      edges: PatternEdgeInput[];
    },
  ): Promise<void>;

  // Flow (Nodes/Edges)
  getNodeById(nodeId: string): Promise<FlowNode | undefined>;
  getFlowRecovery(viewId: number): ReturnType<typeof getFlowRecoveryService>;
  getFlow(
    viewId: number,
  ): Promise<{ nodes: FlowNodeWithPosition[]; edges: FlowEdge[] }>;
  syncFlow(
    viewId: number,
    nodes: SyncFlowNodeInput[],
    edges: FlowEdgeInput[],
  ): Promise<void>;
  insertNodeIntoView(
    viewId: number,
    nodeId: string,
    position: { x: number; y: number },
  ): Promise<void>;
  insertPatternIntoView(
    viewId: number,
    patternId: number,
    position: { x: number; y: number },
  ): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getOrCreateUser(username: string): Promise<User> {
    const existing = await this.getUserByUsername(username);
    if (existing) return existing;
    const [created] = await db.insert(users).values({ username }).returning();
    return created;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }


  async updateUserDisplayName(id: number, displayName: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ displayName })
      .where(eq(users.id, id))
      .returning();
    if (!user) throw new Error("User not found");
    return user;
  }

  // Projects
  async getProjectsByUser(userId: number): Promise<Project[]> {
    return db.select().from(projects).where(eq(projects.userId, userId));
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id));
    return project;
  }

  async getProjectExportData(projectId: number) {
    const project = await this.getProject(projectId);
    if (!project) throw new Error("Project not found");

    const viewRows = await this.getViews(projectId);
    const viewsWithFlow = await Promise.all(
      viewRows.map(async (view) => {
        const flow = await this.getFlow(view.id);
        return { ...view, nodes: flow.nodes, edges: flow.edges };
      }),
    );
    return { project, views: viewsWithFlow };
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db
      .insert(projects)
      .values(insertProject)
      .returning();
    return project;
  }

  async createStarterProject(
    insertProject: InsertProject,
    starterViews: Array<
      StarterViewFlowInput & { name: string; description?: string }
    >,
  ): Promise<{ project: Project; firstViewId: number | null }> {
    validateStarterTemplate(starterViews);

    return db.transaction(async (tx) => {
      const [project] = await tx
        .insert(projects)
        .values(insertProject)
        .returning();
      let firstViewId: number | null = null;

      for (const starterView of starterViews) {
        const [view] = await tx
          .insert(views)
          .values({
            projectId: project.id,
            name: starterView.name,
            description: starterView.description,
          })
          .returning();
        firstViewId ??= view.id;

        const records = buildStarterViewRecords(
          project.id,
          view.id,
          starterView,
        );
        if (starterView.nodes.length > 0) {
          await tx.insert(nodes).values(records.nodes);
          await tx.insert(nodeViews).values(records.nodeViews);
        }

        if (starterView.edges.length > 0) {
          await tx.insert(edges).values(records.edges);
        }
      }

      return { project, firstViewId };
    });
  }

  async updateProject(
    id: number,
    update: Partial<InsertProject> & { referencedMetamodels?: number[] },
  ): Promise<Project> {
    const updateData: any = { ...update };
    if (update.referencedMetamodels !== undefined) {
      updateData.referencedMetamodels = update.referencedMetamodels;
    }
    const [project] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, id))
      .returning();
    if (!project) throw new Error("Project not found");
    return project;
  }

  async deleteProject(id: number): Promise<void> {
    const viewRows = await db
      .select({ id: views.id })
      .from(views)
      .where(eq(views.projectId, id));
    const viewIds = viewRows.map((row) => row.id);

    await db.transaction(async (tx) => {
      if (viewIds.length > 0) {
        await tx.delete(nodeViews).where(inArray(nodeViews.viewId, viewIds));
        await tx.delete(edges).where(inArray(edges.viewId, viewIds));
      }
      await tx.delete(nodes).where(eq(nodes.projectId, id));
      await tx.delete(views).where(eq(views.projectId, id));
      await tx.delete(projects).where(eq(projects.id, id));
    });
  }


  // Views
  async getViews(projectId: number): Promise<View[]> {
    return db
      .select()
      .from(views)
      .where(and(eq(views.projectId, projectId), eq(views.viewType, "view")));
  }

  async getView(id: number): Promise<View | undefined> {
    const [view] = await db.select().from(views).where(eq(views.id, id));
    return view;
  }

  async createView(insertView: InsertView): Promise<View> {
    const [view] = await db.insert(views).values(insertView).returning();
    return view;
  }

  async updateView(id: number, update: Partial<InsertView>): Promise<View> {
    const [view] = await db
      .update(views)
      .set(update)
      .where(eq(views.id, id))
      .returning();
    if (!view) throw new Error("View not found");
    return view;
  }

  async deleteView(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(nodeViews).where(eq(nodeViews.viewId, id));
      await tx.delete(edges).where(eq(edges.viewId, id));
      await tx.delete(views).where(eq(views.id, id));
    });
  }

  async getInternalViews(projectId: number): Promise<View[]> {
    return db
      .select()
      .from(views)
      .where(
        and(eq(views.projectId, projectId), eq(views.viewType, "internal")),
      );
  }

  // Delegations to services (business logic lives there).
  getInternalViewByNodeId(nodeId: string): Promise<View | undefined> {
    return getInternalViewByNodeIdService(nodeId);
  }

  createInternalViewForNode(
    nodeId: string,
    overrides?: { name?: string; description?: string; parentViewId?: number },
  ): Promise<View> {
    return createInternalViewForNodeService(nodeId, overrides);
  }

  // Patterns
  async getPatterns(projectId: number): Promise<View[]> {
    return db
      .select()
      .from(views)
      .where(
        and(eq(views.projectId, projectId), eq(views.viewType, "pattern")),
      );
  }

  createPattern(
    projectId: number,
    pattern: {
      name: string;
      description?: string;
      nodes: PatternNodeInput[];
      edges: PatternEdgeInput[];
    },
  ): Promise<void> {
    return createPatternService(projectId, pattern);
  }

  // Flow
  async getNodeById(nodeId: string): Promise<FlowNode | undefined> {
    const [node] = await db.select().from(nodes).where(eq(nodes.id, nodeId));
    return node;
  }

  getFlow(viewId: number) {
    return getFlowService(viewId);
  }

  getFlowRecovery(viewId: number) {
    return getFlowRecoveryService(viewId);
  }

  syncFlow(
    viewId: number,
    newNodes: SyncFlowNodeInput[],
    newEdges: FlowEdgeInput[],
  ): Promise<void> {
    return syncFlowService(viewId, newNodes, newEdges);
  }

  insertNodeIntoView(
    viewId: number,
    nodeId: string,
    position: { x: number; y: number },
  ): Promise<void> {
    return insertNodeIntoViewService(viewId, nodeId, position);
  }

  insertPatternIntoView(
    viewId: number,
    patternId: number,
    position: { x: number; y: number },
  ): Promise<void> {
    return insertPatternIntoViewService(viewId, patternId, position);
  }
}

export const storage = new DatabaseStorage();
