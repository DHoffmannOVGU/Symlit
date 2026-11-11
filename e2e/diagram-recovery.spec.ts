import { expect, test, type Page, type Route } from "@playwright/test";
import { mockLocalSession } from "./support/local-session";

const project = {
  id: 1,
  userId: 1,
  name: "Recovery Fixture",
  description: "A corrupted diagram fixture",
  projectType: "instance",
  referencedMetamodels: [],
};

const view = {
  id: 1,
  projectId: 1,
  name: "Broken view",
  description: "",
  viewType: "view",
  parentNodeId: null,
  parentViewId: null,
};

const recoveryFlow = {
  nodes: [
    {
      id: "keep-node",
      type: "part",
      position: { x: 10, y: 20 },
      data: { label: "Keep this node" },
      parentId: null,
    },
    {
      id: "remove-node",
      type: "part",
      position: { x: 30, y: 40 },
      data: { label: "Remove this node" },
      parentId: null,
    },
    {
      id: "repair-node",
      type: "part",
      position: { x: "corrupt", y: null },
      data: { label: "Repair this node" },
      parentId: null,
    },
    {
      id: "target-node",
      type: "part",
      position: { x: 100, y: 200 },
      data: { label: "Relationship target" },
      parentId: null,
    },
  ],
  edges: [
    {
      id: "keep-edge",
      source: "keep-node",
      target: "target-node",
      edgeType: "association",
      sourceHandle: null,
      targetHandle: null,
      data: { label: "preserve" },
    },
    {
      id: "remove-edge",
      source: "remove-node",
      target: "keep-node",
      edgeType: "association",
      sourceHandle: null,
      targetHandle: null,
      data: { label: "remove with node" },
    },
    {
      id: "repair-edge",
      source: "keep-node",
      target: "missing-node",
      edgeType: "association",
      sourceHandle: null,
      targetHandle: null,
      data: { label: "repair endpoint" },
    },
  ],
  issues: [
    {
      type: "node",
      id: "repair-node",
      index: 2,
      field: "position.x",
      message: "Expected number, received string",
    },
    {
      type: "node",
      id: "repair-node",
      index: 2,
      field: "position.y",
      message: "Expected number, received null",
    },
    {
      type: "edge",
      id: "repair-edge",
      index: 2,
      field: "target",
      message: "Edge target does not reference a node: missing-node",
    },
  ],
};

const validFlow = {
  nodes: recoveryFlow.nodes
    .filter((node) => node.id !== "remove-node")
    .map((node) => ({
      ...node,
      position:
        node.id === "repair-node" ? { x: 55, y: 65 } : node.position,
      projectId: 1,
      createdAt: null,
    })),
  edges: recoveryFlow.edges
    .filter((edge) => edge.id !== "remove-edge")
    .map((edge) =>
      edge.id === "repair-edge"
        ? { ...edge, target: "target-node" }
        : edge,
    ),
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installRecoveryApi(page: Page) {
  let savedPayload: { nodes: unknown[]; edges: unknown[] } | null = null;

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;

    if (request.method() === "POST" && pathname === "/api/views/1/sync") {
      savedPayload = request.postDataJSON() as {
        nodes: unknown[];
        edges: unknown[];
      };
      await fulfillJson(route, { success: true });
      return;
    }

    if (request.method() !== "GET") {
      await fulfillJson(route, {});
      return;
    }

    if (pathname === "/api/projects" && request.method() === "GET") {
      await fulfillJson(route, [project]);
    } else if (pathname === "/api/projects/1") {
      await fulfillJson(route, project);
    } else if (pathname === "/api/projects/1/views") {
      await fulfillJson(route, [view]);
    } else if (pathname === "/api/views/1") {
      await fulfillJson(route, view);
    } else if (pathname === "/api/views/1/flow/recovery") {
      await fulfillJson(route, recoveryFlow);
    } else if (pathname === "/api/views/1/flow") {
      await fulfillJson(route, savedPayload ? validFlow : {
        ...validFlow,
        nodes: recoveryFlow.nodes,
        edges: recoveryFlow.edges,
      });
    } else {
      await fulfillJson(route, []);
    }
  });

  return {
    getSavedPayload: () => savedPayload,
  };
}

