import { App } from "aws-cdk-lib";
import { ResourcesStack, type Stage } from "./ResourcesStack";

const STAGES: Stage[] = ["local", "aws"];

const app = new App();

const stage = app.node.tryGetContext("stage");
if (!STAGES.includes(stage)) {
  throw new Error(
    `Pass --context stage=<${STAGES.join("|")}> (got ${String(stage)})`,
  );
}

// Origins the web app is served from. Override with
// --context allowedOrigins='["https://app.example.com"]'.
const allowedOrigins = (app.node.tryGetContext("allowedOrigins") as
  string[] | undefined) ?? ["http://localhost:5173"];

// The cognito-local pool, printed by scripts/setup-cognito-local.sh. Only the
// local stage reads it.
const localUserPool =
  stage === "local"
    ? {
        userPoolId: requireContext("cognitoLocalUserPoolId"),
        clientId: requireContext("cognitoLocalClientId"),
        issuerUrl: requireContext("cognitoLocalIssuerUrl"),
      }
    : undefined;

new ResourcesStack(app, "Resources", { stage, allowedOrigins, localUserPool });

function requireContext(key: string): string {
  const value: unknown = app.node.tryGetContext(key);
  if (typeof value !== "string" || !value) {
    throw new Error(
      `Pass --context ${key}=<value> (see scripts/setup-cognito-local.sh)`,
    );
  }
  return value;
}
