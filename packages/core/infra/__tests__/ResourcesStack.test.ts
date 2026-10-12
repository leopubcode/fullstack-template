import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { PARAMETERS } from "../parameters";
import { ResourcesStack } from "../ResourcesStack";

const template = (stage: "local" | "aws") =>
  Template.fromStack(
    new ResourcesStack(new App(), "Resources", {
      stage,
      allowedOrigins: ["https://app.example.com"],
      localUserPool: {
        userPoolId: "local_pool",
        clientId: "local-client",
        issuerUrl: "http://localhost:9229/local_pool",
      },
    }),
  );

describe("the Resources stack", () => {
  it("creates the users table keyed by id", () => {
    template("local").hasResourceProperties("AWS::DynamoDB::Table", {
      KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST",
    });
  });

  it("creates the job queue, its dead-letter queue and the schedule group", () => {
    const t = template("local");
    t.resourceCountIs("AWS::SQS::Queue", 2);
    t.hasResourceProperties("AWS::SQS::Queue", { VisibilityTimeout: 180 });
    t.resourceCountIs("AWS::Scheduler::ScheduleGroup", 1);
  });

  it("lets the web app's origins PUT to the files bucket", () => {
    template("local").hasResourceProperties("AWS::S3::Bucket", {
      CorsConfiguration: {
        CorsRules: [
          {
            AllowedMethods: ["PUT"],
            AllowedOrigins: ["https://app.example.com"],
          },
        ],
      },
    });
  });

  it.each(["local", "aws"] as const)(
    "writes one SSM parameter per shared value (%s)",
    (stage) => {
      const names = Object.values(
        template(stage).findResources("AWS::SSM::Parameter"),
      ).map((resource) => resource.Properties.Name);

      expect(names.sort()).toEqual(Object.values(PARAMETERS).sort());
    },
  );

  it("creates a user pool with a public password-flow client on AWS", () => {
    const t = template("aws");
    t.hasResourceProperties("AWS::Cognito::UserPool", {
      UsernameAttributes: ["email"],
      AutoVerifiedAttributes: ["email"],
    });
    t.hasResourceProperties("AWS::Cognito::UserPoolClient", {
      GenerateSecret: false,
      ExplicitAuthFlows: Match.arrayWith([
        "ALLOW_USER_PASSWORD_AUTH",
        "ALLOW_REFRESH_TOKEN_AUTH",
      ]),
    });
  });

  it("publishes the cognito-local pool instead of creating one locally", () => {
    const t = template("local");
    t.resourceCountIs("AWS::Cognito::UserPool", 0);
    t.hasResourceProperties("AWS::SSM::Parameter", {
      Name: PARAMETERS.userPoolIssuerUrl,
      Value: "http://localhost:9229/local_pool",
    });
  });

  it("retains data on AWS and destroys it locally", () => {
    template("aws").hasResource("AWS::DynamoDB::Table", {
      DeletionPolicy: "Retain",
    });
    template("local").hasResource("AWS::DynamoDB::Table", {
      DeletionPolicy: "Delete",
    });
  });
});
