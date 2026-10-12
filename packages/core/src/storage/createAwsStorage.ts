import type { Config } from "../config";
import type { Clock } from "../domain/clock";
import type { Storage } from "../domain/storage";
import { cognitoClient } from "./cognitoClientInstance";
import { dynamodbDocumentClient } from "./dynamodbClientInstance";
import { S3FileClient } from "./FileClient/S3FileClient";
import { CognitoIdentityProviderClient } from "./IdentityProviderClient/CognitoIdentityProviderClient";
import { AwsJobQueueClient } from "./JobQueueClient/AwsJobQueueClient";
import { s3Client } from "./s3ClientInstance";
import { schedulerClient } from "./schedulerClientInstance";
import { sqsClient } from "./sqsClientInstance";
import { DynamoUsersRepository } from "./UsersRepository/DynamoUsersRepository";

export function createAwsStorage(
  config: Pick<Config, "jobQueue" | "tables" | "files" | "identity">,
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
    files: new S3FileClient(config.files.bucketName, s3Client),
    identity: new CognitoIdentityProviderClient(
      config.identity,
      clock,
      cognitoClient,
    ),
  };
}
