import { expect, test, type Page } from "@playwright/test";

// Regression test for unreliable relationship drawing: every element has one
// handle per side that works in both directions, so connecting in all four
// directions, both ways, must always register.

const opposite = { top: "bottom", bottom: "top", left: "right", right: "left" } as const;
type Side = keyof typeof opposite;
const neighbour: Record<Side, string> = { top: "N", bottom: "S", left: "W", right: "E" };

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

test("relationships can be drawn from and to every side", async ({ page, request }) => {
  const project = await (
    await request.post("/api/projects", { data: { name: "Handles", projectType: "metamodel" } })
  ).json();
  const view = await (
    await request.post(`/api/projects/${project.id}/views`, { data: { name: "All directions" } })
  ).json();
  const id = (name: string) => `handles-${project.id}-${name}`;
  const layout = { C: [500, 500], N: [500, 100], S: [500, 900], W: [50, 500], E: [950, 500] };
  const nodes = Object.entries(layout).map(([name, [x, y]]) => ({
    id: id(name),
    type: "partdef",
    position: { x, y },
    data: { label: name, attributes: [] },
  }));
  expect((await request.post(`/api/views/${view.id}/sync`, { data: { nodes, edges: [] } })).ok()).toBe(true);

  await page.goto(`/project/${project.id}/view/${view.id}`);
  await expect(page.locator(".react-flow__node")).toHaveCount(5);
  // Wait until the initial fit-to-view has finished moving the diagram.
  const centre = page.locator(`.react-flow__node[data-id="${id("C")}"]`);
  let last = "";
  await expect
    .poll(async () => {
      const box = JSON.stringify(await centre.boundingBox());
      const settled = box === last;
      last = box;
      return settled;
    }, { intervals: [150] })
    .toBe(true);

  const handleCenter = async (name: string, side: Side) => {
    const handle = page.locator(`.react-flow__node[data-id="${id(name)}"] .react-flow__handle[data-handlepos="${side}"]`);
    const box = (await handle.boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };

  const expected: Array<{ source: string; target: string; sourceHandle: Side; targetHandle: Side }> = [];
  for (const side of Object.keys(opposite) as Side[]) {
    const other = neighbour[side];
    // Outgoing from the centre, then incoming to the centre on the same side.
    for (const [from, fromSide, to, toSide] of [
      ["C", side, other, opposite[side]],
      [other, opposite[side], "C", side],
    ] as const) {
      await drag(page, await handleCenter(from, fromSide), await handleCenter(to, toSide));
      expected.push({ source: id(from), target: id(to), sourceHandle: fromSide, targetHandle: toSide });
      await expect(page.locator(".react-flow__edge")).toHaveCount(expected.length);
    }
  }

  // Each drawn relationship is its own undo step (also in metamodels).
  await page.getByTitle("Undo").click();
  await expect(page.locator(".react-flow__edge")).toHaveCount(expected.length - 1);
  await expect(page.locator(".react-flow__node")).toHaveCount(5);
  await page.getByTitle("Redo").click();
  await expect(page.locator(".react-flow__edge")).toHaveCount(expected.length);

  await page.getByTestId("button-save-diagram-header").click();
  await expect(page.getByTestId("button-save-diagram-header")).toBeDisabled();
  const saved = (await (await request.get(`/api/views/${view.id}/flow`)).json()) as { edges: typeof expected };
  expect(
    saved.edges.map(({ source, target, sourceHandle, targetHandle }) => ({ source, target, sourceHandle, targetHandle })),
  ).toEqual(expect.arrayContaining(expected));
});
