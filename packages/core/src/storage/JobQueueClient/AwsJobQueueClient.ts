import {
  ConflictException,
  CreateScheduleCommand,
  type SchedulerClient,
} from "@aws-sdk/client-scheduler";
import { SendMessageCommand, type SQSClient } from "@aws-sdk/client-sqs";
import type { AwsJobQueueConfig } from "../../config";
import type { Clock } from "../../domain/clock";
import type { AddJobOptions, JobQueue } from "../../domain/jobs/jobQueue";
import type { Job } from "../../domain/jobs/types";
import { scheduleName } from "./scheduleName";

// The job queue on AWS: a job with a runAt becomes a one-time EventBridge
// Scheduler schedule that sends it to the SQS queue; any other job goes to the
// queue directly. So does a job whose runAt has already passed: what Scheduler
// does with a one-time schedule in the past is undocumented, and the job is
// due anyway.
export class AwsJobQueueClient implements JobQueue {
  constructor(
    private readonly config: AwsJobQueueConfig,
    private readonly clock: Clock,
    private readonly scheduler: SchedulerClient,
    private readonly sqs: SQSClient,
  ) {}

  async add(job: Job, options?: AddJobOptions): Promise<void> {
    if (!options?.runAt || options.runAt <= this.clock.now()) {
      await this.sqs.send(
        new SendMessageCommand({
          QueueUrl: this.config.queueUrl,
          MessageBody: JSON.stringify(job),
        }),
      );
      return;
    }

    try {
      await this.scheduler.send(
        new CreateScheduleCommand({
          Name: scheduleName(job, options.key ?? crypto.randomUUID()),
          GroupName: this.config.scheduleGroupName,
          ScheduleExpression: atExpression(options.runAt),
          ScheduleExpressionTimezone: "UTC",
          FlexibleTimeWindow: { Mode: "OFF" },
          ActionAfterCompletion: "DELETE",
          Target: {
            Arn: this.config.queueArn,
            RoleArn: this.config.schedulerRoleArn,
            Input: JSON.stringify(job),
          },
        }),
      );
    } catch (error) {
      // The schedule name carries the idempotency key, so a schedule that
      // already exists means this job was already added.
      if (!(error instanceof ConflictException)) {
        throw error;
      }
    }
  }
}

const MINUTE = 60 * 1000;

// A one-time schedule expression in UTC. Scheduler fires at minute
// granularity, so runAt is rounded up to the next whole minute: a job may run
// a little late, never early.
function atExpression(runAt: Date): string {
  const roundedUp = new Date(Math.ceil(runAt.getTime() / MINUTE) * MINUTE);
  return `at(${roundedUp.toISOString().slice(0, 19)})`;
}
