import { fileURLToPath } from "node:url";
import { Fn } from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import * as sqs from "aws-cdk-lib/aws-sqs";
import type { Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import { FILES_EXPORTS } from "./filesExports";
import { JOBS_EXPORTS } from "./jobsExports";

// The env var each table's name is passed in, as the services read it.
export interface TableNames {
  USERS_TABLE_NAME: string;
}

export interface ApiFunctionProps {
  tableNames: TableNames;
  timeout: Duration;
  // Origins allowed to call the API from a browser.
  allowedOrigins: string[];
  // Stage-specific env, e.g. development settings on LocalStack.
  environment?: Record<string, string>;
}

// The Lambda that serves the tRPC router, src/lambda.ts already bundled into
// dist/ by `npm run build`, behind a public Function URL.
export class ApiFunction extends Construct {
  readonly function: lambda.Function;
  readonly url: lambda.FunctionUrl;

  constructor(scope: Construct, id: string, props: ApiFunctionProps) {
    super(scope, id);

    const { tableNames } = props;

    const queue = sqs.Queue.fromQueueAttributes(this, "JobQueue", {
      queueArn: Fn.importValue(JOBS_EXPORTS.queueArn),
      queueUrl: Fn.importValue(JOBS_EXPORTS.queueUrl),
    });
    const scheduleGroup = scheduler.ScheduleGroup.fromScheduleGroupName(
      this,
      "JobScheduleGroup",
      Fn.importValue(JOBS_EXPORTS.scheduleGroupName),
    );
    const schedulerRole = iam.Role.fromRoleArn(
      this,
      "JobSchedulerRole",
      Fn.importValue(JOBS_EXPORTS.schedulerRoleArn),
      { mutable: false },
    );
    const filesBucket = s3.Bucket.fromBucketAttributes(this, "FilesBucket", {
      bucketName: Fn.importValue(FILES_EXPORTS.bucketName),
      bucketArn: Fn.importValue(FILES_EXPORTS.bucketArn),
    });

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
        JOB_SCHEDULE_GROUP_NAME: scheduleGroup.scheduleGroupName,
        JOB_SCHEDULER_ROLE_ARN: schedulerRole.roleArn,
        FILES_BUCKET_NAME: filesBucket.bucketName,
      },
    });

    // No auth yet: anyone with the URL can call every procedure.
    this.url = this.function.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: props.allowedOrigins,
        allowedMethods: [lambda.HttpMethod.GET, lambda.HttpMethod.POST],
        allowedHeaders: ["*"],
      },
    });

    // The stack doesn't own the tables; it only grants access to them.
    for (const [envName, tableName] of Object.entries(tableNames)) {
      dynamodb.Table.fromTableName(this, envName, tableName).grantReadWriteData(
        this.function,
      );
    }

    // Adding a job sends it to the queue, or schedules it when it has a runAt.
    queue.grantSendMessages(this.function);
    scheduleGroup.grantWriteSchedules(this.function);
    schedulerRole.grantPassRole(this.function.grantPrincipal);

    // Only needed to sign PutObject URLs; the function never uploads itself.
    filesBucket.grantPut(this.function);
  }
}
