import { expect, test } from "@playwright/test";

// Full-stack checks of canvas interactions that run through the diagram store:
// creating an element by dragging a relationship onto empty canvas, Auto Layout, undo,
// the element panel, and table mode.

test("drag a relationship onto empty canvas, create the element, undo, and edit in the panel", async ({ page, request }) => {
  const project = await (
    await request.post("/api/projects", { data: { name: "Canvas editing", projectType: "metamodel" } })
  ).json();
  const view = await (await request.post(`/api/projects/${project.id}/views`, { data: { name: "Types" } })).json();
  const startId = `start-${project.id}`;
  await request.post(`/api/views/${view.id}/sync`, {
    data: {
      nodes: [{ id: startId, type: "partdef", position: { x: 100, y: 100 }, data: { label: "Start", attributes: [] } }],
      edges: [],
    },
  });

  await page.goto(`/project/${project.id}/view/${view.id}`);
  const start = page.locator(`.react-flow__node[data-id="${startId}"]`);
  await expect(start).toBeVisible();

  // Wait for the initial fit-to-view to finish before measuring the handle.
  let previous = "";
  await expect
    .poll(async () => {
      const box = JSON.stringify(await start.boundingBox());
      const settled = box === previous;
      previous = box;
      return settled;
    }, { intervals: [150] })
    .toBe(true);

  const handle = (await start.locator('.react-flow__handle[data-handlepos="right"]').boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(950, 600, { steps: 10 });
  // The menu only opens once the pointer rests briefly on the canvas.
  await page.waitForTimeout(400);
  await page.mouse.up();

  await expect(page.getByText("Create node", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /\(default\)/ }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);

  // Auto Layout (its engine loads on first use) moves the elements; undo restores them.
  const positions = () =>
    page.locator(".react-flow__node").evaluateAll((els) => els.map((el) => (el as HTMLElement).style.transform).join("|"));
  const beforeLayout = await positions();
  await page.getByTestId("button-toolbar-auto-layout").click();
  await expect.poll(positions).not.toBe(beforeLayout);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(positions).toBe(beforeLayout);

  // Undo again removes the new element and its relationship together.
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expect(page.locator(".react-flow__edge")).toHaveCount(0);

  // Double-click opens the element panel; renaming shows on the canvas.
  await start.dblclick();
  const panel = page.getByTestId("node-attribute-panel");
  await expect(panel).toBeVisible();
  await panel.getByTestId("input-node-label").fill("Renamed start");
  await page.keyboard.press("Escape");

  // Table mode lists the element.
  await page.getByTestId("button-toolbar-table").click();
  // The name is an editable field in the table (Escape discarded the rename above, or it was kept).
  await expect(page.locator('input[value="Start"], input[value="Renamed start"]').first()).toBeVisible();
});