test("repairs a rejected diagram without dropping valid records", async ({
  page,
}) => {
  const api = await installRecoveryApi(page);

  await mockLocalSession(page, { displayName: "recovery-test" });
  await page.goto("/project/1/view/1");

  await expect(
    page.getByText("This diagram could not be loaded safely."),
  ).toBeVisible();
  await page.getByTestId("button-repair-diagram").click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Repair saved diagram" }))
    .toBeVisible();
  await expect(dialog.getByText(/3 structural issues found/)).toBeVisible();
  await expect(
    dialog.getByText("Edge target does not reference a node: missing-node"),
  ).toBeVisible();

  const saveButton = dialog.getByRole("button", {
    name: "Save repaired diagram",
  });
  await expect(saveButton).toBeDisabled();

  await dialog.getByRole("button", { name: "Remove node remove-node" }).click();
  await expect(
    dialog.getByRole("button", { name: "Remove relationship remove-edge" }),
  ).toHaveCount(0);

  await dialog.locator("#recovery-repair-node-x").fill("55");
  await dialog.locator("#recovery-repair-node-y").fill("65");

  await dialog
    .getByTestId("recovery-repair-edge-target-select")
    .click();
  await page.getByRole("option", { name: "target-node" }).click();

  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await expect(page.getByText("This diagram could not be loaded safely."))
    .toHaveCount(0);
  await expect(page.getByTestId("diagram-canvas-region")).toBeVisible();

  const savedPayload = api.getSavedPayload();
  expect(savedPayload).not.toBeNull();
  expect(savedPayload?.nodes.map((node) => (node as { id: string }).id)).toEqual([
    "keep-node",
    "repair-node",
    "target-node",
  ]);
  expect(savedPayload?.edges.map((edge) => (edge as { id: string }).id)).toEqual([
    "keep-edge",
    "repair-edge",
  ]);
  expect(savedPayload?.nodes).toContainEqual(
    expect.objectContaining({
      id: "repair-node",
      position: { x: 55, y: 65 },
    }),
  );
  expect(savedPayload?.edges).toContainEqual(
    expect.objectContaining({
      id: "repair-edge",
      source: "keep-node",
      target: "target-node",
    }),
  );
});

const relationshipProject = {
  id: 2,
  userId: 1,
  name: "Relationship Visuals",
  description: "Configured relationship fixture",
  projectType: "metamodel",
  referencedMetamodels: [],
  metamodelSetup: {
    version: 1,
    purpose: "custom",
    description: "A metamodel with richer relationship semantics",
    nodeTypes: ["partdef"],
    relationTypes: ["association", "composition", "dependency", "realization"],
  },
};

const relationshipView = {
  id: 2,
  projectId: 2,
  name: "Relationship canvas",
  description: "",
  viewType: "view",
  parentNodeId: null,
  parentViewId: null,
};

const instanceRelationshipProject = {
  id: 3,
  userId: 1,
  name: "Instance Relationship Visuals",
  description: "Instance relationship fixture",
  projectType: "instance",
  referencedMetamodels: [2],
  metamodelSetup: null,
};

const instanceRelationshipView = {
  id: 3,
  projectId: 3,
  name: "Instance relationship canvas",
  description: "",
  viewType: "view",
  parentNodeId: null,
  parentViewId: null,
};

const relationshipNodes = [
  {
    id: "visual-source",
    type: "partdef",
    position: { x: 50, y: 210 },
    data: { label: "Source" },
    parentId: null,
    projectId: 2,
    createdAt: null,
  },
  {
    id: "composition-target",
    type: "partdef",
    position: { x: 440, y: 70 },
    data: { label: "Composition target" },
    parentId: null,
    projectId: 2,
    createdAt: null,
  },
  {
    id: "dependency-target",
    type: "partdef",
    position: { x: 440, y: 210 },
    data: { label: "Dependency target" },
    parentId: null,
    projectId: 2,
    createdAt: null,
  },
  {
    id: "realization-target",
    type: "partdef",
    position: { x: 440, y: 350 },
    data: { label: "Realization target" },
    parentId: null,
    projectId: 2,
    createdAt: null,
  },
];

