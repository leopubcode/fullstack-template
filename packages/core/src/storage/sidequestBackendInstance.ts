import { type Backend, type BackendConfig, LazyBackend } from "sidequest";
import type { DatabaseConfig } from "../config";

// Sidequest keeps its jobs in the app's own Postgres, in sidequest_* tables
// that it migrates itself (npm run db:setup, and the worker on start).
export function sidequestBackendConfig(config: DatabaseConfig) {
  return {
    driver: "@sidequest/postgres-backend",
    config: config.url,
  } satisfies BackendConfig;
}

// One Sidequest backend per process for adding jobs. It connects lazily, on
// the first job added.
export function createSidequestBackend(config: DatabaseConfig): Backend {
  return new LazyBackend(sidequestBackendConfig(config));
}
