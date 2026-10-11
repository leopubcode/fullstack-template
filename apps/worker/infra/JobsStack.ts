import { CfnOutput, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import type { StackProps } from "aws-cdk-lib";
import type { Construct } from "constructs";
import { JobQueue } from "./JobQueue";
import { JobScheduler } from "./JobScheduler";
import { JobWorker, type TableNames } from "./JobWorker";

export type Stage = "local" | "aws";

export interface JobsStackProps extends StackProps {
  stage: Stage;
  tableNames: TableNames;
}

const WORKER_TIMEOUT = Duration.seconds(30);

// The same stack deploys to LocalStack
// (cdklocal) and AWS (cdk); the stage only toggles stage-specific settings.
export class JobsStack extends Stack {
  constructor(scope: Construct, id: string, props: JobsStackProps) {
    super(scope, id, props);

    // Locally, `cdklocal destroy` should leave nothing behind; on AWS, keep
    // queued jobs and schedules if the stack is ever deleted.
    const removalPolicy =
      props.stage === "local" ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN;

    const { queue } = new JobQueue(this, "JobQueue", {
      visibilityTimeout: Duration.seconds(WORKER_TIMEOUT.toSeconds() * 6),
      removalPolicy,
    });
    const scheduler = new JobScheduler(this, "JobScheduler", {
      queue,
      removalPolicy,
    });
    new JobWorker(this, "JobWorker", {
      queue,
      scheduler,
      tableNames: props.tableNames,
      timeout: WORKER_TIMEOUT,
      environment:
        props.stage === "local"
          ? {
              NODE_ENV: "development",
            }
          : {},
    });

    // The API's and the local scheduler's env take these (see the README).
    new CfnOutput(this, "JobQueueArn", { value: queue.queueArn });
    new CfnOutput(this, "JobQueueUrl", { value: queue.queueUrl });
    new CfnOutput(this, "JobScheduleGroupName", {
      value: scheduler.scheduleGroup.scheduleGroupName,
    });
    new CfnOutput(this, "JobSchedulerRoleArn", {
      value: scheduler.role.roleArn,
    });
  }
}
