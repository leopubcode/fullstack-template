import {
  DeleteScheduleCommand,
  GetScheduleCommand,
  ListSchedulesCommand,
  SchedulerClient,
} from "@aws-sdk/client-scheduler";
import {
  GetQueueUrlCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { runDueSchedules } from "../runDueSchedules";

const scheduler = mockClient(SchedulerClient);
const sqs = mockClient(SQSClient);

const queueArn = "arn:aws:sqs:us-east-1:000000000000:jobs";
const queueUrl = "http://localhost:4566/000000000000/jobs";
const now = new Date("2026-01-08T00:00:30Z");

// Schedules in the group as Scheduler stores them, keyed by name.
function givenSchedules(schedules: Record<string, string>) {
  scheduler.on(ListSchedulesCommand).resolves({
    Schedules: Object.keys(schedules).map((Name) => ({
      Name,
      GroupName: "jobs",
    })),
  });
  for (const [Name, ScheduleExpression] of Object.entries(schedules)) {
    scheduler.on(GetScheduleCommand, { Name, GroupName: "jobs" }).resolves({
      Name,
      GroupName: "jobs",
      ScheduleExpression,
      ScheduleExpressionTimezone: "UTC",
      Target: { Arn: queueArn, RoleArn: "role", Input: `{"job":"${Name}"}` },
    });
  }
}

const run = () =>
  runDueSchedules({
    scheduler: new SchedulerClient({}),
    sqs: new SQSClient({}),
    groupName: "jobs",
    now,
  });

const sentMessages = () =>
  sqs.commandCalls(SendMessageCommand).map((call) => call.args[0].input);

const deletedSchedules = () =>
  scheduler
    .commandCalls(DeleteScheduleCommand)
    .map((call) => call.args[0].input);

beforeEach(() => {
  scheduler.reset();
  sqs.reset();
  sqs
    .on(GetQueueUrlCommand, {
      QueueName: "jobs",
      QueueOwnerAWSAccountId: "000000000000",
    })
    .resolves({ QueueUrl: queueUrl });
});

describe("running due schedules", () => {
  it("sends a due one-time schedule's input to its queue and deletes it", async () => {
    givenSchedules({ due: "at(2026-01-08T00:00:00)" });

    await run();

    expect(sentMessages()).toEqual([
      { QueueUrl: queueUrl, MessageBody: '{"job":"due"}' },
    ]);
    expect(deletedSchedules()).toEqual([{ Name: "due", GroupName: "jobs" }]);
  });

  it("leaves a schedule that isn't due yet", async () => {
    givenSchedules({
      due: "at(2026-01-08T00:00:00)",
      later: "at(2026-01-08T00:01:00)",
    });

    await run();

    expect(sentMessages()).toEqual([
      { QueueUrl: queueUrl, MessageBody: '{"job":"due"}' },
    ]);
    expect(deletedSchedules()).toEqual([{ Name: "due", GroupName: "jobs" }]);
  });
});
