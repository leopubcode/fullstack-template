import { defineConfig } from "drizzle-kit";

// `db:generate` only diffs the schema, so it needs no database; `db:setup`
// (drizzle-kit migrate) applies the migrations to DATABASE_URL.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/storage/postgresSchema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
