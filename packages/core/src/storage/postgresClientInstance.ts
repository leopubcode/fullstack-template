import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { DatabaseConfig } from "../config";
import * as schema from "./postgresSchema";

// Any Drizzle Postgres database over our schema, whatever the driver:
// postgres.js in the app, PGlite in tests.
export type PostgresDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

// One connection pool per process, built from DATABASE_URL: the connection
// string that docker compose, Supabase (see infra/supabase) and most hosts
// hand out. It connects lazily, on the first query.
export function createPostgresDatabase(
  config: DatabaseConfig,
): PostgresDatabase {
  // Supabase's transaction pooler can't keep prepared statements between
  // transactions, so don't name any.
  const client = postgres(config.url, { prepare: false });
  return drizzle(client, { schema });
}
