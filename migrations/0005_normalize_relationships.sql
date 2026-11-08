-- Relationships are stored in the canonical form described in
-- shared/relationships.ts, so that saving any existing diagram passes the
-- stricter checks: a known type mirrored in data.edgeType, handles named by
-- side, data always an object, and known data fields with the right type.

-- Unknown relationship types were already shown as associations.
UPDATE "edges" SET "edge_type" = 'association'
WHERE "edge_type" NOT IN ('association', 'aggregation', 'composition', 'generalization', 'dependency', 'realization');
--> statement-breakpoint
UPDATE "edges" SET "data" = '{}'::jsonb WHERE "data" IS NULL OR jsonb_typeof("data") <> 'object';
--> statement-breakpoint
UPDATE "edges" SET "data" = "data" - 'label'
WHERE "data" ? 'label' AND jsonb_typeof("data"->'label') <> 'string';
--> statement-breakpoint
UPDATE "edges" SET "data" = "data" - 'description'
WHERE "data" ? 'description' AND jsonb_typeof("data"->'description') <> 'string';
--> statement-breakpoint
UPDATE "edges" SET "data" = "data" - 'multiplicity'
WHERE "data" ? 'multiplicity' AND jsonb_typeof("data"->'multiplicity') <> 'string';
--> statement-breakpoint
UPDATE "edges" SET "data" = "data" - 'strokeColor'
WHERE "data" ? 'strokeColor' AND jsonb_typeof("data"->'strokeColor') <> 'string';
--> statement-breakpoint
UPDATE "edges" SET "data" = "data" - 'flowType'
WHERE "data" ? 'flowType' AND (jsonb_typeof("data"->'flowType') <> 'string' OR "data"->>'flowType' NOT IN ('partflow', 'actionflow', 'informationflow'));
--> statement-breakpoint
UPDATE "edges" SET "data" = "data" - 'variability'
WHERE "data" ? 'variability' AND (jsonb_typeof("data"->'variability') <> 'string' OR "data"->>'variability' NOT IN ('mandatory', 'optional'));
--> statement-breakpoint
UPDATE "edges" SET "data" = "data" - 'lineStyle'
WHERE "data" ? 'lineStyle' AND (jsonb_typeof("data"->'lineStyle') <> 'string' OR "data"->>'lineStyle' NOT IN ('solid', 'dashed', 'dotted'));
--> statement-breakpoint
UPDATE "edges" SET "data" = "data" - 'sourceArrow'
WHERE "data" ? 'sourceArrow' AND (jsonb_typeof("data"->'sourceArrow') <> 'string' OR "data"->>'sourceArrow' NOT IN ('none', 'arrow', 'arrowclosed'));
--> statement-breakpoint
UPDATE "edges" SET "data" = "data" - 'targetArrow'
WHERE "data" ? 'targetArrow' AND (jsonb_typeof("data"->'targetArrow') <> 'string' OR "data"->>'targetArrow' NOT IN ('none', 'arrow', 'arrowclosed'));
--> statement-breakpoint
UPDATE "edges" SET "data" = "data" - 'pathType'
WHERE "data" ? 'pathType' AND (jsonb_typeof("data"->'pathType') <> 'string' OR "data"->>'pathType' NOT IN ('default', 'straight', 'step', 'smoothstep'));
--> statement-breakpoint
UPDATE "edges" SET "data" = "data" - 'strokeWidth'
WHERE "data" ? 'strokeWidth'
  AND CASE WHEN jsonb_typeof("data"->'strokeWidth') = 'number'
        THEN ("data"->>'strokeWidth')::numeric <= 0 OR ("data"->>'strokeWidth')::numeric > 50
        ELSE true END;
--> statement-breakpoint
UPDATE "edges" SET "data" = "data" - 'animated'
WHERE "data" ? 'animated' AND jsonb_typeof("data"->'animated') <> 'boolean';
--> statement-breakpoint
UPDATE "edges" SET "data" = "data" - 'sourceAnchor'
WHERE "data" ? 'sourceAnchor'
  AND NOT (
    jsonb_typeof("data"->'sourceAnchor') = 'object'
    AND jsonb_typeof("data"->'sourceAnchor'->'side') = 'string'
    AND "data"->'sourceAnchor'->>'side' IN ('top', 'right', 'bottom', 'left')
    AND CASE WHEN jsonb_typeof("data"->'sourceAnchor'->'offset') = 'number'
          THEN ("data"->'sourceAnchor'->>'offset')::numeric BETWEEN 0 AND 1
          ELSE false END
  );
--> statement-breakpoint
UPDATE "edges" SET "data" = "data" - 'targetAnchor'
WHERE "data" ? 'targetAnchor'
  AND NOT (
    jsonb_typeof("data"->'targetAnchor') = 'object'
    AND jsonb_typeof("data"->'targetAnchor'->'side') = 'string'
    AND "data"->'targetAnchor'->>'side' IN ('top', 'right', 'bottom', 'left')
    AND CASE WHEN jsonb_typeof("data"->'targetAnchor'->'offset') = 'number'
          THEN ("data"->'targetAnchor'->>'offset')::numeric BETWEEN 0 AND 1
          ELSE false END
  );
--> statement-breakpoint
-- Display-only style fields that were read but never written.
UPDATE "edges" SET "data" = "data" - 'ruleStrokeWidth' - 'ruleStrokeColor' - 'ruleLineStyle' - 'ruleAnimated'
WHERE "data" ?| ARRAY['ruleStrokeWidth', 'ruleStrokeColor', 'ruleLineStyle', 'ruleAnimated'];
--> statement-breakpoint
-- The type column is authoritative; data.edgeType mirrors it.
UPDATE "edges" SET "data" = jsonb_set("data", '{edgeType}', to_jsonb("edge_type"))
WHERE "data"->>'edgeType' IS DISTINCT FROM "edge_type";
--> statement-breakpoint
-- Handles: one per side. Older ids had -source/-target suffixes, and NULL
-- meant the default handle (bottom for sources, top for targets).
UPDATE "edges" SET
  "source_handle" = CASE
    WHEN regexp_replace(coalesce("source_handle", ''), '-(source|target)$', '') IN ('top', 'right', 'bottom', 'left')
      THEN regexp_replace("source_handle", '-(source|target)$', '')
    ELSE 'bottom'
  END,
  "target_handle" = CASE
    WHEN regexp_replace(coalesce("target_handle", ''), '-(source|target)$', '') IN ('top', 'right', 'bottom', 'left')
      THEN regexp_replace("target_handle", '-(source|target)$', '')
    ELSE 'top'
  END
WHERE "source_handle" IS NULL OR "target_handle" IS NULL
   OR "source_handle" NOT IN ('top', 'right', 'bottom', 'left')
   OR "target_handle" NOT IN ('top', 'right', 'bottom', 'left');
