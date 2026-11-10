-- Multiplicities became meaningful: a defined syntax, checked when a model is
-- validated, and one for each end of a relationship. "Variability"
-- (mandatory/optional) said the same as a minimum of 1 or 0 and is folded in.

-- A mandatory part without a multiplicity: at least one (metamodel relationships only,
-- models do not define multiplicities).
UPDATE "edges" AS e
SET "data" = jsonb_set(e."data", '{multiplicity}', '"1..*"'::jsonb)
FROM "views" AS v
JOIN "projects" AS p ON p."id" = v."project_id"
WHERE e."view_id" = v."id"
  AND p."project_type" = 'metamodel'
  AND jsonb_typeof(e."data") = 'object'
  AND e."data"->>'variability' = 'mandatory'
  AND btrim(coalesce(e."data"->>'multiplicity', '')) = '';
--> statement-breakpoint
UPDATE "edges" SET "data" = "data" - 'variability'
WHERE jsonb_typeof("data") = 'object' AND "data" ? 'variability';
--> statement-breakpoint
-- Multiplicities set on a model's relationships were never used; they are
-- defined on the metamodel's relationships.
UPDATE "edges" AS e
SET "data" = e."data" - 'multiplicity'
FROM "views" AS v
JOIN "projects" AS p ON p."id" = v."project_id"
WHERE e."view_id" = v."id"
  AND p."project_type" <> 'metamodel'
  AND jsonb_typeof(e."data") = 'object'
  AND e."data" ? 'multiplicity';
--> statement-breakpoint
-- Canonical spelling for what can be read ("1 .. 1" -> "1"). Text that is not
-- a multiplicity, and "any number" (*, 0..*), restricts nothing and is removed.
WITH parsed AS (
  SELECT "id", regexp_replace("data"->>'multiplicity', '\s', '', 'g') AS v
  FROM "edges"
  WHERE jsonb_typeof("data") = 'object' AND "data" ? 'multiplicity'
), canonical AS (
  SELECT "id",
    CASE
      WHEN v ~ '^\d{1,6}$' AND v::int > 0 THEN v::int::text
      WHEN v ~ '^\d{1,6}\.\.\*$' AND split_part(v, '..', 1)::int > 0 THEN split_part(v, '..', 1)::int::text || '..*'
      WHEN v ~ '^\d{1,6}\.\.\d{1,6}$'
        AND split_part(v, '..', 2)::int > 0
        AND split_part(v, '..', 2)::int >= split_part(v, '..', 1)::int
      THEN CASE
        WHEN split_part(v, '..', 1)::int = split_part(v, '..', 2)::int THEN split_part(v, '..', 1)::int::text
        ELSE split_part(v, '..', 1)::int::text || '..' || split_part(v, '..', 2)::int::text
      END
      ELSE NULL
    END AS value
  FROM parsed
)
UPDATE "edges" AS e
SET "data" = CASE
  WHEN c.value IS NULL THEN e."data" - 'multiplicity'
  ELSE jsonb_set(e."data", '{multiplicity}', to_jsonb(c.value))
END
FROM canonical AS c
WHERE e."id" = c."id";
