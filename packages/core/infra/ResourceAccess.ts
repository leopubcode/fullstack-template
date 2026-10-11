import type * as iam from "aws-cdk-lib/aws-iam";
import type * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

// One way of using a resource: the env vars core's config reads to find it,
// and the IAM rights that use needs.
export interface Access {
  env: Record<string, string>;
  grant(grantee: iam.IGrantable): void;
}

export interface ResourceAccessProps {
  function: lambda.Function;
  accesses: Access[];
}

// The one place a Lambda is coupled to the resources it uses. Neither the
// function's construct nor the resources' know about each other.
export class ResourceAccess extends Construct {
  constructor(scope: Construct, id: string, props: ResourceAccessProps) {
    super(scope, id);

    for (const access of props.accesses) {
      for (const [name, value] of Object.entries(access.env)) {
        props.function.addEnvironment(name, value);
      }
      access.grant(props.function);
    }
  }
}
