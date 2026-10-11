import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda";
import { type AppContext, appRouter } from "@repo/core";

// Adapts the tRPC router to a Lambda Function URL, whose events use the API
// Gateway v2 payload. The procedure is the whole path, so clients point at the
// URL's root: POST https://<id>.lambda-url.<region>.on.aws/submitTestJob.
export function createHandler(context: AppContext) {
  return awsLambdaRequestHandler<typeof appRouter, APIGatewayProxyEventV2>({
    router: appRouter,
    createContext: () => context,
    onError: ({ path, error }) => {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        console.error(`tRPC ${path ?? "<no path>"} failed`, error);
      }
    },
  });
}
