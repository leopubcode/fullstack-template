import { CfnOutput, Duration, Stack } from "aws-cdk-lib";
import type { StackProps } from "aws-cdk-lib";
import type { Construct } from "constructs";
import { ResourceAccess, SharedResources } from "@repo/core/infra";
import { ApiFunction } from "./ApiFunction";

export type Stage = "local" | "aws";

export interface ApiStackProps extends StackProps {
  stage: Stage;
  allowedOrigins: string[];
}

// The API's runtime. The resources it uses live in core's Resources stack,
// which must be deployed first. The same stack deploys to LocalStack
// (cdklocal) and AWS (cdk); the stage only toggles stage-specific settings.
export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const resources = new SharedResources(this, "Resources");

    const api = new ApiFunction(this, "Api", {
      timeout: Duration.seconds(30),
      allowedOrigins: props.allowedOrigins,
      // tRPC puts stack traces in error responses unless NODE_ENV is
      // "production".
      environment:
        props.stage === "local"
          ? {
              NODE_ENV: "development",
              // Presigned URLs must name a host both this Lambda and the
              // browser resolve to LocalStack (see s3ClientInstance.ts).
              AWS_ENDPOINT_URL_S3: "http://s3.localhost.localstack.cloud:4566",
            }
          : { NODE_ENV: "production" },
    });

    new ResourceAccess(this, "ApiAccess", {
      function: api.function,
      accesses: [
        resources.users.readWrite,
        resources.jobQueue.addJobs,
        resources.files.upload,
      ],
    });

    // The web app's VITE_API_URL (see the README).
    new CfnOutput(this, "ApiUrl", { value: api.url.url });
  }
}
