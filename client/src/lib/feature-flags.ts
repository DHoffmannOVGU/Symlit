import { getAppConfig } from "./app-config";

// Feature gates come from the server configuration (GET /api/config).
// `main.tsx` loads the configuration before importing the app, so these
// values are final by the time any component module evaluates them.
export const AI_ASSISTANT_ENABLED = getAppConfig().features.ai;
