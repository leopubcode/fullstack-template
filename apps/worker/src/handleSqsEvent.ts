import type { SQSBatchResponse, SQSEvent } from "aws-lambda";

export interface HandleSqsEventOptions {
  // Runs one job from its message body; throws when the job failed.
  handle: (body: string) => Promise<void>;
  logError?: (...args: unknown[]) => void;
}

// Adapts a Lambda SQS batch to the jobs transport. Records run one at a time,
// and each one that throws is reported in batchItemFailures, so SQS redelivers
// only those (the event source must enable ReportBatchItemFailures).
export async function handleSqsEvent(
  event: SQSEvent,
  { handle, logError = console.error }: HandleSqsEventOptions,
): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];
  for (const record of event.Records) {
    try {
      await handle(record.body);
    } catch (error) {
      logError(`Job in message ${record.messageId} failed`, error);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
}
