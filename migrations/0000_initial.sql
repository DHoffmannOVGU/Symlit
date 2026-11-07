CREATE TABLE "edges" (
	"id" text PRIMARY KEY NOT NULL,
	"view_id" integer NOT NULL,
	"source" text NOT NULL,
	"target" text NOT NULL,
	"edge_type" text DEFAULT 'association' NOT NULL,
	"source_handle" text,
	"target_handle" text,
	"data" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "node_views" (
	"node_id" text NOT NULL,
	"view_id" integer NOT NULL,
	"position" jsonb NOT NULL,
	"parent_id" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "node_views_node_id_view_id_pk" PRIMARY KEY("node_id","view_id")
);
--> statement-breakpoint
CREATE TABLE "nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"type" text DEFAULT 'default' NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"project_type" text DEFAULT 'metamodel' NOT NULL,
	"referenced_metamodels" jsonb DEFAULT '[]'::jsonb,
	"method_metadata" jsonb DEFAULT '{"stakeholders":[]}'::jsonb,
	"metamodel_setup" jsonb DEFAULT 'null'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "views" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"view_type" text DEFAULT 'view' NOT NULL,
	"parent_node_id" text,
	"parent_view_id" integer,
	"model_rules" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now()
);