const relationshipEdges = [
  {
    id: "composition-edge",
    source: "visual-source",
    target: "composition-target",
    edgeType: "association",
    sourceHandle: null,
    targetHandle: null,
    data: { edgeType: "association", label: "composition candidate" },
  },
  {
    id: "dependency-edge",
    source: "visual-source",
    target: "dependency-target",
    edgeType: "association",
    sourceHandle: null,
    targetHandle: null,
    data: { edgeType: "association", label: "dependency candidate" },
  },
  {
    id: "realization-edge",
    source: "visual-source",
    target: "realization-target",
    edgeType: "association",
    sourceHandle: null,
    targetHandle: null,
    data: { edgeType: "association", label: "realization candidate" },
  },
];

const instanceRelationshipNodes = relationshipNodes.map((node) => ({
  ...node,
  projectId: 3,
}));

const instanceRelationshipEdges = relationshipEdges.map((edge) => ({
  ...edge,
  data: { ...edge.data },
}));

async function installRelationshipApi(page: Page) {
  let created = false;
  let createdSetup: unknown = null;
  let savedPayload: { nodes: unknown[]; edges: unknown[] } | null = null;

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;

    // A blank project is created directly (templates go through /api/project-templates).
    if (request.method() === "POST" && pathname === "/api/projects") {
      created = true;
      createdSetup = (request.postDataJSON() as { metamodelSetup?: unknown })
        .metamodelSetup;
      await fulfillJson(route, relationshipProject, 201);
      return;
    }
    // ... with its first diagram.
    if (request.method() === "POST" && pathname === "/api/projects/2/views") {
      await fulfillJson(route, relationshipView, 201);
      return;
    }

    if (request.method() === "POST" && pathname === "/api/views/2/sync") {
      savedPayload = request.postDataJSON() as {
        nodes: unknown[];
        edges: unknown[];
      };
      await fulfillJson(route, { success: true });
      return;
    }

    if (request.method() !== "GET") {
      await fulfillJson(route, {});
      return;
    }

    if (pathname === "/api/projects" && request.method() === "GET") {
      await fulfillJson(route, created ? [relationshipProject] : []);
    } else if (pathname === "/api/projects/2") {
      await fulfillJson(route, relationshipProject);
    } else if (pathname === "/api/projects/2/views") {
      await fulfillJson(route, [relationshipView]);
    } else if (pathname === "/api/views/2") {
      await fulfillJson(route, relationshipView);
    } else if (pathname === "/api/views/2/flow") {
      await fulfillJson(route, {
        nodes: relationshipNodes,
        edges: savedPayload?.edges ?? relationshipEdges,
      });
    } else {
      await fulfillJson(route, []);
    }
  });

  return {
    getCreatedSetup: () => createdSetup,
    getSavedPayload: () => savedPayload,
  };
}

async function installInstanceRelationshipApi(page: Page) {
  let savedPayload: { nodes: unknown[]; edges: unknown[] } | null = null;

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;

    if (request.method() === "POST" && pathname === "/api/views/3/sync") {
      savedPayload = request.postDataJSON() as {
        nodes: unknown[];
        edges: unknown[];
      };
      await fulfillJson(route, { success: true });
      return;
    }

    if (request.method() !== "GET") {
      await fulfillJson(route, {});
      return;
    }

    if (pathname === "/api/projects" && request.method() === "GET") {
      await fulfillJson(route, [relationshipProject, instanceRelationshipProject]);
    } else if (pathname === "/api/projects/3") {
      await fulfillJson(route, instanceRelationshipProject);
    } else if (pathname === "/api/projects/3/views") {
      await fulfillJson(route, [instanceRelationshipView]);
    } else if (pathname === "/api/views/3") {
      await fulfillJson(route, instanceRelationshipView);
    } else if (pathname === "/api/views/3/flow") {
      await fulfillJson(route, {
        nodes: instanceRelationshipNodes,
        edges: savedPayload?.edges ?? instanceRelationshipEdges,
      });
    } else if (pathname === "/api/projects/2") {
      await fulfillJson(route, relationshipProject);
    } else if (pathname === "/api/projects/2/views") {
      await fulfillJson(route, [relationshipView]);
    } else if (pathname === "/api/views/2/flow") {
      await fulfillJson(route, { nodes: [], edges: [] });
    } else {
      await fulfillJson(route, []);
    }
  });

  return {
    getSavedPayload: () => savedPayload,
  };
}

