// Dev only. Creates the user pool and client the API signs users up and in
// with on cognito-local (docker-compose), mirroring infra/resources/UserPool.ts.
// Writes their ids to cdk.context.json for core's `cdk:deploy:local`, and
// prints the env lines apps/api/.env needs. Run with
// `npm run setup:cognito-local` after `docker compose up -d`.
import { readFile, writeFile } from "node:fs/promises";
import {
  CognitoIdentityProviderClient,
  CreateUserPoolClientCommand,
  CreateUserPoolCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { ENV } from "../src/config";

const ENDPOINT = process.env.COGNITO_LOCAL_URL ?? "http://localhost:9229";
const CONTEXT_FILE = new URL("../cdk.context.json", import.meta.url);

// cognito-local ignores credentials, but the SDK needs some to sign with.
const client = new CognitoIdentityProviderClient({
  endpoint: ENDPOINT,
  region: "us-east-1",
  credentials: { accessKeyId: "local", secretAccessKey: "local" },
});

const { UserPool } = await client.send(
  new CreateUserPoolCommand({
    PoolName: "local",
    UsernameAttributes: ["email"],
    AutoVerifiedAttributes: ["email"],
  }),
);
const { UserPoolClient } = await client.send(
  new CreateUserPoolClientCommand({
    UserPoolId: UserPool!.Id!,
    ClientName: "api",
    GenerateSecret: false,
    ExplicitAuthFlows: ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
  }),
);

const userPoolId = UserPool!.Id!;
const clientId = UserPoolClient!.ClientId!;
const issuerUrl = `${ENDPOINT}/${userPoolId}`;

const context = await readFile(CONTEXT_FILE, "utf8").then(
  (text) => JSON.parse(text) as Record<string, unknown>,
  () => ({}),
);
await writeFile(
  CONTEXT_FILE,
  `${JSON.stringify(
    {
      ...context,
      cognitoLocalUserPoolId: userPoolId,
      cognitoLocalClientId: clientId,
      cognitoLocalIssuerUrl: issuerUrl,
    },
    null,
    2,
  )}\n`,
);

console.log(`Wrote the pool's ids to packages/core/cdk.context.json.

Add to apps/api/.env:

${ENV.cognitoUserPoolId}=${userPoolId}
${ENV.cognitoClientId}=${clientId}
${ENV.cognitoIssuerUrl}=${issuerUrl}`);
