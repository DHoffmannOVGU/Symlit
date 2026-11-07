import { defineConfig } from "drizzle-kit";

// `npm run db:generate` only diffs the schema against ./migrations and needs
// no database connection. Migrations are applied by the app on startup or by
// `npm run db:migrate`.
export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
});
