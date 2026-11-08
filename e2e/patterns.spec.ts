import { expect, test } from "@playwright/test";

// Inserting patterns from the sidebar (docs/decisions/patterns.md): inserting
// keeps unsaved edits and is one undo step (I3); patterns of a referenced
// metamodel are offered, insert-only (L2).

test("insert patterns without losing unsaved work, undo one insert, use a metamodel's pattern", async ({ page, request }) => {
  const metamodel = await (
    await request.post("/api/projects", { data: { name: "Library MM", projectType: "metamodel" } })
  ).json();
  const mmView = await (await request.post(`/api/projects/${metamodel.id}/views`, { data: { name: "Types" } })).json();
  const typeNodeId = `sensor-${metamodel.id}`;
  await request.post(`/api/views/${mmView.id}/sync`, {
    data: { nodes: [{ id: typeNodeId, type: "partdef", position: { x: 0, y: 0 }, data: { label: "Sensor" } }], edges: [] },
  });
  const typeId = `mm:${metamodel.id}:${typeNodeId}`;
  expect(
    (
      await request.post(`/api/projects/${metamodel.id}/patterns`, {
        data: {
          name: "Sensor kit",
          nodes: [{ nodeId: "s", type: "part", position: { x: 0, y: 0 }, data: { label: "Kit sensor", type: "Sensor", typeId } }],
          edges: [],
        },
      })
    ).status(),
  ).toBe(201);

  const project = await (await request.post("/api/projects", { data: { name: "Pattern user", projectType: "instance" } })).json();
  await request.patch(`/api/projects/${project.id}`, { data: { referencedMetamodels: [metamodel.id] } });
  const view = await (await request.post(`/api/projects/${project.id}/views`, { data: { name: "Context" } })).json();
  expect(
    (
      await request.post(`/api/projects/${project.id}/patterns`, {
        data: {
          name: "Pair",
          nodes: [
            { nodeId: "a", type: "part", position: { x: -120, y: 0 }, data: { label: "Left", type: "Sensor", typeId } },
            { nodeId: "b", type: "part", position: { x: 120, y: 0 }, data: { label: "Right", type: "Sensor", typeId } },
          ],
          edges: [{ source: "a", target: "b", edgeType: "association", sourceHandle: "right", targetHandle: "left" }],
        },
      })
    ).status(),
  ).toBe(201);

  await page.goto(`/project/${project.id}/view/${view.id}`);
  await page.getByRole("tab", { name: "Diagram Views" }).click();
  const nodes = page.locator(".react-flow__node");
  const edges = page.locator(".react-flow__edge");
  const insert = async (name: string) => {
    const item = page.locator("li", { hasText: name }).last();
    await item.hover();
    await item.getByTitle("Insert pattern into current view").click();
  };

  // Two inserts in a row: the second must not drop the first (unsaved) copy.
  await insert("Pair");
  await expect(nodes).toHaveCount(2);
  await insert("Pair");
  await expect(nodes).toHaveCount(4);
  await expect(edges).toHaveCount(2);

  // Undo removes the last insert only.
  await page.getByTitle("Undo").click();
  await expect(nodes).toHaveCount(2);
  await expect(edges).toHaveCount(1);

  // The metamodel's pattern is listed with its origin and can be inserted.
  await expect(page.getByTestId(/library-pattern-/)).toContainText("Library MM");
  await insert("Sensor kit");
  await expect(nodes).toHaveCount(3);
  await expect(page.getByText("Kit sensor")).toBeVisible();
});
