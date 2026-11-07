import type { Page } from "@playwright/test";

/**
 * Specs that mock the whole `/api/**` surface also need the two bootstrap
 * calls every page makes: the public configuration and the local workspace
 * user. Call this AFTER registering the spec's own `/api/**` route so these
 * handlers take precedence (Playwright runs the newest matching route first).
 */
export async function mockLocalSession(
  page: Page,
  options: { userId?: number; displayName?: string; ai?: boolean } = {},
) {
  const user = {
    id: options.userId ?? 1,
    username: "local",
    displayName: options.displayName ?? "E2E user",
    createdAt: null,
  };
  await page.route("**/api/config", (route) =>
    route.fulfill({
      json: {
        edition: "local",
        version: "e2e",
        features: { ai: options.ai ?? true },
      },
    }),
  );
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user,
        role: "admin",
        authKind: "local",
        capabilities: {
          canView: true,
          canEditInstances: true,
          canEditMetamodels: true,
          canManageMembers: true,
          canCreateProjects: true,
        },
      },
    }),
  );
}
