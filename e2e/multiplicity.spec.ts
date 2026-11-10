import { expect, test } from "@playwright/test";

// A multiplicity is set on a metamodel's relationship ("how many targets per
// source element") and checked when a model built from it is validated.

test("a metamodel relationship's multiplicity is validated in the editor and enforced in a model", async ({ page, request }) => {
  const metamodel = await (
    await request.post("/api/projects", { data: { name: "Multiplicity: types", projectType: "metamodel" } })
  ).json();
  const metaView = await (await request.post(`/api/projects/${metamodel.id}/views`, { data: { name: "Types" } })).json();
  const drone = `drone-${metamodel.id}`;
  const battery = `battery-${metamodel.id}`;
  const relationship = `powered-${metamodel.id}`;
  await request.post(`/api/views/${metaView.id}/sync`, {
    data: {
      nodes: [
        { id: drone, type: "partdef", position: { x: 100, y: 150 }, data: { label: "Drone", attributes: [] } },
        { id: battery, type: "partdef", position: { x: 600, y: 150 }, data: { label: "Battery", attributes: [] } },
      ],
      edges: [
        {
          id: relationship,
          source: drone,
          target: battery,
          edgeType: "composition",
          sourceHandle: "right",
          targetHandle: "left",
          data: { label: "powered by" },
        },
      ],
    },
  });

  await page.goto(`/project/${metamodel.id}/view/${metaView.id}`);
  const edge = page.locator(`.react-flow__edge[data-id="${relationship}"]`);
  await expect(edge).toHaveCount(1);
  await edge.locator(".react-flow__edge-path").first().dblclick({ force: true });
  await page.getByRole("tab", { name: "Multiplicity" }).click();

  const input = page.getByTestId("input-edge-multiplicity");
  const meaning = page.getByTestId("text-multiplicity-meaning");
  const apply = page.getByTestId("button-save-edge");
  await expect(page.getByText("How many Battery per Drone")).toBeVisible();

  // Text that is not a multiplicity cannot be applied.
  await input.fill("lots");
  await expect(apply).toBeDisabled();
  await expect(meaning).toContainText("Use a number");

  await page.getByTestId("button-multiplicity-1..*").click();
  await expect(input).toHaveValue("1..*");
  await expect(meaning).toContainText("every Drone needs at least 1 of these relationships to a Battery");
  await apply.click();
  await page.getByTestId("button-save-diagram-header").click();
  await expect(page.getByTestId("diagram-save-status")).toContainText("All changes saved");

  // A model with a drone and no battery.
  const model = await (
    await request.post("/api/projects", {
      data: { name: "Multiplicity: model", projectType: "instance", referencedMetamodels: [metamodel.id] },
    })
  ).json();
  const view = await (await request.post(`/api/projects/${model.id}/views`, { data: { name: "Fleet" } })).json();
  await request.post(`/api/views/${view.id}/sync`, {
    data: {
      nodes: [
        {
          id: `courier-${model.id}`,
          type: "part",
          position: { x: 200, y: 200 },
          data: { label: "Courier X1", type: "Drone", typeId: `mm:${metamodel.id}:${drone}`, attributes: [] },
        },
      ],
      edges: [],
    },
  });
  await page.goto(`/project/${model.id}/view/${view.id}`);
  await expect(page.locator(".react-flow__node", { hasText: "Courier X1" })).toBeVisible();
  await page.getByTestId("button-toolbar-validate").click();
  await expect(
    page.getByText('"Courier X1" needs at least 1 "powered by" relationships to Battery, but has none.'),
  ).toBeVisible();

  // The server's validation agrees.
  const server = await (await request.post(`/api/views/${view.id}/validate`)).json();
  expect(server.issues.map((issue: { message: string }) => issue.message)).toEqual([
    '"Courier X1" needs at least 1 "powered by" relationships to Battery, but has none.',
  ]);
});
