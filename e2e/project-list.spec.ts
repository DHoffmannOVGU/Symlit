import { expect, test } from "@playwright/test";

test("project cards are real links, and deleting a metamodel in use names what depends on it", async ({ page, request }) => {
  const metamodel = await (
    await request.post("/api/projects", { data: { name: "List: types", projectType: "metamodel" } })
  ).json();
  const model = await (
    await request.post("/api/projects", {
      data: { name: "List: model", projectType: "instance", referencedMetamodels: [metamodel.id] },
    })
  ).json();

  await page.goto("/projects");
  const card = page.getByTestId(`card-project-${metamodel.id}`);
  await expect(card.getByRole("link", { name: "Open project List: types" })).toHaveAttribute(
    "href",
    `/project/${metamodel.id}`,
  );

  await card.hover();
  await page.getByTestId(`button-delete-project-${metamodel.id}`).click();
  await expect(page.getByTestId("delete-project-dependents")).toContainText("List: model");
  await page.getByRole("button", { name: "Cancel" }).click();

  // A project nothing depends on has no such warning.
  await page.getByTestId(`card-project-${model.id}`).hover();
  await page.getByTestId(`button-delete-project-${model.id}`).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(page.getByTestId("delete-project-dependents")).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel" }).click();

  // Clicking anywhere on the card opens the project.
  await card.click({ position: { x: 30, y: 150 } });
  await expect(page).toHaveURL(new RegExp(`/project/${metamodel.id}`));
});

test("a diagram address under the wrong project does not mix two projects", async ({ page, request }) => {
  const one = await (await request.post("/api/projects", { data: { name: "Mix: one", projectType: "metamodel" } })).json();
  const two = await (await request.post("/api/projects", { data: { name: "Mix: two", projectType: "metamodel" } })).json();
  const foreign = await (await request.post(`/api/projects/${two.id}/views`, { data: { name: "Foreign diagram" } })).json();

  await page.goto(`/project/${one.id}/view/${foreign.id}`);
  await expect(page.getByText("Diagram not found", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/project/${one.id}$`));

  await page.goto("/project/987654");
  await expect(page.getByText("Project not found", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/projects$/);
});

test("a project file exported from one project imports as a new one", async ({ page, request }) => {
  const project = await (await request.post("/api/projects", { data: { name: "Round trip", projectType: "metamodel" } })).json();
  const view = await (await request.post(`/api/projects/${project.id}/views`, { data: { name: "Types" } })).json();
  await request.post(`/api/views/${view.id}/sync`, {
    data: {
      nodes: [{ id: `rt-${project.id}`, type: "partdef", position: { x: 0, y: 0 }, data: { label: "Gearbox", attributes: [] } }],
      edges: [],
    },
  });
  const file = await (await request.post(`/api/projects/${project.id}/export`, { data: { format: "json" } })).body();

  await page.goto("/projects");
  await page.getByTestId("input-import-project").setInputFiles({ name: "round-trip.json", mimeType: "application/json", buffer: file });
  await expect(page).toHaveURL(/\/project\/\d+\/view\/\d+$/);
  expect(page.url()).not.toContain(`/project/${project.id}/`);
  await expect(page.locator(".react-flow__node", { hasText: "Gearbox" })).toBeVisible();

  await page.goto("/projects");
  await page.getByTestId("input-import-project").setInputFiles({ name: "notes.json", mimeType: "application/json", buffer: Buffer.from("not json") });
  await expect(page.getByText("Not a project file", { exact: true })).toBeVisible();
});