test("renders configured relationship semantics and preserves them after reload", async ({
  page,
}) => {
  const api = await installRelationshipApi(page);

  await mockLocalSession(page, { displayName: "relationship-test" });
  await page.goto("/projects");

  await page.getByTestId("button-new-project").click();
  const setupDialog = page.getByRole("dialog");
  await setupDialog.getByTestId("select-template-blank-metamodel").click();
  // The name comes first; kinds and relationship types are under "Customize".
  await expect(setupDialog.getByTestId("input-project-name")).toBeFocused();
  await setupDialog.getByTestId("button-adjust-vocabulary").click();
  for (const relationType of ["composition", "dependency", "realization"]) {
    const checkbox = setupDialog.getByTestId(
      `checkbox-metamodel-relation-${relationType}`,
    );
    await expect(checkbox).toBeVisible();
    await checkbox.click();
    await expect(checkbox).toBeChecked();
  }
  await setupDialog
    .getByTestId("input-project-name")
    .fill("Relationship Visuals");
  await setupDialog.getByTestId("button-create-project").click();
  // A blank project gets a first diagram and opens on it.
  await expect(page).toHaveURL(/\/project\/2\/view\/2$/);
  await expect(page.getByTestId("diagram-canvas-region")).toBeVisible();
  expect(
    (
      api.getCreatedSetup() as {
        relationTypes: string[];
      }
    ).relationTypes,
  ).toEqual(
    expect.arrayContaining([
      "association",
      "composition",
      "dependency",
      "realization",
    ]),
  );

  const edgeChanges = [
    {
      edgeId: "composition-edge",
      relationType: "composition",
      markerAttribute: "marker-start",
      markerValue: "url(#composition-diamond-marker)",
    },
    {
      edgeId: "dependency-edge",
      relationType: "dependency",
      markerAttribute: "marker-end",
      markerValue: /arrow/,
    },
    {
      edgeId: "realization-edge",
      relationType: "realization",
      markerAttribute: "marker-end",
      markerValue: "url(#generalization-triangle-marker)",
    },
  ] as const;

  for (const change of edgeChanges) {
    const edge = page.locator(
      `.react-flow__edge[data-id="${change.edgeId}"]`,
    );
    await expect(edge).toBeVisible();
    await edge.locator(".react-flow__edge-path").dblclick({ force: true });

    const panel = page.getByTestId("edge-attribute-panel");
    await expect(panel).toBeVisible();
    await panel
      .getByRole("radio", { name: change.relationType, exact: true })
      .click();
    await panel.getByRole("button", { name: "Apply" }).click();
    await expect(panel).toHaveCount(0);

    const edgePath = page.locator(
      `.react-flow__edge[data-id="${change.edgeId}"] .react-flow__edge-path`,
    );
    await expect(edgePath).toHaveAttribute(
      change.markerAttribute,
      change.markerValue,
    );
    if (change.relationType === "composition") {
      await expect(edgePath).toHaveCSS("stroke-dasharray", "none");
    } else {
      await expect(edgePath).toHaveCSS("stroke-dasharray", "5px, 5px");
    }
  }

  await expect(page.getByTestId("button-save-diagram-header")).toBeEnabled();
  await page.getByTestId("button-save-diagram-header").click();
  await expect.poll(() => api.getSavedPayload()).not.toBeNull();

  const savedEdges = api
    .getSavedPayload()
    ?.edges.map((edge) => (edge as { id: string; edgeType: string }).edgeType);
  expect(savedEdges).toEqual(["composition", "dependency", "realization"]);

  await page.reload();
  await expect(page.getByTestId("diagram-canvas-region")).toBeVisible();
  await expect(
    page.locator('.react-flow__edge[data-id="composition-edge"]'),
  ).toHaveClass(/react-flow__edge-composition/);
  await expect(
    page.locator('.react-flow__edge[data-id="dependency-edge"]'),
  ).toHaveClass(/react-flow__edge-dependency/);
  await expect(
    page.locator('.react-flow__edge[data-id="realization-edge"]'),
  ).toHaveClass(/react-flow__edge-realization/);
  await expect(
    page.locator(
      '.react-flow__edge[data-id="composition-edge"] .react-flow__edge-path',
    ),
  ).toHaveAttribute(
    "marker-start",
    "url(#composition-diamond-marker)",
  );
  await expect(
    page.locator(
      '.react-flow__edge[data-id="dependency-edge"] .react-flow__edge-path',
    ),
  ).toHaveCSS("stroke-dasharray", "5px, 5px");
  await expect(
    page.locator(
      '.react-flow__edge[data-id="realization-edge"] .react-flow__edge-path',
    ),
  ).toHaveAttribute(
    "marker-end",
    "url(#generalization-triangle-marker)",
  );
});

