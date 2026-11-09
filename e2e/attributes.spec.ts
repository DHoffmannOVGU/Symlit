import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Full-stack: defining attributes on a type in a metamodel, and how they reach
// the elements of an instance model typed by it.

async function createProjects(request: APIRequestContext, suffix: string) {
  const metamodel = await request.post("/api/projects/starter", {
    data: {
      name: `Drone parts ${suffix}`,
      projectType: "metamodel",
      views: [
        {
          name: "Types",
          nodes: [
            {
              id: "battery",
              type: "partdef",
              position: { x: 80, y: 80 },
              data: { label: "Battery", type: "Object", attributes: [] },
            },
          ],
          edges: [],
        },
      ],
    },
  });
  const { project: meta, firstViewId: metaViewId } = await metamodel.json();
  const flow = await (await request.get(`/api/views/${metaViewId}/flow`)).json();
  const batteryTypeId = `mm:${meta.id}:${flow.nodes[0].id}`;

  const instance = await request.post("/api/projects/starter", {
    data: {
      name: `Drone ${suffix}`,
      projectType: "instance",
      referencedMetamodels: [meta.id],
      views: [
        {
          name: "Drone",
          nodes: [
            {
              id: "old",
              type: "part",
              position: { x: 80, y: 80 },
              // Created before the type had attributes.
              data: { label: "Old pack", type: "Battery", typeId: batteryTypeId, inheritStyle: true, attributes: [] },
            },
          ],
          edges: [],
        },
      ],
    },
  });
  const { project: inst, firstViewId: instViewId } = await instance.json();
  return {
    batteryTypeId,
    metamodelUrl: `/project/${meta.id}/view/${metaViewId}`,
    instanceUrl: `/project/${inst.id}/view/${instViewId}`,
  };
}

const openElement = async (page: Page, label: string) => {
  await page.locator(".react-flow__node", { hasText: label }).first().dblclick();
  await expect(page.getByTestId("node-attribute-panel")).toBeVisible();
};

const dialog = (page: Page) => page.getByTestId("attribute-editor-dialog");

async function saveElementAndDiagram(page: Page) {
  await page.getByTestId("button-save-attributes").click();
  await page.getByTestId("button-save-diagram-header").click();
  await expect(page.getByTestId("button-save-diagram-header")).toBeDisabled();
}

test("an attribute is defined in its own editor and shown in short form", async ({ page, request }) => {
  const { metamodelUrl } = await createProjects(request, "define");
  await page.goto(metamodelUrl);
  await openElement(page, "Battery");

  // A new attribute opens the editor with the name ready to type.
  await page.getByTestId("button-add-attribute").click();
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByTestId("input-attr-name-0")).toBeFocused();
  await expect(page.getByTestId("button-attribute-done")).toBeDisabled();
  await page.keyboard.type("capacity");
  await page.getByTestId("input-attr-description-0").fill("Usable energy of a full charge");

  // Units come from the catalog, searchable by quantity.
  await page.getByTestId("input-attr-unit-0").click();
  await page.getByTestId("input-attr-unit-0-search").fill("energy");
  await page.getByTestId("input-attr-unit-0-option-Wh").click();
  await expect(page.getByTestId("input-attr-unit-0")).toContainText("watt-hour · Energy");
  await page.getByTestId("button-attribute-done").click();
  await expect(dialog(page)).toBeHidden();

  // The short form reads well: name, type, description, default value.
  const row = page.getByTestId("attribute-summary-0");
  await expect(row.getByTestId("attribute-name-0")).toHaveText("capacity");
  await expect(row).toContainText("Number");
  await expect(row.getByTestId("attribute-description-0")).toHaveText("Usable energy of a full charge");

  // A custom unit is allowed and marked as custom.
  await row.getByTestId("button-attr-edit-0").click();
  await page.getByTestId("input-attr-unit-0").click();
  await page.getByTestId("input-attr-unit-0-search").fill("cycles");
  await page.getByTestId("input-attr-unit-0-custom").click();
  await expect(page.getByTestId("input-attr-unit-0")).toContainText("custom unit");
  // Cancel puts the attribute back as it was.
  await page.getByTestId("button-attribute-cancel").click();
  await row.getByTestId("button-attr-edit-0").click();
  await expect(page.getByTestId("input-attr-unit-0")).toContainText("Wh");
  await page.getByTestId("button-attribute-cancel").click();

  // Cancelling a new attribute leaves nothing behind.
  await page.getByTestId("button-add-attribute").click();
  await page.keyboard.type("temporary");
  await page.getByTestId("button-attribute-cancel").click();
  await expect(page.getByTestId("attribute-summary-1")).toHaveCount(0);
});

test("new typed elements get copies of their type's attributes; older ones are offered the missing ones", async ({ page, request }) => {
  const { metamodelUrl, instanceUrl, batteryTypeId } = await createProjects(request, "copy");

  // Give the Battery type an attribute with a unit and a default value.
  await page.goto(metamodelUrl);
  await openElement(page, "Battery");
  await page.getByTestId("button-add-attribute").click();
  await page.keyboard.type("capacity");
  await page.getByTestId("input-attr-unit-0").click();
  await page.getByTestId("input-attr-unit-0-search").fill("Wh");
  await page.getByTestId("input-attr-unit-0-option-Wh").click();
  await page.getByTestId("input-attr-value-0").fill("160");
  await page.getByTestId("button-attribute-done").click();
  await saveElementAndDiagram(page);

  // A Battery added to the instance model now comes with that attribute.
  await page.goto(instanceUrl);
  await page
    .getByTestId(`button-insert-referenced-class-${batteryTypeId}`)
    .dragTo(page.locator(".react-flow__pane"), { targetPosition: { x: 600, y: 420 } });
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await openElement(page, "New Battery");
  const row = page.getByTestId("attribute-summary-0");
  await expect(row.getByTestId("attribute-name-0")).toHaveText("capacity");
  // Values are set right in the list; the unit is shown next to it.
  await expect(row.getByTestId("input-attr-value-0")).toHaveValue("160");
  await expect(row).toContainText("Wh");
  await row.getByTestId("input-attr-value-0").fill("180");
  await saveElementAndDiagram(page);
  await page.reload();
  await openElement(page, "New Battery");
  await expect(page.getByTestId("input-attr-value-0")).toHaveValue("180");
  await page.getByTestId("button-cancel-attributes").click();

  // The element created before the type had attributes is offered them.
  await openElement(page, "Old pack");
  await expect(page.getByTestId("attributes-missing-from-type")).toContainText("capacity");
  await page.getByTestId("button-add-missing-attributes").click();
  await expect(page.getByTestId("attributes-missing-from-type")).toHaveCount(0);
  await expect(page.getByTestId("attribute-name-0")).toHaveText("capacity");
});
