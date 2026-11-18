import { createApp } from "./app";
import { createAuthProvider } from "./auth-provider";
import { recordRelationshipLinks } from "./services/relationship-links";
import { loadConfig } from "./config";
import { loadDotEnv } from "./env";
import { initDatabase } from "./db";
import { log } from "./log";
import { seedDemoProject } from "./seed";
import { serveStatic } from "./static";

export interface StartOptions {
  /** Called once the server listens, with the address to open in a browser. */
  onListening?: (url: string) => void;
}

/** Loads configuration, opens the database and starts the HTTP server. */
export async function startServer(options: StartOptions = {}) {
  loadDotEnv();
  const config = loadConfig();
  const database = await initDatabase(config.database);
  log(
    config.database.driver === "postgres"
      ? "using PostgreSQL from DATABASE_URL"
      : config.database.dataDir
        ? `using embedded PGlite database in ${config.database.dataDir}`
        : "using an in-memory PGlite database (data is lost on exit)",
    "db",
  );

  const auth = await createAuthProvider(config);
  const { app, httpServer } = await createApp(config, { auth });
  // Model relationships drawn before they recorded their metamodel relationship get it recorded once.
  try {
    const recorded = await recordRelationshipLinks();
    if (recorded > 0) log(`linked ${recorded} relationships to their metamodel relationships`, "db");
  } catch (error) {
    console.error("Could not link relationships to their metamodel relationships:", error);
  }

  if (config.seedDemo && auth.resolveSeedOwner) {
    const owner = await auth.resolveSeedOwner();
    if (await seedDemoProject(owner.id)) log("created demo project", "db");
  }

  // Vite (dev) and static serving come last so their catch-all routes do not
  // shadow the API.
  if (config.env === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  httpServer.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${config.port} is already in use. Set PORT to use another one.`);
      process.exit(1);
    }
    throw error;
  });
  httpServer.listen({ port: config.port, host: config.host }, () => {
    const url = `http://${config.host === "0.0.0.0" ? "localhost" : config.host}:${config.port}`;
    log(`Symlit is running at ${url}`);
    options.onListening?.(url);
  });

  const shutdown = async () => {
    httpServer.close();
    await database.close();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
