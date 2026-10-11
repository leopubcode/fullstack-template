import { SQSClient } from "@aws-sdk/client-sqs";

// Configured by the SDK's standard environment (AWS_REGION, AWS_ENDPOINT_URL, …).
export const sqsClient = new SQSClient({});
