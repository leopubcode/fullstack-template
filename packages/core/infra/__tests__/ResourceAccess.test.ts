import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { describe, expect, it } from "vitest";
import { ENV } from "../../src/config";
import { type Access, ResourceAccess } from "../ResourceAccess";
import { SharedResources } from "../SharedResources";

// A stack with one Lambda given these accesses, and its synthesized template.
function synth(pick: (resources: SharedResources) => Access[]): Template {
  const stack = new Stack(new App(), "Test");
  const resources = new SharedResources(stack, "Resources");
  const fn = new lambda.Function(stack, "Function", {
    runtime: lambda.Runtime.NODEJS_24_X,
    handler: "index.handler",
    code: lambda.Code.fromInline("exports.handler = async () => {}"),
  });
  new ResourceAccess(stack, "Access", {
    function: fn,
    accesses: pick(resources),
  });
  return Template.fromStack(stack);
}

const envOf = (template: Template): Record<string, unknown> => {
  const [fn] = Object.values(template.findResources("AWS::Lambda::Function"));
  return fn!.Properties.Environment?.Variables ?? {};
};

const actionsOf = (template: Template): string[] =>
  Object.values(template.findResources("AWS::IAM::Policy")).flatMap((policy) =>
    policy.Properties.PolicyDocument.Statement.flatMap(
      (statement: { Action: string | string[] }) => statement.Action,
    ),
  );

describe("granting a Lambda access to shared resources", () => {
  it("sets the env var core reads for each access", () => {
    const env = envOf(
      synth((r) => [
        r.users.readWrite,
        r.jobQueue.addJobs,
        r.files.upload,
        r.identity.authenticate,
      ]),
    );

    expect(Object.keys(env).sort()).toEqual(Object.values(ENV).sort());
  });

  it("reads each value from the Resources stack's SSM parameters", () => {
    const template = synth((r) => [r.users.readWrite]);

    template.hasParameter("*", {
      Type: "AWS::SSM::Parameter::Value<String>",
      Default: "/resources/users-table-name",
    });
    expect(Object.keys(template.findOutputs("*"))).toEqual([]);
    expect(JSON.stringify(template.toJSON())).not.toContain("Fn::ImportValue");
  });

  it("grants what adding jobs needs", () => {
    const actions = actionsOf(synth((r) => [r.jobQueue.addJobs]));

    expect(actions).toEqual(
      expect.arrayContaining([
        "sqs:SendMessage",
        "scheduler:CreateSchedule",
        "iam:PassRole",
      ]),
    );
  });

  it("grants putting objects for uploads", () => {
    synth((r) => [r.files.upload]).hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(["s3:PutObject"]),
          }),
        ]),
      },
    });
  });

  it("grants nothing for a reference, only the env var", () => {
    const template = synth((r) => [r.files.reference]);

    expect(Object.keys(envOf(template))).toEqual([ENV.filesBucketName]);
    template.resourceCountIs("AWS::IAM::Policy", 0);
  });

  it("grants nothing to authenticate users, only the pool's env vars", () => {
    const template = synth((r) => [r.identity.authenticate]);

    expect(Object.keys(envOf(template)).sort()).toEqual(
      [ENV.cognitoClientId, ENV.cognitoIssuerUrl, ENV.cognitoUserPoolId].sort(),
    );
    template.resourceCountIs("AWS::IAM::Policy", 0);
  });
});
