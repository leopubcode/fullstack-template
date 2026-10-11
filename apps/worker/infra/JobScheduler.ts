import type { RemovalPolicy } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import type * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

export interface JobSchedulerProps {
  queue: sqs.IQueue;
  removalPolicy: RemovalPolicy;
}

// Where AwsJobQueueClient creates a one-time schedule for each job with a
// runAt, and the role those schedules use to send the job to the queue.
export class JobScheduler extends Construct {
  readonly scheduleGroup: scheduler.ScheduleGroup;
  readonly role: iam.Role;

  constructor(scope: Construct, id: string, props: JobSchedulerProps) {
    super(scope, id);

    this.scheduleGroup = new scheduler.ScheduleGroup(this, "ScheduleGroup", {
      removalPolicy: props.removalPolicy,
    });

    this.role = new iam.Role(this, "Role", {
      assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
    });
    props.queue.grantSendMessages(this.role);
  }
}
