import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Full-stack: styling a type in a metamodel and how that reaches the elements
// of an instance model that uses it. Each test creates its own projects.

interface Setup {
  metamodelUrl: string;
  instanceUrl: string;
}

async function createProjects(request: APIRequestContext, suffix: string): Promise<Setup> {
  const metamodel = await request.post("/api/projects/starter", {
    data: {
      name: `Sensors ${suffix}`,
      projectType: "metamodel",
      views: [
        {
          name: "Types",
          nodes: [
            {
              id: "sensor",
              type: "partdef",
              position: { x: 80, y: 80 },
              data: { label: "Sensor", type: "Object", icon: "Cpu", color: "#3b82f6", attributes: [] },
            },
          ],
          edges: [],
        },
      ],
    },
  });
  expect(metamodel.status()).toBe(201);
  const { project: meta, firstViewId: metaViewId } = await metamodel.json();
  const flow = await (await request.get(`/api/views/${metaViewId}/flow`)).json();
  // Instance elements refer to a type of a referenced metamodel as mm:<project>:<element>.
  const sensorId = `mm:${meta.id}:${flow.nodes[0].id}`;

  const instance = await request.post("/api/projects/starter", {
    data: {
      name: `Station ${suffix}`,
      projectType: "instance",
      referencedMetamodels: [meta.id],
      views: [
        {
          name: "Station",
          nodes: [
            {
              id: "matching",
              type: "part",
              position: { x: 80, y: 80 },
              data: { label: "Matching sensor", type: "Sensor", typeId: sensorId, inheritStyle: true, attributes: [] },
            },
            {
              id: "custom",
              type: "part",
              position: { x: 420, y: 80 },
              data: {
                label: "Custom sensor",
                type: "Sensor",
                typeId: sensorId,
                inheritStyle: false,
                icon: "Flame",
                color: "#f43f5e",
                attributes: [],
              },
            },
          ],
          edges: [],
        },
      ],
    },
  });
  expect(instance.status()).toBe(201);
  const { project: inst, firstViewId: instViewId } = await instance.json();
  return {
    metamodelUrl: `/project/${meta.id}/view/${metaViewId}`,
    instanceUrl: `/project/${inst.id}/view/${instViewId}`,
  };
}

const card = (page: Page, label: string) =>
  page.locator(".react-flow__node", { hasText: label }).getByTestId("element-card");

async function openStyling(page: Page, label: string) {
  await page.locator(".react-flow__node", { hasText: label }).dblclick();
  await expect(page.getByTestId("node-attribute-panel")).toBeVisible();
  await page.getByRole("tab", { name: "Styling" }).click();
}

async function saveDiagram(page: Page) {
  await page.getByTestId("button-save-diagram-header").click();
  await expect(page.getByTestId("button-save-diagram-header")).toBeDisabled();
}

test("a type's style reaches matching elements and leaves elements with their own style alone", async ({ page, request }) => {
  const { metamodelUrl, instanceUrl } = await createProjects(request, "propagation");

  // Style the Sensor type in the metamodel.
  await page.goto(metamodelUrl);
  await openStyling(page, "Sensor");
  await page.getByTestId("choice-border-style-dashed").click();
  await page.getByTestId("choice-shape-pill").click();
  await page.getByTestId("choice-fill-tint").click();
  await page.getByTestId("switch-show-type-label").click();
  await expect(page.getByTestId("style-preview").locator("div").first()).toHaveCSS("border-top-style", "dashed");
  await page.getByTestId("button-save-attributes").click();
  await expect(card(page, "Sensor")).toHaveCSS("border-top-style", "dashed");
  await saveDiagram(page);

  // The element that matches its type looks like the type now.
  await page.goto(instanceUrl);
  const matching = card(page, "Matching sensor");
  await expect(matching).toHaveCSS("border-top-style", "dashed");
  await expect(matching).toHaveCSS("background-color", "rgba(59, 130, 246, 0.1)");
  await expect(matching.getByTestId("element-type-label")).toHaveCount(0);

  // The element with its own style is unchanged.
  const custom = card(page, "Custom sensor");
  await expect(custom).toHaveCSS("border-top-style", "solid");
  await expect(custom.getByTestId("element-type-label")).toHaveText("Sensor");
});

test("changing a setting gives an element its own style; matching again restores the type's", async ({ page, request }) => {
  const { instanceUrl } = await createProjects(request, "override");
  await page.goto(instanceUrl);

  await openStyling(page, "Matching sensor");
  const matchSwitch = page.getByTestId("switch-inherit-style");
  await expect(matchSwitch).toBeChecked();
  // The type's colour is shown; changing the fill turns matching off.
  await expect(page.getByTestId("button-pick-color")).toContainText("Blue");
  await page.getByTestId("choice-fill-solid").click();
  await expect(matchSwitch).not.toBeChecked();
  await page.getByTestId("button-save-attributes").click();
  await expect(card(page, "Matching sensor")).toHaveCSS("background-color", "rgb(59, 130, 246)");

  // Saved and reloaded, the element keeps its own style.
  await saveDiagram(page);
  await page.reload();
  await expect(card(page, "Matching sensor")).toHaveCSS("background-color", "rgb(59, 130, 246)");

  // Matching the type again brings back the type's look.
  await openStyling(page, "Matching sensor");
  await page.getByTestId("switch-inherit-style").click();
  await page.getByTestId("button-save-attributes").click();
  await expect(card(page, "Matching sensor")).toHaveCSS("background-color", "rgb(255, 255, 255)");
});

test("the icon and colour pickers open from the current choice, and only under Styling", async ({ page, request }) => {
  const { instanceUrl } = await createProjects(request, "pickers");
  await page.goto(instanceUrl);

  await page.locator(".react-flow__node", { hasText: "Custom sensor" }).dblclick();
  const panel = page.getByTestId("node-attribute-panel");
  await expect(panel.getByTestId("button-pick-icon")).toHaveCount(0);

  await panel.getByRole("tab", { name: "Styling" }).click();
  await expect(panel.getByTestId("button-pick-icon")).toContainText("Flame");
  await panel.getByTestId("button-pick-icon").click();
  await page.getByTestId("button-icon-Camera").click();
  await expect(panel.getByTestId("button-pick-icon")).toContainText("Camera");

  await panel.getByTestId("button-pick-color").click();
  await page.getByTestId("button-color-Emerald").click();
  await expect(panel.getByTestId("button-pick-color")).toContainText("Emerald");
});
