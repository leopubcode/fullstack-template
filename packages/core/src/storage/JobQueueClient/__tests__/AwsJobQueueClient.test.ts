import {
  ConflictException,
  CreateScheduleCommand,
  SchedulerClient,
} from "@aws-sdk/client-scheduler";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import type { AwsJobQueueConfig } from "../../../config";
import type { Job } from "../../../domain/jobs/types";
import { AwsJobQueueClient } from "../AwsJobQueueClient";

const scheduler = mockClient(SchedulerClient);
const sqs = mockClient(SQSClient);

const config: AwsJobQueueConfig = {
  queueArn: "arn:aws:sqs:us-east-1:000000000000:jobs",
  queueUrl: "http://localhost:4566/000000000000/jobs",
  scheduleGroupName: "jobs",
  schedulerRoleArn: "arn:aws:iam::000000000000:role/scheduler",
};
const now = new Date("2026-01-08T00:00:30Z");
const job: Job = { type: "Testing", foo: "bar" };

const client = () =>
  new AwsJobQueueClient(
    config,
    { now: () => now },
    new SchedulerClient({}),
    new SQSClient({}),
  );

const sentMessages = () =>
  sqs.commandCalls(SendMessageCommand).map((call) => call.args[0].input);

const createdSchedules = () =>
  scheduler
    .commandCalls(CreateScheduleCommand)
    .map((call) => call.args[0].input);

beforeEach(() => {
  scheduler.reset();
  sqs.reset();
});

describe("adding a job to the AWS job queue", () => {
  it("sends a job without a runAt straight to the queue", async () => {
    await client().add(job);

    expect(sentMessages()).toEqual([
      { QueueUrl: config.queueUrl, MessageBody: JSON.stringify(job) },
    ]);
    expect(createdSchedules()).toEqual([]);
  });

  it("sends a job whose runAt has passed straight to the queue", async () => {
    await client().add(job, {
      runAt: new Date("2026-01-08T00:00:00Z"),
      key: "k",
    });

    expect(sentMessages()).toEqual([
      { QueueUrl: config.queueUrl, MessageBody: JSON.stringify(job) },
    ]);
    expect(createdSchedules()).toEqual([]);
  });

  it("schedules a job whose runAt is ahead, rounded up to the minute", async () => {
    await client().add(job, {
      runAt: new Date("2026-01-08T00:01:10Z"),
      key: "k",
    });

    expect(sentMessages()).toEqual([]);
    expect(createdSchedules()).toEqual([
      {
        Name: "Testing-k",
        GroupName: config.scheduleGroupName,
        ScheduleExpression: "at(2026-01-08T00:02:00)",
        ScheduleExpressionTimezone: "UTC",
        FlexibleTimeWindow: { Mode: "OFF" },
        ActionAfterCompletion: "DELETE",
        Target: {
          Arn: config.queueArn,
          RoleArn: config.schedulerRoleArn,
          Input: JSON.stringify(job),
        },
      },
    ]);
  });

  it("doesn't round a runAt that is already on the minute", async () => {
    await client().add(job, { runAt: new Date("2026-01-08T00:05:00Z") });

    expect(createdSchedules()[0]?.ScheduleExpression).toBe(
      "at(2026-01-08T00:05:00)",
    );
  });

  it("names a schedule without a key uniquely", async () => {
    const runAt = new Date("2026-01-08T00:05:00Z");

    await client().add(job, { runAt });
    await client().add(job, { runAt });

    const [first, second] = createdSchedules().map((input) => input.Name);
    expect(first).toMatch(/^Testing-[0-9a-f-]{36}$/);
    expect(second).not.toBe(first);
  });

  it("treats an existing schedule with the same key as already added", async () => {
    scheduler.on(CreateScheduleCommand).rejects(
      new ConflictException({
        Message: "exists",
        message: "exists",
        $metadata: {},
      }),
    );

    await expect(
      client().add(job, { runAt: new Date("2026-01-08T00:05:00Z"), key: "k" }),
    ).resolves.toBeUndefined();
  });

  it("fails on any other Scheduler error", async () => {
    const error = new Error("throttled");
    scheduler.on(CreateScheduleCommand).rejects(error);

    await expect(
      client().add(job, { runAt: new Date("2026-01-08T00:05:00Z"), key: "k" }),
    ).rejects.toThrow("throttled");
  });
});
