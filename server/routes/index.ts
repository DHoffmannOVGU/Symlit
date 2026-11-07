import type { Express } from "express";
import type { Server } from "http";
import { api } from "@shared/routes";
import type { AppConfig } from "../config";
import { registerAiRoutes } from "./ai";
import { registerExportRoutes } from "./export";
import { registerFlowRoutes } from "./flow";
import { registerPatternRoutes } from "./patterns";
import { registerProjectRoutes } from "./projects";
import { registerSessionRoutes } from "./session";
import { registerViewRoutes } from "./views";

type ApiRoutePattern = { method: string; path: string; regex: RegExp };

function pathToRegex(path: string): RegExp {
  const pattern = path
    .split("/")
    .map((segment) =>
      segment.startsWith(":") ? "[^/]+" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("/");
  return new RegExp(`^${pattern}$`);
}

// Walks the shared `api` contract object and flattens every { method, path }
// leaf into a matchable pattern, so the 404/405 handler below stays in sync
// with routes.ts without a second hand-maintained route list.
function collectApiRoutePatterns(node: unknown, acc: ApiRoutePattern[] = []): ApiRoutePattern[] {
  if (node && typeof node === "object") {
    const maybeRoute = node as { method?: unknown; path?: unknown };
    if (typeof maybeRoute.method === "string" && typeof maybeRoute.path === "string") {
      acc.push({ method: maybeRoute.method, path: maybeRoute.path, regex: pathToRegex(maybeRoute.path) });
    } else {
      for (const value of Object.values(node)) {
        collectApiRoutePatterns(value, acc);
      }
    }
  }
  return acc;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
  config: AppConfig,
): Promise<Server> {
  registerSessionRoutes(app, config);
  registerAiRoutes(app, config);
  registerProjectRoutes(app);
  registerExportRoutes(app);
  registerViewRoutes(app);
  registerPatternRoutes(app);
  registerFlowRoutes(app);

  // Terminal handler for /api/*: must be registered after every real route
  // above and before the SPA/vite catch-all (server/index.ts), so unmatched
  // /api paths return JSON instead of falling through to index.html.
  const apiRoutePatterns = collectApiRoutePatterns(api);
  app.use((req, res, next) => {
    if (!req.path.startsWith("/api")) return next();
    const matches = apiRoutePatterns.filter((route) => route.regex.test(req.path));
    if (matches.length === 0) {
      return res.status(404).json({ message: "Not Found", path: req.path, method: req.method });
    }
    const allowed = Array.from(new Set(matches.map((route) => route.method)));
    res.set("Allow", allowed.join(", "));
    return res.status(405).json({
      message: "Method Not Allowed",
      path: req.path,
      method: req.method,
      allowed,
    });
  });

  return httpServer;
}
