-- Method projects and internal views were removed from Symlit.
-- Delete their data first; views, placements and relationships cascade.
DELETE FROM "projects" WHERE "project_type" NOT IN ('metamodel', 'instance');--> statement-breakpoint
DELETE FROM "views" WHERE "view_type" NOT IN ('view', 'pattern');--> statement-breakpoint
-- Elements are deleted once they are in no diagram.
DELETE FROM "nodes" n WHERE NOT EXISTS (SELECT 1 FROM "node_views" nv WHERE nv."node_id" = n."id");--> statement-breakpoint
ALTER TABLE "views" DROP CONSTRAINT "views_parent_view_id_views_id_fk";
--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "method_metadata";--> statement-breakpoint
ALTER TABLE "views" DROP COLUMN "parent_node_id";--> statement-breakpoint
ALTER TABLE "views" DROP COLUMN "parent_view_id";