import { Duration, RemovalPolicy } from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

export interface JobQueueProps {
  // At least the worker's timeout; AWS recommends six times it for an SQS
  // event source.
  visibilityTimeout: Duration;
  removalPolicy: RemovalPolicy;
}

// The SQS queue jobs are sent to, with a dead-letter queue for jobs that keep
// failing and an alarm as soon as one lands there.
export class JobQueue extends Construct {
  readonly queue: sqs.Queue;
  readonly deadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: JobQueueProps) {
    super(scope, id);

    this.deadLetterQueue = new sqs.Queue(this, "DeadLetterQueue", {
      retentionPeriod: Duration.days(14),
      removalPolicy: props.removalPolicy,
    });

    this.queue = new sqs.Queue(this, "Queue", {
      visibilityTimeout: props.visibilityTimeout,
      deadLetterQueue: { queue: this.deadLetterQueue, maxReceiveCount: 5 },
      removalPolicy: props.removalPolicy,
    });

    // No notification target yet: the alarm only shows in CloudWatch.
    new cloudwatch.Alarm(this, "DeadLetterQueueAlarm", {
      alarmDescription: "A job failed 5 times and is in the dead-letter queue.",
      metric: this.deadLetterQueue.metricApproximateNumberOfMessagesVisible({
        period: Duration.minutes(1),
        statistic: cloudwatch.Stats.MAXIMUM,
      }),
      threshold: 1,
      comparisonOperator:
        cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  }
}
