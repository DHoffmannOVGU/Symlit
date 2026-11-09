import { expect, test, type Locator } from "@playwright/test";

// The canvas's own controls must not cover each other.

const overlaps = async (a: Locator, b: Locator) => {
  const [boxA, boxB] = [await a.boundingBox(), await b.boundingBox()];
  if (!boxA || !boxB) return false;
  return boxA.x < boxB.x + boxB.width && boxA.x + boxA.width > boxB.x && boxA.y < boxB.y + boxB.height && boxA.y + boxA.height > boxB.y;
};

test("an element's edit bar goes below it when above would cover the canvas toolbar", async ({ page, request }) => {
  const created = await request.post("/api/projects/starter", {
    data: {
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
    },
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
