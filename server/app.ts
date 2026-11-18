import express, { type NextFunction, type Request, type Response } from "express";
import { createServer, type Server } from "node:http";
import { registerRoutes } from "./routes/index";
import { authorizeWorkspaceApi, createLocalAuth, type AuthProvider } from "./auth";
import type { AppConfig } from "./config";
import { catchAsyncRouteErrors, guardLocalApi, rejectInvalidIds } from "./http-guards";
import { log } from "./log";

export interface CreatedApp {
  app: express.Express;
  httpServer: Server;
  auth: AuthProvider;
}

/**
 * Builds the Express application without listening or serving the client.
 * The database must be initialised before requests are handled.
 */
export async function createApp(
  config: AppConfig,
  options: { requestLogging?: boolean; auth?: AuthProvider } = {},
): Promise<CreatedApp> {
  const app = express();
  const httpServer = createServer(app);
  const auth = options.auth ?? createLocalAuth(config.localUserName);
  app.locals.auth = { kind: auth.kind, signInUrl: auth.signInUrl, signOutUrl: auth.signOutUrl };

  app.disable("x-powered-by");
  catchAsyncRouteErrors(app);
  rejectInvalidIds(app);
  // The whole app (pages included) is guarded, so a rebound domain gets nothing.
  app.use(guardLocalApi(config.allowedHosts));
  // JSON only: form-encoded bodies are what other sites can post without a
  // CORS preflight, and no client of this API sends them.
  app.use(express.json({ limit: "10mb" }));

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

  await auth.setup?.(app, httpServer);
  app.use("/api", auth.attachUser);
  app.use("/api", (req, _res, next) => {
    req.authKind ??= auth.kind;
    next();
  });
  app.use("/api", authorizeWorkspaceApi(auth.signInUrl));

  await registerRoutes(httpServer, app, config);

  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const details = (typeof err === "object" && err !== null ? err : {}) as {
      status?: number;
      statusCode?: number;
      message?: string;
    };
    const status = details.status || details.statusCode || 500;
    if (status >= 500) console.error(err);
    if (res.headersSent) return next(err);
    res.status(status).json({
      message: status >= 500 ? "Internal Server Error" : details.message || "Request failed",
    });
  });

  return { app, httpServer, auth };
}
