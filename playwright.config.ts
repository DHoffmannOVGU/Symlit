import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 5100);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  webServer: {
    // A throwaway in-memory database per run. The AI assistant is enabled with
    // a dummy key because its spec mocks the AI endpoint.
    command: "tsx server/index.ts",
    url: `http://127.0.0.1:${PORT}/api/config`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: "development",
      PORT: String(PORT),
      HOST: "127.0.0.1",
      DATABASE_URL: "",
      SYMLIT_DATA_DIR: ":memory:",
      SYMLIT_SEED_DEMO: "false",
      GEMINI_API_KEY: "e2e-placeholder",
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Optional: use a preinstalled Chromium instead of `npx playwright install`.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],
});
