import { loadDatabaseConfig } from "../src/config";
import { createSidequestBackend } from "../src/storage/sidequestBackendInstance";

// Creates or updates Sidequest's own sidequest_* tables in DATABASE_URL. Its
// migrations aren't Drizzle's, so `db:setup` runs this after drizzle-kit.
const backend = createSidequestBackend(loadDatabaseConfig(process.env));
try {
  await backend.migrate();
} finally {
  await backend.close();
}
