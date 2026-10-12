import type { RemovalPolicy } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface FilesBucketProps {
  // Origins the browser may PUT directly to a presigned upload URL from.
  allowedOrigins: string[];
  removalPolicy: RemovalPolicy;
}

// Where uploaded files live. Nothing here ever reads or writes an object
// itself: the API hands out presigned PUT and GET URLs, for the browser to
// upload to and show images from this bucket directly. Only the PUT needs
// CORS; an <img> loads cross-origin without it.
export class FilesBucket extends Construct {
  readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: FilesBucketProps) {
    super(scope, id);

    this.bucket = new s3.Bucket(this, "Bucket", {
      removalPolicy: props.removalPolicy,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: props.allowedOrigins,
          allowedHeaders: ["*"],
          maxAge: 3000,
        },
      ],
    });
  }
}
