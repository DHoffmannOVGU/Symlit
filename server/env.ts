/** Loads ./.env into process.env when present (Node >= 20.12). */
export function loadDotEnv() {
  try {
    process.loadEnvFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
