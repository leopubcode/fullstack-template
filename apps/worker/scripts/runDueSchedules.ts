import {
  DeleteScheduleCommand,
  GetScheduleCommand,
  paginateListSchedules,
  type SchedulerClient,
} from "@aws-sdk/client-scheduler";
import {
  GetQueueUrlCommand,
  SendMessageCommand,
  type SQSClient,
} from "@aws-sdk/client-sqs";

export interface RunDueSchedulesOptions {
  scheduler: SchedulerClient;
  sqs: SQSClient;
  groupName: string;
  now: Date;
}

// Does what EventBridge Scheduler would for every due one-time schedule in the
// group, which LocalStack stores but never fires: sends its target input to
// its SQS queue, then deletes it (AwsJobQueueClient sets
// ActionAfterCompletion: DELETE).
export async function runDueSchedules({
  scheduler,
  sqs,
  groupName,
  now,
}: RunDueSchedulesOptions): Promise<void> {
  for await (const page of paginateListSchedules(
    { client: scheduler },
    { GroupName: groupName },
  )) {
    for (const { Name } of page.Schedules ?? []) {
      const schedule = await scheduler.send(
        new GetScheduleCommand({ Name, GroupName: groupName }),
      );
      const dueAt = oneTimeScheduleDueAt(schedule.ScheduleExpression);
      if (!dueAt || dueAt > now) {
        continue;
      }
      await sqs.send(
        new SendMessageCommand({
          QueueUrl: await queueUrl(sqs, schedule.Target!.Arn!),
          MessageBody: schedule.Target!.Input,
        }),
      );
      await scheduler.send(
        new DeleteScheduleCommand({ Name, GroupName: groupName }),
      );
    }
  }
}

// The time a one-time `at(yyyy-mm-ddThh:mm:ss)` expression fires, read as UTC,
// the timezone AwsJobQueueClient always gives it. Undefined for a rate or cron
// expression.
function oneTimeScheduleDueAt(
  expression: string | undefined,
): Date | undefined {
  const match = expression?.match(/^at\((.+)\)$/);
  return match ? new Date(`${match[1]}Z`) : undefined;
}

// arn:aws:sqs:<region>:<account>:<queue name>
async function queueUrl(sqs: SQSClient, queueArn: string): Promise<string> {
  const [, , , , account, name] = queueArn.split(":");
  const { QueueUrl } = await sqs.send(
    new GetQueueUrlCommand({
      QueueName: name,
      QueueOwnerAWSAccountId: account,
    }),
  );
  return QueueUrl!;
}
