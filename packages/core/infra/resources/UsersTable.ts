import type { RemovalPolicy } from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export interface UsersTableProps {
  removalPolicy: RemovalPolicy;
}

// The table DynamoUsersRepository reads and writes, keyed by the user's id.
export class UsersTable extends Construct {
  readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: UsersTableProps) {
    super(scope, id);

    this.table = new dynamodb.Table(this, "Table", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: props.removalPolicy,
    });
  }
}
