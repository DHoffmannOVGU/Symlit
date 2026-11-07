-- Elements are deleted once they are no longer placed in any diagram.
-- Remove elements that earlier versions left behind without a placement.
DELETE FROM "nodes" n
WHERE NOT EXISTS (SELECT 1 FROM "node_views" nv WHERE nv."node_id" = n."id");
