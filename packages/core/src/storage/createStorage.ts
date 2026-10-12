import type { Config } from "../config";
import type { Storage } from "../domain/storage";
import { createPostgresDatabase } from "./postgresClientInstance";
import { s3Client } from "./s3ClientInstance";
import { createSidequestBackend } from "./sidequestBackendInstance";
import { S3FileClient } from "./FileClient/S3FileClient";
import { SidequestJobQueueClient } from "./JobQueueClient/SidequestJobQueueClient";
import { PostgresUsersRepository } from "./UsersRepository/PostgresUsersRepository";

// Data and jobs live in Postgres; files live in S3, as nothing in Postgres
// would hand out a URL the browser can upload to.
export function createStorage(
  config: Pick<Config, "database" | "files">,
): Storage {
  const db = createPostgresDatabase(config.database);

  return {
    users: new PostgresUsersRepository(db),
    jobQueue: new SidequestJobQueueClient(
      createSidequestBackend(config.database),
    ),
    files: new S3FileClient(config.files.bucketName, s3Client),
  };
}
