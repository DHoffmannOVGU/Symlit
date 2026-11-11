import { expect, test } from "@playwright/test";

// Creating projects (docs/decisions/project-templates.md): from a template,
// an empty model based on a metamodel, and duplicating a project.

test("create a project from a template", async ({ page }) => {
  await page.goto("/projects");
  await page.getByTestId("button-new-project").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("select-template-system-context").click();
  await expect(dialog.getByTestId("input-project-name")).toHaveValue("System Context");
  await dialog.getByTestId("input-project-name").fill("Context from template");
  await dialog.getByTestId("button-create-project").click();

  await expect(page).toHaveURL(/\/project\/\d+\/view\/\d+$/);
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);
  await expect(page.getByText("Context from template").first()).toBeVisible();
});

test("start a model from a metamodel's card; it opens on its first diagram with the metamodel's types", async ({
  page,
  request,
}) => {
  const metamodel = await (
    await request.post("/api/projects", { data: { name: `Rover types ${Date.now()}`, projectType: "metamodel" } })
  ).json();
  const types = await (await request.post(`/api/projects/${metamodel.id}/views`, { data: { name: "Types" } })).json();
  await request.post(`/api/views/${types.id}/sync`, {
    data: {
      nodes: [{ id: `wheel-${metamodel.id}`, type: "partdef", position: { x: 0, y: 0 }, data: { label: "Wheel" } }],
      edges: [],
    },
  });

  await page.goto("/projects");
  const card = page.getByTestId(`card-project-${metamodel.id}`);
  await card.hover();
  await card.getByTestId(`button-new-model-${metamodel.id}`).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("select-based-on")).toContainText(metamodel.name);
  await dialog.getByTestId("input-project-name").fill("Rover");
  await dialog.getByTestId("button-create-project").click();

  await expect(page).toHaveURL(/\/project\/\d+\/view\/\d+$/);
  const projectId = Number(page.url().match(/project\/(\d+)/)![1]);
  const created = await (await request.get(`/api/projects/${projectId}`)).json();
  expect(created.referencedMetamodels).toEqual([metamodel.id]);
  await expect(page.getByText("Wheel").first()).toBeVisible();
});

test("duplicate a project: the copy opens and keeps its diagrams", async ({ page, request }) => {
  const created = await (
    await request.post("/api/project-templates/system-context/projects", { data: { name: `Original ${Date.now()}` } })
  ).json();

  await page.goto("/projects");
  const card = page.getByTestId(`card-project-${created.project.id}`);
  await card.hover();
  await card.getByTestId(`button-duplicate-project-${created.project.id}`).click();

  await expect(page).toHaveURL(/\/project\/\d+\/view\/\d+$/);
  expect(page.url()).not.toContain(`/project/${created.project.id}/`);
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await expect(page.getByText(`Copy of ${created.project.name}`).first()).toBeVisible();
});
