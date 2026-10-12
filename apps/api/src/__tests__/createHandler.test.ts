import type { APIGatewayProxyEventV2, Context } from "aws-lambda";
import { describe, expect, it } from "vitest";
import {
  createInMemoryStorage,
  createServices,
  createSystemClock,
} from "@repo/core";
import { createHandler } from "../createHandler";

function functionUrlEvent(
  method: string,
  rawPath: string,
  rawQueryString = "",
  headers: Record<string, string> = {},
): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "$default",
    rawPath,
    rawQueryString,
    headers: { host: "abc.lambda-url.us-east-1.on.aws", ...headers },
    isBase64Encoded: false,
    requestContext: {
      domainName: "abc.lambda-url.us-east-1.on.aws",
      http: { method, path: rawPath },
    },
  } as unknown as APIGatewayProxyEventV2;
}

describe("createHandler", () => {
  const clock = createSystemClock();
  const storage = createInMemoryStorage(clock);
  const handler = createHandler({
    clock,
    services: createServices(storage, clock),
  });

  it("runs the procedure named by the path", async () => {
    const input = encodeURIComponent(JSON.stringify({ name: "x" }));

    const result = await handler(
      functionUrlEvent("GET", "/userList", `input=${input}`),
      {} as Context,
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body!)).toEqual({
      result: { data: await storage.users.list() },
    });
  });

  it("answers 404 for an unknown procedure", async () => {
    const result = await handler(
      functionUrlEvent("GET", "/nope"),
      {} as Context,
    );

    expect(result.statusCode).toBe(404);
  });

  it("authenticates the caller from the Authorization header", async () => {
    const services = createServices(storage, clock);
    const ada = {
      email: "ada@example.com",
      password: "correct-horse",
      displayName: "Ada",
    };
    await services.auth.signUp(ada);
    await services.auth.confirmSignUp({
      email: ada.email,
      code: storage.identity.codeFor(ada.email)!,
    });
    const session = await services.auth.signIn(ada);

    const result = await handler(
      functionUrlEvent("GET", "/auth.me", "", {
        authorization: `Bearer ${session.accessToken}`,
      }),
      {} as Context,
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body!).result.data).toEqual(session.user);
  });

  it("answers 401 to a protected procedure without a token", async () => {
    const result = await handler(
      functionUrlEvent("GET", "/auth.me"),
      {} as Context,
    );

    expect(result.statusCode).toBe(401);
  });
});
