// Dev only. LocalStack's EventBridge Scheduler stores schedules but never
// fires them, so this stands in for it: every few seconds it sends each due
// one-time schedule's job to SQS, where the worker Lambda picks it up.
// Run with `npm run local-scheduler` (reads .env).
import { SchedulerClient } from "@aws-sdk/client-scheduler";
import { SQSClient } from "@aws-sdk/client-sqs";
import { runDueSchedules } from "./runDueSchedules";

const POLL_INTERVAL_MS = 5000;

const groupName = process.env.JOB_SCHEDULE_GROUP_NAME;
if (!groupName) {
  throw new Error(
    "JOB_SCHEDULE_GROUP_NAME is not set (copy it from cdk-outputs.json)",
  );
}
if (!process.env.AWS_ENDPOINT_URL) {
  throw new Error("AWS_ENDPOINT_URL is not set; this only runs on LocalStack");
}

const scheduler = new SchedulerClient({});
const sqs = new SQSClient({});

console.log(`local scheduler polling schedule group ${groupName}`);

for (;;) {
  try {
    await runDueSchedules({ scheduler, sqs, groupName, now: new Date() });
  } catch (error) {
    console.error("local scheduler poll failed", error);
  }
  await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
}
