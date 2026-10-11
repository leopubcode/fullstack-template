import type { Config } from "../config";
import type { Clock } from "../domain/clock";
import type { Storage } from "../domain/storage";
import { dynamodbDocumentClient } from "./dynamodbClientInstance";
import { AwsJobQueueClient } from "./JobQueueClient/AwsJobQueueClient";
import { schedulerClient } from "./schedulerClientInstance";
import { sqsClient } from "./sqsClientInstance";
import { DynamoUsersRepository } from "./UsersRepository/DynamoUsersRepository";

export function createAwsStorage(
  config: Pick<Config, "jobQueue" | "tables">,
  clock: Clock,
): Storage {
  return {
    users: new DynamoUsersRepository(
      config.tables.users,
      dynamodbDocumentClient,
    ),
    jobQueue: new AwsJobQueueClient(
      config.jobQueue,
      clock,
      schedulerClient,
      sqsClient,
    ),
  };
}
