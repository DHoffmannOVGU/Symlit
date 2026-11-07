import type { NextFunction, Request, RequestHandler, Response } from "express";
import { storage } from "./storage";
import type { WorkspaceRole } from "@shared/authorization";
import type { Project, User } from "@shared/schema";

declare global {
  namespace Express {
    interface Request {
      workspaceUser?: User;
      workspaceRole?: WorkspaceRole;
      authKind?: "local";
    }
  }
}

export const LOCAL_USERNAME = "local";

/**
 * The local edition is single-user: every request acts as one implicit local
 * owner. The user row is created on first use and cached for the process.
 */
export function createLocalAuth(displayName: string) {
  let cached: User | undefined;

  const resolveLocalUser = async (): Promise<User> => {
    if (cached) return cached;
    const user = await storage.getOrCreateUser(LOCAL_USERNAME);
    cached =
      user.displayName === displayName
        ? user
        : await storage.updateUserDisplayName(user.id, displayName);
    return cached;
  };

  const attachLocalUser: RequestHandler = async (req, _res, next) => {
    try {
      req.workspaceUser = await resolveLocalUser();
      req.workspaceRole = "admin";
      req.authKind = "local";
      next();
    } catch (error) {
      next(error);
    }
  };

  return { resolveLocalUser, attachLocalUser };
}

/** Owners administer their own projects; nobody else has access. */
export async function projectRole(
  project: Project,
  user: User,
): Promise<WorkspaceRole | null> {
  return project.userId === user.id ? "admin" : null;
}

async function requireProjectAccess(req: Request, res: Response, projectId: number) {
  if (!req.workspaceUser) {
    res.status(401).json({ message: "Authentication required" });
    return null;
  }
  const project = await storage.getProject(projectId);
  if (!project) {
    res.status(404).json({ message: "Project not found" });
    return null;
  }
  const role = await projectRole(project, req.workspaceUser);
  if (!role) {
    res.status(403).json({ message: "You do not have access to this project" });
    return null;
  }
  req.workspaceRole = role;
  return project;
}

function pathParts(req: Request) {
  return req.originalUrl.split("?")[0].split("/").filter(Boolean);
}

/**
 * Resolves the project a request targets (directly, or through a view or
 * node id) and checks that the current user owns it. Resource ownership is
 * checked here instead of trusting ids supplied by the browser.
 */
export function authorizeWorkspaceApi(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const parts = pathParts(req);
    if (parts[1] === "config" || (parts[1] === "auth" && parts[2] === "me")) {
      return next();
    }
    if (!req.workspaceUser) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      let projectId: number | undefined;
      if (parts[1] === "projects" && parts[2] && Number.isFinite(Number(parts[2]))) {
        projectId = Number(parts[2]);
      } else if (parts[1] === "views" && parts[2]) {
        const view = await storage.getView(Number(parts[2]));
        if (!view) return res.status(404).json({ message: "View not found" });
        projectId = view.projectId;
      } else if (parts[1] === "nodes" && parts[2]) {
        const node = await storage.getNodeById(String(parts[2]));
        if (!node) return res.status(404).json({ message: "Node not found" });
        projectId = node.projectId;
      }

      if (projectId !== undefined) {
        const project = await requireProjectAccess(req, res, projectId);
        if (!project) return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
