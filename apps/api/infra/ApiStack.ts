import { CfnOutput, Duration, Stack } from "aws-cdk-lib";
import type { StackProps } from "aws-cdk-lib";
import type { Construct } from "constructs";
import { ApiFunction, type TableNames } from "./ApiFunction";

export type Stage = "local" | "aws";

export interface ApiStackProps extends StackProps {
  stage: Stage;
  tableNames: TableNames;
  allowedOrigins: string[];
}

// The same stack deploys to LocalStack (cdklocal) and AWS (cdk); the stage
// only toggles stage-specific settings.
export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const api = new ApiFunction(this, "Api", {
      tableNames: props.tableNames,
      timeout: Duration.seconds(30),
      allowedOrigins: props.allowedOrigins,
      // tRPC puts stack traces in error responses unless NODE_ENV is
      // "production".
      environment: {
        NODE_ENV: props.stage === "local" ? "development" : "production",
      },
    });

    // The web app's VITE_API_URL (see the README).
    new CfnOutput(this, "ApiUrl", { value: api.url.url });
  }
}
