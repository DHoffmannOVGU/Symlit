import assert from "node:assert/strict";
import test from "node:test";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { projects, views } from "./schema";
import { insertProjectSchema, insertViewSchema, modelRuleSchema, projectTypeEnum } from "./contracts";
import { metamodelSetupSchema } from "./metamodel-setup";

// The input schemas in contracts.ts are written by hand so the browser bundle
// does not include drizzle. These checks keep them in line with the tables.

// What the schemas used to be: generated from the tables, with the JSON
// columns narrowed.
const generatedProject = createInsertSchema(projects)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    projectType: z.enum(projectTypeEnum).optional(),
    referencedMetamodels: z.array(z.number()).optional(),
    metamodelSetup: metamodelSetupSchema.optional().nullable(),
  });
const generatedView = createInsertSchema(views)
  .omit({ id: true, createdAt: true, viewType: true })
  .extend({ modelRules: z.array(modelRuleSchema).optional() });

test("project input covers exactly the insertable project columns", () => {
  assert.deepEqual(Object.keys(insertProjectSchema.shape).sort(), Object.keys(generatedProject.shape).sort());
});

test("view input covers exactly the insertable view columns", () => {
  assert.deepEqual(Object.keys(insertViewSchema.shape).sort(), Object.keys(generatedView.shape).sort());
});

test("both accept and reject the same inputs", () => {
  const cases: Array<[z.ZodTypeAny, z.ZodTypeAny, unknown]> = [
    [insertProjectSchema, generatedProject, { userId: 1, name: "P" }],
    [insertProjectSchema, generatedProject, { userId: 1, name: "P", description: null, templateId: null, metamodelSetup: null }],
    [insertProjectSchema, generatedProject, { userId: 1.5, name: "P" }],
    [insertProjectSchema, generatedProject, { userId: 1 }],
    [insertProjectSchema, generatedProject, { userId: 1, name: "P", projectType: "other" }],
    [insertViewSchema, generatedView, { projectId: 1, name: "V", modelRules: [] }],
    [insertViewSchema, generatedView, { projectId: 1, name: 5 }],
  ];
  for (const [manual, generated, input] of cases) {
    assert.equal(manual.safeParse(input).success, generated.safeParse(input).success, JSON.stringify(input));
  }
});

test("hand-written and generated schemas agree on required, optional and nullable columns", () => {
  const pairs: Array<[z.ZodObject<z.ZodRawShape>, z.ZodObject<z.ZodRawShape>]> = [
    [insertProjectSchema, generatedProject],
    [insertViewSchema, generatedView],
  ];
  for (const [manual, generated] of pairs) {
    for (const key of Object.keys(generated.shape)) {
      const a = manual.shape[key];
      const b = generated.shape[key];
      assert.equal(a.isOptional(), b.isOptional(), `${key}: optional`);
      assert.equal(a.isNullable(), b.isNullable(), `${key}: nullable`);
    }
  }
});
