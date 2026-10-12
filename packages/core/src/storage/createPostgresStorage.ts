import type { Config } from "../config";
import type { Storage } from "../domain/storage";
import { createPostgresDatabase } from "./postgresClientInstance";
import { PostgresUsersRepository } from "./UsersRepository/PostgresUsersRepository";

export function createPostgresStorage(
  config: Pick<Config, "database">,
): Storage {
  const db = createPostgresDatabase(config.database);

  return {
    users: new PostgresUsersRepository(db),
  };
}