test("inherits configured relationship semantics in a referenced instance model", async ({
  page,
}) => {
  const api = await installInstanceRelationshipApi(page);

  await mockLocalSession(page, { displayName: "instance-relationship-test" });
  await page.goto("/project/3/view/3");
  await expect(page.getByTestId("diagram-canvas-region")).toBeVisible();

  const edgeChanges = [
    {
      edgeId: "composition-edge",
      relationType: "composition",
      markerAttribute: "marker-start",
      markerValue: "url(#composition-diamond-marker)",
    },
    {
      edgeId: "dependency-edge",
      relationType: "dependency",
      markerAttribute: "marker-end",
      markerValue: /arrow/,
    },
    {
      edgeId: "realization-edge",
      relationType: "realization",
      markerAttribute: "marker-end",
      markerValue: "url(#generalization-triangle-marker)",
    },
  ] as const;

  for (const change of edgeChanges) {
    const edge = page.locator(
      `.react-flow__edge[data-id="${change.edgeId}"]`,
    );
    await expect(edge).toBeVisible();
    await edge.locator(".react-flow__edge-path").dblclick({ force: true });

    const panel = page.getByTestId("edge-attribute-panel");
    await expect(panel).toBeVisible();
    for (const relationType of ["composition", "dependency", "realization"]) {
      await expect(
        panel.getByRole("radio", { name: relationType, exact: true }),
      ).toBeVisible();
    }
    await panel
      .getByRole("radio", { name: change.relationType, exact: true })
      .click();
    await panel.getByRole("button", { name: "Apply" }).click();
    await expect(panel).toHaveCount(0);

    const edgePath = page.locator(
      `.react-flow__edge[data-id="${change.edgeId}"] .react-flow__edge-path`,
    );
    await expect(edgePath).toHaveAttribute(
      change.markerAttribute,
      change.markerValue,
    );
    if (change.relationType === "composition") {
      await expect(edgePath).toHaveCSS("stroke-dasharray", "none");
    } else {
      await expect(edgePath).toHaveCSS("stroke-dasharray", "5px, 5px");
    }
  }

  await page.getByTestId("button-save-diagram-header").click();
  await expect.poll(() => api.getSavedPayload()).not.toBeNull();
  expect(
    api
      .getSavedPayload()
      ?.edges.map((edge) => (edge as { edgeType: string }).edgeType),
  ).toEqual(["composition", "dependency", "realization"]);
});