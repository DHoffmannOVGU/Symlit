import { api, type AppConfig } from "@shared/routes";

const fallbackConfig: AppConfig = {
  edition: "local",
  version: "unknown",
  features: { ai: false },
};

let current: AppConfig = fallbackConfig;

/** Loads the server's public configuration once, before the app renders. */
export async function loadAppConfig(): Promise<AppConfig> {
  try {
    const response = await fetch(api.config.get.path, { credentials: "include" });
    if (response.ok) {
      current = api.config.get.responses[200].parse(await response.json());
    }
  } catch (error) {
    console.warn("Could not load Symlit configuration, using defaults.", error);
  }
  return current;
}

export function getAppConfig(): AppConfig {
  return current;
}
