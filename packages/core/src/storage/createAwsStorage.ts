import type { Config } from "../config";
import type { Clock } from "../domain/clock";
import type { Storage } from "../domain/storage";
import { AwsJobQueueClient } from "./JobQueueClient/AwsJobQueueClient";
import { schedulerClient } from "./schedulerClientInstance";
import { sqsClient } from "./sqsClientInstance";

export function createAwsStorage(
  config: Pick<Config, "jobQueue">,
  clock: Clock,
): Storage {
  return {
    jobQueue: new AwsJobQueueClient(
      config.jobQueue,
      clock,
      schedulerClient,
      sqsClient,
    ),
  };
}
