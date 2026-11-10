import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// A diagram that changed elsewhere after it was opened (another tab, or an
// element edited in another diagram) is not overwritten unnoticed: the save
// is refused and the user picks a version.

async function openDiagram(page: Page, request: APIRequestContext, name: string) {
  const project = await (await request.post("/api/projects", { data: { name, projectType: "metamodel" } })).json();
  const view = await (await request.post(`/api/projects/${project.id}/views`, { data: { name: "Types" } })).json();
  const nodes = [
    { id: `a-${project.id}`, type: "partdef", position: { x: 100, y: 100 }, data: { label: "Alpha", attributes: [] } },
    { id: `b-${project.id}`, type: "partdef", position: { x: 500, y: 300 }, data: { label: "Beta", attributes: [] } },
  ];
  await request.post(`/api/views/${view.id}/sync`, { data: { nodes, edges: [] } });
  await page.goto(`/project/${project.id}/view/${view.id}`);
  await expect(page.locator(".react-flow__node")).toHaveCount(2);

  // "Another tab" renames Alpha and saves.
  const renamed = [{ ...nodes[0], data: { ...nodes[0].data, label: "Renamed elsewhere" } }, nodes[1]];
  expect((await request.post(`/api/views/${view.id}/sync`, { data: { nodes: renamed, edges: [] } })).ok()).toBe(true);

  // A local edit, then save.
  await page.getByTestId("button-toolbar-auto-layout").click();
  await expect(page.getByTestId("diagram-save-status").getByText("Unsaved changes")).toBeVisible();
  await page.getByTestId("button-save-diagram-header").click();
  await expect(page.getByTestId("dialog-save-conflict")).toBeVisible();
  return { view };
}

const storedLabels = async (request: APIRequestContext, viewId: number) =>
  ((await (await request.get(`/api/views/${viewId}/flow`)).json()).nodes as Array<{ data: { label: string } }>)
    .map((node) => node.data.label)
    .sort();

test("loading the other version shows what was saved elsewhere", async ({ page, request }) => {
  const { view } = await openDiagram(page, request, "Conflict: reload");
  expect(await storedLabels(request, view.id)).toEqual(["Beta", "Renamed elsewhere"]);

  await page.getByTestId("button-conflict-reload").click();
  await expect(page.getByTestId("dialog-save-conflict")).toBeHidden();
  await expect(page.locator(".react-flow__node", { hasText: "Renamed elsewhere" })).toBeVisible();
  await expect(page.getByTestId("diagram-save-status").getByText("All changes saved")).toBeVisible();
});

test("saving my version overwrites, and later saves go through", async ({ page, request }) => {
  const { view } = await openDiagram(page, request, "Conflict: overwrite");

  await page.getByTestId("button-conflict-overwrite").click();
  await expect(page.getByTestId("dialog-save-conflict")).toBeHidden();
  await expect(page.getByTestId("diagram-save-status").getByText("All changes saved")).toBeVisible();
  expect(await storedLabels(request, view.id)).toEqual(["Alpha", "Beta"]);

  // Undo still works after a save (the canvas is not reloaded), and the next save is no conflict.
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByTestId("diagram-save-status").getByText("Unsaved changes")).toBeVisible();
  await page.getByTestId("button-save-diagram-header").click();
  await expect(page.getByTestId("diagram-save-status").getByText("All changes saved")).toBeVisible();
  await expect(page.getByTestId("dialog-save-conflict")).toBeHidden();
});
