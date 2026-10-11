// Dev only. Serves the API Lambda's handler over plain HTTP on :4000, turning
// each request into the Function URL event the Lambda would get, so the web
// app can run against it without deploying. Run with `npm run dev` (reads .env).
import { createServer, type IncomingMessage } from "node:http";
import type { APIGatewayProxyEventV2, Context } from "aws-lambda";
import {
  createAwsStorage,
  createServices,
  createSystemClock,
  loadConfig,
} from "@repo/core";
import { createHandler } from "../src/createHandler";

const PORT = 4000;

const config = loadConfig(process.env);
const clock = createSystemClock();
const handler = createHandler({
  clock,
  services: createServices(createAwsStorage(config, clock), clock),
});

// What the Function URL's CORS config adds on AWS (see infra/ApiFunction.ts).
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST",
  "access-control-allow-headers": "*",
};

async function toEvent(req: IncomingMessage): Promise<APIGatewayProxyEventV2> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      headers[key] = Array.isArray(value) ? value.join(", ") : value;
    }
  }
  return {
    version: "2.0",
    routeKey: "$default",
    rawPath: url.pathname,
    rawQueryString: url.search.slice(1),
    headers,
    body: chunks.length ? Buffer.concat(chunks).toString("base64") : undefined,
    isBase64Encoded: true,
    requestContext: {
      domainName: url.host,
      http: { method: req.method ?? "GET", path: url.pathname },
    },
  } as APIGatewayProxyEventV2;
}

createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS).end();
    return;
  }
  try {
    const result = await handler(await toEvent(req), {} as Context);
    res.writeHead(result.statusCode ?? 200, {
      ...result.headers,
      ...CORS_HEADERS,
      ...(result.cookies?.length && { "set-cookie": result.cookies }),
    });
    res.end(result.body);
  } catch (error) {
    console.error(`${req.method} ${req.url} failed`, error);
    res.writeHead(500, CORS_HEADERS).end();
  }
}).listen(PORT, () => console.log(`listening on :${PORT}`));
