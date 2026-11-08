import { z } from "zod";
import { metamodelSetupSchema } from "./metamodel-setup";

/*
 * Validation shared by the client and server that must not depend on the
 * database layer: importing drizzle here would put the ORM in the browser
 * bundle. `shared/schema.ts` re-exports everything, and
 * `contracts.test.ts` checks the input schemas against the tables.
 */

export const projectTypeEnum = ["metamodel", "instance"] as const;
export type ProjectType = typeof projectTypeEnum[number];

export const viewTypeEnum = ["view", "pattern"] as const;
export type ViewType = typeof viewTypeEnum[number];

export const modelRuleCheckEnum = [
  "missing-name",
  "missing-description",
  "duplicate-name",
  "no-connections",
] as const;
export const modelRuleSeverityEnum = ["warning", "error"] as const;

export const modelRuleOperatorEnum = [
  "exists",
  "missing",
  "equals",
  "not-equals",
  "contains",
  "greater-than",
  "greater-than-or-equal",
  "less-than",
  "less-than-or-equal",
  "is-true",
  "is-false",
] as const;

export type ModelRuleComparison = {
      kind: "comparison";
      source: "self" | "connected";
      direction?: "any" | "incoming" | "outgoing";
      quantifier?: "any" | "all" | "none";
      targetType?: string;
      field: "name" | "description" | "type" | "attribute";
      attribute?: string;
      operator: typeof modelRuleOperatorEnum[number];
      value?: string;
    };

export type ModelRuleCondition = ModelRuleComparison | {
  kind: "group";
  combinator: "all" | "any";
  conditions: Array<ModelRuleComparison | {
    kind: "group";
    combinator: "all" | "any";
    conditions: ModelRuleComparison[];
  }>;
};

const modelRuleComparisonSchema = z.object({
      kind: z.literal("comparison"),
      source: z.enum(["self", "connected"]),
      direction: z.enum(["any", "incoming", "outgoing"]).optional(),
      quantifier: z.enum(["any", "all", "none"]).optional(),
      targetType: z.string().optional(),
      field: z.enum(["name", "description", "type", "attribute"]),
      attribute: z.string().optional(),
      operator: z.enum(modelRuleOperatorEnum),
      value: z.string().optional(),
    });

const modelRuleNestedGroupSchema = z.object({
  kind: z.literal("group"),
  combinator: z.enum(["all", "any"]),
  conditions: z.array(modelRuleComparisonSchema),
});

const modelRuleConditionSchema: z.ZodType<ModelRuleCondition> = z.discriminatedUnion("kind", [
  modelRuleComparisonSchema,
  z.object({
    kind: z.literal("group"),
    combinator: z.enum(["all", "any"]),
    conditions: z.array(z.union([modelRuleComparisonSchema, modelRuleNestedGroupSchema])),
  }),
]);

export const modelRuleOutcomeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("tag"),
    label: z.string().min(1),
    color: z.string().optional(),
  }),
  z.object({
    kind: z.literal("issue"),
    severity: z.enum(modelRuleSeverityEnum).default("warning"),
    message: z.string().optional(),
  }),
]);

export type ModelRuleOutcome = z.infer<typeof modelRuleOutcomeSchema>;

export const modelRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  targetType: z.string().min(1).default("all"),
  // `check` and `severity` keep rules saved by the original MVP readable.
  check: z.enum(modelRuleCheckEnum).optional(),
  severity: z.enum(modelRuleSeverityEnum).optional(),
  condition: modelRuleConditionSchema.optional(),
  outcome: modelRuleOutcomeSchema.optional(),
}).superRefine((rule, context) => {
  if (rule.check !== undefined) return;
  if (!rule.condition || !rule.outcome) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "A model rule needs a condition and outcome" });
    return;
  }
  const inspect = (condition: ModelRuleCondition) => {
    if (condition.kind === "group") {
      if (condition.conditions.length === 0) context.addIssue({ code: z.ZodIssueCode.custom, message: "Condition groups cannot be empty" });
      condition.conditions.forEach(inspect);
      return;
    }
    if (condition.field === "attribute" && !condition.attribute?.trim()) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Choose an attribute for each attribute condition" });
    }
    if (!["exists", "missing", "is-true", "is-false"].includes(condition.operator) && !condition.value?.trim()) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a comparison value" });
    }
  };
  inspect(rule.condition);
});

export type ModelRule = z.infer<typeof modelRuleSchema>;

const int = () => z.number().int().gte(-2147483648).lte(2147483647);

/** Creating a project (mirrors the `projects` table; see contracts.test.ts). */
export const insertProjectSchema = z.object({
  userId: int(),
  name: z.string(),
  description: z.string().nullable().optional(),
  projectType: z.enum(projectTypeEnum).optional(),
  referencedMetamodels: z.array(z.number()).optional(),
  templateId: z.string().nullable().optional(),
  metamodelSetup: metamodelSetupSchema.optional().nullable(),
});

/** Creating a view (mirrors the `views` table; see contracts.test.ts). */
export const insertViewSchema = z.object({
  projectId: int(),
  name: z.string(),
  description: z.string().nullable().optional(),
  modelRules: z.array(modelRuleSchema).optional(),
});
