CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"roles" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
