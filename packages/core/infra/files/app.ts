import { App } from "aws-cdk-lib";
import { FilesStack, type Stage } from "./FilesStack";

const STAGES: Stage[] = ["local", "aws"];

const app = new App();

const stage = app.node.tryGetContext("stage");
if (!STAGES.includes(stage)) {
  throw new Error(
    `Pass --context stage=<${STAGES.join("|")}> (got ${String(stage)})`,
  );
}

// Origins the web app is served from, passed to the files bucket's CORS
// config. Override with --context allowedOrigins='["https://app.example.com"]'.
const allowedOrigins = (app.node.tryGetContext("allowedOrigins") as
  string[] | undefined) ?? ["http://localhost:5173"];

new FilesStack(app, "Files", {
  stage,
  allowedOrigins,
});
