import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PostgresDatabase } from "../postgresClientInstance";
import * as schema from "../postgresSchema";

export const MIGRATIONS_FOLDER = new URL("../../../drizzle", import.meta.url)
  .pathname;

export interface TestPostgresDatabase {
  db: PostgresDatabase;
  close(): Promise<void>;
}

// A real Postgres (PGlite, compiled to WASM) running in memory, with every
// migration applied. No database server needed.
export async function createTestPostgresDatabase(): Promise<TestPostgresDatabase> {
  const client = await PGlite.create();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  return { db, close: () => client.close() };
}
