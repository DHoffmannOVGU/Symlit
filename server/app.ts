import express, { type NextFunction, type Request, type Response } from "express";
import { createServer, type Server } from "node:http";
import { registerRoutes } from "./routes";
import { authorizeWorkspaceApi, createLocalAuth } from "./auth";
import type { AppConfig } from "./config";
import { log } from "./log";

export interface CreatedApp {
  app: express.Express;
  httpServer: Server;
  resolveLocalUser: ReturnType<typeof createLocalAuth>["resolveLocalUser"];
}

/**
 * Builds the Express application without listening or serving the client.
 * The database must be initialised before requests are handled.
 */
export async function createApp(
  config: AppConfig,
  options: { requestLogging?: boolean } = {},
): Promise<CreatedApp> {
  const app = express();
  const httpServer = createServer(app);
  const localAuth = createLocalAuth(config.localUserName);

  app.disable("x-powered-by");
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  if (options.requestLogging ?? true) {
    // Log method, path, status and duration only. Response bodies contain
    // model data and are deliberately not written to the log.
    app.use((req, res, next) => {
      if (!req.path.startsWith("/api")) return next();
      const start = Date.now();
      res.on("finish", () => {
        log(`${req.method} ${req.path} ${res.statusCode} in ${Date.now() - start}ms`);
      });
      next();
    });
  }

  app.use("/api", localAuth.attachLocalUser);
  app.use("/api", authorizeWorkspaceApi());

  await registerRoutes(httpServer, app, config);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(err);
    if (res.headersSent) return next(err);
    res.status(status).json({
      message: status >= 500 ? "Internal Server Error" : err.message || "Request failed",
    });
  });

  return { app, httpServer, resolveLocalUser: localAuth.resolveLocalUser };
}
