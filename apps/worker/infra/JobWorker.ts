import { fileURLToPath } from "node:url";
import type { Duration } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import type * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

export interface JobWorkerProps {
  queue: sqs.IQueue;
  timeout: Duration;
  // Stage-specific env, e.g. development settings on LocalStack.
  environment?: Record<string, string>;
}

// The Lambda that runs jobs from the queue: src/lambda.ts, already bundled
// into dist/ by `npm run build`. What else it may use is granted by the
// stack's ResourceAccess.
export class JobWorker extends Construct {
  readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: JobWorkerProps) {
    super(scope, id);

    this.function = new lambda.Function(this, "Function", {
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      handler: "lambda.handler",
      code: lambda.Code.fromAsset(
        fileURLToPath(new URL("../dist", import.meta.url)),
      ),
      timeout: props.timeout,
      memorySize: 512,
      environment: props.environment,
    });

    this.function.addEventSource(
      new SqsEventSource(props.queue, {
        batchSize: 10,
        reportBatchItemFailures: true,
      }),
    );
  }
}
