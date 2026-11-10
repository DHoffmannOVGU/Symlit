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
  const meaning = page.getByTestId("text-target-multiplicity-meaning");
  const apply = page.getByTestId("button-save-edge");
  await expect(page.getByText("How many Battery per Drone")).toBeVisible();

  // Text that is not a multiplicity cannot be applied.
  await input.fill("lots");
  await expect(apply).toBeDisabled();
  await expect(meaning).toContainText("Use a number");

  await page.getByTestId("button-target-multiplicity-1..*").click();
  await expect(input).toHaveValue("1..*");
  await expect(meaning).toContainText("every Drone needs at least 1 of these relationships to a Battery");

  // The other end: how many Drones a Battery may power.
  await expect(page.getByText("How many Drone per Battery")).toBeVisible();
  await page.getByTestId("input-edge-source-multiplicity").fill("3..1");
  await expect(apply).toBeDisabled();
  await page.getByTestId("button-source-multiplicity-0..1").click();
  await expect(page.getByTestId("text-source-multiplicity-meaning")).toContainText(
    "every Battery needs at most 1 of these relationships from a Drone",
  );
  // Variability is gone: a minimum of 1 or 0 says the same.
  await expect(page.getByTestId("toggle-edge-variability")).toHaveCount(0);
  await apply.click();
  await expect(page.getByTestId("edge-multiplicity")).toHaveText("[0..1 → 1..*]");
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

test("the editor counts relationships drawn in the model's other diagrams", async ({ page, request }) => {
  const metamodel = await (
    await request.post("/api/projects", { data: { name: "Across diagrams: types", projectType: "metamodel" } })
  ).json();
  const metaView = await (await request.post(`/api/projects/${metamodel.id}/views`, { data: { name: "Types" } })).json();
  const drone = `x-drone-${metamodel.id}`;
  const battery = `x-battery-${metamodel.id}`;
  await request.post(`/api/views/${metaView.id}/sync`, {
    data: {
      nodes: [
        { id: drone, type: "partdef", position: { x: 100, y: 150 }, data: { label: "Drone", attributes: [] } },
        { id: battery, type: "partdef", position: { x: 600, y: 150 }, data: { label: "Battery", attributes: [] } },
      ],
      edges: [
        {
          id: `x-rel-${metamodel.id}`,
          source: drone,
          target: battery,
          edgeType: "composition",
          data: { label: "powered by", multiplicity: "1" },
        },
      ],
    },
  });
  const model = await (
    await request.post("/api/projects", {
      data: { name: "Across diagrams: model", projectType: "instance", referencedMetamodels: [metamodel.id] },
    })
  ).json();
  const overview = await (await request.post(`/api/projects/${model.id}/views`, { data: { name: "Overview" } })).json();
  const power = await (await request.post(`/api/projects/${model.id}/views`, { data: { name: "Power" } })).json();
  const element = (id: string, label: string, type: string, typeLabel: string, x: number) => ({
    id: `${id}-${model.id}`,
    type: "part",
    position: { x, y: 200 },
    data: { label, type: typeLabel, typeId: `mm:${metamodel.id}:${type}`, attributes: [] },
  });
  const courier = element("courier", "Courier X1", drone, "Drone", 100);
  const lonely = element("lonely", "Courier X2", drone, "Drone", 100);
  const pack = element("pack", "Pack A", battery, "Battery", 600);
  // "Overview" shows both drones without batteries; "Power" connects only the first.
  await request.post(`/api/views/${overview.id}/sync`, { data: { nodes: [courier, { ...lonely, position: { x: 100, y: 420 } }], edges: [] } });
  await request.post(`/api/views/${power.id}/sync`, {
    data: {
      nodes: [courier, pack],
      edges: [
        {
          id: `x-powered-${model.id}`,
          source: courier.id,
          target: pack.id,
          edgeType: "composition",
          sourceHandle: "right",
          targetHandle: "left",
          data: { label: "powered by" },
        },
      ],
    },
  });

  await page.goto(`/project/${model.id}/view/${overview.id}`);
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await page.getByTestId("button-toolbar-validate").click();
  // Only the drone that has no battery anywhere is reported.
  await expect(
    page.getByText('"Courier X2" needs exactly 1 "powered by" relationship to Battery, but has none.'),
  ).toBeVisible();
  await expect(page.getByText(/"Courier X1" needs/)).toHaveCount(0);
});
