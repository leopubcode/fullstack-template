import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import { ENV } from "../src/config";
import { PARAMETERS } from "./parameters";
import type { Access } from "./ResourceAccess";

// The Resources stack's resources, looked up from its SSM parameters by an
// app stack, with the ways an app may use each. Every access matches one
// section of core's config (src/config.ts).
export class SharedResources extends Construct {
  readonly users: { readWrite: Access };
  readonly jobQueue: { queue: sqs.IQueue; addJobs: Access };
  readonly files: { upload: Access; reference: Access };

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const parameter = (name: keyof typeof PARAMETERS) =>
      ssm.StringParameter.valueForStringParameter(this, PARAMETERS[name]);

    const usersTable = dynamodb.Table.fromTableName(
      this,
      "UsersTable",
      parameter("usersTableName"),
    );
    this.users = {
      readWrite: {
        env: { [ENV.usersTableName]: usersTable.tableName },
        grant: (grantee) => usersTable.grantReadWriteData(grantee),
      },
    };

    const queue = sqs.Queue.fromQueueAttributes(this, "JobQueue", {
      queueArn: parameter("jobQueueArn"),
      queueUrl: parameter("jobQueueUrl"),
    });
    const scheduleGroup = scheduler.ScheduleGroup.fromScheduleGroupName(
      this,
      "JobScheduleGroup",
      parameter("jobScheduleGroupName"),
    );
    const schedulerRole = iam.Role.fromRoleArn(
      this,
      "JobSchedulerRole",
      parameter("jobSchedulerRoleArn"),
      { mutable: false },
    );
    this.jobQueue = {
      queue,
      // Adding a job sends it to the queue, or schedules it when it has a
      // runAt.
      addJobs: {
        env: {
          [ENV.jobQueueArn]: queue.queueArn,
          [ENV.jobQueueUrl]: queue.queueUrl,
          [ENV.jobScheduleGroupName]: scheduleGroup.scheduleGroupName,
          [ENV.jobSchedulerRoleArn]: schedulerRole.roleArn,
        },
        grant: (grantee) => {
          queue.grantSendMessages(grantee);
          scheduleGroup.grantWriteSchedules(grantee);
          schedulerRole.grantPassRole(grantee.grantPrincipal);
        },
      },
    };

    const filesBucket = s3.Bucket.fromBucketAttributes(this, "FilesBucket", {
      bucketName: parameter("filesBucketName"),
      bucketArn: parameter("filesBucketArn"),
    });
    const filesEnv = { [ENV.filesBucketName]: filesBucket.bucketName };
    this.files = {
      // Signing a presigned PUT URL needs the right to put the object.
      upload: {
        env: filesEnv,
        grant: (grantee) => filesBucket.grantPut(grantee),
      },
      // The bucket's name only, for a Lambda whose config requires it but
      // which never touches the bucket.
      reference: { env: filesEnv, grant: () => {} },
    };
  }
}
