import { db } from "./db";
import {
  users,
  projects,
  views,
  nodes,
  nodeViews,
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
  SyncFlowNodeInput,
} from "@shared/flow-inputs";
import { eq, and } from "drizzle-orm";
import {
  getFlow as getFlowService,
  getFlowRecovery as getFlowRecoveryService,
  insertNodeIntoView as insertNodeIntoViewService,
  deleteUnplacedNodes,
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

  // Patterns
  getPatterns(projectId: number): Promise<View[]>;

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
    options?: { baseRevision?: string },
  ): Promise<{ revision: string | null }>;
  insertNodeIntoView(
    viewId: number,
    nodeId: string,
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

  async updateProject(
    id: number,
    update: Partial<InsertProject> & { referencedMetamodels?: number[] },
  ): Promise<Project> {
    const [project] = await db
      .update(projects)
      .set(update)
      .where(eq(projects.id, id))
      .returning();
    if (!project) throw new Error("Project not found");
    return project;
  }

  async deleteProject(id: number): Promise<void> {
    // Views, elements, placements and relationships cascade in the database.
    await db.delete(projects).where(eq(projects.id, id));
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
      const placed = await tx
        .select({ nodeId: nodeViews.nodeId })
        .from(nodeViews)
        .where(eq(nodeViews.viewId, id));
      // Placements and relationships of the view cascade in the database.
      await tx.delete(views).where(eq(views.id, id));
      await deleteUnplacedNodes(
        tx,
        placed.map((row) => row.nodeId),
      );
    });
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
    options?: { baseRevision?: string },
  ): Promise<{ revision: string | null }> {
    return syncFlowService(viewId, newNodes, newEdges, options);
  }

  insertNodeIntoView(
    viewId: number,
    nodeId: string,
    position: { x: number; y: number },
  ): Promise<void> {
    return insertNodeIntoViewService(viewId, nodeId, position);
  }
}

export const storage = new DatabaseStorage();
