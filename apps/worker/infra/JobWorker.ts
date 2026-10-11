import { fileURLToPath } from "node:url";
import type { Duration } from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import type * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import type { JobScheduler } from "./JobScheduler";

// The env var each table's name is passed in, as the services read it.
export interface TableNames {
  USERS_TABLE_NAME: string;
}

export interface JobWorkerProps {
  queue: sqs.IQueue;
  scheduler: JobScheduler;
  // core's config requires this even though no job handler uses it yet; the
  // worker never gets write access to the bucket.
  filesBucketName: string;
  tableNames: TableNames;
  timeout: Duration;
  // Stage-specific env, e.g. development settings on LocalStack.
  environment?: Record<string, string>;
}

// The Lambda that runs jobs from the queue: src/lambda.ts, already bundled
// into dist/ by `npm run build`.
export class JobWorker extends Construct {
  readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: JobWorkerProps) {
    super(scope, id);

    const { queue, scheduler, tableNames } = props;

    this.function = new lambda.Function(this, "Function", {
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      handler: "lambda.handler",
      code: lambda.Code.fromAsset(
        fileURLToPath(new URL("../dist", import.meta.url)),
      ),
      timeout: props.timeout,
      memorySize: 512,
      environment: {
        ...props.environment,
        ...tableNames,
        JOB_QUEUE_ARN: queue.queueArn,
        JOB_QUEUE_URL: queue.queueUrl,
        JOB_SCHEDULE_GROUP_NAME: scheduler.scheduleGroup.scheduleGroupName,
        JOB_SCHEDULER_ROLE_ARN: scheduler.role.roleArn,
        FILES_BUCKET_NAME: props.filesBucketName,
      },
    });

    this.function.addEventSource(
      new SqsEventSource(queue, {
        batchSize: 10,
        reportBatchItemFailures: true,
      }),
    );

    // The stack doesn't own the tables; it only grants access to them.
    for (const [envName, tableName] of Object.entries(tableNames)) {
      dynamodb.Table.fromTableName(this, envName, tableName).grantReadWriteData(
        this.function,
      );
    }

    // A job may add further jobs, which needs the same rights as the API.
    scheduler.scheduleGroup.grantWriteSchedules(this.function);
    scheduler.role.grantPassRole(this.function.grantPrincipal);
    queue.grantSendMessages(this.function);
  }
}
