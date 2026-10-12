import { Stack } from "aws-cdk-lib";
import type { StackProps } from "aws-cdk-lib";
import type { Construct } from "constructs";
import {
  JOB_WORKER_MAX_TIMEOUT,
  ResourceAccess,
  SharedResources,
} from "@repo/core/infra";
import { JobWorker } from "./JobWorker";

export type Stage = "local" | "aws";

export interface JobsStackProps extends StackProps {
  stage: Stage;
}

// The job worker's runtime. The queue, scheduler and everything else it uses
// live in core's Resources stack, which must be deployed first. The same
// stack deploys to LocalStack (cdklocal) and AWS (cdk); the stage only
// toggles stage-specific settings.
export class JobsStack extends Stack {
  constructor(scope: Construct, id: string, props: JobsStackProps) {
    super(scope, id, props);

    const resources = new SharedResources(this, "Resources");

    const worker = new JobWorker(this, "JobWorker", {
      queue: resources.jobQueue.queue,
      timeout: JOB_WORKER_MAX_TIMEOUT,
      environment:
        props.stage === "local" ? { NODE_ENV: "development" } : undefined,
    });

    new ResourceAccess(this, "WorkerAccess", {
      function: worker.function,
      accesses: [
        resources.users.readWrite,
        // A job may add further jobs.
        resources.jobQueue.addJobs,
        resources.files.reference,
        resources.identity.reference,
      ],
    });
  }
}
