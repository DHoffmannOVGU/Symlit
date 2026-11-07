-- Earlier versions had no foreign keys and deleted dependent rows by hand.
-- Remove rows that would violate the new constraints before adding them.
DELETE FROM "projects" p WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = p."user_id");--> statement-breakpoint
DELETE FROM "views" v WHERE NOT EXISTS (SELECT 1 FROM "projects" p WHERE p."id" = v."project_id");--> statement-breakpoint
UPDATE "views" v SET "parent_view_id" = NULL WHERE "parent_view_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "views" pv WHERE pv."id" = v."parent_view_id");--> statement-breakpoint
DELETE FROM "nodes" n WHERE NOT EXISTS (SELECT 1 FROM "projects" p WHERE p."id" = n."project_id");--> statement-breakpoint
DELETE FROM "node_views" nv WHERE NOT EXISTS (SELECT 1 FROM "nodes" n WHERE n."id" = nv."node_id") OR NOT EXISTS (SELECT 1 FROM "views" v WHERE v."id" = nv."view_id");--> statement-breakpoint
DELETE FROM "edges" e WHERE NOT EXISTS (SELECT 1 FROM "views" v WHERE v."id" = e."view_id") OR NOT EXISTS (SELECT 1 FROM "nodes" n WHERE n."id" = e."source") OR NOT EXISTS (SELECT 1 FROM "nodes" n WHERE n."id" = e."target");--> statement-breakpoint
DELETE FROM "nodes" n WHERE NOT EXISTS (SELECT 1 FROM "node_views" nv WHERE nv."node_id" = n."id");--> statement-breakpoint
ALTER TABLE "edges" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "edges" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "node_views" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "node_views" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "nodes" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "nodes" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "views" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "views" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_view_id_views_id_fk" FOREIGN KEY ("view_id") REFERENCES "public"."views"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_source_nodes_id_fk" FOREIGN KEY ("source") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edges" ADD CONSTRAINT "edges_target_nodes_id_fk" FOREIGN KEY ("target") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_views" ADD CONSTRAINT "node_views_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_views" ADD CONSTRAINT "node_views_view_id_views_id_fk" FOREIGN KEY ("view_id") REFERENCES "public"."views"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "views" ADD CONSTRAINT "views_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "views" ADD CONSTRAINT "views_parent_view_id_views_id_fk" FOREIGN KEY ("parent_view_id") REFERENCES "public"."views"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "edges_view_id_idx" ON "edges" USING btree ("view_id");--> statement-breakpoint
CREATE INDEX "node_views_view_id_idx" ON "node_views" USING btree ("view_id");--> statement-breakpoint
CREATE INDEX "nodes_project_id_idx" ON "nodes" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "projects_user_id_idx" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "views_project_id_idx" ON "views" USING btree ("project_id");