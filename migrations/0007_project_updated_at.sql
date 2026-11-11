ALTER TABLE "projects" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
-- Existing projects: the best known "last change" is their creation.
UPDATE "projects" SET "updated_at" = COALESCE("created_at", now());
