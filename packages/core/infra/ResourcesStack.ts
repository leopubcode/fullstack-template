import { CfnOutput, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import type { StackProps } from "aws-cdk-lib";
import * as ssm from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";
import { PARAMETERS } from "./parameters";
import { FilesBucket } from "./resources/FilesBucket";
import { JobQueue } from "./resources/JobQueue";
import { JobScheduler } from "./resources/JobScheduler";
import { UserPool } from "./resources/UserPool";
import { UsersTable } from "./resources/UsersTable";

export type Stage = "local" | "aws";

// The longest a job worker may run per batch. The queue hides a received
// message for six times this, as AWS recommends for an SQS event source, so a
// worker must not set a longer timeout.
export const JOB_WORKER_MAX_TIMEOUT = Duration.seconds(30);

export interface ResourcesStackProps extends StackProps {
  stage: Stage;
  // Origins the web app is served from, allowed to upload to the files bucket.
  allowedOrigins: string[];
  // Locally, the identity provider is cognito-local, which LocalStack can't
  // host: pass the pool it created (scripts/setup-cognito-local.sh) instead.
  // Required on the local stage, ignored on AWS.
  localUserPool?: ExistingUserPool;
}

export interface ExistingUserPool {
  userPoolId: string;
  clientId: string;
  issuerUrl: string;
}

// Every stateful resource the apps share. It knows nothing about who uses
// them: each app stack looks them up through SharedResources and grants its
// own Lambda access with ResourceAccess. The same stack deploys to LocalStack
// (cdklocal) and AWS (cdk); the stage only toggles stage-specific settings.
export class ResourcesStack extends Stack {
  constructor(scope: Construct, id: string, props: ResourcesStackProps) {
    super(scope, id, props);

    // Locally, `cdklocal destroy` should leave nothing behind; on AWS, keep
    // data, queued jobs and schedules if the stack is ever deleted.
    const removalPolicy =
      props.stage === "local" ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN;

    const { table: usersTable } = new UsersTable(this, "UsersTable", {
      removalPolicy,
    });
    const { queue } = new JobQueue(this, "JobQueue", {
      visibilityTimeout: Duration.seconds(
        JOB_WORKER_MAX_TIMEOUT.toSeconds() * 6,
      ),
      removalPolicy,
    });
    const scheduler = new JobScheduler(this, "JobScheduler", {
      queue,
      removalPolicy,
    });
    const { bucket: filesBucket } = new FilesBucket(this, "FilesBucket", {
      allowedOrigins: props.allowedOrigins,
      removalPolicy,
    });

    const userPool = userPoolFor(this, props, removalPolicy);

    const values: Record<keyof typeof PARAMETERS, string> = {
      usersTableName: usersTable.tableName,
      jobQueueArn: queue.queueArn,
      jobQueueUrl: queue.queueUrl,
      jobScheduleGroupName: scheduler.scheduleGroup.scheduleGroupName,
      jobSchedulerRoleArn: scheduler.role.roleArn,
      filesBucketName: filesBucket.bucketName,
      filesBucketArn: filesBucket.bucketArn,
      userPoolId: userPool.userPoolId,
      userPoolClientId: userPool.clientId,
      userPoolIssuerUrl: userPool.issuerUrl,
    };
    for (const [key, value] of Object.entries(values)) {
      new ssm.StringParameter(this, `${key}Parameter`, {
        parameterName: PARAMETERS[key as keyof typeof PARAMETERS],
        stringValue: value,
      });
    }

    // For local env files (see the README): the API's dev server and the
    // local scheduler read these from packages/core/cdk-outputs.json.
    new CfnOutput(this, "UsersTableName", { value: usersTable.tableName });
    new CfnOutput(this, "JobQueueArn", { value: queue.queueArn });
    new CfnOutput(this, "JobQueueUrl", { value: queue.queueUrl });
    new CfnOutput(this, "JobScheduleGroupName", {
      value: scheduler.scheduleGroup.scheduleGroupName,
    });
    new CfnOutput(this, "JobSchedulerRoleArn", {
      value: scheduler.role.roleArn,
    });
    new CfnOutput(this, "FilesBucketName", { value: filesBucket.bucketName });
    new CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new CfnOutput(this, "UserPoolClientId", { value: userPool.clientId });
    new CfnOutput(this, "UserPoolIssuerUrl", { value: userPool.issuerUrl });
  }
}

// A Cognito user pool on AWS. Locally, the cognito-local pool passed in.
function userPoolFor(
  scope: Construct,
  props: ResourcesStackProps,
  removalPolicy: RemovalPolicy,
): ExistingUserPool {
  if (props.stage === "local") {
    if (!props.localUserPool) {
      throw new Error(
        "The local stage needs localUserPool (see scripts/setup-cognito-local.sh)",
      );
    }
    return props.localUserPool;
  }
  const { userPool, client, issuerUrl } = new UserPool(scope, "UserPool", {
    removalPolicy,
  });
  return {
    userPoolId: userPool.userPoolId,
    clientId: client.userPoolClientId,
    issuerUrl,
  };
}
