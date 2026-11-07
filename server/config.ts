import path from "node:path";
import { z } from "zod";

const booleanFlag = (defaultValue: boolean) =>
  z
    .enum(["true", "false", "1", "0", "yes", "no", ""])
    .optional()
    .transform((value) =>
      value === undefined || value === ""
        ? defaultValue
        : ["true", "1", "yes"].includes(value),
    );

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  // Local edition: listen on loopback only unless explicitly opened up
  // (for example inside a container, where HOST=0.0.0.0 is set).
  HOST: z.string().min(1).default("127.0.0.1"),
  DATABASE_URL: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  SYMLIT_DATA_DIR: z.string().min(1).default("./data"),
  SYMLIT_SEED_DEMO: booleanFlag(true),
  SYMLIT_USER_NAME: z.string().trim().min(1).max(80).default("Local user"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
});

export type DatabaseConfig =
  | { driver: "postgres"; url: string }
  | { driver: "pglite"; dataDir: string | null };

export interface AppConfig {
  env: "development" | "production" | "test";
  port: number;
  host: string;
  database: DatabaseConfig;
  seedDemo: boolean;
  localUserName: string;
  features: {
    ai: boolean;
  };
}

/**
 * Parses process environment into a typed, validated configuration.
 * The local edition needs no environment variables at all: without
 * DATABASE_URL it falls back to an embedded PGlite database in
 * SYMLIT_DATA_DIR.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid Symlit configuration:\n${details}`);
  }
  const values = parsed.data;
  return {
    env: values.NODE_ENV,
    port: values.PORT,
    host: values.HOST,
    database: values.DATABASE_URL
      ? { driver: "postgres", url: values.DATABASE_URL }
      : {
          driver: "pglite",
          // ":memory:" keeps everything in RAM (used by end-to-end tests).
          dataDir:
            values.SYMLIT_DATA_DIR === ":memory:"
              ? null
              : path.resolve(values.SYMLIT_DATA_DIR, "pg"),
        },
    seedDemo: values.SYMLIT_SEED_DEMO,
    localUserName: values.SYMLIT_USER_NAME,
    features: {
      ai: Boolean(values.GEMINI_API_KEY?.trim()),
    },
  };
}
