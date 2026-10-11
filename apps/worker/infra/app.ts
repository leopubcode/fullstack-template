import { App } from "aws-cdk-lib";
import { JobsStack, type Stage } from "./JobsStack";

const STAGES: Stage[] = ["local", "aws"];

const app = new App();

const stage = app.node.tryGetContext("stage");
if (!STAGES.includes(stage)) {
  throw new Error(
    `Pass --context stage=<${STAGES.join("|")}> (got ${String(stage)})`,
  );
}

new JobsStack(app, "Jobs", { stage });
