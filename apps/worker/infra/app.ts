import { App } from "aws-cdk-lib";
import { JobsStack, type Stage } from "./JobsStack";
import type { TableNames } from "./JobWorker";

const STAGES: Stage[] = ["local", "aws"];

const app = new App();

const stage = app.node.tryGetContext("stage");
if (!STAGES.includes(stage)) {
  throw new Error(
    `Pass --context stage=<${STAGES.join("|")}> (got ${String(stage)})`,
  );
}

// The DynamoDB tables the worker may access, keyed by the env var each name is
// passed in. cdk.json has none yet; override with --context tableNames='{...}'.
const tableNames = app.node.tryGetContext("tableNames") as TableNames;

new JobsStack(app, "Jobs", {
  stage,
  tableNames,
});
