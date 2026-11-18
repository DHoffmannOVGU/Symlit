import { expect, test, type Page } from "@playwright/test";
import { createProjectWithViews } from "./support/create-project";
import { addElementOfType, confirmSuggestion, connect, openRelationship, saveRelationship } from "./support/tutorial";

// Full-stack: a Related Formula calculates over the elements an element is
// related to, across all diagrams of the project, and follows unsaved changes.

const attribute = (name: string, value: string, type = "number") => ({ id: name, name, type, value, unit: "" });
const part = (id: string, attributes: ReturnType<typeof attribute>[], x = 0) => ({
  id,
  type: "part",
  position: { x, y: 200 },
  data: { label: id, type: "Object", attributes },
});
const consistsOf = (id: string, source: string, target: string) => ({
  id,
  source,
  target,
  edgeType: "composition",
  data: { label: "consists of", edgeType: "composition" },
});

const openElement = async (page: Page, label: string) => {
  await expect(async () => {
    // Near the corner: a relationship of a type to itself has its label in the middle of the card.
    await page.locator(".react-flow__node", { hasText: label }).first().dblclick({ position: { x: 16, y: 16 } });
    await expect(page.getByTestId("node-attribute-panel")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10_000 });
};

test("a Related Formula adds up the related elements of all diagrams, with a where, and follows changes", async ({ page, request }) => {
  const machine = part("Machine", [attribute("mass", "2")], 0);
  const created = await createProjectWithViews(request, {
    name: "Espresso machine with totals",
    projectType: "instance",
    views: [
      {
        name: "Structure",
        nodes: [
          machine,
          part("Boiler", [attribute("mass", "3"), attribute("status", "released", "string")], 250),
          part("Pump", [attribute("mass", "1.5"), attribute("status", "draft", "string")], 500),
        ],
        edges: [consistsOf("e1", "Machine", "Boiler"), consistsOf("e2", "Machine", "Pump")],
      },
      {
        // The machine is shown here too; a part related only in this diagram still counts.
        name: "Heating",
        nodes: [machine, part("Heater", [attribute("mass", "0.5"), attribute("status", "released", "string")], 250)],
        edges: [consistsOf("e3", "Machine", "Heater")],
      },
    ],
  });
  const { project, firstViewId } = await created.json();
  await page.goto(`/project/${project.id}/view/${firstViewId}`);
  await openElement(page, "Machine");

  const dialog = page.getByTestId("attribute-editor-dialog");
  const addRelated = async (name: string, formula: string) => {
    await page.getByTestId("button-add-attribute").click();
    await dialog.locator('[data-testid^="input-attr-name-"]').fill(name);
    await dialog.locator('[data-testid^="select-attr-type-"]').click();
    await page.getByRole("option", { name: "Related Formula", exact: true }).click();
    await dialog.locator('[data-testid^="input-attr-formula-"]').fill(formula);
  };

  // The relationships it can use are offered; the result says what it counted.
  await addRelated("total mass", '[mass] + sum([mass] of "consists of")');
  await expect(dialog.locator('[data-testid^="related-formula-relationships-"]')).toContainText('of "consists of" · 3');
  await expect(dialog.locator('[data-testid^="related-formula-result-"]')).toContainText("Calculated value: 7");
  await expect(dialog.locator('[data-testid^="related-formula-used-"]')).toContainText("3 related elements");
  await expect(dialog.locator('[data-testid^="related-formula-used-"]')).toContainText("Heater");
  await page.getByTestId("button-attribute-done").click();

  await addRelated("released parts", 'count(of "consists of" where [status] = "released")');
  await expect(dialog.locator('[data-testid^="related-formula-result-"]')).toContainText("Calculated value: 2");
  await expect(dialog.locator('[data-testid^="related-formula-used-"]')).toContainText("1 left out by the condition");
  // A mistake says what is wrong.
  await dialog.locator('[data-testid^="input-attr-formula-"]').fill('count(of consists)');
  await expect(dialog.locator('[data-testid^="related-formula-result-"]')).toContainText("Invalid formula");
  await dialog.locator('[data-testid^="input-attr-formula-"]').fill('count(of "consists of" where [status] = "released")');
  await page.getByTestId("button-attribute-done").click();

  // A Derived Formula sees only its own element, and says where aggregates belong.
  await page.getByTestId("button-add-attribute").click();
  await dialog.locator('[data-testid^="input-attr-name-"]').fill("wrong kind");
  await dialog.locator('[data-testid^="select-attr-type-"]').click();
  await page.getByRole("option", { name: "Derived Formula", exact: true }).click();
  await dialog.locator('[data-testid^="input-attr-formula-"]').fill('sum([mass] of "consists of")');
  await expect(dialog).toContainText("Related Formula");
  await page.getByTestId("button-attribute-cancel").click();

  const panel = page.getByTestId("node-attribute-panel");
  await expect(panel.getByTestId("attribute-summary-1")).toContainText("7");
  await expect(panel.getByTestId("attribute-summary-2")).toContainText("2");
  await page.getByTestId("button-save-attributes").click();
  await page.getByTestId("button-save-diagram-header").click();
  await expect(page.getByTestId("button-save-diagram-header")).toBeDisabled();

  // An input changed in the table: the total follows before anything is saved,
  // and recalculating it is not a change of its own.
  await page.getByTestId("button-toolbar-table").click();
  const row = (name: string) => page.locator(`[data-testid="table-element-row"][data-element-name="${name}"]`);
  await expect(row("Machine").getByTestId("table-attribute-total mass")).toContainText("7");
  await row("Pump").getByTestId("table-attribute-mass").locator("input").fill("2.5");
  await expect(row("Machine").getByTestId("table-attribute-total mass")).toContainText("8");
  await page.getByTestId("button-save-diagram-header").click();
  await expect(page.getByTestId("button-save-diagram-header")).toBeDisabled();

  // Stored values are recalculated on the way out: the export has them too.
  const exported = await (
    await request.post(`/api/projects/${project.id}/export`, { data: { format: "json" } })
  ).json();
  const machineData = exported.views
    .flatMap((view: { nodes: Array<{ data: { label: string; attributes: Array<{ name: string; value: string }> } }> }) => view.nodes)
    .find((node: { data: { label: string } }) => node.data.label === "Machine").data;
  expect(machineData.attributes.find((item: { name: string }) => item.name === "total mass").value).toBe("8");

  // After a reload, and in the other diagram, the values are the same.
  await page.reload();
  await page.getByTestId("button-toolbar-table").click();
  await expect(row("Machine").getByTestId("table-attribute-total mass")).toContainText("8");
  await expect(page.getByTestId("button-save-diagram-header")).toBeDisabled();
});

test("defined on a type, a Related Formula is checked there and calculated by each element", async ({ page, request }) => {
  const metamodel = await createProjectWithViews(request, {
    name: "Part types with totals",
    projectType: "metamodel",
    views: [
      {
        name: "Types",
        nodes: [
          {
            id: "part",
            type: "partdef",
            position: { x: 80, y: 80 },
            data: { label: "Part", type: "Object", attributes: [attribute("mass", "")] },
          },
        ],
        // A part consists of parts: how a roll-up is defined.
        edges: [consistsOf("part-part", "part", "part")],
      },
    ],
  });
  const { project: meta, firstViewId: metaViewId } = await metamodel.json();
  const typeFlow = await (await request.get(`/api/views/${metaViewId}/flow`)).json();
  const typeId = `mm:${meta.id}:${typeFlow.nodes[0].id}`;
  const typed = (id: string, mass: string, x: number) => ({
    id,
    type: "part",
    position: { x, y: 200 },
    data: { label: id, type: "Part", typeId, attributes: [attribute("mass", mass)] },
  });
  const model = await createProjectWithViews(request, {
    name: "Assembly with totals",
    projectType: "instance",
    referencedMetamodels: [meta.id],
    views: [
      {
        name: "Structure",
        nodes: [typed("Frame", "4", 0), typed("Arm", "1", 250), typed("Wrist", "0.5", 500)],
        // Drawn with Symlit's suggestion: each records the metamodel relationship it is.
        edges: [consistsOf("f-a", "Frame", "Arm"), consistsOf("a-w", "Arm", "Wrist")].map((edge) => ({
          ...edge,
          data: { ...edge.data, relationId: typeFlow.edges[0].id },
        })),
      },
    ],
  });
  const { project: inst, firstViewId: instViewId } = await model.json();

  // On the type, the formula is checked and explained, not calculated.
  await page.goto(`/project/${meta.id}/view/${metaViewId}`);
  await openElement(page, "Part");
  await page.getByTestId("button-add-attribute").click();
  const dialog = page.getByTestId("attribute-editor-dialog");
  await dialog.locator('[data-testid^="input-attr-name-"]').fill("total mass");
  await dialog.locator('[data-testid^="select-attr-type-"]').click();
  await page.getByRole("option", { name: "Related Formula", exact: true }).click();
  await dialog.locator('[data-testid^="input-attr-formula-"]').fill('[mass] + sum([total mass] of "consists of")');
  await expect(dialog.locator('[data-testid^="related-formula-result-"]')).toContainText(
    "Each element of this type calculates it",
  );
  // The type's relationship to itself is known, so the parts' total is linked, not matched by name.
  await expect(dialog.locator('[data-testid^="related-formula-relationships-"]')).toContainText('of "consists of"');
  await expect(dialog.locator('[data-testid^="related-formula-by-name-"]')).toHaveCount(0);
  await page.getByTestId("button-attribute-done").click();
  await page.getByTestId("button-save-attributes").click();
  await page.getByTestId("button-save-diagram-header").click();
  await expect(page.getByTestId("button-save-diagram-header")).toBeDisabled();

  // The elements take the attribute from their type and roll up over two levels.
  await page.goto(`/project/${inst.id}/view/${instViewId}`);
  for (const name of ["Frame", "Arm", "Wrist"]) {
    await openElement(page, name);
    await page.getByTestId("button-add-missing-attributes").click();
    await page.getByTestId("button-save-attributes").click();
    await expect(page.getByTestId("node-attribute-panel")).toBeHidden();
  }
  await page.getByTestId("button-toolbar-table").click();
  const total = (name: string) =>
    page.locator(`[data-testid="table-element-row"][data-element-name="${name}"]`).getByTestId("table-attribute-total mass");
  await expect(total("Wrist")).toContainText("0.5");
  await expect(total("Arm")).toContainText("1.5");
  await expect(total("Frame")).toContainText("5.5");

  // Stored by ids, like a Derived Formula: its own mass, the parts' total, and the relationship.
  const typeData = (await (await request.get(`/api/views/${metaViewId}/flow`)).json()).nodes[0].data;
  const ids = Object.fromEntries(typeData.attributes.map((item: { id: string; name: string }) => [item.name, item.id]));
  const stored = typeData.attributes.find((item: { name: string }) => item.name === "total mass").formula;
  expect(stored).toBe(`[attr:${ids["mass"]}] + sum([attr:${ids["total mass"]}] of "rel:${typeFlow.edges[0].id}")`);

  // Renamed on one element, an attribute keeps working in every formula that uses it, and shows by its new name.
  await page.getByTestId("button-toolbar-graph").click();
  await openElement(page, "Wrist");
  const panel = page.getByTestId("node-attribute-panel");
  await panel.getByTestId("button-attr-open-0").click();
  await page.getByTestId("input-attr-name-0").fill("weight");
  await page.getByTestId("button-attribute-done").click();
  await panel.getByTestId("button-attr-open-1").click();
  await page.getByTestId("input-attr-name-1").fill("assembly weight");
  // Its own mass follows the rename. Inside the sum, the parts' attribute keeps the name the other parts give it
  // (Wrist has no parts of its own).
  await expect(dialog.locator('[data-testid^="input-attr-formula-"]')).toHaveValue('[weight] + sum([total mass] of "consists of")');
  await page.getByTestId("button-attribute-done").click();
  await page.getByTestId("button-save-attributes").click();
  await page.getByTestId("button-toolbar-table").click();
  await expect(total("Arm")).toContainText("1.5");
  await expect(total("Frame")).toContainText("5.5");
  // Arm's formula names the attribute as its related element calls it now.
  await page.getByTestId("button-toolbar-graph").click();
  await openElement(page, "Arm");
  await panel.getByTestId("button-attr-open-1").click();
  await expect(dialog.locator('[data-testid^="input-attr-formula-"]')).toHaveValue('[mass] + sum([assembly weight] of "consists of")');
  await page.getByTestId("button-attribute-cancel").click();
  await page.getByTestId("button-cancel-attributes").click();
  await page.getByTestId("button-save-diagram-header").click();
  await expect(page.getByTestId("button-save-diagram-header")).toBeDisabled();

  // Renamed in the metamodel, the relationship shows by its new name, and the relationships
  // drawn before (still labelled "consists of") keep counting.
  const metaFlow = await (await request.get(`/api/views/${metaViewId}/flow`)).json();
  metaFlow.edges[0].data.label = "contains";
  const renamed = await request.post(`/api/views/${metaViewId}/sync`, {
    data: { nodes: metaFlow.nodes, edges: metaFlow.edges },
  });
  expect(renamed.ok()).toBe(true);
  await page.reload();
  await page.getByTestId("button-toolbar-table").click();
  await expect(total("Frame")).toContainText("5.5");
  await page.getByTestId("button-toolbar-graph").click();
  await openElement(page, "Arm");
  await panel.getByTestId("button-attr-open-1").click();
  await expect(dialog.locator('[data-testid^="input-attr-formula-"]')).toHaveValue('[mass] + sum([assembly weight] of "contains")');
  await page.getByTestId("button-attribute-cancel").click();
  await page.getByTestId("button-cancel-attributes").click();

  // A relationship drawn now records which metamodel relationship it is, and counts.
  await addElementOfType(page, "Part");
  await connect(page, "Frame", "bottom", "New Part", "top");
  await confirmSuggestion(page);
  await page.getByTestId("button-save-diagram-header").click();
  await expect(page.getByTestId("button-save-diagram-header")).toBeDisabled();
  const modelFlow = await (await request.get(`/api/views/${instViewId}/flow`)).json();
  const drawn = modelFlow.edges.find((edge: { data: { relationId?: string; label?: string } }) => edge.data.label === "contains");
  expect(drawn?.data.relationId).toBe(typeFlow.edges[0].id);
});

test("renaming a relationship: in the metamodel the formula follows it, in the model it leaves the formula", async ({ page, request }) => {
  const type = (id: string, x: number, attributes: ReturnType<typeof attribute>[] = []) => ({
    id,
    type: "partdef",
    position: { x, y: 80 },
    data: { label: id, type: "Object", attributes },
  });
  const metamodel = await createProjectWithViews(request, {
    name: "Machine types for renames",
    projectType: "metamodel",
    views: [
      {
        name: "Types",
        nodes: [type("Machine", 0), type("Part", 400, [attribute("mass", "")])],
        edges: [consistsOf("machine-part", "Machine", "Part")],
      },
    ],
  });
  const { project: meta, firstViewId: metaViewId } = await metamodel.json();
  const typesFlow = await (await request.get(`/api/views/${metaViewId}/flow`)).json();
  const typeIdOf = (label: string) =>
    `mm:${meta.id}:${typesFlow.nodes.find((node: { data: { label: string } }) => node.data.label === label).id}`;
  const element = (id: string, typeLabel: string, x: number, y: number, attributes: ReturnType<typeof attribute>[] = []) => ({
    id,
    type: "part",
    position: { x, y },
    data: { label: id, type: typeLabel, typeId: typeIdOf(typeLabel), attributes },
  });
  const model = await createProjectWithViews(request, {
    name: "Machine M1 for renames",
    projectType: "instance",
    referencedMetamodels: [meta.id],
    views: [
      {
        name: "Structure",
        nodes: [
          element("M1", "Machine", 0, 120),
          element("P1", "Part", 420, -60, [attribute("mass", "2")]),
          element("P2", "Part", 420, 300, [attribute("mass", "3")]),
          element("P3", "Part", 0, 520, [attribute("mass", "4")]),
        ],
        edges: [],
      },
    ],
  });
  const { project: inst, firstViewId: instViewId } = await model.json();

  // The parts are related through the editor, with Symlit's suggestion.
  await page.goto(`/project/${inst.id}/view/${instViewId}`);
  await connect(page, "M1", "right", "P1", "left");
  await confirmSuggestion(page, "consists of");
  await connect(page, "M1", "bottom", "P2", "left");
  await confirmSuggestion(page, "consists of");

  // Two Related Formulas on the machine, written in the editor.
  await openElement(page, "M1");
  const dialog = page.getByTestId("attribute-editor-dialog");
  const addRelated = async (name: string, formula: string, expected: string) => {
    await page.getByTestId("button-add-attribute").click();
    await dialog.locator('[data-testid^="input-attr-name-"]').fill(name);
    await dialog.locator('[data-testid^="select-attr-type-"]').click();
    await page.getByRole("option", { name: "Related Formula", exact: true }).click();
    await dialog.locator('[data-testid^="input-attr-formula-"]').fill(formula);
    await expect(dialog.locator('[data-testid^="related-formula-result-"]')).toContainText(`Calculated value: ${expected}`);
    // Linked: nothing in it is matched by name.
    await expect(dialog.locator('[data-testid^="related-formula-by-name-"]')).toHaveCount(0);
    await page.getByTestId("button-attribute-done").click();
  };
  await addRelated("parts", 'count(of "consists of")', "2");
  await addRelated("parts mass", 'sum([mass] of "consists of")', "5");
  await page.getByTestId("button-save-attributes").click();
  await page.getByTestId("button-save-diagram-header").click();
  await expect(page.getByTestId("button-save-diagram-header")).toBeDisabled();

  // Stored by the metamodel relationship's id, which the drawn relationships record too.
  const relationId = typesFlow.edges[0].id;
  const saved = await (await request.get(`/api/views/${instViewId}/flow`)).json();
  const machineData = saved.nodes.find((node: { data: { label: string } }) => node.data.label === "M1").data;
  expect(machineData.attributes.map((item: { formula: string }) => item.formula)).toEqual([
    `count(of "rel:${relationId}")`,
    `sum([attr:mass] of "rel:${relationId}")`,
  ]);
  expect(saved.edges.map((edge: { data: { relationId?: string } }) => edge.data.relationId)).toEqual([relationId, relationId]);

  // The metamodel relationship is renamed in the metamodel's editor.
  await page.goto(`/project/${meta.id}/view/${metaViewId}`);
  await openRelationship(page);
  await expect(page.getByTestId("input-edge-label")).toHaveValue("consists of");
  await page.getByTestId("input-edge-label").fill("contains");
  await saveRelationship(page);
  await page.getByTestId("button-save-diagram-header").click();
  await expect(page.getByTestId("button-save-diagram-header")).toBeDisabled();
  // The model's relationships made from it take the new name, and saving says so.
  await expect(page.getByText("2 relationships in models now carry the new name.").first()).toBeVisible();
  const relabeled = (await (await request.get(`/api/views/${instViewId}/flow`)).json()).edges;
  expect(relabeled.map((edge: { data: { label: string } }) => edge.data.label)).toEqual(["contains", "contains"]);

  // In the model, the relationships and the formulas show the new name and count both parts.
  await page.goto(`/project/${inst.id}/view/${instViewId}`);
  await expect(page.locator(".react-flow__edgelabel-renderer").getByText("contains", { exact: true })).toHaveCount(2);
  await page.getByTestId("button-toolbar-table").click();
  const machineCell = (name: string) =>
    page.locator('[data-testid="table-element-row"][data-element-name="M1"]').getByTestId(`table-attribute-${name}`);
  await expect(machineCell("parts")).toContainText("2");
  await expect(machineCell("parts mass")).toContainText("5");
  await page.getByTestId("button-toolbar-graph").click();
  await openElement(page, "M1");
  const panel = page.getByTestId("node-attribute-panel");
  await panel.getByTestId("button-attr-open-0").click();
  await expect(dialog.locator('[data-testid^="input-attr-formula-"]')).toHaveValue('count(of "contains")');
  await page.getByTestId("button-attribute-cancel").click();
  await panel.getByTestId("button-attr-open-1").click();
  await expect(dialog.locator('[data-testid^="input-attr-formula-"]')).toHaveValue('sum([mass] of "contains")');
  await page.getByTestId("button-attribute-cancel").click();
  await page.getByTestId("button-cancel-attributes").click();
  // Validation knows the relationships with the old label are the renamed one.
  await page.getByTestId("button-toolbar-validate").click();
  await expect(page.getByText("No issues found", { exact: true })).toBeVisible();

  // A part related now gets the new name, "contains". Old and new relationships count together:
  // matched by the old name or by the new one, either would be left out.
  await connect(page, "M1", "bottom", "P3", "top");
  await confirmSuggestion(page, "contains");
  await page.getByTestId("button-toolbar-table").click();
  await expect(machineCell("parts")).toContainText("3");
  await expect(machineCell("parts mass")).toContainText("9");

  // Renamed in the model, a relationship is no longer the metamodel's: it leaves the formulas.
  await page.getByTestId("button-toolbar-graph").click();
  await openRelationship(page);
  await expect(page.getByTestId("input-edge-label")).toHaveValue("contains");
  await page.getByTestId("input-edge-label").fill("holds");
  await saveRelationship(page);
  await page.getByTestId("button-toolbar-table").click();
  await expect(machineCell("parts")).toContainText("2");
  await expect(machineCell("parts mass")).toContainText("5");
  // Named as the metamodel names it now, it is that relationship again and counts.
  await page.getByTestId("button-toolbar-graph").click();
  await openRelationship(page);
  await page.getByTestId("input-edge-label").fill("contains");
  await saveRelationship(page);
  await page.getByTestId("button-toolbar-table").click();
  await expect(machineCell("parts")).toContainText("3");
  await expect(machineCell("parts mass")).toContainText("9");
});
