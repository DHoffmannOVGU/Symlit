import { expect, test, type Locator } from "@playwright/test";
import { createProjectWithViews } from "./support/create-project";

// The canvas's own controls must not cover each other.

const overlaps = async (a: Locator, b: Locator) => {
  const [boxA, boxB] = [await a.boundingBox(), await b.boundingBox()];
  if (!boxA || !boxB) return false;
  return boxA.x < boxB.x + boxB.width && boxA.x + boxA.width > boxB.x && boxA.y < boxB.y + boxB.height && boxA.y + boxA.height > boxB.y;
};

test("an element's edit bar goes below it when above would cover the canvas toolbar", async ({ page, request }) => {
  const created = await createProjectWithViews(request, {
      name: "Edit bar",
      projectType: "instance",
      views: [
        {
          name: "Main",
          nodes: [
            { id: "top", type: "part", position: { x: 0, y: 0 }, data: { label: "Top element", type: "Object", attributes: [] } },
            { id: "low", type: "part", position: { x: 0, y: 500 }, data: { label: "Lower element", type: "Object", attributes: [] } },
          ],
          edges: [],
        },
      ],
  });
  const { project, firstViewId } = await created.json();
  await page.goto(`/project/${project.id}/view/${firstViewId}`);

  await page.locator(".react-flow__node", { hasText: "Top element" }).click();
  const bar = page.getByTestId("element-action-bar");
  await expect(bar).toHaveAttribute("data-placement", "below");
  for (const id of ["graph", "auto-layout", "validate", "help"]) {
    expect(await overlaps(bar, page.getByTestId(`button-toolbar-${id}`))).toBe(false);
  }

  await page.locator(".react-flow__node", { hasText: "Lower element" }).click();
  await expect(bar).toHaveAttribute("data-placement", "above");
});

test("the save button says what it does; the state is shown next to it; Ctrl+S saves", async ({ page, request }) => {
  const created = await createProjectWithViews(request, {
      name: "Saving",
      projectType: "instance",
      views: [
        {
          name: "Main",
          // Two elements on the same spot, so Auto layout has something to change.
          nodes: [
            { id: "a", type: "part", position: { x: 0, y: 0 }, data: { label: "Pump", type: "Object", attributes: [] } },
            { id: "b", type: "part", position: { x: 0, y: 0 }, data: { label: "Valve", type: "Object", attributes: [] } },
          ],
          edges: [],
        },
      ],
  });
  const { project, firstViewId } = await created.json();
  await page.goto(`/project/${project.id}/view/${firstViewId}`);

  const save = page.getByTestId("button-save-diagram-header");
  const status = page.getByTestId("diagram-save-status");
  await expect(save).toHaveText("Save");
  await expect(save).toBeDisabled();
  await expect(status).toHaveText("All changes saved");

  await page.getByTestId("button-toolbar-auto-layout").click();
  await expect(status).toHaveText("Unsaved changes");
  await expect(save).toBeEnabled();

  await page.keyboard.press("ControlOrMeta+s");
  await expect(status).toHaveText("All changes saved");
  await expect(save).toBeDisabled();
});

test("validation lists issues beside the canvas and shows the element; a clean result is only a note", async ({ page, request }) => {
  const metamodel = await createProjectWithViews(request, {
    name: "Validation types",
    projectType: "metamodel",
    views: [{ name: "Types", nodes: [{ id: "pump", type: "partdef", position: { x: 0, y: 0 }, data: { label: "Pump", type: "Object", attributes: [] } }], edges: [] }],
  });
  const { project: meta, firstViewId: metaViewId } = await metamodel.json();
  const flow = await (await request.get(`/api/views/${metaViewId}/flow`)).json();
  const pumpType = `mm:${meta.id}:${flow.nodes[0].id}`;
  const created = await createProjectWithViews(request, {
      name: "Validation",
      projectType: "instance",
      referencedMetamodels: [meta.id],
      views: [
        {
          name: "Main",
          nodes: [
            { id: "ok", type: "part", position: { x: 0, y: 0 }, data: { label: "Pump 1", type: "Pump", typeId: pumpType, attributes: [] } },
            // Its type no longer exists in the metamodel.
            { id: "bad", type: "part", position: { x: 400, y: 0 }, data: { label: "Orphan", type: "Valve", typeId: `mm:${meta.id}:gone`, attributes: [] } },
          ],
          edges: [],
        },
      ],
  });
  const { project, firstViewId } = await created.json();
  await page.goto(`/project/${project.id}/view/${firstViewId}`);
  await expect(page.locator(".react-flow__node")).toHaveCount(2);

  await page.getByTestId("button-toolbar-validate").click();
  const results = page.getByTestId("validation-results");
  await expect(results).toContainText("1 issue found");
  await expect(results).toContainText("Orphan");
  // Not a modal: the canvas stays usable, and the issue leads to its element.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByTestId("validation-issue-0").click();
  await expect(page.locator(".react-flow__node.selected")).toContainText("Orphan");

  // Fix it (delete the orphan) and validate again: the panel goes away.
  await page.keyboard.press("Delete");
  await page.getByRole("button", { name: /delete/i }).last().click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await page.getByTestId("button-validate-again").click();
  await expect(results).toHaveCount(0);
  await expect(page.getByText("No issues found", { exact: true })).toBeVisible();

  // Ctrl+Z brings the element back.
  await page.locator(".react-flow__pane").click({ position: { x: 20, y: 300 } });
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
});
