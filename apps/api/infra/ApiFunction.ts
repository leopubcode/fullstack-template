import { fileURLToPath } from "node:url";
import type { Duration } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export interface ApiFunctionProps {
  timeout: Duration;
  // Origins allowed to call the API from a browser.
  allowedOrigins: string[];
  // Stage-specific env, e.g. development settings on LocalStack.
  environment?: Record<string, string>;
}

// The Lambda that serves the tRPC router, src/lambda.ts already bundled into
// dist/ by `npm run build`, behind a public Function URL. What it may use is
// granted by the stack's ResourceAccess.
export class ApiFunction extends Construct {
  readonly function: lambda.Function;
  readonly url: lambda.FunctionUrl;

  constructor(scope: Construct, id: string, props: ApiFunctionProps) {
    super(scope, id);

    this.function = new lambda.Function(this, "Function", {
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      handler: "lambda.handler",
      code: lambda.Code.fromAsset(
        fileURLToPath(new URL("../dist", import.meta.url)),
      ),
      timeout: props.timeout,
      memorySize: 512,
      environment: props.environment,
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
  }
}
