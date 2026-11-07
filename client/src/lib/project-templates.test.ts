import assert from "node:assert/strict";
import test from "node:test";
import { api } from "@shared/routes";
import { getProjectTemplateViews, PROJECT_TEMPLATES } from "./project-templates";

test("every starter template has a valid, view-local flow shape", () => {
  for (const template of PROJECT_TEMPLATES) {
    const views = getProjectTemplateViews(template);
    const nodeIds = new Set<string>();

    for (const view of views) {
      assert.ok(view.name.trim(), `${template.id} view needs a name`);
      assert.ok(view.description.trim(), `${template.id} view needs a description`);

      const viewNodeIds = new Set(view.nodes.map((node) => node.id));
      assert.equal(
        viewNodeIds.size,
        view.nodes.length,
        `${template.id} contains duplicate node IDs in one view`,
      );
      for (const node of view.nodes) nodeIds.add(node.id);

      for (const edge of view.edges) {
        assert.ok(viewNodeIds.has(edge.source), `${edge.id} has an unknown source`);
        assert.ok(viewNodeIds.has(edge.target), `${edge.id} has an unknown target`);
      }
    }

    assert.equal(
      nodeIds.size,
      views.reduce((count, view) => count + view.nodes.length, 0),
      `${template.id} reuses a node ID across views`,
    );
  }
});

test("every template parses as a starter payload", () => {
  for (const template of PROJECT_TEMPLATES.filter((candidate) => candidate.id !== "blank")) {
    const payload = api.projects.createStarter.input.parse({
      userId: 7,
      name: template.projectName,
      description: template.projectDescription,
      projectType: template.projectType,
      views: getProjectTemplateViews(template),
    });
    assert.ok(payload.views.length > 0, template.id);
    assert.ok(payload.views.every((view) => view.nodes.length > 0), template.id);
  }
});
