import { CfnOutput, RemovalPolicy, Stack } from "aws-cdk-lib";
import type { StackProps } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";
import { FilesBucket } from "./FilesBucket";

export type Stage = "local" | "aws";

export interface FilesStackProps extends StackProps {
  stage: Stage;
  // Origins the web app is served from, for the bucket's CORS.
  allowedOrigins: string[];
}

// The same stack deploys to LocalStack (cdklocal) and AWS (cdk); the stage
// only toggles stage-specific settings.
export class FilesStack extends Stack {
  constructor(scope: Construct, id: string, props: FilesStackProps) {
    super(scope, id, props);

    // Locally, `cdklocal destroy` should leave nothing behind; on AWS, keep
    // uploaded files if the stack is ever deleted.
    const removalPolicy =
      props.stage === "local" ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN;

    const { bucket } = new FilesBucket(this, "FilesBucket", {
      allowedOrigins: props.allowedOrigins,
      removalPolicy,
    });

    // The API doesn't run on AWS, so there's no role here to grant to. Attach
    // this policy to whichever user or role the API's credentials belong to.
    // The API signs PutObject and GetObject URLs, for the browser to upload
    // and download itself, and lists the bucket's keys.
    const accessPolicy = new iam.ManagedPolicy(this, "FilesAccessPolicy", {
      statements: [
        new iam.PolicyStatement({
          actions: ["s3:PutObject", "s3:GetObject"],
          resources: [bucket.arnForObjects("*")],
        }),
        new iam.PolicyStatement({
          actions: ["s3:ListBucket"],
          resources: [bucket.bucketArn],
        }),
      ],
    });

    // Every app reads the bucket's name as FILES_BUCKET_NAME (see the README).
    new CfnOutput(this, "FilesBucketName", { value: bucket.bucketName });
    new CfnOutput(this, "FilesAccessPolicyArn", {
      value: accessPolicy.managedPolicyArn,
    });
  }
}
