import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

async function openDiagram(page: Page, request: APIRequestContext, name: string) {
  const project = await (await request.post("/api/projects", { data: { name, projectType: "metamodel" } })).json();
  const view = await (await request.post(`/api/projects/${project.id}/views`, { data: { name: "Types" } })).json();
  await request.post(`/api/views/${view.id}/sync`, {
    data: {
      nodes: [{ id: `r-${project.id}`, type: "partdef", position: { x: 100, y: 100 }, data: { label: "Sensor", attributes: [] } }],
      edges: [],
    },
  });
  await page.goto(`/project/${project.id}/view/${view.id}`);
  const node = page.locator(".react-flow__node");
  await expect(node).toHaveCount(1);
  return { node, view };
}

test("F2 renames an element on its card; Escape cancels; undo restores", async ({ page, request }) => {
  const { node } = await openDiagram(page, request, "Inline rename");
  const label = node.getByTestId("element-label");
  const input = page.getByTestId("input-rename-element");

  await node.click();
  await page.keyboard.press("F2");
  await expect(input).toBeFocused();
  await input.fill("Thrown away");
  await page.keyboard.press("Escape");
  await expect(label).toHaveText("Sensor");
  await expect(page.getByTestId("diagram-save-status")).toContainText("All changes saved");

  await page.keyboard.press("F2");
  // Typing Backspace in the field edits the name; it must not ask to delete the element.
  await input.fill("Cameraa");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Enter");
  await expect(label).toHaveText("Camera");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByTestId("diagram-save-status")).toContainText("Unsaved changes");

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(label).toHaveText("Sensor");
});

test("in a narrow window Save stays reachable and the toolbar clears undo/redo", async ({ page, request }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await openDiagram(page, request, "A project with quite a long name to squeeze the header");

  const save = page.getByTestId("button-save-diagram-header");
  await expect(save).toBeInViewport({ ratio: 1 });

  const redo = (await page.getByRole("button", { name: "Redo", exact: true }).boundingBox())!;
  const firstTool = (await page.getByTestId("button-toolbar-auto-layout").boundingBox())!;
  const overlaps =
    firstTool.x < redo.x + redo.width && firstTool.y < redo.y + redo.height && firstTool.y + firstTool.height > redo.y;
  expect(overlaps).toBe(false);
});
