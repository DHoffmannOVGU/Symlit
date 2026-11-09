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

const LONG_REQUIREMENT =
  "The drone shall return to the depot autonomously when the remaining battery capacity falls below 20 % of the usable capacity, or when the link to the ground station is lost for more than 5 seconds.";

test("a type can always show its elements' descriptions; an element can still hide its own", async ({ page, request }) => {
  const { metamodelUrl, instanceUrl } = await createProjects(request, "descriptions");

  // Show descriptions for every Sensor, whatever the canvas setting says.
  await page.goto(metamodelUrl);
  await openStyling(page, "Sensor");
  await page.getByTestId("choice-description-show").click();
  await page.getByTestId("button-save-attributes").click();
  await saveDiagram(page);

  await page.goto(instanceUrl);
  for (const label of ["Matching sensor", "Custom sensor"]) {
    await page.locator(".react-flow__node", { hasText: label }).dblclick();
    await page.getByTestId("input-node-description").fill(`${label}: ${LONG_REQUIREMENT}`);
    await page.getByTestId("button-save-attributes").click();
  }
  // The matching element follows its type; the one with its own style follows the canvas setting.
  await expect(card(page, "Matching sensor").getByTestId("element-description")).toContainText("Matching sensor:");
  await expect(card(page, "Custom sensor").getByTestId("element-description")).toHaveCount(0);

  // Hiding it on one element overrides its type.
  await openStyling(page, "Matching sensor");
  await page.getByTestId("choice-description-hide").click();
  await page.getByTestId("button-save-attributes").click();
  await expect(card(page, "Matching sensor").getByTestId("element-description")).toHaveCount(0);
});

test("long text in a resized element gets smaller, then is cut with the full text on hover", async ({ page, request }) => {
  const created = await request.post("/api/projects/starter", {
    data: {
      name: "Overflow",
      projectType: "metamodel",
      views: [
        {
          name: "Requirements",
          nodes: [
            {
              id: "small",
              type: "requirementdef",
              position: { x: 80, y: 80 },
              data: {
                label: "REQ-1 Return to the depot when the battery runs low or the link is lost",
                type: "Requirement",
                description: LONG_REQUIREMENT,
                descriptionOnCard: "show",
                _nodeStyle: { width: 220, height: 150 },
                attributes: [],
              },
            },
            {
              id: "auto",
              type: "requirementdef",
              position: { x: 480, y: 80 },
              data: { label: "REQ-2", type: "Requirement", description: "Short text.", descriptionOnCard: "show", attributes: [] },
            },
          ],
          edges: [],
        },
      ],
    },
  });
  const { project, firstViewId } = await created.json();
  await page.goto(`/project/${project.id}/view/${firstViewId}`);

  // Stored under the old name "Requirement", shown as the kind's current name.
  await expect(card(page, "REQ-2").getByTestId("element-type-label")).toHaveText("Need");

  const small = card(page, "REQ-1");
  await expect(small).toHaveAttribute("data-fixed-size", "true");
  const description = small.getByTestId("element-description");
  await expect(description).toHaveAttribute("data-fit-clamped", "true");
  await expect(description).toHaveAttribute("title", LONG_REQUIREMENT);
  // Nothing spills out of the card (once the canvas has sized it).
  await expect
    .poll(async () => {
      const cardBox = await small.boundingBox();
      const textBox = await description.boundingBox();
      return cardBox!.y + cardBox!.height - (textBox!.y + textBox!.height);
    })
    .toBeGreaterThanOrEqual(0);

  // Short text keeps its full size.
  const short = card(page, "REQ-2").getByTestId("element-description");
  await expect(short).toHaveAttribute("data-fit-clamped", "false");
  await expect(short).toHaveCSS("font-size", "12px");
});
