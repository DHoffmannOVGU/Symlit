import { expect, test } from "@playwright/test";

// Full-stack checks against the real local server and its throwaway
// in-memory database: no API mocking.

test("opens straight into the local workspace without a login", async ({ page }) => {
  // The local edition must work offline: no fonts, scripts or APIs from other hosts.
  const external: string[] = [];
  page.on("request", (request) => {
    const { hostname } = new URL(request.url());
    if (!["localhost", "127.0.0.1"].includes(hostname)) external.push(request.url());
  });
  await page.goto("/");
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByTestId("button-new-project")).toBeVisible();
  await expect(page.getByText("Local workspace")).toBeVisible();
  await expect(page).toHaveTitle("Symlit");
  expect(external).toEqual([]);
});

test("creates a project in the UI and persists it on the server", async ({ page, request }) => {
  const name = `UI project ${Date.now()}`;
  await page.goto("/projects");
  await page.getByTestId("button-new-project").click();
  await page.getByTestId("radio-instance").click();
  await page.getByTestId("input-project-name").fill(name);
  await page.getByTestId("button-create-project").click();

  await expect
    .poll(async () => {
      const projects = await (await request.get("/api/projects")).json();
      return projects.some((project: { name: string }) => project.name === name);
    })
    .toBe(true);
});

test("renders a diagram saved through the API and keeps it after reload", async ({
  page,
  request,
}) => {
  const me = await (await request.get("/api/auth/me")).json();
  const projectResponse = await request.post("/api/projects", {
    data: { userId: me.user.id, name: "Persisted diagram", projectType: "instance" },
  });
  expect(projectResponse.status()).toBe(201);
  const project = await projectResponse.json();
  const view = await (
    await request.post(`/api/projects/${project.id}/views`, { data: { name: "Context" } })
  ).json();

  const prefix = `e2e-${project.id}`;
  const sync = await request.post(`/api/views/${view.id}/sync`, {
    data: {
      nodes: [
        { id: `${prefix}-a`, type: "part", position: { x: 80, y: 120 }, data: { label: "Battery", type: "Object" } },
        { id: `${prefix}-b`, type: "part", position: { x: 480, y: 120 }, data: { label: "Controller", type: "Object" } },
      ],
      edges: [
        {
          id: `${prefix}-ab`,
          source: `${prefix}-a`,
          target: `${prefix}-b`,
          edgeType: "association",
          sourceHandle: null,
          targetHandle: null,
        },
      ],
    },
  });
  expect(sync.ok()).toBe(true);

  await page.goto(`/project/${project.id}/view/${view.id}`);
  await expect(page.getByTestId("diagram-canvas-region")).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.getByText("Battery", { exact: true })).toBeVisible();
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);

  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
});
