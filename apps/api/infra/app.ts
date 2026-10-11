import { App } from "aws-cdk-lib";
import { ApiStack, type Stage } from "./ApiStack";

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

new ApiStack(app, "Api", { stage, allowedOrigins });
