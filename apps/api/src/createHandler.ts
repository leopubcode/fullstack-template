import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda";
import { type AppContext, appRouter } from "@repo/core";

// Adapts the tRPC router to a Lambda Function URL, whose events use the API
// Gateway v2 payload. The procedure is the whole path, so clients point at the
// URL's root: POST https://<id>.lambda-url.<region>.on.aws/submitTestJob.
// Each request's context carries the bearer token from its Authorization
// header, if any.
export function createHandler(context: Omit<AppContext, "accessToken">) {
  return awsLambdaRequestHandler<typeof appRouter, APIGatewayProxyEventV2>({
    router: appRouter,
    createContext: ({ event }) => ({
      ...context,
      accessToken: bearerToken(event.headers.authorization),
    }),
    onError: ({ path, error }) => {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        console.error(`tRPC ${path ?? "<no path>"} failed`, error);
      }
    },
  });
}

function bearerToken(header: string | undefined): string | undefined {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1];
}
