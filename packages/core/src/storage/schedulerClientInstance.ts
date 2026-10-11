import { SchedulerClient } from "@aws-sdk/client-scheduler";

// Configured by the SDK's standard environment (AWS_REGION, AWS_ENDPOINT_URL, …).
export const schedulerClient = new SchedulerClient({});
